import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { captureError } from "@/lib/monitoring";
import { rateLimit } from "@/lib/rate-limit";
import {
  COMMENT_BODY_MAX,
  createSectionComment,
  listSectionComments,
  sectionInOrganization,
} from "@/server/section-comments";
import { unauthorized } from "@/server/responses";
import { requireApiUser } from "@/server/session";

const createSchema = z.object({
  body: z.string().trim().min(1).max(COMMENT_BODY_MAX),
  parentId: z.string().trim().min(1).nullish(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ sectionId: string }> },
) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { sectionId } = await context.params;
    const section = await sectionInOrganization({
      sectionId,
      organizationId: user.organizationId,
    });
    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    return NextResponse.json({ threads: await listSectionComments({ sectionId }) });
  } catch (error) {
    captureError(error, { route: "section-comments:GET" });
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sectionId: string }> },
) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { allowed } = await rateLimit(user.id);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const { sectionId } = await context.params;
    const section = await sectionInOrganization({
      sectionId,
      organizationId: user.organizationId,
    });
    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const input = createSchema.parse(await req.json());
    const comment = await createSectionComment({
      sectionId,
      projectId: section.projectId,
      authorId: user.id,
      body: input.body,
      parentId: input.parentId ?? null,
    });

    if (!comment) {
      return NextResponse.json(
        { error: "Could not post this comment" },
        { status: 400 },
      );
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 },
      );
    }
    captureError(error, { route: "section-comments:POST" });
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}
