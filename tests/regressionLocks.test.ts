// @ts-nocheck
// REGRESSION LOCKS — pin fixed P0s so they can't silently regress.
//
// Each block corresponds to a shipped P0 fix. Where the behavior can be exercised
// in-process it is (boot the Express app via createApp(), read live headers/responses
// with supertest). Where it can't (browser-only cleanup logic, private in-memory cache
// helpers that are never exported), we assert against the committed SOURCE TEXT as a
// guard — that still fails loudly if someone deletes the fix.
//
// REQUIRE_AUTH is read at app-construction time. server.ts loads .env.local (which sets
// REQUIRE_AUTH=true) via dotenv, but dotenv does NOT override an already-set process.env
// value, so setting it here BEFORE importing server.ts wins. We use demo mode (false) so
// the /api/tenants/provision handler is actually reached (proving it ignores client tier
// end-to-end) instead of being short-circuited by the auth middleware.
process.env.REQUIRE_AUTH = "false";
process.env.VITEST = process.env.VITEST || "1";

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Vitest runs with cwd at the repo root (see vitest.config.ts include globs).
const ROOT = process.cwd();
const SERVER_SRC = readFileSync(resolve(ROOT, "server.ts"), "utf8");
const LIVEEAR_SRC = readFileSync(
  resolve(ROOT, "src/components/LiveEar.tsx"),
  "utf8",
);

// Slice the source region for one Express route handler: from its `app.<verb>("path"` marker
// to the next route registration. Lets us assert on a single handler without matching lines
// that belong to unrelated routes.
function routeRegion(src: string, marker: string): string {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`route marker not found: ${marker}`);
  const next = src.indexOf("\n  app.", start + marker.length);
  return src.slice(start, next < 0 ? undefined : next);
}

// Pull the `connect-src ...;` directive out of a CSP header string.
function connectSrc(csp: string): string {
  const m = csp.match(/connect-src([^;]*)/i);
  return m ? m[1] : "";
}

let app: any;

beforeAll(async () => {
  const { createApp } = await import("../server");
  app = await createApp();
});

// ── P0 #1 — Helmet CSP connect-src points at Supabase, not the dead Firebase realtime DB ──
describe("P0: Helmet CSP connect-src (Supabase migration)", () => {
  it("emits a live CSP header whose connect-src allows Supabase over https AND wss", async () => {
    const res = await request(app).get("/api/health");
    const csp = res.headers["content-security-policy"] || "";
    expect(csp).toBeTruthy();
    const cs = connectSrc(csp);
    // Supabase is called DIRECTLY from the browser (auth + REST + realtime), so both the
    // https origin and the wss realtime origin MUST be in connect-src or prod login/data
    // loading is CSP-refused.
    expect(cs).toContain("https://*.supabase.co");
    expect(cs).toContain("wss://*.supabase.co");
  });

  it("does NOT list any *.firebaseio.com origin anywhere in the CSP (Firestore realtime DB is unused)", async () => {
    const res = await request(app).get("/api/health");
    const csp = (res.headers["content-security-policy"] || "").toLowerCase();
    expect(csp).not.toContain("firebaseio.com");
  });

  it("source of truth: server.ts CSP connectSrc includes supabase and excludes firebaseio", () => {
    // Guard the directive definition itself, so a regression is caught even if the boot path
    // changes. Isolate the connectSrc array from the rest of the helmet config.
    const csFieldStart = SERVER_SRC.indexOf("connectSrc:");
    expect(csFieldStart).toBeGreaterThan(-1);
    const csFieldEnd = SERVER_SRC.indexOf("]", csFieldStart);
    const csLine = SERVER_SRC.slice(csFieldStart, csFieldEnd);
    expect(csLine).toContain("https://*.supabase.co");
    expect(csLine).toContain("wss://*.supabase.co");
    expect(csLine).not.toContain("firebaseio.com");
  });
});

// ── P0 #2 — LiveEar stopLiveEar releases the camera/mic and stops streaming frames ──
// Browser-only: the component depends on AudioContext, MediaStream, WebSocket, and a stack of
// React context providers (CuttyGuide/FieldMode/Toast/Router), so a faithful in-process render
// is brittle. We instead pin the exact cleanup logic in the committed source — a regression
// (leaving the device recording after Stop / on unmount) deletes one of these tokens.
describe("P0: LiveEar cleanup stops tracks + clears the frame interval", () => {
  const stopRegion = (() => {
    const start = LIVEEAR_SRC.indexOf("const stopLiveEar");
    const end = LIVEEAR_SRC.indexOf("const startLiveEar");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return LIVEEAR_SRC.slice(start, end);
  })();

  it("stopLiveEar stops every MediaStream track (getTracks().forEach(stop)) and nulls the ref", () => {
    expect(stopRegion).toMatch(
      /streamRef\.current\?\.getTracks\(\)\.forEach\(\s*\(t\)\s*=>\s*t\.stop\(\)\s*\)/,
    );
    expect(stopRegion).toContain("streamRef.current = null");
  });

  it("stopLiveEar clears the video frame interval and nulls the interval ref", () => {
    expect(stopRegion).toContain("clearInterval(videoIntervalRef.current)");
    expect(stopRegion).toContain("videoIntervalRef.current = null");
  });

  it("the interval that streams frames is tracked in a ref so stop() can clear it", () => {
    // If the setInterval handle is never stored in videoIntervalRef, stopLiveEar can't clear it.
    expect(LIVEEAR_SRC).toContain("videoIntervalRef.current = videoInterval");
    expect(LIVEEAR_SRC).toContain("const videoIntervalRef = useRef");
  });

  it("unmount runs the cleanup: an empty-deps effect returns a teardown that calls stopLiveEar", () => {
    // Collapse whitespace so the assertion is robust to formatting, then require the
    // effect -> return cleanup -> stopLiveEar() -> [] shape.
    const flat = LIVEEAR_SRC.replace(/\s+/g, " ");
    expect(flat).toMatch(
      /useEffect\(\s*\(\)\s*=>\s*\{\s*return\s*\(\)\s*=>\s*\{\s*stopLiveEar\(\);\s*\};\s*\},\s*\[\]\s*\)/,
    );
  });
});

// ── P0 #3 — /api/tenants/provision ignores a client-supplied tier (privilege escalation) ──
describe("P0: /api/tenants/provision ignores client-supplied tier", () => {
  it('a request asking for tier:"enterprise" is NOT granted enterprise (free/simulated only)', async () => {
    const res = await request(app)
      .post("/api/tenants/provision")
      .send({
        companyName: "Escalation Attempt LLC",
        tier: "enterprise",
        settings: {},
      });
    // In mock mode there is no service Supabase, so provisioning is honestly unavailable (503).
    // With auth on it would be 401. Either way it must never be a 200 that hands back enterprise,
    // and a 500 where a 4xx/503 belongs would itself be a bug.
    expect([401, 503]).toContain(res.status);
    expect(res.status).not.toBe(500);
    // The client-supplied tier must never surface in the response as a granted tier.
    const body = JSON.stringify(res.body || {}).toLowerCase();
    expect(body).not.toContain("enterprise");
  });

  it("validates companyName before doing anything (400, not 500)", async () => {
    const res = await request(app)
      .post("/api/tenants/provision")
      .send({ tier: "enterprise" });
    expect(res.status).toBe(400);
    expect(res.body?.error || "").toMatch(/companyName/i);
  });

  it("source of truth: the provision handler never reads tier from req.body and forces the default", () => {
    const region = routeRegion(SERVER_SRC, 'app.post("/api/tenants/provision"');
    // `tier` must NOT be destructured out of req.body...
    expect(region).not.toMatch(
      /const\s*\{[^}]*\btier\b[^}]*\}\s*=\s*req\.body/,
    );
    // ...and must not be pulled off req.body directly anywhere in the handler.
    expect(region).not.toContain("req.body.tier");
    // The tenant row is always inserted at the server-set default tier.
    expect(region).toContain('DEFAULT_TENANT_TIER = "free"');
    expect(region).toContain("tier: DEFAULT_TENANT_TIER");
  });
});

// ── P0 #4 — the in-process Gemini + API caches are bounded (no unbounded-Map OOM) ──
// These Maps and their eviction helpers are module-private (never exported), so we guard the
// cap constants + eviction logic in source. A regression that drops the cap or the eviction
// loop re-opens the OOM on a long-lived instance.
describe("P0: geminiCache + apiCacheStore are bounded", () => {
  it("geminiCache has a cap constant and evicts oldest entries past the cap", () => {
    expect(SERVER_SRC).toMatch(
      /const GEMINI_CACHE_MAX = Number\(process\.env\.GEMINI_CACHE_MAX\)\s*\|\|\s*\d+/,
    );
    const put = routeRegionSafe("function geminiCachePut", "function ");
    expect(put).toContain("while (geminiCache.size > GEMINI_CACHE_MAX)");
    expect(put).toContain("geminiCache.delete(oldest)");
  });

  it("apiCacheStore has a cap constant and evicts (sweep expired, then oldest) past the cap", () => {
    expect(SERVER_SRC).toMatch(
      /const API_CACHE_MAX = Number\(process\.env\.API_CACHE_MAX\)\s*\|\|\s*\d+/,
    );
    const put = routeRegionSafe("function apiCacheSet", "function ");
    expect(put).toContain("if (apiCacheStore.size >= API_CACHE_MAX)");
    expect(put).toContain("apiCacheStore.delete(oldest)");
  });

  // Slice a function body from its declaration marker to the NEXT declaration of the given
  // kind, so the eviction assertions are scoped to the right helper.
  function routeRegionSafe(marker: string, nextKind: string): string {
    const start = SERVER_SRC.indexOf(marker);
    expect(start).toBeGreaterThan(-1);
    const next = SERVER_SRC.indexOf("\n" + nextKind, start + marker.length);
    return SERVER_SRC.slice(start, next < 0 ? undefined : next);
  }
});
