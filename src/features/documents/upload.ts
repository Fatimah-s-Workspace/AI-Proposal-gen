import { randomUUID } from "crypto";
import { saveFile } from "@/lib/storage";

const allowedExtensionsByMime: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/plain": "txt",
};

function getExtension(filename: string) {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim());
  return match ? match[1].toLowerCase() : null;
}

// Sniff the real file format from its leading bytes so a renamed or
// mislabeled file (e.g. an .exe saved as .pdf) is rejected even though the
// browser-reported MIME type and extension look fine.
function sniffFormat(header: Buffer): "pdf" | "zip" | "unknown" {
  if (header.length >= 5 && header.subarray(0, 5).toString("latin1") === "%PDF-") {
    return "pdf";
  }
  // DOCX files are zip archives; the standard local file header signature is
  // "PK\x03\x04" (empty zips use \x05\x06 / \x07\x08, which we don't expect here).
  if (
    header.length >= 4 &&
    header[0] === 0x50 &&
    header[1] === 0x4b &&
    header[2] === 0x03 &&
    header[3] === 0x04
  ) {
    return "zip";
  }
  return "unknown";
}

function looksLikeBinary(header: Buffer) {
  return header.includes(0);
}

export async function validateUpload(file: File): Promise<string | null> {
  const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 15);
  const maxBytes = maxUploadMb * 1024 * 1024;

  if (file.size === 0) {
    return `"${file.name}" is empty. Upload a file that contains content.`;
  }

  if (file.size > maxBytes) {
    return `"${file.name}" is too large. Maximum upload size is ${maxUploadMb}MB.`;
  }

  const expectedExtension = allowedExtensionsByMime[file.type];
  const actualExtension = getExtension(file.name);

  if (!expectedExtension || !actualExtension) {
    return `"${file.name}" is not a supported file type. Upload PDF, DOCX, or TXT files.`;
  }

  if (actualExtension !== expectedExtension) {
    return `"${file.name}" has a .${actualExtension} extension but looks like a .${expectedExtension} file. Rename or re-export it before uploading.`;
  }

  const header = Buffer.from(await file.slice(0, 8).arrayBuffer());

  if (expectedExtension === "pdf" && sniffFormat(header) !== "pdf") {
    return `"${file.name}" does not look like a valid PDF. It may be corrupted or mislabeled.`;
  }

  if (expectedExtension === "docx" && sniffFormat(header) !== "zip") {
    return `"${file.name}" does not look like a valid DOCX. It may be corrupted or mislabeled.`;
  }

  if (expectedExtension === "txt" && looksLikeBinary(header)) {
    return `"${file.name}" appears to contain binary data, not text.`;
  }

  return null;
}

export async function saveUploadedFile(file: File, projectId: string) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = sanitizeFileName(file.name);
  const filename = `${Date.now()}-${randomUUID()}-${safeName}`;
  const relativePath = `${projectId}/${filename}`;

  const storagePath = await saveFile("uploads", relativePath, buffer, file.type);

  return {
    buffer,
    filename,
    storagePath
  };
}

function sanitizeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
