import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingDown } from "lucide-react";

export function StockDepletionChart() {
  const data = [
    { date: "May 1", mulch: 250, fertilizer: 120, topsoil: 300 },
    { date: "May 5", mulch: 210, fertilizer: 110, topsoil: 280 },
    { date: "May 10", mulch: 150, fertilizer: 90, topsoil: 220 },
    { date: "May 15", mulch: 110, fertilizer: 70, topsoil: 150 },
    { date: "May 20", mulch: 60, fertilizer: 40, topsoil: 80 },
    { date: "May 25", mulch: 25, fertilizer: 20, topsoil: 40 },
    { date: "May 29", mulch: 8, fertilizer: 5, topsoil: 10 },
  ];

  return (
    <div className="bg-zinc-950 border border-white/5 rounded-2xl p-6 sm:p-8 mt-12 mb-8 shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
           <h2 className="text-xl sm:text-2xl font-black uppercase tracking-normal md:tracking-tighter text-white flex items-center gap-3">
             <TrendingDown className="text-red-500" />
             Stock Level Over Time
           </h2>
           <p className="text-white/50 text-sm font-medium mt-1">High-turnover bulk items depletion rates</p>
        </div>
      </div>
      
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMulch" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorFertilizer" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorTopsoil" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="date" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181b', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }}
              itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
            />
            <Area type="monotone" dataKey="mulch" name="Mulch (Yards)" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMulch)" strokeWidth={3} />
            <Area type="monotone" dataKey="fertilizer" name="Fertilizer (Bags)" stroke="#10b981" fillOpacity={1} fill="url(#colorFertilizer)" strokeWidth={3} />
            <Area type="monotone" dataKey="topsoil" name="Topsoil (Yards)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorTopsoil)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
