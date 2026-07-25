import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { deleteStoredFile, isCloudStorageEnabled, readStoredFile, saveFile } from "./index";

// These tests exercise the local-disk fallback path, which is what actually
// runs in CI and local dev (no real Supabase credentials are configured).
// The Supabase Storage path is only exercised by real usage against a
// configured project - faking the Supabase SDK's responses would mostly
// test the mock, not real behavior, so it's intentionally left uncovered
// here (see the README's "Testing and CI" section).

test("isCloudStorageEnabled is false when Supabase env vars are unset", () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    assert.equal(isCloudStorageEnabled(), false);
  } finally {
    if (originalUrl !== undefined) process.env.SUPABASE_URL = originalUrl;
    if (originalKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

test("isCloudStorageEnabled is true only when both Supabase env vars are set", () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal(isCloudStorageEnabled(), false);

    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    assert.equal(isCloudStorageEnabled(), true);
  } finally {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

async function withLocalStorage(run: (dir: string) => Promise<void>) {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalUploadDir = process.env.UPLOAD_DIR;
  const originalExportDir = process.env.EXPORT_DIR;

  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const dir = await mkdtemp(path.join(tmpdir(), "tenderflow-storage-test-"));
  process.env.UPLOAD_DIR = path.join(dir, "uploads");
  process.env.EXPORT_DIR = path.join(dir, "exports");

  try {
    await run(dir);
  } finally {
    if (originalUrl !== undefined) process.env.SUPABASE_URL = originalUrl;
    if (originalKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = originalUploadDir;
    if (originalExportDir === undefined) delete process.env.EXPORT_DIR;
    else process.env.EXPORT_DIR = originalExportDir;
    await rm(dir, { recursive: true, force: true });
  }
}

test("saveFile writes to local disk and readStoredFile reads it back", async () => {
  await withLocalStorage(async () => {
    const content = Buffer.from("tender document contents");
    const relativePath = "project-1/test-file.txt";

    const storedPath = await saveFile("uploads", relativePath, content, "text/plain");
    assert.equal(storedPath, relativePath);

    const readBack = await readStoredFile("uploads", relativePath);
    assert.equal(readBack.toString(), content.toString());
  });
});

test("saveFile creates nested directories as needed", async () => {
  await withLocalStorage(async (dir) => {
    const relativePath = "deeply/nested/project/file.pdf";
    await saveFile("exports", relativePath, Buffer.from("pdf bytes"), "application/pdf");

    const fullPath = path.join(dir, "exports", relativePath);
    assert.ok(existsSync(fullPath));
  });
});

test("uploads and exports are stored under separate scopes", async () => {
  await withLocalStorage(async () => {
    await saveFile("uploads", "same-name.txt", Buffer.from("upload"), "text/plain");
    await saveFile("exports", "same-name.txt", Buffer.from("export"), "text/plain");

    const upload = await readStoredFile("uploads", "same-name.txt");
    const exportFile = await readStoredFile("exports", "same-name.txt");
    assert.equal(upload.toString(), "upload");
    assert.equal(exportFile.toString(), "export");
  });
});

test("deleteStoredFile removes a file from local disk", async () => {
  await withLocalStorage(async (dir) => {
    const relativePath = "project-1/to-delete.txt";
    await saveFile("uploads", relativePath, Buffer.from("temporary"), "text/plain");

    const fullPath = path.join(dir, "uploads", relativePath);
    assert.ok(existsSync(fullPath));

    await deleteStoredFile("uploads", relativePath);
    assert.equal(existsSync(fullPath), false);
  });
});

test("deleteStoredFile does not throw when the file is already missing", async () => {
  await withLocalStorage(async () => {
    await assert.doesNotReject(deleteStoredFile("uploads", "never-existed.txt"));
  });
});

test("readStoredFile rejects when the file does not exist", async () => {
  await withLocalStorage(async () => {
    await assert.rejects(readStoredFile("uploads", "missing.txt"));
  });
});

// Sanity check that the file content actually round-trips byte-for-byte,
// not just as a UTF-8 string comparison.
test("saveFile/readStoredFile round-trip binary content exactly", async () => {
  await withLocalStorage(async () => {
    const binary = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x10]);
    await saveFile("uploads", "binary.pdf", binary, "application/pdf");
    const readBack = await readStoredFile("uploads", "binary.pdf");
    assert.ok(readBack.equals(binary));
  });
});
