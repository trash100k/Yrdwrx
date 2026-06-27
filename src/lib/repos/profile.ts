// @ts-nocheck
// Current user's profile (tenant_id + role) — replaces reading the Firestore /users/{uid} doc.
import { supabase } from "../supabase";

export interface Profile {
  id: string;
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
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) return null;
  cached = data as Profile;
  return cached;
}

export function clearProfileCache() {
  cached = null;
}
