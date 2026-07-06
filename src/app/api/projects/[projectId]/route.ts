import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { createProjectSchema } from "@/lib/validations";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { unlink } from "fs/promises";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit(`project:update:${user.id}`, 50, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const { projectId } = await params;
  const body = await request.json();
  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid project details", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Check if project exists and belongs to user
  const existingProject = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: user.id,
    },
  });

  if (!existingProject) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      title: parsed.data.title,
      clientName: parsed.data.clientName,
      opportunityType: parsed.data.opportunityType,
      sector: parsed.data.sector,
      country: parsed.data.country,
      authority: parsed.data.authority || null,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
      budgetRange: parsed.data.budgetRange || null,
      summary: parsed.data.summary || null,
    },
  });

  return Response.json({ project });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: user.id,
    },
    include: {
      documents: true,
    },
  });

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Delete all document files
  for (const document of project.documents) {
    try {
      await unlink(document.storagePath);
    } catch (error) {
      console.warn("Failed to delete file from disk:", error);
    }
  }

  // Delete project (this will cascade to all related records)
  await prisma.project.delete({
    where: { id: projectId },
  });

  return Response.json({ success: true });
}
