// Connection limits for the /api/live WebSocket bridge (Gemini Live voice/dictation).
//
// The upgrade endpoint had only a global per-worker LIVE_CAP and no maxPayload / per-IP / per-tenant
// bound, so a bogus-token flood could (a) buffer 100 MiB frames and (b) amplify into unbounded
// Supabase getUser calls. This pure, unit-tested limiter provides the three missing bounds:
//   - allowAttempt(key): a pre-upgrade attempt throttle (per-IP connection-attempt rate) so a flood
//     is refused at the handshake before any Supabase auth round-trip.
//   - reserveIp/releaseIp: a per-IP concurrent-connection cap.
//   - reserveTenant/releaseTenant: a per-tenant concurrent-session cap.
// PER-WORKER in-memory (same caveat as the existing LIVE_CAP); a Redis-backed fleet-wide version is
// the documented follow-up.

export interface LiveLimiterConfig {
  maxPerIp: number; maxPerTenant: number; attemptsPerWindow: number; windowMs: number;
}
const num = (v: unknown, dflt: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};
export function liveLimiterConfigFromEnv(env: Record<string, string | undefined> = process.env): LiveLimiterConfig {
  return {
    maxPerIp: num(env.LIVE_MAX_PER_IP, 25),
    maxPerTenant: num(env.LIVE_MAX_PER_TENANT, 25),
    attemptsPerWindow: num(env.LIVE_ATTEMPTS_PER_MIN, 30),
    windowMs: num(env.LIVE_ATTEMPT_WINDOW_MS, 60_000),
  };
}
interface AttemptSlot { count: number; resetAt: number; }
export class LiveLimiter {
  private ip = new Map<string, number>();
  private tenant = new Map<string, number>();
  private attempts = new Map<string, AttemptSlot>();
  constructor(private readonly cfg: LiveLimiterConfig) {}
  allowAttempt(key: string, now: number = Date.now()): boolean {
    const slot = this.attempts.get(key);
    if (!slot || slot.resetAt <= now) { this.attempts.set(key, { count: 1, resetAt: now + this.cfg.windowMs }); return true; }
    if (slot.count >= this.cfg.attemptsPerWindow) return false;
    slot.count++; return true;
  }
  reserveIp(key: string): boolean {
    const n = this.ip.get(key) || 0;
    if (n >= this.cfg.maxPerIp) return false;
    this.ip.set(key, n + 1); return true;
  }
  releaseIp(key: string): void { const n = (this.ip.get(key) || 1) - 1; if (n <= 0) this.ip.delete(key); else this.ip.set(key, n); }
  reserveTenant(id: string): boolean {
    const n = this.tenant.get(id) || 0;
    if (n >= this.cfg.maxPerTenant) return false;
    this.tenant.set(id, n + 1); return true;
  }
  releaseTenant(id: string): void { const n = (this.tenant.get(id) || 1) - 1; if (n <= 0) this.tenant.delete(id); else this.tenant.set(id, n); }
  pruneAttempts(now: number = Date.now()): void { for (const [k, v] of this.attempts) if (v.resetAt <= now) this.attempts.delete(k); }
  ipCount(key: string): number { return this.ip.get(key) || 0; }
  tenantCount(id: string): number { return this.tenant.get(id) || 0; }
  attemptWindows(): number { return this.attempts.size; }
}
