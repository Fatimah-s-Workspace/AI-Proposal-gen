import assert from "node:assert/strict";
import test from "node:test";

import { validateUpload } from "./upload";

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TXT_MIME = "text/plain";

function makeFile(name: string, mime: string, bytes: Uint8Array<ArrayBuffer> | string) {
  return new File([bytes], name, { type: mime });
}

test("validateUpload rejects an empty file", async () => {
  const file = makeFile("empty.pdf", PDF_MIME, new Uint8Array());
  const error = await validateUpload(file);
  assert.match(error ?? "", /empty/i);
});

test("validateUpload rejects a file over the configured size limit", async () => {
  const original = process.env.MAX_UPLOAD_MB;
  process.env.MAX_UPLOAD_MB = "0.000001"; // effectively 1 byte
  try {
    const file = makeFile("big.txt", TXT_MIME, "some content");
    const error = await validateUpload(file);
    assert.match(error ?? "", /too large/i);
  } finally {
    if (original === undefined) delete process.env.MAX_UPLOAD_MB;
    else process.env.MAX_UPLOAD_MB = original;
  }
});

test("validateUpload rejects an unsupported MIME type", async () => {
  const file = makeFile("image.png", "image/png", "not a real png");
  const error = await validateUpload(file);
  assert.match(error ?? "", /not a supported file type/i);
});

test("validateUpload rejects a MIME/extension mismatch", async () => {
  // Declares itself a PDF but has a .docx extension.
  const file = makeFile("report.docx", PDF_MIME, "%PDF-1.4 fake body");
  const error = await validateUpload(file);
  assert.match(error ?? "", /looks like a \.pdf file/i);
});

test("validateUpload accepts a real PDF", async () => {
  const file = makeFile("tender.pdf", PDF_MIME, "%PDF-1.7\n%rest of a pdf body");
  const error = await validateUpload(file);
  assert.equal(error, null);
});

test("validateUpload rejects a .pdf file whose content is not actually a PDF", async () => {
  // Right extension, right declared MIME, but the bytes don't match the
  // PDF signature — e.g. a renamed executable or corrupted download.
  const file = makeFile("tender.pdf", PDF_MIME, "MZ this is not a pdf at all");
  const error = await validateUpload(file);
  assert.match(error ?? "", /does not look like a valid PDF/i);
});

test("validateUpload accepts a real DOCX (zip signature)", async () => {
  const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 1, 2, 3]);
  const file = makeFile("proposal.docx", DOCX_MIME, zipHeader);
  const error = await validateUpload(file);
  assert.equal(error, null);
});

test("validateUpload rejects a .docx file that isn't a real zip archive", async () => {
  const file = makeFile("proposal.docx", DOCX_MIME, "definitely not a zip file");
  const error = await validateUpload(file);
  assert.match(error ?? "", /does not look like a valid DOCX/i);
});

test("validateUpload accepts plain text content", async () => {
  const file = makeFile("notes.txt", TXT_MIME, "Section 1: Eligibility requirements\n");
  const error = await validateUpload(file);
  assert.equal(error, null);
});

test("validateUpload rejects binary content disguised as .txt", async () => {
  const binary = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe, 0x00, 0x10, 0x20]);
  const file = makeFile("notes.txt", TXT_MIME, binary);
  const error = await validateUpload(file);
  assert.match(error ?? "", /binary data/i);
});

test("validateUpload rejects a file with no extension", async () => {
  const file = makeFile("tenderfile", PDF_MIME, "%PDF-1.4");
  const error = await validateUpload(file);
  assert.match(error ?? "", /not a supported file type/i);
});
