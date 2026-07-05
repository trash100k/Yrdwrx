/**
 * YardWorx end-to-end smoke test (Puppeteer, plain Node script — NOT vitest).
 * ==========================================================================
 *
 * WHAT / WHY
 *   Boots the REAL app in DEMO mode and drives a real browser through the core
 *   admin journey, asserting the SPA mounts and NO route trips an error boundary
 *   or throws an uncaught page error. This is the "does the whole thing actually
 *   render for a human" gate that unit/supertest coverage can't give us.
 *
 * HOW TO RUN
 *   node tests/e2e/smoke.e2e.mjs
 *   Exit code 0 = pass, 1 = fail. Prints a per-step log + a final PASS/FAIL line.
 *   It is intentionally a standalone script (not a *.test.ts) so `vitest run`
 *   never tries to boot Chromium/a live server; run it explicitly in CI/E2E.
 *
 * BOOT STRATEGY (why `tsx server.ts`, not `dist/server.cjs`)
 *   We spawn `npx tsx server.ts` with REQUIRE_AUTH='' / VITE_REQUIRE_AUTH=''
 *   (empty-but-present, so server.ts's dotenv.config() — which never overrides an
 *   already-set key — keeps demo mode ON even though .env.local sets real values)
 *   and PORT=4311. In demo mode there is no login wall: App.tsx injects a mock
 *   admin and useRole() returns `owner`, so /admin is reachable headless.
 *   NODE_ENV is left unset, so server.ts mounts Vite as middleware and serves the
 *   SPA itself on :4311 — one process, no separate vite. GEMINI_API_KEY is unset
 *   → AI runs in mock mode (no external keys needed).
 *   The `node dist/server.cjs` fallback is deliberately NOT used: that path serves
 *   static dist ONLY under NODE_ENV=production, and production mode hard-refuses to
 *   boot without REQUIRE_AUTH=true (server.ts ~L1476) — i.e. it cannot run the
 *   auth-free demo this smoke test needs. The tsx dev-server boots in ~1s here.
 *
 * WHAT COUNTS AS A FAILURE (and what doesn't)
 *   FAIL  = an uncaught JS exception on the page (page 'pageerror'), OR any route
 *           landing on an error-boundary fallback ("Neural Grid Desynced",
 *           "System Interruption", "System Exception Captured"), OR a missing
 *           expected element (dashboard shell, invoice modal, deposit field).
 *   OK    = failed network requests to *external* hosts (e.g. *.supabase.co) and
 *           their console.error echoes. This sandbox blocks outbound Supabase, and
 *           the app's data layer swallows those into "no data yet" empty states by
 *           design — they are the environment, not app bugs. We log the count for
 *           visibility but never gate on it.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';
import puppeteer from 'puppeteer';

const PORT = 4311;
const BASE = `http://localhost:${PORT}`;
const BOOT_TIMEOUT_MS = 90_000;
// Error-boundary fallback headings rendered by ErrorBoundary / GlobalErrorBoundary.
const BOUNDARY_MARKERS = ['Neural Grid Desynced', 'System Interruption', 'System Exception Captured'];

const failures = [];
const fail = (msg) => { failures.push(msg); console.error('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);

// Prefer the pre-installed Playwright Chromium; fall back to puppeteer's own.
function chromePath() {
  const pw = '/opt/pw-browsers/chromium';
  if (existsSync(pw)) return pw;
  try { const p = puppeteer.executablePath(); if (p && existsSync(p)) return p; } catch { /* ignore */ }
  return undefined; // let puppeteer decide
}

function get(path) {
  return new Promise((resolve) => {
    const req = http.get(BASE + path, { timeout: 3000 }, (res) => {
      res.resume();
      resolve(res.statusCode || 0);
    });
    req.on('timeout', () => { req.destroy(); resolve(0); });
    req.on('error', () => resolve(0));
  });
}

async function waitForReady(child) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server process exited early (code ${child.exitCode}) before becoming ready`);
    }
    if ((await get('/healthz')) === 200) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not become ready within ${BOOT_TIMEOUT_MS}ms`);
}

async function main() {
  console.log(`[smoke] booting  REQUIRE_AUTH='' VITE_REQUIRE_AUTH='' PORT=${PORT} npx tsx server.ts`);
  const child = spawn('npx', ['tsx', 'server.ts'], {
    cwd: process.cwd(),
    // Own process group (leader = child.pid) so teardown can SIGKILL the WHOLE tree
    // (npx -> tsx -> server) via the negative-pid group signal. Killing only the npx
    // wrapper orphans the real listening process and leaks port 4311.
    detached: true,
    env: {
      ...process.env,
      REQUIRE_AUTH: '',            // demo mode (dotenv won't override an already-set key)
      VITE_REQUIRE_AUTH: '',       // frontend demo mode: mock admin, no login wall
      PORT: String(PORT),
      DISABLE_HMR: 'true',         // no file-watching churn in a constrained env
      NODE_ENV: process.env.NODE_ENV === 'production' ? '' : (process.env.NODE_ENV || ''),
      GEMINI_API_KEY: '',          // AI mock mode — no external keys
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  child.stdout.on('data', (d) => { serverLog += d.toString(); });
  child.stderr.on('data', (d) => { serverLog += d.toString(); });

  let browser;
  try {
    await waitForReady(child);
    ok(`server ready on ${BASE}`);

    browser = await puppeteer.launch({
      headless: true,
      executablePath: chromePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });

    // Uncaught JS exceptions on the page are hard failures (real app bugs).
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e).slice(0, 300)));
    // External-host request failures are expected (sandbox blocks Supabase). Count for info only.
    let extReqFails = 0;
    page.on('requestfailed', (r) => {
      const u = r.url();
      if (!u.startsWith(BASE)) extReqFails++;
    });

    const bodyText = () => page.evaluate(() => document.body?.innerText || '');
    async function assertNoBoundary(where) {
      const t = await bodyText();
      const hit = BOUNDARY_MARKERS.find((m) => t.includes(m));
      if (hit) fail(`error boundary tripped at ${where}: "${hit}"`);
      return !hit;
    }
    async function navigate(path, mustInclude) {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      // give the lazy-loaded route + first data pass time to mount
      await new Promise((r) => setTimeout(r, 2000));
      const t = await bodyText();
      if ((t.trim().length || 0) < 50) fail(`${path} rendered an essentially empty body (len=${t.trim().length})`);
      if (mustInclude && !new RegExp(mustInclude, 'i').test(t)) {
        fail(`${path} did not contain expected text /${mustInclude}/i`);
      } else {
        ok(`${path} rendered (${t.trim().length} chars)`);
      }
      await assertNoBoundary(path);
    }

    // 1) Admin dashboard shell.
    await navigate('/admin', 'YardWorx|Dashboard|Workspace');
    // 2) Core operational routes.
    await navigate('/admin/crm', 'Client|Customer');
    await navigate('/admin/invoices', 'Invoice');
    await navigate('/admin/scheduler', 'Schedul|Dispatch|Board');

    // 3) New-invoice modal + the Deposit-on-accept field.
    await page.goto(BASE + '/admin/invoices', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await new Promise((r) => setTimeout(r, 1500));
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /generate invoice/i.test(x.textContent || ''));
      if (b) { b.click(); return true; }
      return false;
    });
    if (!clicked) {
      fail('could not find a "Generate Invoice" button on /admin/invoices to open the new-invoice modal');
    } else {
      // Wait for the modal's billing summary (with the deposit field) to render.
      let depositLabel = false, depositInput = false;
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        depositLabel = await page.evaluate(() => (document.body?.innerText || '').includes('Deposit on accept'));
        depositInput = await page.evaluate(() => !!document.querySelector('input[type="number"][max="100"]'));
        if (depositLabel && depositInput) break;
        await new Promise((r) => setTimeout(r, 300));
      }
      if (depositLabel) ok('new-invoice modal: "Deposit on accept (%)" label rendered');
      else fail('new-invoice modal opened but the "Deposit on accept" label never rendered');
      if (depositInput) ok('new-invoice modal: deposit percentage input (max=100) rendered');
      else fail('new-invoice modal: deposit percentage input (max=100) did not render');
      await assertNoBoundary('/admin/invoices (new-invoice modal)');
    }

    // 4) Client portal route (unauthenticated clientId -> graceful "locked" screen, not a crash).
    await navigate('/portal/demo-client', 'Portal');

    // 5) Global assertion: zero uncaught page errors across the whole journey.
    if (pageErrors.length) {
      fail(`${pageErrors.length} uncaught page error(s): ` + pageErrors.slice(0, 5).join(' | '));
    } else {
      ok('zero uncaught page errors across the journey');
    }
    console.log(`  · (info) external-host request failures ignored as sandbox noise: ${extReqFails}`);
  } catch (err) {
    fail('harness error: ' + (err?.message || String(err)));
    if (serverLog) console.error('---- server log (tail) ----\n' + serverLog.slice(-1500));
  } finally {
    try { if (browser) await browser.close(); } catch { /* ignore */ }
    // Signal the whole process group (negative pid), not just the npx wrapper, so the
    // real tsx/server child can't survive as an orphan holding the port.
    const killGroup = (sig) => { try { process.kill(-child.pid, sig); } catch { try { child.kill(sig); } catch { /* ignore */ } } };
    killGroup('SIGTERM');
    await new Promise((r) => setTimeout(r, 1500));
    if (child.exitCode === null) killGroup('SIGKILL');
    await new Promise((r) => setTimeout(r, 300));
  }

  if (failures.length) {
    console.error(`\n[smoke] FAIL — ${failures.length} problem(s):`);
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('\n[smoke] PASS — admin journey rendered clean (no error-boundary trips, no uncaught page errors).');
  process.exit(0);
}

main().catch((e) => {
  console.error('[smoke] FATAL', e);
  process.exit(1);
});
