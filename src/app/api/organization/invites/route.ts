import { randomBytes, createHash } from "crypto";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { canManageMembers } from "@/server/permissions";
import { inviteMemberSchema } from "@/lib/validations";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { teamInviteEmail } from "@/lib/email/templates";
import { logAudit, AUDIT_ACTIONS } from "@/server/audit";
import { captureError } from "@/lib/monitoring";

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMembers(user.organizationRole)) {
    return Response.json({ error: "Only owners and admins can view invites" }, { status: 403 });
  }

  const invites = await prisma.organizationInvite.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, expires: true, createdAt: true },
  });

  return Response.json({ invites });
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageMembers(user.organizationRole)) {
      return Response.json({ error: "Only owners and admins can invite members" }, { status: 403 });
    }

    const limit = await rateLimit(`org-invite:${user.organizationId}`, 20, 60 * 60_000);
    if (!limit.allowed) return rateLimitResponse();

    const body = await request.json();
    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Enter a valid email", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();

    const existingMember = await prisma.membership.findFirst({
      where: { organizationId: user.organizationId, user: { email } },
    });
    if (existingMember) {
      return Response.json(
        { error: "That person is already a member of this team." },
        { status: 409 },
      );
    }

    // One active invite per (org, email) - mirrors the password-reset
    // token's "delete any existing then create fresh" idiom, so re-inviting
    // someone (e.g. after their link expired) just works.
    await prisma.organizationInvite.deleteMany({
      where: { organizationId: user.organizationId, email },
    });

    const rawToken = randomBytes(32).toString("hex");
    const hashedToken = createHash("sha256").update(rawToken).digest("hex");

    await prisma.organizationInvite.create({
      data: {
        organizationId: user.organizationId,
        email,
        role: parsed.data.role,
        token: hashedToken,
        invitedByUserId: user.id,
        expires: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${baseUrl}/invite/${rawToken}`;

    const { subject, text, html } = teamInviteEmail(
      user.name ?? user.email,
      user.organization.name,
      inviteUrl,
    );
    const delivery = await sendEmail({ to: email, subject, text, html });

    await logAudit({
      userId: user.id,
      organizationId: user.organizationId,
      action: AUDIT_ACTIONS.memberInvite,
      entityType: "OrganizationInvite",
      metadata: { email, role: parsed.data.role, emailDelivered: delivery.delivered },
    });

    // The invite is valid whether or not the email got out, so this is a
    // 201 either way - but the caller needs to know delivery failed so it
    // can offer the link directly instead of claiming an email was sent.
    // Returning the raw link to the inviter is safe: they just created it,
    // it's scoped to their own org, and they'd have it from the email too.
    return Response.json(
      {
        ok: true,
        emailDelivered: delivery.delivered,
        emailFailureReason: delivery.delivered ? null : delivery.reason,
        inviteUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("ORG INVITE ERROR:", error);
    captureError(error, { route: "organization/invites" });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
