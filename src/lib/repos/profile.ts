// @ts-nocheck
// Current user's profile (tenant_id + role) — the authorization source of record.
// Identity is the Supabase Auth user; the Postgres `profiles` row is keyed on
// firebase_uid (= the Supabase UID, which RLS reads from the JWT `sub` claim).
import { supabase, getCurrentUser } from "../supabase";

export interface Profile {
  firebase_uid: string;
  tenant_id: string | null;
  role: "admin" | "owner" | "employee" | "client" | "foreman";
  email?: string;
  display_name?: string;
  agreements_accepted?: boolean;
  is_platform_admin?: boolean;
}

let cached: Profile | null = null;

export async function getCurrentProfile(force = false): Promise<Profile | null> {
  if (cached && !force) return cached;

  // Prefer the synchronous snapshot; fall back to the persisted session.
  let uid = getCurrentUser()?.uid;
  if (!uid) {
    try {
      const { data } = await supabase.auth.getSession();
      uid = data.session?.user?.id;
    } catch {
      return null;
    }
  }
  if (!uid) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("firebase_uid", uid)
    .maybeSingle();
  if (error) return null;
  cached = data as Profile;
  return cached;
}

export function clearProfileCache() {
  cached = null;
}
