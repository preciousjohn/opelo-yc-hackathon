import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service client for API routes and background jobs (no cookie handling needed)
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
