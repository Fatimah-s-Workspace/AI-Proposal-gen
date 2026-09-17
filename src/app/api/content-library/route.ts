import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { captureError } from "@/lib/monitoring";
import { rateLimit } from "@/lib/rate-limit";
import { AUDIT_ACTIONS, logAudit } from "@/server/audit";
import {
  LIBRARY_CONTENT_MAX,
  LIBRARY_TAGS_MAX,
  LIBRARY_TITLE_MAX,
  createLibraryEntry,
  listLibraryEntries,
} from "@/server/content-library";
import { prisma } from "@/server/db";
import { unauthorized } from "@/server/responses";
import { requireApiUser } from "@/server/session";

const createSchema = z.object({
  title: z.string().trim().min(1).max(LIBRARY_TITLE_MAX),
  content: z.string().trim().min(1).max(LIBRARY_CONTENT_MAX),
  sectionType: z.string().trim().max(120).nullish(),
  tags: z.array(z.string().trim().min(1)).max(LIBRARY_TAGS_MAX).optional(),
  sourceProjectId: z.string().trim().min(1).nullish(),
  sourceSectionId: z.string().trim().min(1).nullish(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const params = req.nextUrl.searchParams;
    const entries = await listLibraryEntries({
      organizationId: user.organizationId,
      search: params.get("search") ?? undefined,
      sectionType: params.get("sectionType") ?? undefined,
      includeArchived: params.get("includeArchived") === "true",
    });

    return NextResponse.json({ entries });
  } catch (error) {
    captureError(error, { route: "content-library:GET" });
    return NextResponse.json(
      { error: "Failed to load the content library" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { allowed } = await rateLimit(user.id);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const input = createSchema.parse(await req.json());

    // A source project must belong to this workspace. Without the check, a
    // valid id from another organization would be stored as provenance on
    // this one's entry, quietly linking two customers' records together.
    if (input.sourceProjectId) {
      const project = await prisma.project.findFirst({
        where: { id: input.sourceProjectId, organizationId: user.organizationId },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json(
          { error: "Source project not found" },
          { status: 404 },
        );
      }
    }

    if (input.sourceSectionId) {
      const section = await prisma.proposalSection.findFirst({
        where: {
          id: input.sourceSectionId,
          project: { organizationId: user.organizationId },
        },
        select: { id: true },
      });
      if (!section) {
        return NextResponse.json(
          { error: "Source section not found" },
          { status: 404 },
        );
      }
    }

    const result = await createLibraryEntry({
      organizationId: user.organizationId,
      title: input.title,
      content: input.content,
      sectionType: input.sectionType ?? null,
      tags: input.tags,
      sourceProjectId: input.sourceProjectId ?? null,
      sourceSectionId: input.sourceSectionId ?? null,
      createdById: user.id,
    });

    if (!result.duplicateOf) {
      await logAudit({
        userId: user.id,
        organizationId: user.organizationId,
        action: AUDIT_ACTIONS.libraryEntryCreate,
        entityType: "content_library_entry",
        entityId: result.entry.id,
        metadata: { title: result.entry.title },
      });
    }

    // 200 rather than 201 when it was already there, so the client can tell
    // "saved" from "you already have this" and say so.
    return NextResponse.json(
      { entry: result.entry, duplicate: Boolean(result.duplicateOf) },
      { status: result.duplicateOf ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 },
      );
    }
    captureError(error, { route: "content-library:POST" });
    return NextResponse.json(
      { error: "Failed to save to the content library" },
      { status: 500 },
    );
  }
}
