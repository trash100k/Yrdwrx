// @ts-nocheck
import { fetchApi } from "./api";

// Best-effort: returns {lat,lng,formatted} or null (no key / no result / error). Never throws.
export async function geocodeAddress(
  address?: string,
): Promise<{ lat: number; lng: number; formatted?: string } | null> {
  if (!address?.trim()) return null;
  try {
    const res = await fetchApi("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.configured && typeof data.lat === "number" && typeof data.lng === "number") {
      return { lat: data.lat, lng: data.lng, formatted: data.formatted };
    }
    return null;
  } catch {
    return null;
  }
}
