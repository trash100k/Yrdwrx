// @ts-nocheck
// Supabase data client (HYBRID AUTH). Identity stays in Firebase Auth; this client
// forwards the Firebase ID token on every request, and Supabase validates it via
// Third-Party Auth so Postgres RLS keys on the Firebase UID (auth.jwt() ->> 'sub').
// See supabase/migrations/0002_rls.sql + 0003_rls_helpers_private_schema.sql.
//
// NOTE: with the `accessToken` option set, do NOT use supabase.auth.* — auth is
// owned entirely by Firebase (src/lib/firebase.ts).

import { createClient } from "@supabase/supabase-js";
import { auth } from "./firebase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
      "Data access will not work until they are configured (.env.local).",
  );
}

// Use a syntactically-valid placeholder when env is missing so createClient never THROWS at
// module load ("supabaseUrl is required"), which would blank the entire app. Requests against
// the placeholder fail gracefully at call time instead of taking the whole SPA down.
export const supabase = createClient(SUPABASE_URL || "https://placeholder.supabase.co", SUPABASE_ANON_KEY || "placeholder-anon-key", {
  // Forward the current Firebase ID token to Supabase (Third-Party Auth).
  // NOTE: in demo / internal-testing mode (VITE_REQUIRE_AUTH !== 'true') the app never
  // signs the user into Firebase, so `auth.currentUser` is null and this callback returns
  // null. That makes the Supabase repos (e.g. lib/repos/*) inert by design — demo pages
  // read/write Firestore instead. Real Supabase access only kicks in once auth is required.
  accessToken: async () => {
    try {
      return (await auth.currentUser?.getIdToken()) ?? null;
    } catch {
      return null;
    }
  },
});
