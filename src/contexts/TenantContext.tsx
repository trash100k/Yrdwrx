// @ts-nocheck
import { safeStorage } from '../lib/storage';

import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, onSnapshot, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { fetchApi } from "../lib/api";

const REQUIRE_AUTH = import.meta.env.VITE_REQUIRE_AUTH === "true";

interface TenantProfile {
  id: string;
  name: string;
  tier: "free" | "pro" | "enterprise";
  stripeAccountId?: string;
  contactEmail?: string;
  legal?: {
    aiDisclaimerAccepted: boolean;
    acceptedAt?: string;
  };
  quotas?: {
    aiRequestsMonthly: number;
    aiRequestLimit: number;
  };
  settings: {
    hoaProtocolEnabled: boolean;
    satelliteVisionEnabled: boolean;
    currency: string;
    neighborhoodMask: string[];
    customInstallRules?: string;
    features: {
      crewTracking: boolean;
      inventoryManagement: boolean;
      designStudio: boolean;
      contracts: boolean;
      routeOptimization: boolean;
      crm: boolean;
      scheduler: boolean;
      reports: boolean;
      invoices: boolean;
      compliance: boolean;
      aiOmnilingual?: boolean;
      cockpit_buttons?: boolean;
    };
    subFeatures?: Record<string, boolean>;
    serviceCatalog?: { name: string; services: { name: string; price: number }[] }[];
  };
}

interface TenantContextType {
  tenant: TenantProfile | null;
  userRole: "admin" | "employee" | "client" | "owner" | null;
  loading: boolean;
  error: string | null;
  switchTenant: (id: string) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "employee" | "client" | "owner" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

useEffect(() => {
    // DEMO / INTERNAL TESTING BYPASS — keep the hardcoded enterprise tenant verbatim so
    // the demo path is byte-for-byte identical to today when the flag is off.
    if (!REQUIRE_AUTH) {
      setUserRole("owner");
      setTenant({
        id: "demo-tenant-1",
        name: "YardWorx Internal Testing",
        tier: "enterprise",
        legal: {
          aiDisclaimerAccepted: true,
        },
        quotas: {
          aiRequestsMonthly: 10,
          aiRequestLimit: 50000,
        },
        settings: {
          hoaProtocolEnabled: true,
          satelliteVisionEnabled: true,
          currency: "USD",
          neighborhoodMask: [],
          features: {
            crewTracking: true,
            inventoryManagement: true,
            agenticOutreach: true,
          }
        }
      } as any);
      setLoading(false);
      return;
    }

    // REAL AUTH — resolve the caller's tenant from the server on every auth change.
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!active) return;
      setError(null);

      if (!currentUser) {
        setTenant(null);
        setUserRole(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetchApi("/api/tenants/me");
        if (!active) return;

        if (res.status === 404) {
          // No tenant yet — the user still needs to onboard/provision.
          setTenant(null);
          setUserRole(null);
        } else if (res.ok) {
          const result = await res.json();
          setTenant(result as any);
          setUserRole(result.role ?? null);
        } else {
          setError("Failed to load workspace.");
          setTenant(null);
          setUserRole(null);
        }
      } catch (e) {
        if (active) {
          setError("Failed to load workspace.");
          setTenant(null);
          setUserRole(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const switchTenant = async (id: string) => {
    if (!REQUIRE_AUTH) {
      setLoading(true);
      return;
    }
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi(`/api/tenants/me?tenantId=${encodeURIComponent(id)}`);
      if (res.ok) {
        const result = await res.json();
        setTenant(result as any);
        setUserRole(result.role ?? null);
      } else {
        setError("Failed to switch workspace.");
      }
    } catch (e) {
      setError("Failed to switch workspace.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TenantContext.Provider value={{ tenant, userRole, loading, error, switchTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
};

