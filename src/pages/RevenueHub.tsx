
import { useState } from "react";
import { motion } from "motion/react";
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePie,
  Pie,
  Cell,
} from "recharts";
import {
  Zap,
  TrendingUp,
  Globe,
  Target,
  ArrowUpRight,
  DollarSign,
  PieChart,
  Landmark,
  ReceiptText,
  CreditCard,
} from "lucide-react";
import RevenueRecovery from "../components/RevenueRecovery";

const revenueData = [
  { name: "May 04", actual: 4200, projected: 4000 },
  { name: "May 05", actual: 3800, projected: 4100 },
  { name: "May 06", actual: 5100, projected: 4200 },
  { name: "May 07", actual: 4800, projected: 4300 },
  { name: "May 08", actual: 6200, projected: 4500 },
  { name: "May 09", actual: 7100, projected: 5000 },
  { name: "May 10", actual: 5900, projected: 5200 },
  { name: "May 11", actual: 4400, projected: 5400 },
  { name: "May 12", actual: 8200, projected: 6000 },
  { name: "May 13", actual: 9500, projected: 6500 },
  { name: "May 14", actual: 8800, projected: 7000 },
  { name: "May 15", actual: 11200, projected: 8000 },
  { name: "May 16", actual: 12500, projected: 9000 },
  { name: "May 17", actual: 14200, projected: 10000 },
];

const allocationData = [
  { name: "Labor", value: 42, color: "#10b981" },
  { name: "Materials", value: 28, color: "#3b82f6" },
  { name: "Fleet", value: 18, color: "#f59e0b" },
  { name: "Admin", value: 12, color: "#a855f7" },
];

export default function RevenueHub() {
  const [activeMetric, setActiveMetric] = useState("revenue");

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-40">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-500/10 rounded-full border border-blue-500 text-xs font-black uppercase tracking-widest text-blue-500">
            <Landmark size={16} className="animate-pulse" />
            Strategic Growth Vector
          </div>
          <h1 className="text-6xl font-sans font-black tracking-tighter leading-none text-white italic uppercase">
            Capital Hub
          </h1>
          <p className="max-w-2xl text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2 leading-relaxed">
            Global Revenue Matrix
          </p>
        </div>

        <div className="flex gap-6 shrink-0 flex-col md:flex-row w-full md:w-auto">
          <div className="bg-black p-6 border-4 border-white/10 shadow-inner flex flex-col gap-2 items-end min-w-[200px] rounded-[32px]">
            <span className="text-xs font-black text-white/40 uppercase tracking-widest">
              MTD Revenue
            </span>
            <span className="text-4xl font-black italic text-white tracking-tighter">
              $142,800
            </span>
          </div>
          <div className="bg-black p-6 border-4 border-white/10 shadow-inner flex flex-col gap-2 items-end min-w-[200px] rounded-[32px]">
            <span className="text-xs font-black text-emerald-500/60 uppercase tracking-widest">
              Growth Delta
            </span>
            <span className="text-4xl font-black italic text-emerald-400 tracking-tighter">
              +22.4%
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 structural-border bg-zinc-900/20 p-12 relative overflow-hidden group rounded-[32px]">
          <header className="flex items-center justify-between mb-16 px-2">
            <div className="flex items-center gap-8">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-black shadow-2xl relative group-hover:scale-110 transition-transform">
                <TrendingUp size={32} />
                <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full -z-10" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tighter uppercase leading-none text-white italic">
                  Projected Cashflow
                </h2>
                <p className="text-[10px] text-emerald-400 font-black tracking-[0.4em] mt-3 uppercase opacity-60 italic">
                  Algorithmic Prediction Layer
                </p>
              </div>
            </div>
            <div className="flex bg-black/40 p-1.5 rounded-2xl border-4 border-white/10">
              <button className="px-6 py-2.5 bg-white text-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-xl">
                Weekly
              </button>
              <button className="px-6 py-2.5 text-white/40 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                Monthly
              </button>
            </div>
          </header>

          <div className="h-[350px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient
                    id="colorActualHub"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient
                    id="colorProjectedHub"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(0,0,0,0.9)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "24px",
                    padding: "16px",
                  }}
                  itemStyle={{
                    fontWeight: "900",
                    textTransform: "uppercase",
                    fontSize: "9px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="projected"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fillOpacity={1}
                  fill="url(#colorProjectedHub)"
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#10b981"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorActualHub)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-6 mt-10 pt-10 border-t border-white/10">
            {[
              { label: "Avg Ticket", value: "$842", trend: "+12%" },
              { label: "Burn Rate", value: "$12k/wk", trend: "Stable" },
              { label: "Net Margin", value: "38.4%", trend: "+4.1%" },
            ].map((m, i) => (
              <div key={i}>
                <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">
                  {m.label}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-white italic">
                    {m.value}
                  </span>
                  <span className="text-[8px] font-bold text-emerald-500">
                    {m.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-10 flex flex-col justify-between">
          <div>
            <header className="mb-10 flex justify-between items-start">
              <div>
                <p className="micro-label font-black text-white/20 uppercase tracking-widest mb-1 italic">
                  Expense Breakdown
                </p>
                <h3 className="text-2xl font-black italic text-white uppercase leading-none">
                  Expenses
                </h3>
              </div>
              <PieChart size={24} className="text-white/20" />
            </header>
            <div className="h-[200px] mb-10">
              <ResponsiveContainer width="100%" height="100%">
                <RePie>
                  <Pie
                    data={allocationData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </RePie>
              </ResponsiveContainer>
            </div>

            <div className="space-y-6">
              {allocationData.map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-[9px] font-black uppercase text-white/40 tracking-wider">
                      {item.name}
                    </span>
                    <span className="text-[10px] font-bold text-white italic">
                      {item.value}%
                    </span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.value}%` }}
                      style={{ backgroundColor: item.color }}
                      className="h-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button className="w-full py-5 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all mt-10">
            Review Expenses
          </button>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-10 space-y-8">
          <header className="flex items-center justify-between">
            <h4 className="micro-label font-black text-white/40 uppercase tracking-widest">
              Active Receivables
            </h4>
            <ReceiptText size={16} className="text-emerald-500" />
          </header>
          <div className="space-y-4">
            {[
              {
                client: "Schmidt Residence",
                amount: 1420,
                due: "2 days",
                status: "OVERDUE",
              },
              {
                client: "Oak Estates",
                amount: 3840,
                due: "5 days",
                status: "PENDING",
              },
              {
                client: "Arbor Lakes",
                amount: 1250,
                due: "Today",
                status: "PENDING",
              },
            ].map((inv, i) => (
              <div
                key={i}
                className="p-5 bg-zinc-900 border-4 border-white/10 rounded-2xl flex items-center justify-between group hover:bg-white/5 transition-all"
              >
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-tight italic">
                    {inv.client}
                  </p>
                  <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest mt-1">
                    Due {inv.due}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-white italic leading-none">
                    ${inv.amount}
                  </p>
                  <p
                    className={`text-[8px] font-black uppercase tracking-widest mt-1 ${inv.status === "OVERDUE" ? "text-red-500" : "text-emerald-400"}`}
                  >
                    {inv.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full py-4 bg-white/5 border-4 border-white/10 text-white/40 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition-all">
            Remind All Overdue
          </button>
        </section>

        <section className="lg:col-span-2 bg-zinc-900 border-4 border-white/10 shadow-2xl p-10 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-5">
            <CreditCard size={120} />
          </div>
          <RevenueRecovery />
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: "Revenue Recovery",
            value: "$8,240",
            signal: "GAINED",
            icon: Zap,
          },
          {
            label: "Market Share",
            value: "94.2%",
            signal: "HIGH",
            icon: Globe,
          },
          {
            label: "Efficiency",
            value: "+32.4%",
            signal: "OPTIMAL",
            icon: TrendingUp,
          },
          { label: "HNW Leads", value: "42", signal: "OPEN", icon: Target },
        ].map((opp, idx) => (
          <div
            key={idx}
            className="bg-zinc-900 border-4 border-white/10 shadow-2xl p-8 flex flex-col justify-between group hover:border-blue-500/50 transition-all"
          >
            <div>
              <span className="micro-label font-black text-white/20 uppercase tracking-widest leading-none mb-6 block">
                {opp.label}
              </span>
              <p className="text-4xl font-black italic tracking-tighter text-white mb-2 leading-none">
                {opp.value}
              </p>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">
                  {opp.signal}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
