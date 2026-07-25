import { readStoredFile } from "@/lib/storage";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ exportId: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { exportId } = await params;
  const history = await prisma.exportHistory.findFirst({
    where: {
      id: exportId,
      userId: user.id
    }
  });

  if (!history) return Response.json({ error: "Export not found" }, { status: 404 });

  let file: Buffer;
  try {
    file = await readStoredFile("exports", history.filePath);
  } catch {
    return Response.json({ error: "Export file is no longer available." }, { status: 404 });
  }
  const mimeType =
    history.format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${history.fileName}"`
    }
  });
}
