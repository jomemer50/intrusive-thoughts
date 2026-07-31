import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Browser client — used in client components
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server client factory — used in API routes
export function createServerSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}
