import { NextRequest, NextResponse } from "next/server";

import { describeMatch } from "@/features/content-library/matching";
import { captureError } from "@/lib/monitoring";
import { suggestLibraryEntries } from "@/server/content-library";
import { prisma } from "@/server/db";
import { unauthorized } from "@/server/responses";
import { requireApiUser } from "@/server/session";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string; sectionId: string }> },
) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { projectId, sectionId } = await context.params;

    const section = await prisma.proposalSection.findFirst({
      where: {
        id: sectionId,
        projectId,
        project: { organizationId: user.organizationId },
      },
      select: { id: true, title: true, sectionType: true },
    });
    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Requirements are what the section actually has to answer, so they carry
    // more of the section's meaning than its title does - "Technical
    // approach" on its own matches almost nothing.
    const requirements = await prisma.requirement.findMany({
      where: { projectId },
      select: { title: true, description: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      take: 30,
    });

    const matches = await suggestLibraryEntries({
      organizationId: user.organizationId,
      need: {
        title: section.title,
        sectionType: section.sectionType,
        requirements,
      },
    });

    return NextResponse.json({
      suggestions: matches.map((match) => ({
        id: match.entry.id,
        title: match.entry.title,
        content: match.entry.content,
        sectionType: match.entry.sectionType,
        tags: match.entry.tags,
        timesUsed: match.entry.timesUsed,
        score: Number(match.score.toFixed(3)),
        reason: describeMatch(match),
      })),
    });
  } catch (error) {
    captureError(error, { route: "library-suggestions:GET" });
    return NextResponse.json(
      { error: "Failed to load suggestions" },
      { status: 500 },
    );
  }
}
