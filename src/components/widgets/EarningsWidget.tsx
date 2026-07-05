// @ts-nocheck
import React from 'react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n) || 0);

export default function EarningsWidget({ isReel, flexOrder, data, totals }: { isReel: boolean, flexOrder?: number, data?: any[], totals?: { earningsMTD: number, count: number } }) {
  const hasReal = Array.isArray(data) && data.length > 0;
  const avgInvoice = totals && totals.count ? totals.earningsMTD / totals.count : 0;
  const shell =
    isReel
      ? "relative bg-zinc-950 border border-white/5 molten-edge rounded-2xl p-5 sm:p-8 shadow-2xl space-y-8 flex flex-col justify-between w-[85vw] md:w-[450px] max-w-full shrink-0 snap-start h-[500px]"
      : "bg-zinc-950 border border-white/5 molten-edge rounded-2xl sm:rounded-2xl p-5 sm:p-8 col-span-1 lg:col-span-2 shadow-2xl space-y-8 flex flex-col justify-between";

  return (
    <div style={flexOrder !== undefined ? { order: flexOrder } : undefined} className={shell}>
      <div className="flex justify-between items-center">
        <div className="space-y-1 shrink-0">
          <span className="text-xs md:text-[10px] font-bold text-forest-400 tracking-widest uppercase">
            Income Delta
          </span>
          <h4 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tight">
            Active Inflow Progress
          </h4>
        </div>
        {hasReal && (
          <div className="text-xs text-forest-400 font-bold bg-forest-500/10 border border-forest-500/20 px-4 py-2 rounded-xl uppercase tracking-widest">
            Live · Paid Invoices
          </div>
        )}
      </div>

      {hasReal ? (
        <>
          <div className="h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "16px", color: "#fff" }}
                  labelStyle={{ fontWeight: "bold" }}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorActual)"
                  name="Income ($)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-4 text-center">
            <div>
              <p className="text-xs md:text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Earnings MTD</p>
              <p className="text-lg font-bold text-white mt-1">{usd(totals?.earningsMTD || 0)}</p>
            </div>
            <div>
              <p className="text-xs md:text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Invoices Paid</p>
              <p className="text-lg font-bold text-forest-400 mt-1">{totals?.count ?? 0}</p>
            </div>
            <div>
              <p className="text-xs md:text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Avg Invoice</p>
              <p className="text-lg font-bold text-white mt-1">{usd(avgInvoice)}</p>
            </div>
          </div>
        </>
      ) : (
        // Honest empty state — no fabricated chart or dollar figures before any invoice is paid.
        <div className="flex-1 flex flex-col items-center justify-center text-center py-10 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-zinc-500">
            <TrendingUp size={22} />
          </div>
          <p className="text-sm font-bold text-white/70">No paid invoices yet</p>
          <p className="text-xs text-zinc-500 max-w-xs leading-normal">
            Your last 14 days of paid revenue and month-to-date totals appear here the moment your first invoice is marked paid.
          </p>
        </div>
      )}
    </div>
  );
}
