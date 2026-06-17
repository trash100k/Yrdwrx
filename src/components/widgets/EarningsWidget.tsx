// @ts-nocheck
import React from 'react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from "recharts";

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

export default function EarningsWidget({ isReel, flexOrder }: { isReel: boolean, flexOrder?: number }) {
  return (
    <div
      style={flexOrder !== undefined ? { order: flexOrder } : undefined}
      className={
        isReel
          ? "relative bg-zinc-950 border border-white/5 molten-edge rounded-2xl p-5 sm:p-8 shadow-2xl space-y-8 flex flex-col justify-between w-[85vw] md:w-full md:w-[450px] max-w-full shrink-0 snap-start h-[500px]"
          : "bg-zinc-950 border border-white/5 molten-edge rounded-2xl sm:rounded-2xl p-5 sm:p-8 col-span-1 lg:col-span-2 shadow-2xl space-y-8 flex flex-col justify-between"
      }
    >
      <div className="flex justify-between items-center">
        <div className="space-y-1 shrink-0">
          <span className="text-xs md:text-[10px] font-bold text-forest-400 tracking-widest uppercase">
            Income Delta
          </span>
          <h4 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tight">
            Active Inflow Progress
          </h4>
        </div>
        <div className="text-xs text-zinc-500 font-bold bg-zinc-900 border border-white/5 molten-edge px-4 py-2 rounded-xl">
          Live Audit Syncing
        </div>
      </div>

      <div className="h-44 sm:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={revenueData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{
                backgroundColor: "#09090b",
                borderColor: "#27272a",
                borderRadius: "16px",
                color: "#fff",
              }}
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
          <p className="text-xs md:text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
            Earnings MTD
          </p>
          <p className="text-lg font-bold text-white mt-1">$142,500</p>
        </div>
        <div>
          <p className="text-xs md:text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
            Projected MTD
          </p>
          <p className="text-lg font-bold text-forest-400 mt-1">$155,000</p>
        </div>
        <div>
          <p className="text-xs md:text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
            Efficiency Margin
          </p>
          <p className="text-lg font-bold text-white mt-1">94.2%</p>
        </div>
      </div>
    </div>
  );
}
