import { createHash } from "crypto";
import { prisma } from "@/server/db";

// Invite links are `/invite/<token>`, and that's what the sign-in/sign-up
// pages receive as ?callbackUrl= when someone arrives from one.
const INVITE_CALLBACK = /^\/invite\/([a-f0-9]{16,})\/?$/;

export type PendingInvite = {
  email: string;
  organizationName: string;
};

/**
 * Resolves which invite (if any) a visitor is trying to accept, from the
 * callbackUrl they arrived with.
 *
 * The email comes out of the invite row rather than the URL on purpose: it
 * keeps a real address out of query strings, logs, and Referer headers, and
 * it means a hand-edited link can't seed an arbitrary email into the form.
 * An unknown or expired token resolves to null, so the caller just renders
 * the ordinary form.
 */
export async function pendingInviteFromCallback(
  callbackUrl?: string | null,
): Promise<PendingInvite | null> {
  if (!callbackUrl) return null;

  const match = INVITE_CALLBACK.exec(callbackUrl);
  if (!match) return null;

  const invite = await prisma.organizationInvite.findUnique({
    where: { token: createHash("sha256").update(match[1]).digest("hex") },
    select: {
      email: true,
      expires: true,
      organization: { select: { name: true } },
    },
  });

  if (!invite || invite.expires < new Date()) return null;

  return { email: invite.email, organizationName: invite.organization.name };
}
