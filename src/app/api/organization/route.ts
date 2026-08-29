import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { requireApiUser, ACTIVE_ORG_COOKIE } from "@/server/session";
import { createOrganizationSchema } from "@/lib/validations";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { slugifyOrganizationName } from "@/lib/utils";
import { logAudit, AUDIT_ACTIONS } from "@/server/audit";
import { captureError } from "@/lib/monitoring";
import { unauthorized, serverError } from "@/server/responses";

// A soft cap so a single account can't spray workspaces (each one carries a
// subscription row and its own usage bucket). Well clear of what a real
// consultant juggling client workspaces would need.
const MAX_ORGANIZATIONS_PER_USER = 10;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const limit = await rateLimit(`org-create:${user.id}`, 5, 60 * 60_000);
    if (!limit.allowed) return rateLimitResponse();

    const body = await request.json();
    const parsed = createOrganizationSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Enter a workspace name", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const existingCount = await prisma.membership.count({ where: { userId: user.id } });
    if (existingCount >= MAX_ORGANIZATIONS_PER_USER) {
      return Response.json(
        { error: `You can belong to at most ${MAX_ORGANIZATIONS_PER_USER} workspaces.` },
        { status: 409 },
      );
    }

    const name = parsed.data.name;

    // Mirrors what signup creates for a personal workspace, so a workspace
    // made here is indistinguishable from the one you get on day one.
    const organization = await prisma.organization.create({
      data: {
        name,
        slug: slugifyOrganizationName(name),
        memberships: { create: { userId: user.id, role: "owner" } },
        subscription: { create: { plan: "starter", status: "trialing" } },
        usageTracking: { create: { period: new Date().toISOString().slice(0, 7) } },
      },
    });

    await logAudit({
      userId: user.id,
      organizationId: organization.id,
      action: AUDIT_ACTIONS.organizationCreate,
      entityType: "Organization",
      entityId: organization.id,
      metadata: { name },
    });

    // You just made it, so make it active - otherwise the switcher would
    // still be pointing at the old workspace right after creating one.
    (await cookies()).set(ACTIVE_ORG_COOKIE, organization.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
    });

    return Response.json(
      { ok: true, organizationId: organization.id, name: organization.name },
      { status: 201 },
    );
  } catch (error) {
    console.error("ORGANIZATION CREATE ERROR:", error);
    captureError(error, { route: "organization/create" });
    return serverError();
  }
}
