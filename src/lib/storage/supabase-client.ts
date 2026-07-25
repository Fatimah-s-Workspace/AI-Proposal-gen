import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function hasCloudStorageConfig() {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

// Uses the service role key because this app authenticates users with
// NextAuth, not Supabase Auth - there is no Supabase user JWT to attach to
// these requests, so bucket access is controlled entirely server-side.
export function getSupabaseStorageClient(): SupabaseClient | null {
  if (!hasCloudStorageConfig()) return null;

  if (!client) {
    client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  }

  return client;
}
