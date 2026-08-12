import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireApiUser, ACTIVE_ORG_COOKIE } from "@/server/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const switchOrganizationSchema = z.object({
  organizationId: z.string().min(1, "An organization is required"),
});

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await rateLimit(`org:switch:${user.id}`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const body = await request.json();
  const parsed = switchOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid organization" }, { status: 400 });
  }

  // Setting the cookie without this check would let anyone switch into any
  // organization by id, since the cookie is what later requests trust.
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId: user.id, organizationId: parsed.data.organizationId },
    },
  });

  if (!membership) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  (await cookies()).set(ACTIVE_ORG_COOKIE, parsed.data.organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });

  return Response.json({ ok: true });
}
