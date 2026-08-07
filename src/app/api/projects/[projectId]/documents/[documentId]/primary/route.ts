import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";

export async function PATCH(
  request: Request,
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
        organizationId: user.organizationId,
      },
    },
  });

  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  if (document.documentType !== "tender_pack") {
    return Response.json(
      { error: "Only tender pack documents can be marked as primary" },
      { status: 400 },
    );
  }

  // First, unset any existing primary document for this project
  await prisma.tenderDocument.updateMany({
    where: {
      projectId,
      isPrimary: true,
    },
    data: {
      isPrimary: false,
    },
  });

  // Then mark this document as primary
  const updatedDocument = await prisma.tenderDocument.update({
    where: { id: documentId },
    data: {
      isPrimary: true,
    },
  });

  return Response.json({ document: updatedDocument });
}
