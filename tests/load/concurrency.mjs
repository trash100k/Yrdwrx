#!/usr/bin/env node
// @ts-nocheck
/**
 * tests/load/concurrency.mjs — dependency-free Node load / soak harness for the
 * built production server bundle (`dist/server.cjs`).
 *
 * WHAT IT DOES
 *   1. Boots `PORT=4312 node dist/server.cjs` as a child in MOCK + DEMO mode
 *      (no GEMINI_API_KEY -> canned AI; REQUIRE_AUTH=false -> the /api surface is
 *      reachable without a Firebase/Supabase token, which is what lets us exercise
 *      the cheap read APIs and the PDF render path below).
 *   2. Waits for GET /healthz to return 200, then WARMS UP (the dev-path Vite dep
 *      optimizer runs once at boot and Chromium cold-starts on the first render;
 *      both are one-time costs that would otherwise pollute the numbers).
 *   3. Fires N=200 concurrent GETs (node:http + Promise.all, batched) at the
 *      health/read/cheap-API paths and reports p50/p95/max latency, error rate,
 *      and any non-2xx / 5xx.
 *   4. Runs a small PDF-render soak: POST /api/invoices/generate-pdf ~20x
 *      concurrently to check Puppeteer stability and memory leaks (RSS of the
 *      whole node+Chromium process tree is sampled before/after).
 *   5. Tears the child down (SIGTERM -> SIGKILL fallback) and prints a JSON summary.
 *
 * WHY DEMO MODE (NODE_ENV unset, not "production"):
 *   The production entrypoint refuses to boot unless REQUIRE_AUTH=true (it will
 *   process.exit(1) on an unauthenticated API) AND it forks a cluster — under which
 *   every /api route needs a real auth token, so the cheap GETs and the PDF POST
 *   would all 401 and there would be nothing to load-test but the 3 auth-excluded
 *   probes. Demo mode is the only launch of the *built* bundle that exposes the
 *   read APIs and the Puppeteer render path without external credentials. The
 *   trade-off is that the dev path also mounts a Vite dev server (extra RSS + a
 *   one-time optimizer pass) — hence the warmup, and hence RSS is reported as a
 *   delta/leak-signal rather than an absolute budget.
 *
 * Run:  node tests/load/concurrency.mjs
 * Exit: 0 = clean; 1 = error-rate>0, a 5xx/timeout, an alarming GET p95, or a
 *       likely Puppeteer leak. (Advisory — the human-readable report is the point.)
 */

import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const HOST = "127.0.0.1";
const PORT = Number(process.env.LOAD_PORT) || 4312;
const BASE = `http://${HOST}:${PORT}`;

const N_GET = Number(process.env.LOAD_N) || 200; // total GET requests
const GET_BATCH = Number(process.env.LOAD_BATCH) || 50; // in-flight per wave
const PDF_SOAK = Number(process.env.LOAD_PDF) || 20; // concurrent PDF renders

const HEALTH_TIMEOUT_MS = 45_000; // max wait for first healthz 200
const SETTLE_MS = 12_000; // let the boot-time Vite dep optimizer finish
const GET_TIMEOUT_MS = 10_000; // per cheap GET
const PDF_TIMEOUT_MS = 90_000; // per PDF (semaphore=1 -> up to ~20*render serialized)
const TEARDOWN_MS = 8_000; // grace before SIGKILL

// Cheap, dependency-free read paths that answer 200 in demo mode.
const GET_PATHS = [
  "/healthz",
  "/readyz",
  "/api/health",
  "/api/tenants/me",
  "/api/usage/credits",
  "/api/config/maps",
  "/api/security/threats",
];

// Alarm thresholds (advisory) for the trivial read paths.
const GET_P95_ALARM_MS = 500;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", ".."); // tests/load -> repo root
const SERVER_BUNDLE = path.join(REPO_ROOT, "dist", "server.cjs");

// Shared keep-alive agent sized so a full batch (and the PDF soak) can be
// genuinely concurrent rather than queued behind a tiny socket pool.
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: Math.max(GET_BATCH, PDF_SOAK) + 16,
});

// ---------------------------------------------------------------------------
// Tiny HTTP client (drains the body so sockets are freed / keep-alive reused)
// ---------------------------------------------------------------------------
function httpRequest({ method = "GET", path: p, body = null, timeoutMs = GET_TIMEOUT_MS }) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const done = (out) => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      resolve({ ms, ...out });
    };
    const payload = body == null ? null : Buffer.from(JSON.stringify(body));
    const req = http.request(
      BASE + p,
      {
        method,
        agent,
        headers: payload
          ? { "content-type": "application/json", "content-length": payload.length }
          : {},
      },
      (res) => {
        let bytes = 0;
        res.on("data", (c) => (bytes += c.length));
        res.on("end", () =>
          done({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, bytes, error: null }),
        );
      },
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`timeout after ${timeoutMs}ms`));
    });
    req.on("error", (err) =>
      done({ status: 0, ok: false, bytes: 0, error: err?.message || String(err) }),
    );
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------
function percentile(sorted, p) {
  if (!sorted.length) return null;
  // nearest-rank
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

function summarize(results) {
  const lat = results.map((r) => r.ms).sort((a, b) => a - b);
  const nonOk = results.filter((r) => !r.ok);
  const server5xx = results.filter((r) => r.status >= 500);
  const timeouts = results.filter((r) => r.error && /timeout/i.test(r.error));
  const transport = results.filter((r) => r.error && !/timeout/i.test(r.error));
  const round = (x) => (x == null ? null : Math.round(x * 10) / 10);
  return {
    total: results.length,
    ok: results.length - nonOk.length,
    errorRate: results.length ? nonOk.length / results.length : 0,
    p50: round(percentile(lat, 50)),
    p95: round(percentile(lat, 95)),
    max: round(lat[lat.length - 1] ?? null),
    min: round(lat[0] ?? null),
    non2xx: nonOk.length,
    server5xx: server5xx.length,
    timeouts: timeouts.length,
    transportErrors: transport.length,
    // A few concrete offenders for the report.
    samples: nonOk.slice(0, 8).map((r) => ({ status: r.status, error: r.error, ms: round(r.ms) })),
  };
}

async function runBatched(tasks, batchSize) {
  const out = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const wave = tasks.slice(i, i + batchSize);
    out.push(...(await Promise.all(wave.map((t) => t()))));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Process-tree RSS (Linux /proc) — captures node + the Puppeteer Chromium kids,
// so a leak in either shows up. Returns kB, or null when /proc is unavailable.
// ---------------------------------------------------------------------------
function processTreeRssKb(rootPid) {
  try {
    const pids = fs.readdirSync("/proc").filter((d) => /^\d+$/.test(d)).map(Number);
    const ppidOf = new Map();
    const rssOf = new Map();
    for (const pid of pids) {
      try {
        const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
        const ppid = Number((status.match(/^PPid:\s*(\d+)/m) || [])[1] || 0);
        const rss = Number((status.match(/^VmRSS:\s*(\d+)/m) || [])[1] || 0);
        ppidOf.set(pid, ppid);
        rssOf.set(pid, rss);
      } catch {
        /* process vanished mid-scan */
      }
    }
    // BFS the descendant set from rootPid.
    const tree = new Set([rootPid]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const [pid, ppid] of ppidOf) {
        if (!tree.has(pid) && tree.has(ppid)) {
          tree.add(pid);
          grew = true;
        }
      }
    }
    let total = 0;
    for (const pid of tree) total += rssOf.get(pid) || 0;
    return total;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Boot / teardown
// ---------------------------------------------------------------------------
function bootServer() {
  const env = { ...process.env };
  env.PORT = String(PORT);
  env.REQUIRE_AUTH = "false"; // demo mode -> /api reachable without a token
  delete env.GEMINI_API_KEY; // force AI mock mode
  delete env.NODE_ENV; // NOT "production" -> no cluster, no auth guard, static+api served here via vite middleware
  delete env.VITEST;

  const child = spawn(process.execPath, [SERVER_BUNDLE], {
    cwd: REPO_ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = [];
  const cap = (buf) => {
    const s = buf.toString();
    log.push(s);
    if (log.length > 400) log.shift();
  };
  child.stdout.on("data", cap);
  child.stderr.on("data", cap);
  return { child, log };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealthz(child) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode != null || child.signalCode) {
      throw new Error(`server exited during boot (code=${child.exitCode}, signal=${child.signalCode})`);
    }
    const r = await httpRequest({ path: "/healthz", timeoutMs: 2000 });
    if (r.ok) return Number(((Date.now() - (deadline - HEALTH_TIMEOUT_MS)) / 1000).toFixed(1));
    await sleep(400);
  }
  throw new Error(`/healthz did not return 200 within ${HEALTH_TIMEOUT_MS}ms`);
}

async function teardown(child) {
  if (child.exitCode != null) return;
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    child.once("exit", finish);
    try {
      child.kill("SIGTERM");
    } catch {
      /* already gone */
    }
    setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
      finish();
    }, TEARDOWN_MS);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!fs.existsSync(SERVER_BUNDLE)) {
    console.error(`[load] missing server bundle: ${SERVER_BUNDLE}\n[load] build it first (npm run build) — this harness does NOT build.`);
    process.exit(2);
  }

  const report = {
    startedAt: new Date().toISOString(),
    config: { PORT, N_GET, GET_BATCH, PDF_SOAK, GET_PATHS },
    boot: {},
    getLoad: null,
    pdfSoak: null,
    findings: [],
  };

  const { child, log } = bootServer();
  // Always attempt teardown even on a throw / signal.
  const onExit = () => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* noop */
    }
  };
  process.on("exit", onExit);
  process.on("SIGINT", () => process.exit(130));
  process.on("SIGTERM", () => process.exit(143));

  try {
    // 1) Boot
    const t0 = Date.now();
    await waitForHealthz(child);
    report.boot.healthzMs = Date.now() - t0;
    report.boot.pid = child.pid;

    // 2) Warmup: let the one-time Vite dep-optimizer settle, hit every GET twice,
    //    then pay the Chromium cold-start with a single PDF (probes reachability).
    await sleep(SETTLE_MS);
    for (let i = 0; i < 2; i++) {
      await Promise.all(GET_PATHS.map((p) => httpRequest({ path: p })));
    }
    const pdfProbe = await httpRequest({
      method: "POST",
      path: "/api/invoices/generate-pdf",
      body: { invoiceId: "WARMUP", merchant: "Warmup Co", amount: 100, items: [{ description: "Cold start", quantity: 1, rate: 100 }] },
      timeoutMs: PDF_TIMEOUT_MS,
    });
    const pdfReachable = pdfProbe.ok && pdfProbe.bytes > 0;
    report.boot.pdfWarmupMs = Math.round(pdfProbe.ms);
    report.boot.pdfWarmupStatus = pdfProbe.status;
    report.boot.pdfReachable = pdfReachable;
    await sleep(1000); // brief quiet period after warmup

    // 3) GET load: N_GET requests round-robin across the cheap paths, batched.
    const getTasks = [];
    for (let i = 0; i < N_GET; i++) {
      const p = GET_PATHS[i % GET_PATHS.length];
      getTasks.push(() => httpRequest({ path: p }).then((r) => ({ ...r, path: p })));
    }
    const getWall0 = Date.now();
    const getResults = await runBatched(getTasks, GET_BATCH);
    const getWallMs = Date.now() - getWall0;
    report.getLoad = { ...summarize(getResults), wallMs: getWallMs, batch: GET_BATCH };

    // Per-path status breakdown (so a single bad route is visible).
    const byPath = {};
    for (const r of getResults) {
      const k = r.path;
      byPath[k] = byPath[k] || { n: 0, ok: 0, statuses: {} };
      byPath[k].n++;
      if (r.ok) byPath[k].ok++;
      byPath[k].statuses[r.status] = (byPath[k].statuses[r.status] || 0) + 1;
    }
    report.getLoad.byPath = byPath;

    // 4) PDF soak (only if reachable): PDF_SOAK concurrent renders. The server
    //    caps concurrent renders at 1 (semaphore) so these SERIALIZE — high tail
    //    latency here is BY DESIGN, not a bug; we watch for errors/5xx and RSS.
    if (pdfReachable) {
      const rssBeforeKb = processTreeRssKb(child.pid);
      const pdfTasks = [];
      for (let i = 0; i < PDF_SOAK; i++) {
        pdfTasks.push(() =>
          httpRequest({
            method: "POST",
            path: "/api/invoices/generate-pdf",
            body: {
              invoiceId: `SOAK-${i}`,
              merchant: `Soak Tenant ${i}`,
              amount: 1000 + i,
              items: [{ description: "Mowing", quantity: 2, rate: 50 }, { description: "Edging", quantity: 1, rate: 40 }],
            },
            timeoutMs: PDF_TIMEOUT_MS,
          }).then((r) => ({ ...r, isPdf: r.ok && r.bytes > 1000 })),
        );
      }
      const pdfWall0 = Date.now();
      const pdfResults = await Promise.all(pdfTasks.map((t) => t())); // all at once -> stress the semaphore
      const pdfWallMs = Date.now() - pdfWall0;
      // Let any post-render GC / page close settle, then re-sample RSS.
      await sleep(1500);
      const rssAfterKb = processTreeRssKb(child.pid);
      const validPdfs = pdfResults.filter((r) => r.isPdf).length;
      report.pdfSoak = {
        ...summarize(pdfResults),
        wallMs: pdfWallMs,
        validPdfBodies: validPdfs,
        rssBeforeKb,
        rssAfterKb,
        rssDeltaKb: rssBeforeKb != null && rssAfterKb != null ? rssAfterKb - rssBeforeKb : null,
        note: "concurrency capped server-side (PDF_MAX_CONCURRENT=1) -> serialized; tail latency expected",
      };
    } else {
      report.pdfSoak = { skipped: true, reason: `PDF endpoint not reachable in mock mode (status=${pdfProbe.status}, err=${pdfProbe.error || "none"})` };
    }

    // Post-soak liveness: the process must still answer after the render load.
    const liveAfter = await httpRequest({ path: "/healthz", timeoutMs: 5000 });
    report.boot.aliveAfterSoak = liveAfter.ok;

    // -----------------------------------------------------------------------
    // Findings (P0/P1/P2)
    // -----------------------------------------------------------------------
    const F = report.findings;
    const g = report.getLoad;
    if (g.server5xx > 0) F.push({ severity: "P1", area: "get-load", msg: `${g.server5xx} server 5xx on cheap read paths` });
    if (g.timeouts > 0) F.push({ severity: "P1", area: "get-load", msg: `${g.timeouts} GET timeouts (>${GET_TIMEOUT_MS}ms)` });
    if (g.transportErrors > 0) F.push({ severity: "P1", area: "get-load", msg: `${g.transportErrors} transport errors (connection dropped/refused)` });
    // non-2xx that are not 5xx/timeout (e.g. an unexpected 401/404 on a demo-mode read path)
    const otherNon2xx = g.non2xx - g.server5xx - g.timeouts - g.transportErrors;
    if (otherNon2xx > 0) F.push({ severity: "P1", area: "get-load", msg: `${otherNon2xx} unexpected non-2xx on read paths (see byPath)` });
    if (g.errorRate > 0) F.push({ severity: "P1", area: "get-load", msg: `GET error rate ${(g.errorRate * 100).toFixed(1)}% (expected 0)` });
    if (g.p95 != null && g.p95 > GET_P95_ALARM_MS) F.push({ severity: "P1", area: "get-load", msg: `GET p95 ${g.p95}ms > ${GET_P95_ALARM_MS}ms alarm on trivial reads` });

    if (report.pdfSoak && !report.pdfSoak.skipped) {
      const s = report.pdfSoak;
      if (s.server5xx > 0) F.push({ severity: "P1", area: "pdf-soak", msg: `${s.server5xx} 5xx during PDF soak (Puppeteer instability)` });
      if (s.timeouts > 0) F.push({ severity: "P1", area: "pdf-soak", msg: `${s.timeouts} PDF timeouts (>${PDF_TIMEOUT_MS}ms)` });
      if (s.transportErrors > 0) F.push({ severity: "P1", area: "pdf-soak", msg: `${s.transportErrors} transport errors during PDF soak` });
      if (s.validPdfBodies < PDF_SOAK) F.push({ severity: "P1", area: "pdf-soak", msg: `only ${s.validPdfBodies}/${PDF_SOAK} returned a valid PDF body` });
      // Leak signal: sustained tree-RSS growth across 20 renders. Chromium is ~200MB;
      // a real per-render leak would blow well past that. Flag > 250MB residual growth.
      if (s.rssDeltaKb != null && s.rssDeltaKb > 250_000)
        F.push({ severity: "P1", area: "pdf-soak", msg: `process-tree RSS grew ${Math.round(s.rssDeltaKb / 1024)}MB across ${PDF_SOAK} renders (possible Puppeteer leak)` });
    }
    if (report.boot.aliveAfterSoak === false)
      F.push({ severity: "P0", area: "liveness", msg: "server did not answer /healthz after the render soak (crashed/hung)" });

    report.finishedAt = new Date().toISOString();
    report.clean = report.findings.length === 0;

    // -----------------------------------------------------------------------
    // Print report
    // -----------------------------------------------------------------------
    console.log("\n================ LOAD / SOAK REPORT ================");
    console.log(`server bundle : ${SERVER_BUNDLE}`);
    console.log(`mode          : mock AI + demo auth (REQUIRE_AUTH=false)`);
    console.log(`boot healthz  : ${report.boot.healthzMs}ms   pid=${report.boot.pid}   alive-after-soak=${report.boot.aliveAfterSoak}`);
    console.log(`pdf warmup    : status=${report.boot.pdfWarmupStatus} ${report.boot.pdfWarmupMs}ms reachable=${report.boot.pdfReachable}`);
    console.log(`\n-- GET load (${N_GET} reqs, batch ${GET_BATCH}, ${GET_PATHS.length} paths) --`);
    console.log(`  ok=${g.ok}/${g.total}  errRate=${(g.errorRate * 100).toFixed(1)}%  p50=${g.p50}ms  p95=${g.p95}ms  max=${g.max}ms  wall=${g.wallMs}ms`);
    console.log(`  non2xx=${g.non2xx}  5xx=${g.server5xx}  timeouts=${g.timeouts}  transportErr=${g.transportErrors}`);
    console.log(`  byPath: ${JSON.stringify(g.byPath)}`);
    if (report.pdfSoak?.skipped) {
      console.log(`\n-- PDF soak: SKIPPED (${report.pdfSoak.reason}) --`);
    } else {
      const s = report.pdfSoak;
      console.log(`\n-- PDF soak (${PDF_SOAK} concurrent, server semaphore=1) --`);
      console.log(`  ok=${s.ok}/${s.total}  validPdf=${s.validPdfBodies}  errRate=${(s.errorRate * 100).toFixed(1)}%  p50=${s.p50}ms  p95=${s.p95}ms  max=${s.max}ms  wall=${s.wallMs}ms`);
      console.log(`  5xx=${s.server5xx}  timeouts=${s.timeouts}  transportErr=${s.transportErrors}`);
      console.log(`  RSS(tree) before=${s.rssBeforeKb}kB after=${s.rssAfterKb}kB delta=${s.rssDeltaKb}kB`);
    }
    console.log(`\n-- findings (${report.findings.length}) --`);
    if (report.findings.length === 0) console.log("  none — clean run");
    else for (const f of report.findings) console.log(`  [${f.severity}] (${f.area}) ${f.msg}`);
    console.log("\n=== JSON ===");
    console.log(JSON.stringify(report));
    console.log("====================================================\n");

    await teardown(child);
    process.exit(report.findings.some((f) => f.severity === "P0" || f.severity === "P1") ? 1 : 0);
  } catch (err) {
    console.error("[load] harness error:", err?.stack || err);
    console.error("[load] --- last server output ---\n" + log.join(""));
    await teardown(child);
    process.exit(2);
  }
}

main();
