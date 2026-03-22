import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin client using SERVICE_ROLE key.
 * Only use in Server Components or API Routes — never expose to browser.
 * Required for auth.admin.getUserById() calls.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
