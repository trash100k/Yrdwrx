import { safeStorage } from '../lib/storage';
// @ts-nocheck

import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, onSnapshot, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

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
    // INTERNAL TESTING BYPASS
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
  }, []);

  const switchTenant = (id: string) => {
    setLoading(true);
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

