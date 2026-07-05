// Pure, fully-typed crew-timeclock helpers (no Firebase/React/Supabase) so they're
// unit-testable. They cover the two bits of real decision logic behind the field clock:
//
//   1. GEOFENCE evaluation — is the worker close enough to the job site to clock in?
//      Geofencing is OPTIONAL and must NEVER block a clock-in: whenever the job has no
//      cached coordinates OR the device gives us no fix, the result is "unavailable"
//      (the caller proceeds). See evaluateGeofence / haversineMeters.
//
//   2. The CLOCK-OUT write plan — a closing shift either PATCHES the existing server row
//      or (for a shift created while offline) writes ONE complete row, so the hours land
//      in payroll without ever creating a duplicate open row. See planClockOut.
//
// Like payroll.ts, this file deliberately keeps `@ts-nocheck` OFF and is strictly typed;
// it is covered by timeclock.test.ts. Reuses minutesBetween from the timesheets seam.

import { minutesBetween } from "./timesheets";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Default clock-in geofence radius (meters) — generous enough for a large lot/property. */
export const DEFAULT_GEOFENCE_RADIUS_M = 150;

export type GeofenceStatus = "ok" | "outside" | "unavailable";

export interface GeofenceResult {
  /** "ok" inside radius · "outside" too far · "unavailable" can't tell (missing coords). */
  status: GeofenceStatus;
  /** Straight-line distance in whole meters, or null when it can't be computed. */
  distanceMeters: number | null;
  radiusMeters: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

function isFiniteCoord(c?: LatLng | null): c is LatLng {
  return !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng);
}

/**
 * Great-circle (haversine) distance between two lat/lng points, in whole meters.
 * Returns NaN when either point is missing/non-finite (callers should guard on that).
 */
export function haversineMeters(a?: LatLng | null, b?: LatLng | null): number {
  if (!isFiniteCoord(a) || !isFiniteCoord(b)) return NaN;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(EARTH_RADIUS_M * c);
}

/**
 * Decide whether a worker at `user` is within `radiusMeters` of the `job` site.
 * OPTIONAL by contract: when the job has no cached coordinates OR the device returned
 * no fix, the result is "unavailable" so the caller can proceed (never a hard block).
 * A non-positive/NaN radius falls back to DEFAULT_GEOFENCE_RADIUS_M.
 */
export function evaluateGeofence(
  job?: LatLng | null,
  user?: LatLng | null,
  radiusMeters: number = DEFAULT_GEOFENCE_RADIUS_M,
): GeofenceResult {
  const radius =
    Number.isFinite(radiusMeters) && radiusMeters > 0
      ? radiusMeters
      : DEFAULT_GEOFENCE_RADIUS_M;
  if (!isFiniteCoord(job) || !isFiniteCoord(user)) {
    return { status: "unavailable", distanceMeters: null, radiusMeters: radius };
  }
  const distanceMeters = haversineMeters(job, user);
  return {
    status: distanceMeters <= radius ? "ok" : "outside",
    distanceMeters,
    radiusMeters: radius,
  };
}

// --- Timesheet write shaping ------------------------------------------------

/**
 * The open (clocked-in, not yet clocked-out) shift, as held in component/local state.
 * Standalone (not a TimesheetEntry subtype) so the linkage/coord fields can be `| null`
 * — the shape summarizePayroll consumes still lives in the clockIn/clockOut/durationMins
 * fields it reads.
 */
export interface OpenShift {
  /** DB id once the open row reached the server; ABSENT for an offline-created shift. */
  id?: string;
  serverId?: string | null;
  jobId?: string | null;
  customerId?: string | null;
  userId?: string | null;
  userName?: string | null;
  clockIn: string;
  clockOut?: string | null;
  durationMins?: number;
  clockInLat?: number | null;
  clockInLng?: number | null;
}

export interface ClockInInput {
  jobId?: string | null;
  customerId?: string | null;
  userId?: string | null;
  userName?: string | null;
  /** ISO instant of the clock-in. */
  clockInISO: string;
  /** Device coordinates captured at clock-in, if permission was granted. */
  coords?: LatLng | null;
}

/**
 * Build the normalized open-shift record written on clock-in (and mirrored to local
 * state). The shape matches the timesheets columns; summarizePayroll reads clockIn plus
 * (later) clockOut/durationMins. An open shift keeps clockOut=null → 0 payroll hours,
 * matching payroll.ts's "don't extrapolate a running shift" rule.
 */
export function buildClockInEntry(input: ClockInInput): OpenShift {
  const coords = isFiniteCoord(input.coords) ? input.coords : null;
  return {
    jobId: input.jobId ?? null,
    customerId: input.customerId ?? null,
    userId: input.userId ?? null,
    userName: input.userName ?? null,
    clockIn: input.clockInISO,
    clockOut: null,
    clockInLat: coords ? coords.lat : null,
    clockInLng: coords ? coords.lng : null,
  };
}

export interface ClosedTimesheetRow {
  jobId: string | null;
  customerId: string | null;
  userId: string | null;
  userName: string | null;
  clockIn: string;
  clockOut: string;
  durationMins: number;
  clockInLat: number | null;
  clockInLng: number | null;
}

export type ClockOutPlan =
  | { mode: "update"; id: string; patch: { clockOut: string; durationMins: number } }
  | { mode: "create"; row: ClosedTimesheetRow };

/**
 * Decide how to persist a clock-out. Two cases:
 *  - The open shift already exists server-side (has serverId) → PATCH it closed with
 *    clockOut + durationMins.
 *  - The shift was created while offline (no serverId) → write ONE complete row now, so
 *    the hours still reach payroll without leaving a duplicate open row behind.
 * durationMins is whole minutes via minutesBetween (floored; 0 if clock-out precedes
 * clock-in, so a bad clock never bills negative time).
 */
export function planClockOut(open: OpenShift, clockOutISO: string): ClockOutPlan {
  const durationMins = minutesBetween(open.clockIn, clockOutISO);
  if (open.serverId) {
    return {
      mode: "update",
      id: open.serverId,
      patch: { clockOut: clockOutISO, durationMins },
    };
  }
  return {
    mode: "create",
    row: {
      jobId: open.jobId ?? null,
      customerId: open.customerId ?? null,
      userId: open.userId ?? null,
      userName: open.userName ?? null,
      clockIn: open.clockIn,
      clockOut: clockOutISO,
      durationMins,
      clockInLat: open.clockInLat ?? null,
      clockInLng: open.clockInLng ?? null,
    },
  };
}
