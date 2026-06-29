// @ts-nocheck
import { fetchApi } from "../lib/api";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Customer } from "../types";
import { MapPin } from "lucide-react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

const defaultCenter = { lat: 32.35, lng: -88.7 };

// Pull any coordinates already stored on the record (defensive — the Customer
// type doesn't declare these, but imported/enriched records may carry them).
function readCoords(c: Customer): { lat: number; lng: number } | null {
  const cand =
    (c as any).coords ||
    (c as any).location ||
    ((c as any).lat != null && (c as any).lng != null
      ? { lat: (c as any).lat, lng: (c as any).lng }
      : null) ||
    ((c as any).latitude != null && (c as any).longitude != null
      ? { lat: (c as any).latitude, lng: (c as any).longitude }
      : null);
  if (!cand) return null;
  const lat = Number(cand.lat);
  const lng = Number(cand.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

export const CustomerMap = ({
  customers,
  onSelectCustomer,
}: {
  customers: Customer[];
  onSelectCustomer: (c: Customer) => void;
}) => {
  const [apiKey, setApiKey] = useState("");
  const [keyLoading, setKeyLoading] = useState(true);

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
      .then((data) => setApiKey(data?.apiKey || ""))
      .catch((err) => console.warn("Failed to load maps config", err))
      .finally(() => setKeyLoading(false));
  }, []);

  const mappable = useMemo(
    () =>
      (customers || []).filter(
        (c) => readCoords(c) || (c.address && c.address.trim() !== ""),
      ),
    [customers],
  );

  // No customer has coordinates or an address to geocode → honest empty state.
  if (!keyLoading && mappable.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 bg-zinc-950 text-center">
        <div className="max-w-md space-y-5">
          <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/10">
            <MapPin size={32} className="text-white/20" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black uppercase tracking-widest text-white">
            Add addresses to see the map
          </h3>
          <p className="text-sm leading-relaxed text-white/50">
            None of your customers have a street address on file yet. Add
            addresses to plot them on the live map.
          </p>
        </div>
      </div>
    );
  }

  // No Maps key → defensive notice (the data exists, but we can't render tiles).
  if (!keyLoading && !apiKey) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 bg-zinc-950 text-center">
        <div className="max-w-md space-y-5">
          <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/10 animate-pulse">
            <MapPin size={32} className="text-white/20" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black uppercase tracking-widest text-white">
            Map Unavailable
          </h3>
          <p className="text-sm leading-relaxed text-white/50">
            Add a{" "}
            <code className="bg-white/10 px-2 py-0.5 rounded text-forest-400">
              GOOGLE_MAPS_API_KEY
            </code>{" "}
            in the workspace settings to enable the interactive customer map.
          </p>
        </div>
      </div>
    );
  }

  if (keyLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-950">
        <span className="w-8 h-8 border border-white/5 border-t-forest-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black relative overflow-hidden">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={11}
          mapId="CUSTOMER_DIRECTORY_MAP"
          disableDefaultUI={true}
          gestureHandling={"greedy"}
          className="w-full h-full"
        >
          <CustomerMarkers
            customers={mappable}
            onSelectCustomer={onSelectCustomer}
          />
        </Map>
      </APIProvider>
    </div>
  );
};

// Resolves coordinates for each customer (stored coords first, else geocode the
// address) and renders markers, fitting the map to the resolved points.
function CustomerMarkers({
  customers,
  onSelectCustomer,
}: {
  customers: Customer[];
  onSelectCustomer: (c: Customer) => void;
}) {
  const map = useMap();
  const geocodingLib = useMapsLibrary("geocoding");
  const [points, setPoints] = useState<
    { customer: Customer; pos: { lat: number; lng: number } }[]
  >([]);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const resolve = async () => {
      const resolved: {
        customer: Customer;
        pos: { lat: number; lng: number };
      }[] = [];
      const toGeocode: Customer[] = [];

      for (const c of customers) {
        const stored = readCoords(c);
        if (stored) resolved.push({ customer: c, pos: stored });
        else if (c.address && c.address.trim() !== "") toGeocode.push(c);
      }

      if (geocodingLib && toGeocode.length > 0) {
        const geocoder = new geocodingLib.Geocoder();
        for (const c of toGeocode) {
          if (cancelled.current) return;
          try {
            const { results } = await geocoder.geocode({ address: c.address });
            const loc = results?.[0]?.geometry?.location;
            if (loc) {
              resolved.push({
                customer: c,
                pos: { lat: loc.lat(), lng: loc.lng() },
              });
            }
          } catch {
            // Skip unresolvable addresses rather than fabricating a location.
          }
        }
      }

      if (!cancelled.current) setPoints(resolved);
    };
    resolve();
    return () => {
      cancelled.current = true;
    };
  }, [customers, geocodingLib]);

  // Fit bounds to whatever real points we resolved.
  useEffect(() => {
    if (!map || points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p.pos));
    map.fitBounds(bounds, 80);
    if (points.length === 1) map.setZoom(13);
  }, [map, points]);

  return (
    <>
      {points.map(({ customer, pos }) => (
        <AdvancedMarker
          key={customer.id || `${pos.lat},${pos.lng}`}
          position={pos}
          onClick={() => onSelectCustomer(customer)}
        >
          <div className="relative flex flex-col items-center group cursor-pointer">
            <Pin
              background={"#10b981"}
              glyphColor={"#000"}
              borderColor={"#000"}
            />
            <div className="absolute top-10 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-20">
              <div className="bg-black/90 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-xl whitespace-nowrap shadow-2xl">
                <p className="text-[10px] font-black italic text-white uppercase tracking-widest">
                  {customer.firstName} {customer.lastName}
                </p>
                <p className="text-[8px] font-bold text-white/40 uppercase tracking-wider">
                  {customer.address}
                </p>
              </div>
            </div>
          </div>
        </AdvancedMarker>
      ))}
    </>
  );
}
