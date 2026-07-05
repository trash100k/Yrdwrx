// Per-tenant outbound rate limiter for email / SMS / notifications.
//
// YardWorx Scenario A — "1,000 tenants each blasting 1,000 emails/SMS". The metering ledger
// tracks spend but does NOT throttle *rate*, and paid tiers with no spend cap would bill (and
// send) unbounded — torching the shared sender's deliverability and getting the shared Twilio
// number A2P-blocked for everyone. This limiter puts a hard per-tenant ceiling on outbound
// volume: a burst is capped per-minute and a campaign is capped per-day. It bounds the blast
// radius regardless of recipient (so it does not break legitimate sends to non-customers, e.g.
// referral invites), and it is the guard in front of the fuller "queue + controlled drain"
// build noted in TODO.md.
//
// Design: FIXED-WINDOW counters (one small bucket per tenant per window), NOT a per-send
// timestamp list — so memory is O(active tenants), not O(sends). A long-lived instance with
// 10k tenants holds ~10k tiny objects, never a growing array of every message. Windows are
// per-minute (burst) and per-day (volume). Fixed windows can allow a 2x burst across a window
// boundary; that is an acceptable, well-understood trade for abuse control (precision is not the
// goal, a hard ceiling is). PER-INSTANCE like the other in-memory limiters — the effective fleet
// cap is roughly limit x instances x workers; a shared/Redis store is the documented follow-up.

export interface OutboundLimits {
  /** Max sends per rolling ~minute window per tenant. */
  perMinute: number;
  /** Max sends per rolling ~day window per tenant. */
  perDay: number;
}

export interface OutboundDecision {
  ok: boolean;
  /** Seconds until the exceeded window resets (for a Retry-After header). Present when !ok. */
  retryAfterSec?: number;
  /** Which window was hit. Present when !ok. */
  scope?: "minute" | "day";
  /** Human-readable reason. Present when !ok. */
  reason?: string;
}

interface Bucket {
  windowStart: number;
  count: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export class OutboundRateLimiter {
  private minute = new Map<string, Bucket>();
  private day = new Map<string, Bucket>();
  private limits: OutboundLimits;

  constructor(limits: OutboundLimits) {
    // Guard against misconfiguration (a 0/NaN limit would block or the reverse).
    this.limits = {
      perMinute: Math.max(1, Math.floor(limits.perMinute) || 1),
      perDay: Math.max(1, Math.floor(limits.perDay) || 1),
    };
  }

  private roll(map: Map<string, Bucket>, key: string, now: number, windowMs: number): Bucket {
    const b = map.get(key);
    if (!b || now - b.windowStart >= windowMs) {
      const fresh = { windowStart: now, count: 0 };
      map.set(key, fresh);
      return fresh;
    }
    return b;
  }

  /**
   * Check-and-consume `qty` sends for `tenantId` at time `now` (ms). If either the per-minute
   * or per-day ceiling would be exceeded, returns `{ ok: false, retryAfterSec, scope }` and
   * consumes NOTHING (so a rejected call doesn't count against the tenant). Otherwise consumes
   * `qty` from both windows and returns `{ ok: true }`.
   */
  take(tenantId: string, now: number, qty = 1): OutboundDecision {
    const n = Math.max(1, Math.floor(qty) || 1);
    const m = this.roll(this.minute, tenantId, now, MINUTE_MS);
    const d = this.roll(this.day, tenantId, now, DAY_MS);

    if (m.count + n > this.limits.perMinute) {
      return {
        ok: false,
        scope: "minute",
        reason: `per-tenant outbound cap: ${this.limits.perMinute}/min`,
        retryAfterSec: Math.max(1, Math.ceil((m.windowStart + MINUTE_MS - now) / 1000)),
      };
    }
    if (d.count + n > this.limits.perDay) {
      return {
        ok: false,
        scope: "day",
        reason: `per-tenant outbound cap: ${this.limits.perDay}/day`,
        retryAfterSec: Math.max(1, Math.ceil((d.windowStart + DAY_MS - now) / 1000)),
      };
    }
    m.count += n;
    d.count += n;
    return { ok: true };
  }

  /** Drop stale buckets so the maps stay bounded on a long-lived instance. */
  sweep(now: number): void {
    for (const [k, b] of this.minute) if (now - b.windowStart >= MINUTE_MS) this.minute.delete(k);
    for (const [k, b] of this.day) if (now - b.windowStart >= DAY_MS) this.day.delete(k);
  }

  /** Current per-tenant counts (for observability / tests). */
  peek(tenantId: string, now: number): { minute: number; day: number } {
    const m = this.minute.get(tenantId);
    const d = this.day.get(tenantId);
    return {
      minute: m && now - m.windowStart < MINUTE_MS ? m.count : 0,
      day: d && now - d.windowStart < DAY_MS ? d.count : 0,
    };
  }
}
