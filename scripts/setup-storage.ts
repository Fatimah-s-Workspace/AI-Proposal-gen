import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const REQUIRED_BUCKETS = ["uploads", "exports"] as const;

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (in .env for local, or your deploy target's env vars) before running this script.",
    );
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: existingBuckets, error: listError } = await client.storage.listBuckets();
  if (listError) {
    console.error("Failed to list existing buckets:", listError.message);
    process.exitCode = 1;
    return;
  }

  const existingNames = new Set((existingBuckets ?? []).map((bucket) => bucket.name));

  for (const bucketName of REQUIRED_BUCKETS) {
    if (existingNames.has(bucketName)) {
      console.log(`✓ Bucket "${bucketName}" already exists.`);
      continue;
    }

    const { error } = await client.storage.createBucket(bucketName, {
      public: false,
    });

    if (error) {
      console.error(`✗ Failed to create bucket "${bucketName}":`, error.message);
      process.exitCode = 1;
      continue;
    }

    console.log(`✓ Created private bucket "${bucketName}".`);
  }
}

main();
