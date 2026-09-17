import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import {
  matchLibraryEntries,
  type LibraryMatch,
  type SectionNeed,
} from "@/features/content-library/matching";

export const LIBRARY_TITLE_MAX = 160;
export const LIBRARY_CONTENT_MAX = 20_000;
export const LIBRARY_TAG_MAX = 40;
export const LIBRARY_TAGS_MAX = 12;

/**
 * How many entries a suggestion pass will consider.
 *
 * Matching runs in process over the workspace's entries, which is fine at the
 * size a bidder's library actually reaches. The cap exists so that a workspace
 * that has grown beyond that cannot turn one section draft into a query that
 * loads megabytes of text. Ordering by proven use means the cap falls on the
 * entries nobody has reached for, which is the right place for it to fall.
 */
const SUGGESTION_CANDIDATE_LIMIT = 500;

export type LibraryEntry = Prisma.ContentLibraryEntryGetPayload<{
  include: { createdBy: { select: { id: true; name: true; email: true } } };
}>;

const withAuthor = {
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ContentLibraryEntryInclude;

/** Normalised form used to spot an entry that is already in the library. */
export function contentFingerprint(content: string): string {
  return content.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normaliseTags(tags: readonly string[] | undefined | null): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().slice(0, LIBRARY_TAG_MAX);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
    if (result.length >= LIBRARY_TAGS_MAX) break;
  }
  return result;
}

/**
 * The unique-constraint violation, recognised without importing Prisma's error
 * classes - they are a runtime export, and this module is imported by tests
 * that run without a generated client.
 */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function listLibraryEntries(
  input: {
    organizationId: string;
    search?: string;
    sectionType?: string | null;
    includeArchived?: boolean;
  },
  prismaClient: typeof prisma = prisma,
): Promise<LibraryEntry[]> {
  const where: Prisma.ContentLibraryEntryWhereInput = {
    organizationId: input.organizationId,
  };

  if (!input.includeArchived) where.archivedAt = null;
  if (input.sectionType) where.sectionType = input.sectionType;

  const search = input.search?.trim();
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
      { tags: { has: search.toLowerCase() } },
    ];
  }

  return prismaClient.contentLibraryEntry.findMany({
    where,
    include: withAuthor,
    // Most-used first: the library's value is concentrated in a handful of
    // answers, and those are the ones a person is usually coming back for.
    orderBy: [{ timesUsed: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getLibraryEntry(
  input: { organizationId: string; entryId: string },
  prismaClient: typeof prisma = prisma,
): Promise<LibraryEntry | null> {
  return prismaClient.contentLibraryEntry.findFirst({
    where: { id: input.entryId, organizationId: input.organizationId },
    include: withAuthor,
  });
}

export type CreateLibraryEntryResult =
  | { entry: LibraryEntry; duplicateOf: null }
  /**
   * The same text is already saved. Returning the existing entry rather than
   * an error keeps "Save to library" idempotent: clicking it twice, or saving
   * a section that was itself inserted from the library, should leave one
   * entry and say so - not fill the library with copies of its own contents.
   */
  | { entry: LibraryEntry; duplicateOf: LibraryEntry };

export async function createLibraryEntry(
  input: {
    organizationId: string;
    title: string;
    content: string;
    sectionType?: string | null;
    tags?: string[];
    sourceProjectId?: string | null;
    sourceSectionId?: string | null;
    createdById?: string | null;
  },
  prismaClient: typeof prisma = prisma,
): Promise<CreateLibraryEntryResult> {
  const title = input.title.trim().slice(0, LIBRARY_TITLE_MAX);
  const content = input.content.trim().slice(0, LIBRARY_CONTENT_MAX);

  const fingerprint = contentFingerprint(content);

  try {
    const entry = await prismaClient.contentLibraryEntry.create({
      data: {
        organizationId: input.organizationId,
        title,
        content,
        fingerprint,
        sectionType: input.sectionType ?? null,
        tags: normaliseTags(input.tags),
        sourceProjectId: input.sourceProjectId ?? null,
        sourceSectionId: input.sourceSectionId ?? null,
        createdById: input.createdById ?? null,
      },
      include: withAuthor,
    });
    return { entry, duplicateOf: null };
  } catch (error) {
    // Attempt the insert and let the unique constraint answer, rather than
    // asking first. Asking first reads every entry to compare text, and two
    // saves a few milliseconds apart both pass the check - which is exactly
    // what a double-clicked button does.
    if (!isUniqueConstraintError(error)) throw error;

    const duplicate = await prismaClient.contentLibraryEntry.findFirst({
      where: { organizationId: input.organizationId, fingerprint },
      include: withAuthor,
    });
    // The constraint fired, so a row with this fingerprint existed a moment
    // ago. If it is gone now something deleted it in between; the caller
    // asked to save this text, so let the original error surface rather than
    // silently reporting a duplicate that no longer exists.
    if (!duplicate) throw error;
    return { entry: duplicate, duplicateOf: duplicate };
  }
}

export async function updateLibraryEntry(
  input: {
    organizationId: string;
    entryId: string;
    title?: string;
    content?: string;
    sectionType?: string | null;
    tags?: string[];
    archived?: boolean;
  },
  prismaClient: typeof prisma = prisma,
): Promise<LibraryEntry | null> {
  const existing = await prismaClient.contentLibraryEntry.findFirst({
    where: { id: input.entryId, organizationId: input.organizationId },
    select: { id: true },
  });
  if (!existing) return null;

  const data: Prisma.ContentLibraryEntryUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim().slice(0, LIBRARY_TITLE_MAX);
  if (input.content !== undefined) {
    const content = input.content.trim().slice(0, LIBRARY_CONTENT_MAX);
    data.content = content;
    // A fingerprint that no longer describes the content would let an edit
    // reintroduce the duplicate the constraint exists to prevent.
    data.fingerprint = contentFingerprint(content);
  }
  if (input.sectionType !== undefined) data.sectionType = input.sectionType;
  if (input.tags !== undefined) data.tags = normaliseTags(input.tags);
  if (input.archived !== undefined) data.archivedAt = input.archived ? new Date() : null;

  return prismaClient.contentLibraryEntry.update({
    where: { id: existing.id },
    data,
    include: withAuthor,
  });
}

export async function deleteLibraryEntry(
  input: { organizationId: string; entryId: string },
  prismaClient: typeof prisma = prisma,
): Promise<boolean> {
  const result = await prismaClient.contentLibraryEntry.deleteMany({
    where: { id: input.entryId, organizationId: input.organizationId },
  });
  return result.count > 0;
}

/**
 * The saved answers worth offering for a section.
 *
 * Archived entries are excluded here rather than filtered afterwards: an
 * archived entry is one someone decided should stop being suggested, and the
 * suggestion path is the only place that decision has any effect.
 */
export async function suggestLibraryEntries(
  input: {
    organizationId: string;
    need: SectionNeed;
    limit?: number;
    minScore?: number;
  },
  prismaClient: typeof prisma = prisma,
): Promise<Array<LibraryMatch<LibraryEntry>>> {
  const candidates = await prismaClient.contentLibraryEntry.findMany({
    where: { organizationId: input.organizationId, archivedAt: null },
    include: withAuthor,
    orderBy: [{ timesUsed: "desc" }, { updatedAt: "desc" }],
    take: SUGGESTION_CANDIDATE_LIMIT,
  });

  return matchLibraryEntries(candidates, input.need, {
    limit: input.limit,
    minScore: input.minScore,
  });
}

/**
 * Record that entries were actually used in a draft.
 *
 * Deliberately not called when suggestions are merely shown. The count is the
 * only evidence a bidder has for which saved answers earn their place, and a
 * number inflated by impressions would make every entry look valuable and the
 * signal worthless.
 */
export async function recordLibraryUsage(
  input: { organizationId: string; entryIds: readonly string[] },
  prismaClient: typeof prisma = prisma,
): Promise<number> {
  const entryIds = Array.from(new Set(input.entryIds)).filter(Boolean);
  if (entryIds.length === 0) return 0;

  const result = await prismaClient.contentLibraryEntry.updateMany({
    where: { id: { in: entryIds }, organizationId: input.organizationId },
    data: { timesUsed: { increment: 1 }, lastUsedAt: new Date() },
  });
  return result.count;
}
