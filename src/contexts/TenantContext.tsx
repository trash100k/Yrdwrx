
import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface TenantProfile {
  id: string;
  name: string;
  tier: "free" | "pro" | "enterprise";
  settings: {
    hoaProtocolEnabled: boolean;
    satelliteVisionEnabled: boolean;
    currency: string;
    neighborhoodMask: string[];
  };
}

interface TenantContextType {
  tenant: TenantProfile | null;
  loading: boolean;
  error: string | null;
  switchTenant: (id: string) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In a real SaaS, the user's document would contain their currentTenantId
    // For now, we simulate a default "Genesis" tenant
    const defaultTenantId = "genesis-1";

    const unsubscribe = onSnapshot(
      doc(db, "tenants", defaultTenantId),
      (doc) => {
        if (doc.exists()) {
          setTenant({ id: doc.id, ...doc.data() } as TenantProfile);
        } else {
          // Fallback / Initial Setup
          setTenant({
            id: defaultTenantId,
            name: "Cutty Default",
            tier: "enterprise",
            settings: {
              hoaProtocolEnabled: true,
              satelliteVisionEnabled: true,
              currency: "USD",
              neighborhoodMask: ["North Hills", "Arbor Lakes"],
            },
          });
        }
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(
          err,
          OperationType.GET,
          `tenants/${defaultTenantId}`,
        );
        setError("Authorization check failed.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const switchTenant = (id: string) => {
    setLoading(true);
    // Logic to update user's active tenant
  };

  return (
    <TenantContext.Provider value={{ tenant, loading, error, switchTenant }}>
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
