import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { generateTenderSectionsForProject } from "@/server/tender-proposal";

const updateSectionSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  content: z.string().optional(),
  status: z.enum(["not_started", "drafting", "review", "ready", "approved", "needs_work"]).optional(),
  sectionType: z.string().min(2).max(120).optional(),
});

const generateSectionSchema = z.object({
  customPrompt: z.string().max(1200).optional(),
  tone: z.enum(["formal", "confident", "technical", "ngo"]).default("formal"),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; sectionId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, sectionId } = await context.params;
  const section = await prisma.proposalSection.findFirst({
    where: {
      id: sectionId,
      projectId,
      project: { organizationId: user.organizationId },
    },
    include: {
      generatedContents: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!section) return NextResponse.json({ error: "Proposal section not found" }, { status: 404 });
  return NextResponse.json(section);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; sectionId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, sectionId } = await context.params;
  const limit = await rateLimit(`proposal-section:update:${user.id}:${sectionId}`, 60, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const parsed = updateSectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid proposal section", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const section = await prisma.proposalSection.findFirst({
    where: {
      id: sectionId,
      projectId,
      project: { organizationId: user.organizationId },
    },
  });

  if (!section) return NextResponse.json({ error: "Proposal section not found" }, { status: 404 });

  const updatedSection = await prisma.proposalSection.update({
    where: { id: sectionId },
    data: parsed.data,
    include: {
      generatedContents: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  return NextResponse.json(updatedSection);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; sectionId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, sectionId } = await context.params;
  const limit = await rateLimit(`proposal-section:generate:${user.id}:${sectionId}`, 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const parsed = generateSectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid generation request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId },
    include: { requirements: true, clauses: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!project.requirements.length && !project.clauses.length) {
    return NextResponse.json(
      { error: "Upload and parse a tender document before generating this section." },
      { status: 400 },
    );
  }

  const result = await generateTenderSectionsForProject({
    projectId,
    userId: user.id,
    sectionId,
    tone: parsed.data.tone,
    customPrompt: parsed.data.customPrompt,
  });
  const updatedSection = result.sections.find((section) => section.id === sectionId) ?? result.sections[0];

  return NextResponse.json({
    section: updatedSection,
    sections: result.sections,
    assistant: result.assistant,
  });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; sectionId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, sectionId } = await context.params;
  const limit = await rateLimit(`proposal-section:delete:${user.id}:${sectionId}`, 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const section = await prisma.proposalSection.findFirst({
    where: {
      id: sectionId,
      projectId,
      project: { organizationId: user.organizationId },
    },
  });

  if (!section) return NextResponse.json({ error: "Proposal section not found" }, { status: 404 });

  await prisma.proposalSection.delete({ where: { id: sectionId } });
  return NextResponse.json({ success: true });
}
