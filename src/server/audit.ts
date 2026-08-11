import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { captureError } from "@/lib/monitoring";

export const AUDIT_ACTIONS = {
  documentUpload: "document.upload",
  documentDelete: "document.delete",
  requirementUpdate: "requirement.update",
  requirementDelete: "requirement.delete",
  proposalSectionEdit: "proposal_section.edit",
  proposalGenerate: "proposal.generate",
  proposalRewrite: "proposal.rewrite",
  proposalDraftAssistant: "proposal.draft_assistant",
  exportCreate: "export.create",
  paymentSuccess: "payment.success",
  memberInvite: "member.invite",
  memberInviteRevoke: "member.invite_revoke",
  memberJoin: "member.join",
  memberRoleUpdate: "member.role_update",
  memberRemove: "member.remove",
  organizationCreate: "organization.create",
  organizationRename: "organization.rename",
  organizationProfileUpdate: "organization.profile_update",
  // No organization.delete: AuditLog.organizationId cascades, so deleting an
  // organization removes its own audit trail in the same transaction - the
  // entry could never be read back.
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

type LogAuditInput = {
  userId: string;
  organizationId: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

// Best-effort: swallows its own errors so a logging failure can never break
// the action it's recording - but callers should still `await` it. This
// deploys to Vercel, where a serverless function can be frozen or torn down
// right after it returns a response, so a genuinely fire-and-forget call
// here risks the write silently never happening.
export async function logAudit(input: LogAuditInput, prismaClient?: typeof prisma) {
  const db = prismaClient ?? prisma;

  try {
    await db.auditLog.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    captureError(error, { route: "audit-log", action: input.action });
  }
}
