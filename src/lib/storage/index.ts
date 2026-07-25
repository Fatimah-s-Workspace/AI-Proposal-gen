import { hasCloudStorageConfig, getSupabaseStorageClient } from "./supabase-client";

export type StorageScope = "uploads" | "exports";

const bucketByScope: Record<StorageScope, string> = {
  uploads: "uploads",
  exports: "exports",
};

// Read lazily (not as a module-level constant) so tests can override
// UPLOAD_DIR/EXPORT_DIR per-run, and so the value always reflects the
// current environment rather than whatever it was at first import.
function localDirFor(scope: StorageScope) {
  return scope === "uploads"
    ? (process.env.UPLOAD_DIR ?? "uploads")
    : (process.env.EXPORT_DIR ?? "exports");
}

export function isCloudStorageEnabled() {
  return hasCloudStorageConfig();
}

/**
 * Saves a file under the given scope (uploads or exports) and returns the
 * path to persist in the database. Uses Supabase Storage when configured;
 * otherwise falls back to local disk, matching this app's existing pattern
 * of degrading gracefully when an external provider isn't set up (see the
 * Gemini/local-fallback split in src/lib/ai/client.ts).
 *
 * Local disk storage does not survive most serverless deploy targets
 * (Vercel's filesystem is read-only outside /tmp, and /tmp is ephemeral),
 * so cloud storage should always be configured in production.
 */
export async function saveFile(
  scope: StorageScope,
  relativePath: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const client = getSupabaseStorageClient();
  if (client) {
    const { error } = await client.storage
      .from(bucketByScope[scope])
      .upload(relativePath, buffer, { contentType, upsert: false });
    if (error) {
      throw new Error(`Failed to upload to Supabase Storage (${scope}): ${error.message}`);
    }
    return relativePath;
  }

  const { mkdir, writeFile } = await import("fs/promises");
  const path = await import("path");
  const fullPath = path.join(localDirFor(scope), relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  return relativePath;
}

export async function readStoredFile(scope: StorageScope, relativePath: string): Promise<Buffer> {
  const client = getSupabaseStorageClient();
  if (client) {
    const { data, error } = await client.storage.from(bucketByScope[scope]).download(relativePath);
    if (error || !data) {
      throw new Error(`Failed to read from Supabase Storage (${scope}): ${error?.message ?? "no data"}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  const { readFile } = await import("fs/promises");
  const path = await import("path");
  return readFile(path.join(localDirFor(scope), relativePath));
}

/**
 * Deletes a stored file. Failures are swallowed (logged only) so that a
 * missing or already-removed file never blocks the caller's own delete
 * operation (matching the previous unlink-and-ignore behavior).
 */
export async function deleteStoredFile(scope: StorageScope, relativePath: string): Promise<void> {
  const client = getSupabaseStorageClient();
  if (client) {
    const { error } = await client.storage.from(bucketByScope[scope]).remove([relativePath]);
    if (error) {
      console.warn(`Failed to delete from Supabase Storage (${scope}):`, error.message);
    }
    return;
  }

  const { unlink } = await import("fs/promises");
  const path = await import("path");
  await unlink(path.join(localDirFor(scope), relativePath)).catch((error) => {
    console.warn(`Failed to delete local file (${scope}):`, error);
  });
}
