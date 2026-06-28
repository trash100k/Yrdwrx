// @ts-nocheck
// Supabase client + native Auth (single source of identity).
//
// Identity is owned by Supabase Auth. Postgres RLS keys on auth.jwt() ->> 'sub'
// (the Supabase user UUID), which the private.auth_tenant_id()/auth_role() helpers
// match against profiles.firebase_uid. A signup trigger (handle_new_user) provisions
// a tenant + owner profile keyed by that UUID, so RLS scopes every row automatically.
//
// The column is still named `firebase_uid` for historical reasons; it now holds the
// Supabase UID. (Renaming it would churn every RLS policy for no behavioral gain.)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
      "Auth and data access will not work until they are configured (.env.local).",
  );
}

// A syntactically-valid placeholder keeps createClient from THROWING at module load
// ("supabaseUrl is required") when env is missing, which would blank the whole SPA.
// Requests then fail gracefully at call time instead of taking the app down.
export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "yardworx-auth",
    },
  },
);

// Firebase-compatible user shape so existing `currentUser`-style reads map cleanly.
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}

function toAuthUser(u: any): AuthUser | null {
  if (!u) return null;
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName:
      u.user_metadata?.display_name || u.user_metadata?.full_name || null,
    emailVerified: !!u.email_confirmed_at || !!u.confirmed_at,
  };
}

// Synchronous snapshot of the current user, kept fresh by the listener below.
// Mirrors Firebase's `auth.currentUser` ergonomics for callers that read it inline.
let _currentUser: AuthUser | null = null;
export function getCurrentUser(): AuthUser | null {
  return _currentUser;
}

try {
  supabase.auth
    .getSession()
    .then(({ data }) => {
      _currentUser = toAuthUser(data.session?.user);
    })
    .catch(() => {});
  supabase.auth.onAuthStateChange((_event, session) => {
    _currentUser = toAuthUser(session?.user);
  });
} catch {
  /* placeholder client (no env) — ignore */
}

// Subscribe to auth changes. Fires immediately with the current state, then on
// every change. Returns an unsubscribe fn (matches onAuthStateChanged ergonomics).
export function onAuthChange(cb: (user: AuthUser | null) => void): () => void {
  supabase.auth
    .getSession()
    .then(({ data }) => cb(toAuthUser(data.session?.user)))
    .catch(() => cb(null));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(toAuthUser(session?.user));
  });
  return () => {
    try {
      data.subscription.unsubscribe();
    } catch {}
  };
}

export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

// --- Auth actions ---------------------------------------------------------

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Self-serve signup. `meta` (company_name / display_name) is read by the
// handle_new_user trigger to provision the tenant + owner profile.
export async function signUpWithEmail(
  email: string,
  password: string,
  meta: Record<string, any> = {},
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: meta },
  });
  if (error) throw error;
  return data;
}

export async function signInWithMagicLink(email: string, emailRedirectTo?: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo, shouldCreateUser: true },
  });
  if (error) throw error;
  return data;
}

export async function signOutUser() {
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
}
