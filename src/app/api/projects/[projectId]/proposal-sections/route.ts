import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/monitoring";

const createSectionSchema = z.object({
  title: z.string().min(1),
  sectionType: z.string().min(2).max(120).default("custom"),
  content: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireApiUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await context.params;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: user.organizationId },
      include: {
        requirements: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or unauthorized" },
        { status: 404 }
      );
    }

    const sections = await prisma.proposalSection.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(sections);
  } catch (error) {
    console.error("Error fetching proposal sections:", error);
    captureError(error, { route: "proposal-sections:GET" });
    return NextResponse.json(
      { error: "Failed to fetch proposal sections" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireApiUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await context.params;
    const { allowed } = await rateLimit(user.id);

    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { title, sectionType, content } = createSectionSchema.parse(body);

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: user.organizationId },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or unauthorized" },
        { status: 404 }
      );
    }

    const lastSection = await prisma.proposalSection.findFirst({
      where: { projectId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const section = await prisma.proposalSection.create({
      data: {
        projectId,
        title,
        slug: createSectionSlug(title, sectionType),
        order: (lastSection?.order ?? 0) + 1,
        sectionType,
        content: content || "",
      },
    });

    return NextResponse.json(section);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating proposal section:", error);
    captureError(error, { route: "proposal-sections:POST" });
    return NextResponse.json(
      { error: "Failed to create proposal section" },
      { status: 500 }
    );
  }
}

function createSectionSlug(title: string, sectionType: string) {
  if (sectionType !== "custom") return sectionType;
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "custom-section";
}
