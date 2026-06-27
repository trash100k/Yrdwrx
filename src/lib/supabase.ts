// @ts-nocheck
// Supabase client — replaces src/lib/firebase.ts (Auth + Postgres data + Storage).
// Tenant isolation is enforced by Postgres RLS (supabase/migrations/0002_rls.sql),
// so queries no longer carry an explicit tenantId filter — the caller's profile row
// scopes every read/write.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Surface misconfig loudly in dev rather than failing with an opaque network error.
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
      "Auth and data access will not work until they are configured (.env.local).",
  );
}

export const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Convenience: current access token for authed calls to the Express API (src/lib/api.ts).
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
