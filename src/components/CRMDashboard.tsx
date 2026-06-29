import React, { useEffect, useMemo, useState } from "react";
import { Customer } from "../types";
import { BarChart3, TrendingUp, Users, DollarSign, Activity } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { invoicesRepo } from "../lib/repos";

// Repos return camelCase; some rows carry a freeform `data` jsonb. Flatten so we can
// read both top-level columns and nested data fields uniformly.
const flatten = (r: any) => ({ ...(r?.data || {}), ...r });

const num = (v: any) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
};

const isPaid = (status: any) => String(status || "").toLowerCase() === "paid";

// Pipeline stages mirror Pipeline.tsx (lowercase statuses).
const PIPELINE = [
  { id: "lead", label: "Lead", color: "#3b82f6" },
  { id: "contacted", label: "Contacted", color: "#a855f7" },
  { id: "estimate", label: "Estimate", color: "#eab308" },
  { id: "active", label: "Active", color: "#22c55e" },
  { id: "lost", label: "Lost", color: "#f43f5e" },
];

export const CRMDashboard = ({ customers }: { customers: Customer[] }) => {
  const [invoices, setInvoices] = useState<any[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = (await invoicesRepo.list()) as any[];
        if (!cancelled) setInvoices((rows || []).map(flatten));
      } catch {
        if (!cancelled) setInvoices([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Real pipeline breakdown from customers (status defaults to "lead", matching Pipeline.tsx).
  const stageData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of customers) {
      const s = (c.status || "lead").toString().toLowerCase();
      counts[s] = (counts[s] || 0) + 1;
    }
    return PIPELINE.map((stage) => ({ ...stage, count: counts[stage.id] || 0 }));
  }, [customers]);

  const totalClients = customers.length;
  const activeClients = stageData.find((s) => s.id === "active")?.count || 0;
  const lostClients = stageData.find((s) => s.id === "lost")?.count || 0;

  // Conversion = active / (active + lost) closed deals. Only meaningful once deals close.
  const closed = activeClients + lostClients;
  const conversionRate = closed > 0 ? Math.round((activeClients / closed) * 100) : null;

  // Real revenue from paid invoices, if any are available.
  const paidRevenue = useMemo(() => {
    if (!invoices) return null;
    return invoices.filter((inv) => isPaid(inv.status)).reduce((acc, inv) => acc + num(inv.amount), 0);
  }, [invoices]);

  return (
    <div className="flex h-full w-full gap-6 p-6 overflow-y-auto custom-scrollbar flex-col bg-zinc-950">

      {/* Top Stats Cards — derived from real data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-forest-500/10 rounded-full blur-2xl group-hover:bg-forest-500/20 transition-colors"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-forest-500/20 text-forest-500 flex items-center justify-center border border-forest-500/30">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-black">Total Clients</p>
              <h3 className="text-3xl font-black text-white">{totalClients || 0}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-forest-400 bg-forest-500/10 w-fit px-2 py-1 rounded">
            <Activity size={12} /> {activeClients} active
          </div>
        </div>

        {/* Revenue card — only shown when there are paid invoices to back it */}
        {paidRevenue !== null && paidRevenue > 0 && (
          <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors"></div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center border border-blue-500/30">
                <DollarSign size={24} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-black">Collected Revenue</p>
                <h3 className="text-3xl font-black text-white">${paidRevenue.toLocaleString()}</h3>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-400 bg-blue-500/10 w-fit px-2 py-1 rounded">
              <TrendingUp size={12} /> Paid invoices
            </div>
          </div>
        )}

        {/* Conversion card — only shown once deals have closed (won or lost) */}
        {conversionRate !== null && (
          <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-colors"></div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                <Activity size={24} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-black">Conversion Rate</p>
                <h3 className="text-3xl font-black text-white">{conversionRate}%</h3>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-purple-400 bg-purple-500/10 w-fit px-2 py-1 rounded">
              <BarChart3 size={12} /> {activeClients} won / {lostClients} lost
            </div>
          </div>
        )}
      </div>

      {/* Pipeline breakdown — real counts of customers by stage */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 shadow-xl h-[450px] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black uppercase tracking-widest text-white">Pipeline Breakdown</h3>
            <span className="text-xs font-bold text-white/40 bg-white/5 px-3 py-1.5 rounded-lg">
              {totalClients} client{totalClients === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex-1 w-full min-h-0">
            {totalClients === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-sm text-white/30 font-bold uppercase tracking-widest">
                No clients yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="label" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "#ffffff05" }}
                    contentStyle={{ backgroundColor: "#18181b", borderColor: "#ffffff20", borderRadius: "12px" }}
                    itemStyle={{ color: "#fff", fontWeight: "bold" }}
                    formatter={(val: any) => [val, "Clients"]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={48} name="Clients">
                    {stageData.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
