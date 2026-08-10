import { createHash } from "crypto";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { acceptInviteSchema } from "@/lib/validations";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit, AUDIT_ACTIONS } from "@/server/audit";
import { captureError } from "@/lib/monitoring";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const limit = await rateLimit(`invite-accept:${user.id}`, 10, 60_000);
    if (!limit.allowed) return rateLimitResponse();

    const body = await request.json();
    const parsed = acceptInviteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid invite token" }, { status: 400 });
    }

    const hashedToken = createHash("sha256").update(parsed.data.token).digest("hex");
    const invite = await prisma.organizationInvite.findUnique({
      where: { token: hashedToken },
      include: { organization: { select: { id: true, name: true } } },
    });

    if (!invite) {
      return Response.json({ error: "This invite link is not valid." }, { status: 404 });
    }

    if (invite.expires < new Date()) {
      await prisma.organizationInvite.delete({ where: { id: invite.id } });
      return Response.json(
        { error: "This invite has expired. Ask for a new one." },
        { status: 410 },
      );
    }

    // The invite is issued to a specific address, so holding the link isn't
    // enough - the signed-in account has to be that person. Without this,
    // a forwarded or leaked link would let anyone into the organization.
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return Response.json(
        { error: `This invite was sent to ${invite.email}. Sign in as that user to accept it.` },
        { status: 403 },
      );
    }

    const existing = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: invite.organizationId } },
    });

    if (existing) {
      await prisma.organizationInvite.delete({ where: { id: invite.id } });
      return Response.json({ ok: true, organizationName: invite.organization.name });
    }

    // Consume the invite in the same transaction that grants access, so a
    // failure can't leave a used link still redeemable.
    await prisma.$transaction([
      prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: invite.organizationId,
          role: invite.role,
        },
      }),
      prisma.organizationInvite.delete({ where: { id: invite.id } }),
    ]);

    await logAudit({
      userId: user.id,
      organizationId: invite.organizationId,
      action: AUDIT_ACTIONS.memberJoin,
      entityType: "Organization",
      entityId: invite.organizationId,
      metadata: { email: user.email, role: invite.role },
    });

    return Response.json({ ok: true, organizationName: invite.organization.name });
  } catch (error) {
    console.error("INVITE ACCEPT ERROR:", error);
    captureError(error, { route: "organization/invites/accept" });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
