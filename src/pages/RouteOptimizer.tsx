// @ts-nocheck
import { fetchApi } from "../lib/api";
import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Truck, Map as MapIcon, Route, Play, Settings, CheckCircle2, Navigation2, Navigation, Copy } from "lucide-react";
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { jobsRepo } from "../lib/repos";
import { geocodeAddress } from "../lib/geocode";
import { useToast } from "../contexts/ToastContext";

// READ adapter: flatten the jsonb `data` bag first (carries client/time/coords),
// then let real columns win on key collisions.
const adaptJob = (r: any) => ({ ...(r?.data || {}), ...r });

// Local YYYY-MM-DD for "today" (jobs store `date` as a date string).
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Parse a routes-API duration ("1234s") into seconds.
const parseDurationSeconds = (d: any): number | null => {
  if (typeof d === "number") return d;
  if (typeof d === "string") {
    const m = d.match(/([\d.]+)\s*s?/);
    if (m) return parseFloat(m[1]);
  }
  return null;
};

const fmtDuration = (secs: number | null): string => {
  if (secs == null) return "--";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
};

const fmtMiles = (meters: number | null): string => {
  if (meters == null) return "--";
  return `${(meters / 1609.34).toFixed(1)} mi`;
};

export default function RouteOptimizer() {
  const { showToast } = useToast();
  const [optimizing, setOptimizing] = useState(false);
  const [complete, setComplete] = useState(false);
  const [routeData, setRouteData] = useState<any>(null);
  const [mapsApiKey, setMapsApiKey] = useState("");
  const [stops, setStops] = useState<any[]>([]);

  useEffect(() => {
    fetchApi("/api/config/maps")
      .then(async (res) => {
        // Only parse JSON when the response is OK and actually JSON; an unconfigured
        // endpoint can return an HTML fallback that would make res.json() throw.
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok || !contentType.includes("application/json")) {
          console.warn("Maps config unavailable; continuing without map key");
          return null;
        }
        return res.json();
      })
      .then((data) => setMapsApiKey(data?.apiKey || ""))
      .catch((err) => console.warn("Failed to load maps config", err));
  }, []);

  // Real stop list: today's SCHEDULED jobs that have an address. Prefer each job's
  // stored `lat`/`lng` (geocoded on create). For jobs that have an address but no
  // stored coords, geocode on demand (best-effort, in parallel) so they can still be
  // routed/plotted. Stops that still resolve to no coords are kept but flagged as
  // un-routable and surfaced as a skipped count.
  useEffect(() => {
    let cancelled = false;
    const unsub = jobsRepo.subscribe(async (rows) => {
      const today = todayStr();
      const base = (rows || [])
        .map(adaptJob)
        .filter((j: any) => (j.status || "").toUpperCase() === "SCHEDULED")
        .filter((j: any) => !!j.address && j.date === today)
        .map((j: any) => {
          const lat = j.coords?.lat ?? j.lat;
          const lng = j.coords?.lng ?? j.lng;
          const hasCoords = typeof lat === "number" && typeof lng === "number";
          return { id: j.id, title: j.title, client: j.client, address: j.address, lat, lng, hasCoords };
        });

      // Show what we have immediately (stored coords), then enrich missing ones.
      if (!cancelled) {
        setStops(base);
        setComplete(false);
        setRouteData(null);
      }

      // Geocode (best-effort, in parallel) only the stops missing stored coords.
      const needsGeocode = base.filter((s) => !s.hasCoords && s.address);
      if (needsGeocode.length === 0) return;

      const geocoded = await Promise.all(
        needsGeocode.map(async (s) => {
          const result = await geocodeAddress(s.address); // {lat,lng}|null, never throws
          return { id: s.id, result };
        })
      );
      if (cancelled) return;

      const coordsById = new Map(
        geocoded
          .filter((g) => g.result && typeof g.result.lat === "number" && typeof g.result.lng === "number")
          .map((g) => [g.id, g.result])
      );
      if (coordsById.size === 0) return;

      setStops((prev) =>
        prev.map((s) => {
          if (s.hasCoords) return s;
          const c = coordsById.get(s.id);
          if (!c) return s;
          return { ...s, lat: c.lat, lng: c.lng, hasCoords: true };
        })
      );
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const waypoints = stops.filter((s) => s.hasCoords);
  const skippedCount = stops.filter((s) => !s.hasCoords).length;
  const route = routeData?.data?.routes?.[0];
  const orderIndex: number[] = Array.isArray(route?.optimizedIntermediateWaypointIndex)
    ? route.optimizedIntermediateWaypointIndex
    : [];
  const durationSecs = parseDurationSeconds(route?.duration);
  const distanceMeters = typeof route?.distanceMeters === "number" ? route.distanceMeters : null;

  // Ordered stop list to display after optimization: origin, optimized intermediates, destination.
  const orderedStops = (() => {
    if (!complete || waypoints.length < 2 || orderIndex.length === 0) return waypoints;
    const intermediates = waypoints.slice(1, -1);
    const reordered = orderIndex.map((idx) => intermediates[idx]).filter(Boolean);
    return [waypoints[0], ...reordered, waypoints[waypoints.length - 1]];
  })();

  const startOptimization = async () => {
    if (waypoints.length < 2) {
      showToast("Need at least 2 geocoded scheduled stops to optimize a route", "warning");
      return;
    }
    setOptimizing(true);
    try {
      const response = await fetchApi("/api/workflows/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waypoints: waypoints.map((w) => ({ lat: w.lat, lng: w.lng, id: w.id })) })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch route optimization");
      }

      setRouteData(data);
      setComplete(true);
      if (data.simulated) {
        showToast("Route optimized (simulation — Maps key missing/restricted)", "info");
      } else {
        showToast("Route optimized via Google Maps Routes API", "success");
      }
    } catch (err: any) {
      console.error(err);
      showToast(`Optimization error: ${err.message}`, "error");
    } finally {
      setOptimizing(false);
    }
  };

  const center = waypoints[0] ? { lat: waypoints[0].lat, lng: waypoints[0].lng } : { lat: 32.3643, lng: -88.7037 };

  return (
    <div className="p-5 sm:p-8 max-w-7xl mx-auto min-h-[100dvh]">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <MapIcon size={32} className="text-forest-400" />
          <h1 className="text-2xl sm:text-3xl sm:text-4xl font-black text-white italic uppercase tracking-tight">Route Optimization</h1>
        </div>
        <button
          onClick={startOptimization}
          disabled={optimizing || complete || waypoints.length < 2}
          className="bg-forest-500 text-black px-6 py-3 rounded-full font-black uppercase text-sm tracking-widest hover:scale-105 active:scale-95 transition-transform flex items-center gap-2 disabled:opacity-50"
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
        <div className="lg:col-span-2 bg-zinc-900 border border-white/5 molten-edge rounded-3xl overflow-hidden h-[600px] relative">
          {waypoints.length === 0 && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-8 bg-black/40">
              <Navigation2 size={32} className="text-white/20 mb-4" />
              <h3 className="text-lg font-black italic text-white uppercase tracking-tight">No Routable Stops Today</h3>
              <p className="text-sm text-white/50 max-w-sm mt-2">
                {stops.length > 0
                  ? `${stops.length} scheduled stop(s) found, but none have map coordinates yet. Geocoded jobs appear here as waypoints.`
                  : "No SCHEDULED jobs with an address are set for today. Schedule jobs to plan a route."}
              </p>
            </div>
          )}
          {mapsApiKey ? (
            <APIProvider apiKey={mapsApiKey}>
              <Map
                defaultZoom={11}
                defaultCenter={center}
                mapId="ROUTE_OPTIMIZER_MAP"
                disableDefaultUI={true}
                className="w-full h-full"
              >
                {waypoints.map((wp, i) => (
                  <AdvancedMarker key={wp.id} position={{ lat: wp.lat, lng: wp.lng }}>
                    {i === 0 || i === waypoints.length - 1 ? (
                      <div className="w-6 h-6 bg-forest-500 rounded-full border border-zinc-900 flex items-center justify-center text-[8px] font-bold">
                        HQ
                      </div>
                    ) : (
                      <div className="w-5 h-5 bg-celtic-500 rounded-full border-2 border-black flex items-center justify-center text-xs md:text-[10px] text-white font-bold">
                        {complete && orderIndex.length > 0
                          ? orderIndex.indexOf(i - 1) + 1
                          : i}
                      </div>
                    )}
                  </AdvancedMarker>
                ))}
              </Map>
            </APIProvider>
          ) : (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
               <span className="w-8 h-8 border border-white/5 border-t-forest-500 rounded-full animate-spin"></span>
             </div>
          )}
          {optimizing && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center flex-col z-10">
              <span className="w-12 h-12 border-4 border-forest-500/30 border-t-forest-500 rounded-full animate-spin" />
              <div className="mt-4 text-forest-400 font-black tracking-widest uppercase">Computing optimal path...</div>
              <div className="mt-2 font-mono text-xs text-forest-400/50">Processing {waypoints.length} stops via Routes API</div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-1 uppercase tracking-tight flex items-center gap-2">
              <Truck size={20} className="text-zinc-400" /> Stop List
            </h2>
            <p className="text-sm text-zinc-400 font-medium mb-2">
              {complete ? "Optimized order for today's scheduled stops." : "Today's scheduled jobs with an address."}
            </p>
            {skippedCount > 0 && (
              <p className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest mb-6">
                {skippedCount} stop{skippedCount === 1 ? "" : "s"} skipped — no location
              </p>
            )}
            {skippedCount === 0 && <div className="mb-6" />}

            <div className="space-y-3 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
              {stops.length === 0 ? (
                <div className="p-4 rounded-xl bg-black border border-white/5 border-dashed text-center">
                  <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest">No scheduled stops today</span>
                </div>
              ) : (
                (complete ? orderedStops : stops).map((stop, i) => (
                  <div key={stop.id} className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <span className="font-bold text-white truncate">{stop.title || stop.client || "Stop"}</span>
                      <span className="shrink-0 text-xs bg-forest-500/10 text-forest-400 px-2 py-1 rounded font-black tracking-widest uppercase">
                        {complete ? `#${i + 1}` : stop.hasCoords ? "Mapped" : "No GPS"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-mono text-zinc-500 truncate">{stop.address}</div>
                      {stop.address && (
                        <div className="flex shrink-0 items-center gap-1">
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Navigate"
                            aria-label="Navigate to this stop"
                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-forest-500/40 hover:bg-forest-500/10 text-zinc-400 hover:text-forest-400 transition-all"
                          >
                            <Navigation size={14} />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(stop.address);
                              showToast("Address copied.", "success");
                            }}
                            title="Copy address"
                            aria-label="Copy address"
                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-forest-500/40 hover:bg-forest-500/10 text-zinc-400 hover:text-forest-400 transition-all"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-tight">Route Metrics</h2>

            <div className="space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Total Drive Time</span>
                <span className="text-xl font-black text-forest-400 italic">{complete ? fmtDuration(durationSecs) : "--"}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Total Distance</span>
                <span className="text-xl font-black text-forest-400 italic">{complete ? fmtMiles(distanceMeters) : "--"}</span>
              </div>
              <div className="flex justify-between items-baseline pt-4 border-t border-white/10">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Stops Routed</span>
                <span className="text-xl font-black text-white italic">{waypoints.length || "--"}</span>
              </div>
              {complete && routeData?.simulated && (
                <p className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest pt-2">
                  Simulated result — set GOOGLE_MAPS_API_KEY for live metrics.
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
