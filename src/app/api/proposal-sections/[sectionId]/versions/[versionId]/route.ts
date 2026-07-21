import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sectionId: string; versionId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { sectionId, versionId } = await params;
  const version = await prisma.generatedContent.findFirst({
    where: {
      id: versionId,
      sectionId,
      project: { userId: user.id },
    },
    select: {
      id: true,
      version: true,
      contentType: true,
      provider: true,
      output: true,
      createdAt: true,
    },
  });

  if (!version)
    return Response.json({ error: "Version not found" }, { status: 404 });

  return Response.json({ version });
}
