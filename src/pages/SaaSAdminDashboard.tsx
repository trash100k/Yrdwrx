import { fetchApi } from "../lib/api";
import React, { useState, useEffect } from 'react';
import { Shield, Activity, Database, AlertOctagon, Lock } from 'lucide-react';

export default function SaaSAdminDashboard() {
  const [threats, setThreats] = useState<any[]>([]);
  const [health, setHealth] = useState<{ status?: string; aiMode?: string; supabase?: boolean } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

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
           <div className="text-5xl font-black italic tracking-normal md:tracking-tighter text-white/40">
             &mdash;
           </div>
           <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-2">No count source wired</p>
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
