import { safeStorage } from '../lib/storage';
// @ts-nocheck
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

export type UserRole = "admin" | "employee" | "client" | "owner" | "foreman";

export function useRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        if (safeStorage.getItem("cutty-demo-mode") === "active") {
           setRole("owner");
        } else {
           setRole(null);
        }
        setLoadingRole(false);
        return;
      }
      
      const unsubDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
          if (snap.exists()) {
             setRole(snap.data().role as UserRole);
          } else {
             setRole("client"); // basic fallback
          }
          setLoadingRole(false);
      });
      return () => unsubDoc();
    });
    return () => unsubAuth();
  }, []);

  const hasPermission = (requiredRole: UserRole) => {
    if (!role) return false;
    const hierarchy = { owner: 5, admin: 4, foreman: 3, employee: 2, client: 1 };
    return hierarchy[role] >= (hierarchy[requiredRole] || 0);
  };

  return { role, loadingRole, hasPermission };
}
