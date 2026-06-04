import { safeStorage } from '../lib/storage';
// @ts-nocheck

import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { safeSetDoc as setDoc } from "../lib/firebase";;
import { onAuthStateChanged } from "firebase/auth";

interface TenantProfile {
  id: string;
  name: string;
  tier: "free" | "pro" | "enterprise";
  stripeAccountId?: string;
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
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // If demo mode is active
        if (safeStorage.getItem("cutty-demo-mode") === "active") {
          setUserRole("admin");
          setTenant({
            id: "demo-tenant-1",
            name: "Cutty Local Operations (Demo)",
            tier: "enterprise",
            legal: {
              aiDisclaimerAccepted: false,
            },
            quotas: {
              aiRequestsMonthly: 6204,
              aiRequestLimit: 5000,
            },
            settings: {
              hoaProtocolEnabled: true,
              satelliteVisionEnabled: true,
              currency: "USD",
              neighborhoodMask: ["North Hills", "Arbor Lakes"],
              customInstallRules: "Prefer standard 3-gallon shrubs. Use proper 3ft spacing on Hydrangeas. Favor Natchez Crepe Myrtles. Use crushed decomposed granite or double-shredded hardwood mulch. Never use lava rock.",
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
              },
              subFeatures: {
                requireGateCheckPhoto: true,
                requireCompletionPhoto: true,
                enableGeofencing: true,
                exifVerification: true,
                aiExpenseOcr: true,
                aiProposals: true,
                automatedFollowUps: true,
                liveEarAlwaysOn: true,
                visionAnalysis: true,
                aiSafetyCheck: true,
                requireSignature: true,
                requireBlueprintDeposit: true,
                semanticStyleLearning: true,
                enableHardscapeBidding: true,
                enableWaterFeatureBidding: true,
              },
            },
          });
        } else {
            setTenant(null);
        }
        setLoading(false);
        return;
      }

      // Check if user has a profile mapped to a tenant
      const userRef = doc(db, "users", user.uid);
      try {
        let userSnap = await getDoc(userRef);
        let activeTenantId = "genesis-1"; // fallback

        if (!userSnap.exists()) {
          // Initialize SaaS user and default tenant association
          await setDoc(userRef, {
            email: user.email,
            role: "admin",
            activeTenantId: activeTenantId,
            createdAt: new Date().toISOString()
          });
          setUserRole("admin");
        } else {
            const data = userSnap.data();
            activeTenantId = data.activeTenantId || "genesis-1";
            setUserRole(data.role || "admin");
        }

        const unsubTenant = onSnapshot(
          doc(db, "tenants", activeTenantId),
          (docSnap) => {
            if (docSnap.exists()) {
              setTenant({ id: docSnap.id, ...docSnap.data() } as TenantProfile);
            } else {
              setTenant({
                id: activeTenantId,
                name: "Cutty Sandbox",
                tier: "free",
                legal: {
                  aiDisclaimerAccepted: false,
                },
                quotas: {
                  aiRequestsMonthly: 48,
                  aiRequestLimit: 50,
                },
                settings: {
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
                  },
                  subFeatures: {},
                },
              });
            }
            setLoading(false);
          },
          (err) => {
             console.error("Tenant fetch failed:", err);
             setError("Tenant resolution failed. Check permissions.");
             setLoading(false);
          }
        );

        return () => unsubTenant();
      } catch (e: any) {
         console.error(e);
         setError(e.message);
         setLoading(false);
      }
    });

    return () => unsubscribeAuth();
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

