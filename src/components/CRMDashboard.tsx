import React from "react";
import { Customer } from "../types";
import { BarChart3, TrendingUp, Users, DollarSign, Activity } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

export const CRMDashboard = ({ customers }: { customers: Customer[] }) => {
  // Mock data for analytics based on real customer count
  const growthData = [
    { month: "Jan", leads: 40, won: 24, revenue: 15400 },
    { month: "Feb", leads: 50, won: 28, revenue: 18200 },
    { month: "Mar", leads: 45, won: 30, revenue: 21500 },
    { month: "Apr", leads: 60, won: 35, revenue: 25800 },
    { month: "May", leads: 70, won: 42, revenue: 32400 },
    { month: "Jun", leads: Math.max(80, customers.length + 20), won: Math.max(48, Math.floor(customers.length * 0.7)), revenue: 38900 },
  ];

  const valueDistribution = [
    { name: "Enterprise", value: 45 },
    { name: "HOA", value: 25 },
    { name: "Residential", value: 20 },
    { name: "Commercial", value: 10 },
  ];

  const totalRevenue = growthData.reduce((acc, curr) => acc + curr.revenue, 0);

  return (
    <div className="flex h-full w-full gap-6 p-6 overflow-y-auto custom-scrollbar flex-col bg-zinc-950">
      
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-forest-500/10 rounded-full blur-2xl group-hover:bg-forest-500/20 transition-colors"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-forest-500/20 text-forest-500 flex items-center justify-center border border-forest-500/30">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-black">Total Clients</p>
              <h3 className="text-3xl font-black text-white">{customers.length || 0}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-forest-400 bg-forest-500/10 w-fit px-2 py-1 rounded">
            <TrendingUp size={12} /> +12% this month
          </div>
        </div>

        <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center border border-blue-500/30">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-black">YTD Revenue</p>
              <h3 className="text-3xl font-black text-white">${(totalRevenue).toLocaleString()}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-400 bg-blue-500/10 w-fit px-2 py-1 rounded">
            <TrendingUp size={12} /> +24% vs last year
          </div>
        </div>

        <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-colors"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-black">Win Rate</p>
              <h3 className="text-3xl font-black text-white">68%</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-purple-400 bg-purple-500/10 w-fit px-2 py-1 rounded">
            <TrendingUp size={12} /> +4% this month
          </div>
        </div>

        <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-colors"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <BarChart3 size={24} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-black">Active Campaigns</p>
              <h3 className="text-3xl font-black text-white">3</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-white/40 bg-white/5 w-fit px-2 py-1 rounded">
             Running on Auto-Pilot
          </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900 border border-white/5 rounded-3xl p-6 shadow-xl h-[450px] flex flex-col">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-black uppercase tracking-widest text-white">Revenue Growth</h3>
              <select className="bg-black border border-white/10 text-white/60 text-xs px-3 py-1.5 rounded-lg outline-none cursor-pointer">
                <option>Last 6 Months</option>
                <option>This Year</option>
                <option>All Time</option>
              </select>
           </div>
           <div className="flex-1 w-full min-h-0">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="month" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#ffffff20', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    formatter={(val: any) => [`$${Number(val).toLocaleString()}`, "Revenue"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 shadow-xl h-[450px] flex flex-col">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-black uppercase tracking-widest text-white">Lead Conversion</h3>
           </div>
           <div className="flex-1 w-full min-h-0">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={growthData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                  <XAxis type="number" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="month" type="category" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#ffffff05' }}
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#ffffff20', borderRadius: '12px' }}
                  />
                  <Bar dataKey="leads" fill="#ffffff20" radius={[0, 4, 4, 0]} barSize={12} name="Total Leads" />
                  <Bar dataKey="won" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} name="Won Deals" />
                </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

    </div>
  );
};
