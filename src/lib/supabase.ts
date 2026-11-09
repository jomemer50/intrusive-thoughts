import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The database is only ever reached from route handlers, using the project's
// secret (service-role) key. Row Level Security is enabled with no policies,
// so the publishable/anon key can no longer read or write anything — every
// access decision is made in the API layer, scoped to the session user.
let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see README → Environment variables)."
    );
  }

  admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
