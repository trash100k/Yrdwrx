// @ts-nocheck
// Current user's profile (tenant_id + role) — replaces reading the Firestore /users/{uid} doc.
// HYBRID AUTH: the identity is the Firebase user; the Postgres `profiles` row is keyed on
// firebase_uid (= the Firebase UID, which Supabase RLS reads from the JWT `sub` claim).
import { supabase } from "../supabase";
import { auth } from "../firebase";

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
  const uid = auth.currentUser?.uid;
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
