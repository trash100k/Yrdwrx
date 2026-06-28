// @ts-nocheck
import { safeStorage } from '../lib/storage';

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase, onAuthChange } from "../lib/supabase";
import { getCurrentProfile, clearProfileCache } from "../lib/repos/profile";

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

  // Resolve the caller's tenant directly from Supabase (RLS-scoped) via their profile.
  // The signup trigger guarantees a profile + tenant row exist for every user.
  const loadTenant = async () => {
    const profile = await getCurrentProfile(true);
    if (!profile?.tenant_id) {
      setTenant(null);
      setUserRole(null);
      return;
    }
    const { data: t, error: tErr } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", profile.tenant_id)
      .maybeSingle();
    if (tErr || !t) {
      setError("Failed to load workspace.");
      setTenant(null);
      setUserRole(null);
      return;
    }
    // Merge DB settings over sane defaults so the UI never hits an undefined feature flag.
    const defaults = {
      hoaProtocolEnabled: false,
      satelliteVisionEnabled: false,
      currency: "USD",
      neighborhoodMask: [],
      features: {
        crewTracking: true,
        inventoryManagement: true,
        designStudio: true,
        contracts: true,
        routeOptimization: true,
        crm: true,
        scheduler: true,
        reports: true,
        invoices: true,
        compliance: true,
        cockpit_buttons: true,
      },
    };
    const s = (t.settings as any) || {};
    setTenant({
      id: t.id,
      name: t.name,
      tier: t.tier || "free",
      stripeAccountId: t.stripe_account_id || undefined,
      legal: t.legal || { aiDisclaimerAccepted: false },
      quotas: t.quotas || { aiRequestsMonthly: 0, aiRequestLimit: 0 },
      settings: {
        ...defaults,
        ...s,
        features: { ...defaults.features, ...(s.features || {}) },
      },
    } as any);
    setUserRole((profile.role as any) ?? null);
  };

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

    // REAL AUTH — resolve the caller's tenant directly from Supabase on every auth change.
    let active = true;

    const unsubscribe = onAuthChange(async (currentUser) => {
      if (!active) return;
      setError(null);

      if (!currentUser) {
        clearProfileCache();
        setTenant(null);
        setUserRole(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        clearProfileCache();
        await loadTenant();
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

  // Single-tenant membership today (one profile -> one tenant), so this just
  // re-resolves the caller's current workspace.
  const switchTenant = async (_id: string) => {
    if (!REQUIRE_AUTH) {
      setLoading(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      clearProfileCache();
      await loadTenant();
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

