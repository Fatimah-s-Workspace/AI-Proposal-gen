import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { captureError } from "@/lib/monitoring";
import { AUDIT_ACTIONS, logAudit } from "@/server/audit";
import {
  LIBRARY_CONTENT_MAX,
  LIBRARY_TAGS_MAX,
  LIBRARY_TITLE_MAX,
  deleteLibraryEntry,
  getLibraryEntry,
  updateLibraryEntry,
} from "@/server/content-library";
import { canDeleteLibraryEntries } from "@/server/permissions";
import { unauthorized } from "@/server/responses";
import { requireApiUser } from "@/server/session";

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(LIBRARY_TITLE_MAX).optional(),
    content: z.string().trim().min(1).max(LIBRARY_CONTENT_MAX).optional(),
    sectionType: z.string().trim().max(120).nullish(),
    tags: z.array(z.string().trim().min(1)).max(LIBRARY_TAGS_MAX).optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No changes supplied",
  });

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ entryId: string }> },
) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { entryId } = await context.params;
    const entry = await getLibraryEntry({
      organizationId: user.organizationId,
      entryId,
    });
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ entry });
  } catch (error) {
    captureError(error, { route: "content-library-entry:GET" });
    return NextResponse.json({ error: "Failed to load entry" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ entryId: string }> },
) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { entryId } = await context.params;
    const input = updateSchema.parse(await req.json());

    const entry = await updateLibraryEntry({
      organizationId: user.organizationId,
      entryId,
      ...input,
      sectionType: input.sectionType === undefined ? undefined : input.sectionType ?? null,
    });
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await logAudit({
      userId: user.id,
      organizationId: user.organizationId,
      action: AUDIT_ACTIONS.libraryEntryUpdate,
      entityType: "content_library_entry",
      entityId: entry.id,
      metadata: { fields: Object.keys(input) },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 },
      );
    }
    // Editing one entry's text into an exact copy of another's hits the same
    // constraint that stops duplicates being created. Saying so is more use
    // than a 500.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Another entry in this workspace already has this exact text" },
        { status: 409 },
      );
    }
    captureError(error, { route: "content-library-entry:PATCH" });
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ entryId: string }> },
) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    if (!canDeleteLibraryEntries(user.organizationRole)) {
      return NextResponse.json(
        { error: "Only owners and admins can delete library entries. Archive it instead." },
        { status: 403 },
      );
    }

    const { entryId } = await context.params;
    const deleted = await deleteLibraryEntry({
      organizationId: user.organizationId,
      entryId,
    });
    if (!deleted) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await logAudit({
      userId: user.id,
      organizationId: user.organizationId,
      action: AUDIT_ACTIONS.libraryEntryDelete,
      entityType: "content_library_entry",
      entityId: entryId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    captureError(error, { route: "content-library-entry:DELETE" });
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
