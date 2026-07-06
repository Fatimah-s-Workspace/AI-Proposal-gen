import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { unlink } from "fs/promises";
import { z } from "zod";

const updateDocumentSchema = z.object({
  originalName: z.string().min(1).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; documentId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, documentId } = await params;
  const body = await request.json();
  const parsed = updateDocumentSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid document data", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const document = await prisma.tenderDocument.findFirst({
    where: {
      id: documentId,
      projectId,
      project: {
        userId: user.id,
      },
    },
  });

  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const updatedDocument = await prisma.tenderDocument.update({
    where: { id: documentId },
    data: parsed.data,
  });

  return Response.json({ document: updatedDocument });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; documentId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, documentId } = await params;

  const document = await prisma.tenderDocument.findFirst({
    where: {
      id: documentId,
      projectId,
      project: {
        userId: user.id,
      },
    },
  });

  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  // Delete the file from disk
  try {
    await unlink(document.storagePath);
  } catch (error) {
    console.warn("Failed to delete file from disk:", error);
    // Continue with DB deletion even if file deletion fails
  }

  // Delete from database (this will cascade to parsedSections and requirements)
  await prisma.tenderDocument.delete({
    where: { id: documentId },
  });

  return Response.json({ success: true });
}
