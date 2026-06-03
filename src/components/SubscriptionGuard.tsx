// @ts-nocheck
import React from "react";
import { Link } from "react-router-dom";
import { useTenant } from "../contexts/TenantContext";
import { Lock, CreditCard } from "lucide-react";

interface Props {
  children: React.ReactNode;
  requiredTier?: "free" | "pro" | "enterprise";
}

export function SubscriptionGuard({ children, requiredTier = "pro" }: Props) {
  const { tenant, loading } = useTenant();

  if (loading) return null;

  const tiers = { free: 0, pro: 1, enterprise: 2 };
  
  if (!tenant) return <>{children}</>;

  const currentTierLevel = tiers[tenant.tier] || 0;
  const requiredTierLevel = tiers[requiredTier] || 0;

  if (currentTierLevel < requiredTierLevel) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-zinc-950 border border-white/5 rounded-3xl mt-12 mx-auto max-w-2xl">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white italic uppercase tracking-normal md:tracking-tighter mb-4">
          Feature Locked
        </h2>
        <p className="text-zinc-400 mb-8 max-w-md mx-auto">
          This capability requires the <strong className="text-amber-400 uppercase">{requiredTier}</strong> tier or higher. Upgrade your platform license to unlock advanced operational tools.
        </p>
        <Link 
          to="../settings"
          className="bg-emerald-500 text-black px-8 py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-transform flex items-center gap-3"
        >
          <CreditCard size={18} />
          Upgrade License
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
