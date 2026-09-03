import { readStoredFile } from "@/lib/storage";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { unauthorized } from "@/server/responses";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ exportId: string }> }) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  // Every hit pulls the whole file out of object storage, so this is about
  // bandwidth rather than compute.
  const limit = await rateLimit(`export:download:${user.id}`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const { exportId } = await params;
  // Access is by org membership, not by who originally ran the export - any
  // teammate in the same org can download a colleague's export.
  const history = await prisma.exportHistory.findFirst({
    where: {
      id: exportId,
      project: { organizationId: user.organizationId },
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
