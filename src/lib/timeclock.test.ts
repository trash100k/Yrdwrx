import { describe, it, expect } from "vitest";
import {
  haversineMeters,
  evaluateGeofence,
  buildClockInEntry,
  planClockOut,
  DEFAULT_GEOFENCE_RADIUS_M,
  type OpenShift,
} from "./timeclock";

describe("haversineMeters", () => {
  it("is 0 for identical points", () => {
    expect(haversineMeters({ lat: 40, lng: -75 }, { lat: 40, lng: -75 })).toBe(0);
  });

  it("computes ~111km for one degree of latitude", () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    // 1° latitude ≈ 111.19 km with R = 6,371,000 m.
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it("computes a short sub-radius distance (~222m for 0.002° lat)", () => {
    const d = haversineMeters({ lat: 40.0, lng: -75.0 }, { lat: 40.002, lng: -75.0 });
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(245);
  });

  it("is symmetric", () => {
    const a = { lat: 34.05, lng: -118.24 };
    const b = { lat: 34.06, lng: -118.25 };
    expect(haversineMeters(a, b)).toBe(haversineMeters(b, a));
  });

  it("returns NaN when a coordinate is missing or non-finite", () => {
    expect(Number.isNaN(haversineMeters(null, { lat: 1, lng: 1 }))).toBe(true);
    expect(Number.isNaN(haversineMeters({ lat: 1, lng: 1 }, undefined))).toBe(true);
    expect(Number.isNaN(haversineMeters({ lat: NaN, lng: 1 }, { lat: 1, lng: 1 }))).toBe(true);
  });
});

describe("evaluateGeofence", () => {
  const job = { lat: 40.0, lng: -75.0 };

  it("is 'ok' when the worker is inside the radius", () => {
    const r = evaluateGeofence(job, { lat: 40.0004, lng: -75.0 }, 150); // ~44m
    expect(r.status).toBe("ok");
    expect(r.distanceMeters).toBeLessThanOrEqual(150);
    expect(r.radiusMeters).toBe(150);
  });

  it("is 'outside' when the worker is beyond the radius", () => {
    const r = evaluateGeofence(job, { lat: 40.003, lng: -75.0 }, 150); // ~333m
    expect(r.status).toBe("outside");
    expect(r.distanceMeters).toBeGreaterThan(150);
  });

  it("degrades to 'unavailable' when the job has no coordinates (never blocks)", () => {
    const r = evaluateGeofence(null, { lat: 40, lng: -75 });
    expect(r.status).toBe("unavailable");
    expect(r.distanceMeters).toBeNull();
  });

  it("degrades to 'unavailable' when the device gave no fix", () => {
    const r = evaluateGeofence(job, null);
    expect(r.status).toBe("unavailable");
    expect(r.distanceMeters).toBeNull();
  });

  it("falls back to the default radius for a non-positive/NaN radius", () => {
    expect(evaluateGeofence(job, job, 0).radiusMeters).toBe(DEFAULT_GEOFENCE_RADIUS_M);
    expect(evaluateGeofence(job, job, -50).radiusMeters).toBe(DEFAULT_GEOFENCE_RADIUS_M);
    expect(evaluateGeofence(job, job, NaN).radiusMeters).toBe(DEFAULT_GEOFENCE_RADIUS_M);
  });

  it("treats a point exactly at the radius edge as inside (<=)", () => {
    // Same point → distance 0, trivially within any positive radius.
    expect(evaluateGeofence(job, job, 150).status).toBe("ok");
  });
});

describe("buildClockInEntry", () => {
  it("stamps jobId + customerId and opens the shift (clockOut null)", () => {
    const e = buildClockInEntry({
      jobId: "job-1",
      customerId: "cust-9",
      userId: "u1",
      userName: "Sam",
      clockInISO: "2026-07-05T13:00:00.000Z",
    });
    expect(e.jobId).toBe("job-1");
    expect(e.customerId).toBe("cust-9");
    expect(e.userId).toBe("u1");
    expect(e.userName).toBe("Sam");
    expect(e.clockIn).toBe("2026-07-05T13:00:00.000Z");
    expect(e.clockOut).toBeNull();
    // No coords → geo fields null (degrade gracefully).
    expect(e.clockInLat).toBeNull();
    expect(e.clockInLng).toBeNull();
  });

  it("records device coordinates when present", () => {
    const e = buildClockInEntry({
      jobId: "job-1",
      clockInISO: "2026-07-05T13:00:00.000Z",
      coords: { lat: 40.1, lng: -75.2 },
    });
    expect(e.clockInLat).toBe(40.1);
    expect(e.clockInLng).toBe(-75.2);
  });

  it("nulls out non-finite coordinates rather than persisting garbage", () => {
    const e = buildClockInEntry({
      jobId: "job-1",
      clockInISO: "2026-07-05T13:00:00.000Z",
      coords: { lat: NaN, lng: 5 },
    });
    expect(e.clockInLat).toBeNull();
    expect(e.clockInLng).toBeNull();
  });

  it("defaults missing linkage fields to null (never undefined)", () => {
    const e = buildClockInEntry({ clockInISO: "2026-07-05T13:00:00.000Z" });
    expect(e.jobId).toBeNull();
    expect(e.customerId).toBeNull();
    expect(e.userId).toBeNull();
    expect(e.userName).toBeNull();
  });
});

describe("planClockOut", () => {
  const base: OpenShift = {
    jobId: "job-1",
    customerId: "cust-9",
    userId: "u1",
    userName: "Sam",
    clockIn: "2026-07-05T13:00:00.000Z",
    clockOut: null,
    clockInLat: 40.1,
    clockInLng: -75.2,
  };

  it("PATCHES an existing server row (has serverId) with clockOut + minutes", () => {
    const open: OpenShift = { ...base, serverId: "ts-123" };
    const plan = planClockOut(open, "2026-07-05T15:30:00.000Z");
    expect(plan.mode).toBe("update");
    if (plan.mode !== "update") throw new Error("expected update");
    expect(plan.id).toBe("ts-123");
    expect(plan.patch.clockOut).toBe("2026-07-05T15:30:00.000Z");
    expect(plan.patch.durationMins).toBe(150); // 2h30m
  });

  it("writes ONE complete row for an offline-created shift (no serverId)", () => {
    const plan = planClockOut(base, "2026-07-05T14:00:00.000Z");
    expect(plan.mode).toBe("create");
    if (plan.mode !== "create") throw new Error("expected create");
    expect(plan.row.jobId).toBe("job-1");
    expect(plan.row.customerId).toBe("cust-9");
    expect(plan.row.userId).toBe("u1");
    expect(plan.row.clockIn).toBe("2026-07-05T13:00:00.000Z");
    expect(plan.row.clockOut).toBe("2026-07-05T14:00:00.000Z");
    expect(plan.row.durationMins).toBe(60);
    expect(plan.row.clockInLat).toBe(40.1);
    expect(plan.row.clockInLng).toBe(-75.2);
  });

  it("never bills negative time when clock-out precedes clock-in", () => {
    const open: OpenShift = { ...base, serverId: "ts-9" };
    const plan = planClockOut(open, "2026-07-05T12:00:00.000Z"); // 1h before clock-in
    if (plan.mode !== "update") throw new Error("expected update");
    expect(plan.patch.durationMins).toBe(0);
  });
});
