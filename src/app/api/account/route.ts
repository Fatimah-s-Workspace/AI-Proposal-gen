import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { requireApiUser, ACTIVE_ORG_COOKIE } from "@/server/session";
import { deleteAccountSchema } from "@/lib/validations";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { deleteStoredFile } from "@/lib/storage";
import { captureError } from "@/lib/monitoring";
import { unauthorized, serverError } from "@/server/responses";

// What deleting an account does to each workspace the user belongs to:
//
//   sole member                -> the workspace goes with them; nobody else
//                                 can reach it, so leaving it behind would
//                                 just be an unreachable row plus orphaned
//                                 files in object storage.
//   sole owner, others present -> blocked. Deleting would strand the
//                                 remaining members in a workspace with
//                                 nobody able to manage billing or the team.
//                                 They must hand ownership over first.
//   others also own it         -> only their membership goes; the workspace
//                                 and its work carry on without them.
export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const limit = await rateLimit(`account-delete:${user.id}`, 5, 60 * 60_000);
    if (!limit.allowed) return rateLimitResponse();

    const body = await request.json().catch(() => null);
    const parsed = deleteAccountSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Confirm your email address" }, { status: 400 });
    }

    // Typing the address is the guard against a reflexive click, and it also
    // means a hijacked session can't wipe an account without knowing it.
    if (parsed.data.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      return Response.json(
        { error: "That doesn't match the email on this account." },
        { status: 400 },
      );
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            _count: { select: { memberships: true } },
          },
        },
      },
    });

    const organizationIdsToDelete: string[] = [];
    const blockedBy: string[] = [];

    for (const membership of memberships) {
      const memberCount = membership.organization._count.memberships;

      if (memberCount === 1) {
        organizationIdsToDelete.push(membership.organizationId);
        continue;
      }

      if (membership.role === "owner") {
        const ownerCount = await prisma.membership.count({
          where: { organizationId: membership.organizationId, role: "owner" },
        });
        if (ownerCount === 1) blockedBy.push(membership.organization.name);
      }
    }

    if (blockedBy.length) {
      return Response.json(
        {
          error:
            "You're the only owner of a workspace that still has other members. Make someone else an owner first, or delete the workspace.",
          workspaces: blockedBy,
        },
        { status: 409 },
      );
    }

    // Rows cascade, but the files behind them live in object storage and
    // would be left behind. Two sources: everything inside workspaces being
    // deleted, and this user's own export records in workspaces that
    // survive (ExportHistory cascades on user delete).
    const [doomedProjects, ownExports] = await Promise.all([
      prisma.project.findMany({
        where: { organizationId: { in: organizationIdsToDelete } },
        include: { documents: true, exports: true },
      }),
      prisma.exportHistory.findMany({
        where: { userId: user.id, project: { organizationId: { notIn: organizationIdsToDelete } } },
      }),
    ]);

    await Promise.all([
      ...doomedProjects.flatMap((project) => [
        ...project.documents.map((document) =>
          deleteStoredFile("uploads", document.storagePath),
        ),
        ...project.exports.map((record) => deleteStoredFile("exports", record.filePath)),
      ]),
      ...ownExports.map((record) => deleteStoredFile("exports", record.filePath)),
    ]);

    await prisma.$transaction([
      prisma.organization.deleteMany({ where: { id: { in: organizationIdsToDelete } } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    // The session cookie is cleared client-side by signOut(); this one is
    // ours and points at a workspace that may no longer exist.
    (await cookies()).delete(ACTIVE_ORG_COOKIE);

    return Response.json({ ok: true, deletedWorkspaces: organizationIdsToDelete.length });
  } catch (error) {
    console.error("ACCOUNT DELETE ERROR:", error);
    captureError(error, { route: "account/delete" });
    return serverError();
  }
}
