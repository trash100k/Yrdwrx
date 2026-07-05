import { describe, it, expect } from "vitest";
import { OutboundRateLimiter } from "./outboundLimiter";

// Fixed synthetic clock (ms) — the limiter takes `now` as a param so tests are deterministic.
const T0 = 1_700_000_000_000;

describe("OutboundRateLimiter — per-tenant outbound cap (Scenario A)", () => {
  it("allows up to perMinute, then 429s the burst with a Retry-After", () => {
    const rl = new OutboundRateLimiter({ perMinute: 5, perDay: 1000 });
    for (let i = 0; i < 5; i++) expect(rl.take("t1", T0).ok).toBe(true);
    const blocked = rl.take("t1", T0);
    expect(blocked.ok).toBe(false);
    expect(blocked.scope).toBe("minute");
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("does NOT consume on a rejected call (rejection is free)", () => {
    const rl = new OutboundRateLimiter({ perMinute: 2, perDay: 1000 });
    expect(rl.take("t1", T0).ok).toBe(true);
    expect(rl.take("t1", T0).ok).toBe(true);
    expect(rl.take("t1", T0).ok).toBe(false); // over
    expect(rl.take("t1", T0).ok).toBe(false); // still over, count didn't creep past 2
    expect(rl.peek("t1", T0).minute).toBe(2);
  });

  it("resets the minute window after 60s but keeps counting the day", () => {
    const rl = new OutboundRateLimiter({ perMinute: 3, perDay: 1000 });
    for (let i = 0; i < 3; i++) expect(rl.take("t1", T0).ok).toBe(true);
    expect(rl.take("t1", T0).ok).toBe(false);
    const later = T0 + 61_000; // next minute window
    expect(rl.take("t1", later).ok).toBe(true);
    expect(rl.peek("t1", later).minute).toBe(1);
    expect(rl.peek("t1", later).day).toBe(4); // day window still accumulating
  });

  it("enforces the per-day ceiling independently of the minute window", () => {
    const rl = new OutboundRateLimiter({ perMinute: 1000, perDay: 10 });
    let t = T0;
    for (let i = 0; i < 10; i++) {
      expect(rl.take("t1", t).ok).toBe(true);
      t += 61_000; // advance past each minute window so per-minute never bites
    }
    const blocked = rl.take("t1", t);
    expect(blocked.ok).toBe(false);
    expect(blocked.scope).toBe("day");
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(86_400);
  });

  it("isolates tenants — one tenant's blast does not throttle another", () => {
    const rl = new OutboundRateLimiter({ perMinute: 2, perDay: 1000 });
    expect(rl.take("noisy", T0).ok).toBe(true);
    expect(rl.take("noisy", T0).ok).toBe(true);
    expect(rl.take("noisy", T0).ok).toBe(false); // noisy is capped
    expect(rl.take("quiet", T0).ok).toBe(true); // quiet is unaffected
    expect(rl.take("quiet", T0).ok).toBe(true);
  });

  it("qty>1 consumes atomically and rejects without partial consumption", () => {
    const rl = new OutboundRateLimiter({ perMinute: 5, perDay: 1000 });
    expect(rl.take("t1", T0, 3).ok).toBe(true);
    expect(rl.peek("t1", T0).minute).toBe(3);
    expect(rl.take("t1", T0, 3).ok).toBe(false); // 3+3 > 5 → rejected, no partial
    expect(rl.peek("t1", T0).minute).toBe(3); // unchanged
    expect(rl.take("t1", T0, 2).ok).toBe(true); // exactly hits 5
    expect(rl.peek("t1", T0).minute).toBe(5);
  });

  it("caps the 1000-blast scenario: a tenant looping 1000 sends is bounded", () => {
    const rl = new OutboundRateLimiter({ perMinute: 60, perDay: 5000 });
    let allowed = 0;
    for (let i = 0; i < 1000; i++) if (rl.take("blaster", T0).ok) allowed++;
    expect(allowed).toBe(60); // the instant burst is capped at the per-minute ceiling
  });

  it("sweep() drops stale buckets to bound memory", () => {
    const rl = new OutboundRateLimiter({ perMinute: 5, perDay: 1000 });
    rl.take("t1", T0);
    rl.sweep(T0 + DAY_PLUS);
    expect(rl.peek("t1", T0 + DAY_PLUS).minute).toBe(0);
    expect(rl.peek("t1", T0 + DAY_PLUS).day).toBe(0);
  });

  it("clamps misconfigured (0 / NaN) limits to a safe floor of 1", () => {
    const rl = new OutboundRateLimiter({ perMinute: 0, perDay: NaN as any });
    expect(rl.take("t1", T0).ok).toBe(true); // floor 1 allows the first
    expect(rl.take("t1", T0).ok).toBe(false); // then caps
  });
});

const DAY_PLUS = 86_400_000 + 1000;
