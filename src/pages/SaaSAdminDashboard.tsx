import { fetchApi } from "../lib/api";
import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Activity, Database, AlertOctagon, Lock, Building2, CreditCard, Crown } from 'lucide-react';
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../contexts/ToastContext";

interface Tenant {
  id: string;
  name: string;
  tier: "free" | "pro" | "enterprise";
  createdAt?: string | number;
  members?: number;
  stripeConnected?: boolean;
  aiCreditsUsed?: number;
}

type TenantTier = "free" | "pro" | "enterprise";

export default function SaaSAdminDashboard() {
  const [threats, setThreats] = useState<any[]>([]);
  const [health, setHealth] = useState<{ status?: string; aiMode?: string; supabase?: boolean } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const { showToast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  const [savingTier, setSavingTier] = useState<string | null>(null);

  useEffect(() => {
    // Poll the backend memory log every 5 seconds
    const fetchThreats = async () => {
      try {
        const res = await fetchApi('/api/security/threats');
        if (res.ok) {
          const data = await res.json();
          setThreats(data);
        }
      } catch (err) {
        console.error("Failed to fetch threat logs", err);
      }
    };

    const fetchHealth = async () => {
      try {
        const res = await fetchApi('/api/health');
        if (res.ok) {
          const data = await res.json();
          setHealth(data);
        } else {
          setHealth(null);
        }
      } catch (err) {
        console.error("Failed to fetch API health", err);
        setHealth(null);
      } finally {
        setHealthLoading(false);
      }
    };

    fetchThreats();
    fetchHealth();
    const int = setInterval(fetchThreats, 5000);
    const healthInt = setInterval(fetchHealth, 15000);
    return () => {
      clearInterval(int);
      clearInterval(healthInt);
    };
  }, []);

  useEffect(() => {
    const fetchTenants = async () => {
      setTenantsLoading(true);
      setTenantsError(null);
      try {
        const res = await fetchApi('/api/admin/tenants');
        if (res.status === 403) {
          setTenantsError("Platform admin access required");
          setTenants([]);
          return;
        }
        if (res.status === 503) {
          setTenantsError("Tenant console needs the server service key");
          setTenants([]);
          return;
        }
        if (!res.ok) {
          setTenantsError("Unable to load tenants");
          setTenants([]);
          return;
        }
        const data = await res.json();
        setTenants(Array.isArray(data?.tenants) ? data.tenants : []);
      } catch (err) {
        console.error("Failed to fetch tenants", err);
        setTenantsError("Unable to load tenants");
        setTenants([]);
      } finally {
        setTenantsLoading(false);
      }
    };
    fetchTenants();
  }, []);

  const handleTierChange = async (tenantId: string, nextTier: TenantTier) => {
    const previous = tenants.find(t => t.id === tenantId)?.tier;
    if (previous === nextTier) return;
    // Optimistic update
    setTenants(prev => prev.map(t => (t.id === tenantId ? { ...t, tier: nextTier } : t)));
    setSavingTier(tenantId);
    try {
      const res = await fetchApi(`/api/admin/tenants/${tenantId}/tier`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: nextTier }),
      });
      if (!res.ok) {
        let msg = "Failed to update tier";
        if (res.status === 403) msg = "Platform admin access required";
        else if (res.status === 503) msg = "Tenant console needs the server service key";
        throw new Error(msg);
      }
      const data = await res.json().catch(() => ({}));
      if (data && data.success === false) throw new Error("Failed to update tier");
      showToast(`Tier updated to ${nextTier}`, "success");
    } catch (err: any) {
      // Roll back optimistic update
      setTenants(prev => prev.map(t => (t.id === tenantId ? { ...t, tier: (previous as TenantTier) ?? t.tier } : t)));
      showToast(err?.message || "Failed to update tier", "error");
    } finally {
      setSavingTier(null);
    }
  };

  const tenantStats = useMemo(() => {
    const total = tenants.length;
    const paid = tenants.filter(t => t.tier === 'pro' || t.tier === 'enterprise').length;
    const stripe = tenants.filter(t => t.stripeConnected).length;
    return { total, paid, stripe };
  }, [tenants]);

  const formatDate = (value?: string | number) => {
    if (!value && value !== 0) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
  };

  const apiOk = health?.status === 'ok';

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-24 animate-in fade-in zoom-in duration-500">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-normal md:tracking-tighter italic mb-2 text-red-500 flex items-center gap-3">
              <Lock size={32} /> Level-0 SaaS Core
            </h1>
            <p className="text-white/60 font-semibold tracking-wider text-sm">
              Gaelworx Global Infrastructure & Tenant Perimeter Monitoring
            </p>
        </div>
        <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Super Admin Active
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-zinc-950 border border-white/5 molten-edge p-6 rounded-2xl">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-celtic-500/10 text-celtic-400 rounded-2xl">
                 <Database size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest text-white">Tenants</h3>
                <p className="text-xs text-white/40 font-semibold">Active Environments</p>
              </div>
           </div>
           {tenantsLoading ? (
             <div className="text-5xl font-black italic tracking-normal md:tracking-tighter text-white/30 animate-pulse">
               &middot;&middot;&middot;
             </div>
           ) : tenantsError ? (
             <div className="text-5xl font-black italic tracking-normal md:tracking-tighter text-white/40">
               &mdash;
             </div>
           ) : (
             <div className="text-5xl font-black italic tracking-normal md:tracking-tighter text-white">
               {tenantStats.total}
             </div>
           )}
           <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-2">
             {tenantsError ? 'Source unavailable' : 'Live tenant count'}
           </p>
        </div>

        <div className="bg-zinc-950 border border-white/5 molten-edge p-6 rounded-2xl">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-forest-500/10 text-forest-400 rounded-2xl">
                 <Activity size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest text-white">Express API</h3>
                <p className="text-xs text-white/40 font-semibold">Live Health Probe</p>
              </div>
           </div>
           {healthLoading ? (
             <div className="text-5xl font-black italic tracking-normal md:tracking-tighter text-white/30 animate-pulse">
               &middot;&middot;&middot;
             </div>
           ) : (
             <div className={`text-5xl font-black italic tracking-normal md:tracking-tighter ${apiOk ? 'text-forest-400' : 'text-red-500'}`}>
               {apiOk ? 'OK' : 'Down'}
             </div>
           )}
           {!healthLoading && apiOk && (
             <div className="flex items-center gap-2 mt-3">
               <span className="text-[10px] font-black uppercase tracking-widest text-white/40">AI Mode</span>
               <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${health?.aiMode === 'live' ? 'text-forest-400 border-forest-500/30 bg-forest-500/5' : 'text-amber-400 border-amber-500/30 bg-amber-500/5'}`}>
                 {health?.aiMode || 'unknown'}
               </span>
             </div>
           )}
        </div>

        <div className="bg-red-500/5 text-red-500 border border-red-500/20 p-6 rounded-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/20 blur-[50px]" />
           <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="p-3 bg-red-500/10 rounded-2xl">
                 <AlertOctagon size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest">Blocks</h3>
                <p className="text-xs text-red-500/60 font-semibold">Middleware Intercepts</p>
              </div>
           </div>
           <div className="text-5xl font-black italic tracking-normal md:tracking-tighter relative z-10">
             {threats.length}
           </div>
        </div>
      </div>

      {/* Tenant Console */}
      <section className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-zinc-950 border border-white/5 molten-edge p-6 rounded-2xl">
             <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-celtic-500/10 text-celtic-400 rounded-xl">
                   <Building2 size={20} />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-white/60">Total Tenants</h3>
             </div>
             {tenantsLoading ? (
               <Skeleton className="h-10 w-20" />
             ) : (
               <div className="text-4xl font-black italic tracking-normal md:tracking-tighter text-white">{tenantStats.total}</div>
             )}
          </div>

          <div className="bg-zinc-950 border border-white/5 molten-edge p-6 rounded-2xl">
             <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
                   <Crown size={20} />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-white/60">Pro / Enterprise</h3>
             </div>
             {tenantsLoading ? (
               <Skeleton className="h-10 w-20" />
             ) : (
               <div className="text-4xl font-black italic tracking-normal md:tracking-tighter text-white">{tenantStats.paid}</div>
             )}
          </div>

          <div className="bg-zinc-950 border border-white/5 molten-edge p-6 rounded-2xl">
             <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-forest-500/10 text-forest-400 rounded-xl">
                   <CreditCard size={20} />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-white/60">Stripe Connected</h3>
             </div>
             {tenantsLoading ? (
               <Skeleton className="h-10 w-20" />
             ) : (
               <div className="text-4xl font-black italic tracking-normal md:tracking-tighter text-white">{tenantStats.stripe}</div>
             )}
          </div>
        </div>

        <div className="bg-zinc-950 border border-white/5 molten-edge rounded-2xl overflow-hidden">
           <div className="p-6 border-b border-white/5 molten-edge bg-white/[0.02]">
              <h3 className="text-lg font-black uppercase tracking-widest text-white flex items-center gap-3">
                <Building2 className="text-celtic-400" /> Tenant Console
              </h3>
              <p className="text-xs text-white/40 font-semibold mt-1">Platform-wide environment registry & plan control</p>
           </div>
           <div className="p-6 overflow-x-auto">
              {tenantsLoading ? (
                 <div className="space-y-3">
                    {[0, 1, 2, 3].map(i => (
                       <Skeleton key={i} className="h-12 w-full" />
                    ))}
                 </div>
              ) : tenantsError ? (
                 <div className="text-center py-12 text-amber-400 uppercase tracking-widest text-xs font-bold flex flex-col items-center gap-3">
                    <Lock size={28} className="text-amber-400/70" />
                    {tenantsError}
                 </div>
              ) : tenants.length === 0 ? (
                 <EmptyState
                    icon={Building2}
                    title="No tenants yet"
                    description="No tenant environments have been provisioned on this platform. New tenants will appear here as they onboard."
                 />
              ) : (
                 <table className="w-full text-left min-w-[760px]">
                    <thead>
                       <tr className="text-xs md:text-[10px] text-white/40 uppercase tracking-widest border-b border-white/5 molten-edge">
                         <th className="pb-4 font-bold">Tenant</th>
                         <th className="pb-4 font-bold">Tier</th>
                         <th className="pb-4 font-bold text-right">Members</th>
                         <th className="pb-4 font-bold">Created</th>
                         <th className="pb-4 font-bold text-center">Stripe</th>
                         <th className="pb-4 font-bold text-right">AI Credits</th>
                       </tr>
                    </thead>
                    <tbody className="text-sm text-white/80">
                       {tenants.map(t => (
                          <tr key={t.id} className="border-b border-white/5 molten-edge hover:bg-white/5 transition-colors">
                             <td className="py-4 font-bold text-white">{t.name || t.id}</td>
                             <td className="py-4">
                                <select
                                   value={t.tier}
                                   disabled={savingTier === t.id}
                                   onChange={(e) => handleTierChange(t.id, e.target.value as TenantTier)}
                                   className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-widest text-white focus:outline-none focus:border-celtic-400/50 disabled:opacity-50 cursor-pointer"
                                >
                                   <option value="free">Free</option>
                                   <option value="pro">Pro</option>
                                   <option value="enterprise">Enterprise</option>
                                </select>
                             </td>
                             <td className="py-4 text-right font-mono text-white/60">{t.members ?? 0}</td>
                             <td className="py-4 text-white/50">{formatDate(t.createdAt)}</td>
                             <td className="py-4 text-center">
                                {t.stripeConnected ? (
                                   <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border text-forest-400 border-forest-500/30 bg-forest-500/5">Yes</span>
                                ) : (
                                   <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border text-white/40 border-white/10 bg-white/5">No</span>
                                )}
                             </td>
                             <td className="py-4 text-right font-mono text-white/60">{(t.aiCreditsUsed ?? 0).toLocaleString()}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              )}
           </div>
        </div>
      </section>

      <div className="bg-zinc-950 border border-white/5 molten-edge rounded-2xl overflow-hidden">
         <div className="p-6 border-b border-white/5 molten-edge bg-white/[0.02]">
            <h3 className="text-lg font-black uppercase tracking-widest text-white flex items-center gap-3">
              <Shield className="text-ember-500" /> Live Threat Memory Log
            </h3>
         </div>
         <div className="p-6 overflow-x-auto">
            {threats.length === 0 ? (
               <div className="text-center py-12 text-white/40 uppercase tracking-widest text-xs font-bold">
                  No active threats detected in memory since last boot.
               </div>
            ) : (
               <table className="w-full text-left min-w-full md:w-[600px]">
                  <thead>
                     <tr className="text-xs md:text-[10px] text-white/40 uppercase tracking-widest border-b border-white/5 molten-edge">
                       <th className="pb-4 font-bold">Timestamp</th>
                       <th className="pb-4 font-bold">IP Source</th>
                       <th className="pb-4 font-bold">Attack Vector</th>
                       <th className="pb-4 font-bold">Target Route</th>
                       <th className="pb-4 font-bold text-right">Status</th>
                     </tr>
                  </thead>
                  <tbody className="text-xs font-mono text-white/80">
                     {threats.map(t => (
                        <tr key={t.id} className="border-b border-white/5 molten-edge hover:bg-white/5 transition-colors">
                           <td className="py-4 text-white/40">{new Date(t.timestamp).toLocaleTimeString()}</td>
                           <td className="py-4">{t.ip}</td>
                           <td className="py-4 text-ember-400 font-bold">{t.type}</td>
                           <td className="py-4 text-forest-400">{t.target}</td>
                           <td className="py-4 text-right">
                              <span className="bg-red-500/20 text-red-500 px-2 py-1 rounded border border-red-500/30 font-black tracking-widest text-[9px]">
                                {t.status}
                              </span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            )}
         </div>
      </div>
    </div>
  );
}
