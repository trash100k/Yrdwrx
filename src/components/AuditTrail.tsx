import React, { useState } from "react";
import { Shield, List, Lock, Filter } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Dumb renderer: the parent (Compliance) owns the Supabase read + RLS scoping
// and passes already-adapted rows (timestamp/module/actionType/details/userEmail/role).
export default function AuditTrail({
  logs = [],
  loading = false,
}: {
  logs?: any[];
  loading?: boolean;
}) {
  const [filterModule, setFilterModule] = useState<string>("all");

  const auditLogs = logs;
  const filteredLogs = filterModule === "all" ? auditLogs : auditLogs.filter(log => log.module === filterModule);
  
  const modules = Array.from(new Set(auditLogs.map(log => log.module))).filter(Boolean);

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-2xl flex flex-col h-full overflow-hidden relative">
      <div className="p-6 sm:p-8 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-forest-500/10 rounded-xl border border-forest-500/20">
            <Lock className="text-forest-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight text-white flex items-center gap-2">
              Immutable Audit Trail
              <Shield size={14} className="text-forest-400" />
            </h2>
            <p className="text-xs text-white/50 tracking-wide">Cryptographically sealed log of key role-based user actions</p>
          </div>
        </div>
        
        {modules.length > 0 && (
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg p-1">
            <Filter size={14} className="text-zinc-500 ml-2" />
            <select 
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-white uppercase tracking-widest focus:ring-0 p-2 cursor-pointer"
            >
              <option value="all">All Modules</option>
              {modules.map(mod => (
                <option key={mod} value={mod}>{mod}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {loading ? (
          <div className="text-center py-12 text-zinc-500 text-sm tracking-widest uppercase font-bold animate-pulse">
            Syncing Ledger...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-white/30 italic text-sm border-2 border-dashed border-white/5 rounded-xl">
            No audit logs recorded for this criteria.
          </div>
        ) : (
          <AnimatePresence>
            {filteredLogs.map((log) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={log.id} 
                className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-black/40 hover:bg-black/60 transition-colors border border-white/5 rounded-xl gap-4 group"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase font-black tracking-widest text-[#B388FF] bg-[#B388FF]/10 border border-[#B388FF]/20 px-2 py-0.5 rounded-md">
                      {log.module}
                    </span>
                    <span className="text-[10px] uppercase font-black tracking-widest text-forest-400 bg-forest-500/10 border border-forest-500/20 px-2 py-0.5 rounded-md">
                      {log.actionType}
                    </span>
                  </div>
                  <p className="text-sm text-white/90 font-medium group-hover:text-white transition-colors">{log.details}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-3 flex items-center gap-2">
                     <span className="text-zinc-400 font-bold">{log.userEmail}</span>
                     <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                     <span className="bg-white/5 px-2 py-0.5 rounded text-white/70">Role: {log.role}</span>
                  </p>
                </div>
                <div className="text-left sm:text-right shrink-0 py-2 sm:py-0 border-t sm:border-t-0 border-white/5 sm:border-l sm:pl-5 mt-2 sm:mt-0">
                  <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Just now'}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
