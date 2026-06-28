// @ts-nocheck
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { getCurrentProfile, clearProfileCache } from "../lib/repos/profile";

export type UserRole = "admin" | "employee" | "client" | "owner" | "foreman";

const REQUIRE_AUTH = import.meta.env.VITE_REQUIRE_AUTH === "true";

// Simple role -> permission map. Owner/admin get everything; foreman gets field +
// crew + scheduler; employee is field-only; client is portal-only.
const ROLE_PERMISSIONS: Record<UserRole, string[] | "*"> = {
  owner: "*",
  admin: "*",
  foreman: ["field", "crew", "scheduler"],
  employee: ["field"],
  client: ["portal"],
};

function roleHasPermission(role: UserRole | null, perm: string): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (perms === "*") return true;
  if (!perms) return false;
  return perms.includes(perm);
}

export function useRole() {
  // DEMO / INTERNAL TESTING BYPASS — keep the historical hardcoded owner so the
  // demo path behaves exactly as before when the flag is off.
  if (!REQUIRE_AUTH) {
    return {
      role: "owner" as UserRole,
      loadingRole: false,
      hasPermission: () => true,
    };
  }

  const [role, setRole] = useState<UserRole | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    let active = true;

    const resolve = async () => {
      setLoadingRole(true);
      if (!auth.currentUser) {
        if (active) {
          setRole(null);
          setLoadingRole(false);
        }
        return;
      }
      const profile = await getCurrentProfile();
      if (active) {
        setRole((profile?.role as UserRole) ?? null);
        setLoadingRole(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // Re-resolve identity whenever auth state changes.
      clearProfileCache();
      resolve();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return {
    role,
    loadingRole,
    hasPermission: (perm: string) => roleHasPermission(role, perm),
  };
}
