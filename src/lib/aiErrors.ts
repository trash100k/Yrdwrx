// Classify upstream AI (Gemini) errors so the server can return an honest 429 + Retry-After
// instead of an opaque 500 when the model rate-limits us. Pure + unit-tested; no I/O.
//
// Gemini surfaces rate limiting as HTTP 429 and/or a string status "RESOURCE_EXHAUSTED", sometimes
// with a `retryDelay: "42s"` field in the message and/or a Retry-After header. We normalize all of
// those into { isRateLimited, retryAfterSec }.

export interface RateLimitInfo { isRateLimited: boolean; retryAfterSec: number | null; }

function statusOf(e: any): number | null {
  if (!e || typeof e !== 'object') return null;
  for (const v of [e.status, e.code, e.statusCode, e?.response?.status]) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

function clampSec(n: number): number {
  const s = Math.ceil(n);
  if (!Number.isFinite(s) || s < 1) return 1;
  return Math.min(s, 3600);
}

export function parseRetryAfterSeconds(e: any): number | null {
  if (!e) return null;
  const h = e.headers;
  let raw: any = null;
  if (h) {
    try { raw = typeof h.get === 'function' ? h.get('retry-after') : (h['retry-after'] ?? h['Retry-After'] ?? null); } catch { raw = null; }
  }
  if (raw != null && raw !== '') {
    const n = Number(String(raw).trim());
    if (Number.isFinite(n) && n >= 0) return clampSec(n);
  }
  const msg = String(e?.message ?? e ?? '');
  const m = msg.match(/retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s/i);
  if (m) { const n = Number(m[1]); if (Number.isFinite(n)) return clampSec(n); }
  return null;
}

export function classifyRateLimit(err: unknown): RateLimitInfo {
  const e: any = err;
  if (!e) return { isRateLimited: false, retryAfterSec: null };
  const status = statusOf(e);
  const msg = String(e?.message ?? e ?? '');
  const rateLimited =
    status === 429 ||
    e?.status === 'RESOURCE_EXHAUSTED' ||
    /\bRESOURCE_EXHAUSTED\b/i.test(msg) ||
    /\b429\b/.test(msg) ||
    /too many requests|rate.?limit(?:ed|ing)?|quota (?:exceeded|exhausted)|exceeded your current quota/i.test(msg);
  if (!rateLimited) return { isRateLimited: false, retryAfterSec: null };
  return { isRateLimited: true, retryAfterSec: parseRetryAfterSeconds(e) };
}
