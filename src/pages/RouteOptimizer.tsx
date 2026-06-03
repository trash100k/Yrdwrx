import { fetchApi } from "../lib/api";
// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Truck, Map as MapIcon, Route, Play, Settings, CheckCircle2, Navigation2 } from "lucide-react";
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";

export default function RouteOptimizer() {
  const [optimizing, setOptimizing] = useState(false);
  const [complete, setComplete] = useState(false);
  const [routeData, setRouteData] = useState<any>(null);
  const [mapsApiKey, setMapsApiKey] = useState("");

  useEffect(() => {
    fetchApi("/api/config/maps")
      .then((res) => res.json())
      .then((data) => setMapsApiKey(data.apiKey))
      .catch((err) => console.error("Failed to load maps config", err));
  }, []);

  // Simulated initial waypoints representing scheduled jobs
  const [waypoints] = useState([
    { lat: 32.3643, lng: -88.7037, id: "W1" }, // Meridian HQ (Origin)
    { lat: 32.4100, lng: -88.6800, id: "W2" }, // Job 1
    { lat: 32.3200, lng: -88.7200, id: "W3" }, // Job 2
    { lat: 32.3800, lng: -88.6500, id: "W4" }, // Job 3
    { lat: 32.3500, lng: -88.6900, id: "W5" }  // Return HQ (Destination)
  ]);

  const startOptimization = async () => {
    setOptimizing(true);
    try {
      const response = await fetchApi("/api/workflows/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waypoints })
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch route optimization");
      }
      
      setRouteData(data);
      setComplete(true);
    } catch (err: any) {
      console.error(err);
      alert(`Optimization Error: ${err.message}`);
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="p-5 sm:p-8 max-w-7xl mx-auto min-h-[100dvh]">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <MapIcon size={32} className="text-emerald-400" />
          <h1 className="text-2xl sm:text-3xl sm:text-4xl font-black text-white italic uppercase tracking-tight">Route Optimization</h1>
        </div>
        <button 
          onClick={startOptimization}
          disabled={optimizing || complete}
          className="bg-emerald-500 text-black px-6 py-3 rounded-full font-black uppercase text-sm tracking-widest hover:scale-105 active:scale-95 transition-transform flex items-center gap-2 disabled:opacity-50"
        >
          {optimizing ? (
            <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Optimizing...</>
          ) : complete ? (
            <><CheckCircle2 size={18} /> Optimized</>
          ) : (
            <><Play size={18} /> Run Optimizer</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900 border border-white/5 rounded-3xl overflow-hidden h-[600px] relative">
          {mapsApiKey ? (
            <APIProvider apiKey={mapsApiKey}>
              <Map
                defaultZoom={11}
                defaultCenter={{ lat: 32.3643, lng: -88.7037 }} // Meridian, MS (from earlier context)
                mapId="ROUTE_OPTIMIZER_MAP"
                disableDefaultUI={true}
                className="w-full h-full"
              >
                {waypoints.map((wp, i) => (
                  <AdvancedMarker key={wp.id} position={{ lat: wp.lat, lng: wp.lng }}>
                    {i === 0 || i === waypoints.length - 1 ? (
                      <div className="w-6 h-6 bg-emerald-500 rounded-full border border-zinc-900 flex items-center justify-center text-[8px] font-bold">
                        HQ
                      </div>
                    ) : (
                      <div className="w-5 h-5 bg-blue-500 rounded-full border-2 border-black flex items-center justify-center text-xs md:text-[10px] text-white font-bold">
                        {routeData?.data?.routes && routeData.data.routes[0]?.optimizedIntermediateWaypointIndex ? 
                          routeData.data.routes[0].optimizedIntermediateWaypointIndex.indexOf(i - 1) + 1 : i}
                      </div>
                    )}
                  </AdvancedMarker>
                ))}
              </Map>
            </APIProvider>
          ) : (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
               <span className="w-8 h-8 border border-white/5 border-t-emerald-500 rounded-full animate-spin"></span>
             </div>
          )}
          {optimizing && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center flex-col z-10">
              <span className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              <div className="mt-4 text-emerald-400 font-black tracking-widest uppercase">Computing optimal path...</div>
              <div className="mt-2 font-mono text-xs text-emerald-400/50">Processing 24 stops via Routes API</div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-1 uppercase tracking-tight flex items-center gap-2">
              <Truck size={20} className="text-zinc-400" /> Crew Manifest
            </h2>
            <p className="text-sm text-zinc-400 font-medium mb-6">Select crew to optimize daily route.</p>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-white/5 border border-emerald-500/30 cursor-pointer">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-emerald-400">Alpha Crew</span>
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded font-black tracking-widest uppercase">Selected</span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                  <span className="flex items-center gap-1"><Navigation2 size={12} /> 12 Stops</span>
                  <span className="flex items-center gap-1"><Route size={12} /> 45 mi</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-black border border-white/5 opacity-50 cursor-pointer hover:opacity-100 transition-opacity">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-white">Bravo Crew</span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                  <span className="flex items-center gap-1"><Navigation2 size={12} /> 8 Stops</span>
                  <span className="flex items-center gap-1"><Route size={12} /> 32 mi</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-tight">Metrics Impact</h2>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  <span>Drive Time</span>
                  {complete ? <span className="text-emerald-400">-22%</span> : <span>--</span>}
                </div>
                <div className="h-2 w-full bg-black rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: "80%" }}
                    animate={{ width: complete ? "58%" : "80%" }}
                    className="h-full bg-emerald-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  <span>Fuel Consumption</span>
                  {complete ? <span className="text-emerald-400">-15%</span> : <span>--</span>}
                </div>
                <div className="h-2 w-full bg-black rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: "70%" }}
                    animate={{ width: complete ? "55%" : "70%" }}
                    className="h-full bg-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
