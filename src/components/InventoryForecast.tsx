// @ts-nocheck
import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useTenant } from "../contexts/TenantContext";
import { InventoryItem, Job } from "../types";
import { TrendingDown, Activity, AlertTriangle, Package2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface InventoryForecastProps {
  items: InventoryItem[];
  onClose: () => void;
}

export default function InventoryForecast({ items, onClose }: InventoryForecastProps) {
  const { tenant } = useTenant();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const q = query(
          collection(db, "jobs"),
          where("tenantId", "==", tenant?.id || "genesis-1")
        );
        const snapshot = await getDocs(q);
        const fetchedJobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Job));
        setJobs(fetchedJobs);
      } catch (error) {
        console.error("Error fetching jobs for forecast:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, [tenant]);

  const generateForecast = () => {
    // Basic heuristic to estimate item usage based on jobs
    const upcomingJobs = jobs.filter(j => j.status === "SCHEDULED" || j.status === "PENDING");
    
    let forecastMap: Record<string, { used: number, runout: boolean }> = {};
    
    // Initialize forecast with 0 usage
    items.forEach(item => {
      forecastMap[item.id] = { used: 0, runout: false };
    });

    upcomingJobs.forEach(job => {
      const titleLower = job.title.toLowerCase();
      
      items.forEach(item => {
        const itemTarget = item.name.toLowerCase();
        
        // Simple mock intelligence: does job title suggest we need this item?
        let qtyToUse = 0;
        
        if ((titleLower.includes("mow") || titleLower.includes("lawn")) && 
            (itemTarget.includes("fuel") || itemTarget.includes("gas") || itemTarget.includes("blade"))) {
          qtyToUse = 2; // Arbitrary usage
        } else if (titleLower.includes("mulch") && itemTarget.includes("mulch")) {
          qtyToUse = 50; 
        } else if (titleLower.includes("clean") && itemTarget.includes("bag")) {
          qtyToUse = 10;
        } else if (titleLower.includes("trim") && itemTarget.includes("line")) {
          qtyToUse = 1;
        } else if (titleLower.includes("plant") && (itemTarget.includes("soil") || itemTarget.includes("dirt"))) {
          qtyToUse = 5;
        }

        if (forecastMap[item.id] && qtyToUse > 0) {
          forecastMap[item.id].used += qtyToUse;
        }
      });
    });

    // Determine runout
    items.forEach(item => {
      if (forecastMap[item.id]) {
        if (forecastMap[item.id].used > item.stock) {
          forecastMap[item.id].runout = true;
        }
      }
    });

    return forecastMap;
  };

  const forecastData = generateForecast();

  // Sort items to show those with runout risk first
  const sortedItems = [...items].sort((a, b) => {
    const aRisk = forecastData[a.id]?.runout ? 1 : 0;
    const bRisk = forecastData[b.id]?.runout ? 1 : 0;
    return bRisk - aRisk; // Put riskiest first
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-black/80 backdrop-blur-3xl border border-white/5 rounded-2xl p-8 lg:p-12 shadow-2xl relative"
    >
      <button 
        onClick={onClose}
        className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors"
      >
        Close Forecast
      </button>

      <div className="flex items-center gap-4 mb-10">
        <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-black">
          <TrendingDown size={32} />
        </div>
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-white italic uppercase tracking-normal md:tracking-tighter">
            AI Stock Forecast
          </h2>
          <p className="text-zinc-400 font-bold tracking-widest uppercase text-sm mt-1">
            Analyzing {jobs.filter(j => j.status === "SCHEDULED" || j.status === "PENDING").length} upcoming jobs against current supply
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Activity size={32} className="text-white/40 animate-pulse" />
        </div>
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto px-2 custom-scrollbar">
          {sortedItems.length === 0 ? (
            <p className="text-white/50 font-bold uppercase tracking-widest text-center py-20">
              No inventory to forecast.
            </p>
          ) : (
            sortedItems.map(item => {
              const forecast = forecastData[item.id] || { used: 0, runout: false };
              const percentUsed = item.stock > 0 ? (forecast.used / (item.stock + forecast.used)) * 100 : 100;
              const remaining = item.stock - forecast.used;

              return (
                <div 
                  key={item.id}
                  className={`border-4 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all ${
                    forecast.runout 
                      ? "border-red-500/50 bg-red-500/10"
                      : forecast.used > 0 
                      ? "border-blue-500/30 bg-blue-500/5"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      forecast.runout ? "bg-red-500 text-white" : forecast.used > 0 ? "bg-blue-500 text-white" : "bg-white/10 text-white/50"
                    }`}>
                      {forecast.runout ? <AlertTriangle size={24} /> : <Package2 size={24} />}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-wider">{item.name}</h3>
                      <p className="text-xs font-bold text-white/50 uppercase tracking-widest mt-1">
                        Current Stock: {item.stock} {item.category || "UNIT"}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 md:max-w-xs space-y-3">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-white/70">
                      <span>Projected Need</span>
                      <span className={forecast.runout ? "text-red-400" : "text-white"}>{forecast.used} needed</span>
                    </div>
                    <div className="h-3 w-full bg-black rounded-full overflow-hidden border border-white/10">
                      <div 
                        className={`h-full rounded-full ${forecast.runout ? "bg-red-500" : "bg-blue-500"}`} 
                        style={{ width: `${Math.min(100, (forecast.used / (item.stock === 0 ? 1 : item.stock)) * 100)}%` }} 
                      />
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs md:text-[10px] font-black text-white/40 uppercase tracking-widest">
                      Estimated Remaining
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black italic tracking-normal md:tracking-tighter mt-1 ${forecast.runout ? "text-red-500" : "text-white"}`}>
                      {remaining < 0 ? 0 : remaining}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </motion.div>
  );
}
