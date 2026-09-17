import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";

export const COMMENT_BODY_MAX = 4_000;

const withPeople = {
  author: { select: { id: true, name: true, email: true } },
  resolvedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.SectionCommentInclude;

export type SectionCommentRecord = Prisma.SectionCommentGetPayload<{
  include: typeof withPeople;
}>;

export interface CommentThread {
  comment: SectionCommentRecord;
  replies: SectionCommentRecord[];
}

/**
 * Confirm the section belongs to this workspace before anything else touches
 * it. Every entry point here takes a sectionId from the client, so this is
 * the single gate between one customer's bid and another's.
 */
export async function sectionInOrganization(
  input: { sectionId: string; organizationId: string },
  prismaClient: typeof prisma = prisma,
): Promise<{ id: string; projectId: string } | null> {
  return prismaClient.proposalSection.findFirst({
    where: {
      id: input.sectionId,
      project: { organizationId: input.organizationId },
    },
    select: { id: true, projectId: true },
  });
}

/**
 * Threads for a section, oldest first, each with its replies.
 *
 * Grouped here rather than in the client so that a reply whose parent has
 * been deleted cannot vanish silently - the parent cascade removes replies
 * with it, so an orphan means something is wrong and should be visible.
 */
export async function listSectionComments(
  input: { sectionId: string },
  prismaClient: typeof prisma = prisma,
): Promise<CommentThread[]> {
  const comments = await prismaClient.sectionComment.findMany({
    where: { sectionId: input.sectionId },
    include: withPeople,
    orderBy: { createdAt: "asc" },
  });

  const threads = new Map<string, CommentThread>();
  for (const comment of comments) {
    if (!comment.parentId) threads.set(comment.id, { comment, replies: [] });
  }
  for (const comment of comments) {
    if (!comment.parentId) continue;
    threads.get(comment.parentId)?.replies.push(comment);
  }

  return Array.from(threads.values());
}

export async function createSectionComment(
  input: {
    sectionId: string;
    projectId: string;
    authorId: string;
    body: string;
    parentId?: string | null;
  },
  prismaClient: typeof prisma = prisma,
): Promise<SectionCommentRecord | null> {
  const body = input.body.trim().slice(0, COMMENT_BODY_MAX);
  if (!body) return null;

  let parentId: string | null = null;
  if (input.parentId) {
    const parent = await prismaClient.sectionComment.findFirst({
      where: { id: input.parentId, sectionId: input.sectionId },
      select: { id: true, parentId: true },
    });
    if (!parent) return null;
    // Replying to a reply attaches to the thread it belongs to. A deep tree
    // is unreadable at the speed a bid review actually happens.
    parentId = parent.parentId ?? parent.id;
  }

  return prismaClient.sectionComment.create({
    data: {
      sectionId: input.sectionId,
      projectId: input.projectId,
      authorId: input.authorId,
      body,
      parentId,
    },
    include: withPeople,
  });
}

/**
 * Resolve or reopen a thread.
 *
 * Only the thread root carries the state: resolving a reply on its own would
 * let a thread be half-settled, which tells a reviewer under deadline nothing
 * useful about whether the point was dealt with.
 */
export async function setCommentResolved(
  input: {
    commentId: string;
    sectionId: string;
    userId: string;
    resolved: boolean;
  },
  prismaClient: typeof prisma = prisma,
): Promise<SectionCommentRecord | null> {
  const comment = await prismaClient.sectionComment.findFirst({
    where: { id: input.commentId, sectionId: input.sectionId },
    select: { id: true, parentId: true },
  });
  if (!comment) return null;

  const rootId = comment.parentId ?? comment.id;

  return prismaClient.sectionComment.update({
    where: { id: rootId },
    data: {
      resolvedAt: input.resolved ? new Date() : null,
      resolvedById: input.resolved ? input.userId : null,
    },
    include: withPeople,
  });
}

export async function deleteSectionComment(
  input: { commentId: string; sectionId: string; userId: string; canModerate: boolean },
  prismaClient: typeof prisma = prisma,
): Promise<boolean> {
  const comment = await prismaClient.sectionComment.findFirst({
    where: { id: input.commentId, sectionId: input.sectionId },
    select: { id: true, authorId: true },
  });
  if (!comment) return false;

  // Your own words, or an owner or admin clearing something up. A reviewer
  // must not be able to delete the objection someone else raised on a bid.
  if (comment.authorId !== input.userId && !input.canModerate) return false;

  await prismaClient.sectionComment.delete({ where: { id: comment.id } });
  return true;
}

/** Unresolved thread counts per section, for the section list. */
export async function openCommentCounts(
  input: { projectId: string },
  prismaClient: typeof prisma = prisma,
): Promise<Record<string, number>> {
  const rows = await prismaClient.sectionComment.groupBy({
    by: ["sectionId"],
    where: { projectId: input.projectId, parentId: null, resolvedAt: null },
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.sectionId] = row._count._all;
  return counts;
}
