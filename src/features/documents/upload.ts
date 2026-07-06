import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
]);

export function validateUpload(file: File) {
  const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 15);
  const maxBytes = maxUploadMb * 1024 * 1024;

  if (!allowedMimeTypes.has(file.type)) {
    return `Unsupported file type. Upload PDF, DOCX, or TXT files.`;
  }

  if (file.size > maxBytes) {
    return `File is too large. Maximum upload size is ${maxUploadMb}MB.`;
  }

  return null;
}

export async function saveUploadedFile(file: File, projectId: string) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = sanitizeFileName(file.name);
  const filename = `${Date.now()}-${randomUUID()}-${safeName}`;
  const uploadRoot = process.env.UPLOAD_DIR ?? "uploads";
  const projectDir = joinStoragePath(uploadRoot, projectId);
  const storagePath = joinStoragePath(projectDir, filename);

  await mkdir(projectDir, { recursive: true });
  await writeFile(storagePath, buffer);

  return {
    buffer,
    filename,
    storagePath
  };
}

function joinStoragePath(...parts: string[]) {
  const prefix = parts[0]?.startsWith("/") ? "/" : "";
  return prefix + parts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

function sanitizeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
