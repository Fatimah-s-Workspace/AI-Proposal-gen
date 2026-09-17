import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { captureError } from "@/lib/monitoring";
import { canDeleteProjects } from "@/server/permissions";
import { unauthorized } from "@/server/responses";
import {
  deleteSectionComment,
  sectionInOrganization,
  setCommentResolved,
} from "@/server/section-comments";
import { requireApiUser } from "@/server/session";

const patchSchema = z.object({ resolved: z.boolean() });

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ sectionId: string; commentId: string }> },
) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { sectionId, commentId } = await context.params;
    const section = await sectionInOrganization({
      sectionId,
      organizationId: user.organizationId,
    });
    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const { resolved } = patchSchema.parse(await req.json());
    const comment = await setCommentResolved({
      commentId,
      sectionId,
      userId: user.id,
      resolved,
    });
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    return NextResponse.json({ comment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 },
      );
    }
    captureError(error, { route: "section-comment:PATCH" });
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ sectionId: string; commentId: string }> },
) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { sectionId, commentId } = await context.params;
    const section = await sectionInOrganization({
      sectionId,
      organizationId: user.organizationId,
    });
    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const deleted = await deleteSectionComment({
      commentId,
      sectionId,
      userId: user.id,
      canModerate: canDeleteProjects(user.organizationRole),
    });
    if (!deleted) {
      // Someone else's comment reads as not found rather than forbidden: the
      // distinction would confirm a comment exists to a person who may not
      // be meant to act on it, and the remedy is the same either way.
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    captureError(error, { route: "section-comment:DELETE" });
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
