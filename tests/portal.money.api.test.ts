// @ts-nocheck
//
// HTTP-integration tests (supertest, mock mode — no live Stripe/Supabase keys) for the
// client-portal MONEY endpoints:
//   POST /api/portal/estimate/sign      (e-sign + accept + deposit-on-acceptance)
//   POST /api/portal/checkout           (pay an invoice balance)
//   POST /api/portal/estimate/deposit   (re-open a pending deposit checkout)
//   GET  /api/portal/data               (used here only to exercise the token gate)
//
// These routes are auth-EXCLUDED from Firebase auth (a portal visitor has no app session);
// the credential is a signed portal capability token in the `x-portal-token` header, verified
// against JWT_SECRET. Every data query is scoped to THAT token's clientId — a body-supplied id
// is never trusted, so a wrong-client invoice is a 403.
//
// How Supabase data is controlled offline (mirrors tests/stripe.webhook.api.test.ts):
//   server.ts reaches Supabase only through `require("@supabase/supabase-js").createClient`.
//   `vi.mock` does NOT intercept server.ts's internal `require` in this repo, so we monkeypatch
//   `createClient` on the shared CJS module (via createRequire — the same module the server's
//   internal require resolves) to return a small in-memory fake. That lets us drive the exact
//   invoice row each endpoint reads (the only way to reach the 403/409/valid business logic) and
//   capture the writes so we can assert the recorded signature block. Money stays in MOCK mode:
//   STRIPE_SECRET_KEY is unset, so the endpoints return honest `simulated`/simulatedUrl shapes
//   instead of hitting Stripe.
//
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'module';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const require2 = createRequire(import.meta.url);
const JWT_SECRET = 'portal-money-test-secret-xyz';

// ---------------------------------------------------------------------------
// In-memory Supabase test double. `state.invoice` is the single row every
// "invoices" read resolves to (set per-test); `state.writes` captures inserts/
// updates so we can assert the persisted signature block + accepted status.
// ---------------------------------------------------------------------------
const state: any = { invoice: null, writes: [] };
function resetState() {
  state.invoice = null;
  state.writes = [];
}

function makeBuilder(table: string) {
  const ctx: any = { table, op: null, payload: null, filters: {} };
  const builder: any = {
    insert(p: any) { ctx.op = 'insert'; ctx.payload = p; return builder; },
    update(p: any) { ctx.op = 'update'; ctx.payload = p; return builder; },
    upsert(p: any) { ctx.op = 'upsert'; ctx.payload = p; return builder; },
    delete() { ctx.op = 'delete'; return builder; },
    select(_c?: string) { if (!ctx.op) ctx.op = 'select'; return builder; },
    eq(c: string, v: any) { ctx.filters[c] = v; return builder; },
    neq() { return builder; },
    in() { return builder; },
    ilike() { return builder; },
    filter() { return builder; },
    match() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    maybeSingle() { return exec(ctx); },
    single() { return exec(ctx); },
    // Thenable so `await sb.from(t).update(...).eq(...)` and `await sb.from(t).insert(...)` resolve.
    then(res: any, rej: any) { return exec(ctx).then(res, rej); },
  };
  return builder;
}

async function exec(ctx: any) {
  const { table, op } = ctx;
  if (op === 'insert' || op === 'update' || op === 'upsert' || op === 'delete') {
    state.writes.push({ table, op, payload: ctx.payload, filters: ctx.filters });
    return { data: null, error: null };
  }
  // Reads
  if (table === 'invoices') return { data: state.invoice ? { ...state.invoice } : null, error: null };
  // tenants (connected-account lookup) + any unmodeled table resolve benignly.
  return { data: null, error: null };
}

const fakeSupabase = { from: (t: string) => makeBuilder(t) };

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
const CLIENT = 'cust-A';
const OTHER_CLIENT = 'cust-B';

const tokenFor = (clientId: string, tenantId = 'tenant-1') =>
  jwt.sign({ clientId, tenantId, email: `${clientId}@example.com`, scope: 'portal' }, JWT_SECRET, {
    expiresIn: '1h',
  });
const TOKEN = () => tokenFor(CLIENT);

const setInvoice = (row: any) => { state.invoice = row; };
const invoiceUpdate = () => state.writes.find((w: any) => w.table === 'invoices' && w.op === 'update');

// A tiny, well-formed inline PNG data-URI (matches the sign endpoint's allow regex).
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('portal money endpoints (mock mode: Supabase faked, Stripe unset)', () => {
  let app: any;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET; // set BEFORE server import; dotenv won't clobber an existing var
    process.env.REQUIRE_AUTH = 'false';
    // Present + non-empty so getServiceSupabase() builds a client; the URL value is irrelevant
    // because we replace createClient below with the in-memory fake (no network).
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://fake.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_fake';
    delete process.env.STRIPE_SECRET_KEY; // force honest simulated money paths
    delete process.env.GEMINI_API_KEY; // AI mock mode (keeps everything offline)

    // Swap the real Supabase factory on the shared CJS module BEFORE server.ts requires it.
    const supa = require2('@supabase/supabase-js');
    supa.createClient = () => fakeSupabase;

    const { createApp } = await import('../server');
    app = await createApp();
  });

  beforeEach(() => {
    delete process.env.STRIPE_SECRET_KEY; // stay in the simulated branch
    resetState();
  });

  // =====================================================================
  // The portal-token gate (guards every /api/portal/* money route).
  // =====================================================================
  describe('portal-token gate', () => {
    const moneyRoutes = [
      { m: 'post', p: '/api/portal/estimate/sign' },
      { m: 'post', p: '/api/portal/checkout' },
      { m: 'post', p: '/api/portal/estimate/deposit' },
      { m: 'get', p: '/api/portal/data' },
    ];

    it('401s every money route when NO portal token is supplied', async () => {
      for (const r of moneyRoutes) {
        const res = await (request(app) as any)[r.m](r.p).send({ invoiceId: 'inv-1' });
        expect(res.status).toBe(401);
        expect(res.body?.error || '').toMatch(/portal link/i);
      }
    });

    it('401s on a FORGED token (signed with the wrong secret)', async () => {
      const forged = jwt.sign({ clientId: CLIENT, scope: 'portal' }, 'attacker-secret', { expiresIn: '1h' });
      const res = await request(app)
        .post('/api/portal/checkout')
        .set('x-portal-token', forged)
        .send({ invoiceId: 'inv-1' });
      expect(res.status).toBe(401);
    });

    it('401s on a valid-signature token whose scope is NOT "portal"', async () => {
      const wrongScope = jwt.sign({ clientId: CLIENT, scope: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
      const res = await request(app)
        .post('/api/portal/estimate/sign')
        .set('x-portal-token', wrongScope)
        .send({ invoiceId: 'inv-1', signerName: 'Jane' });
      expect(res.status).toBe(401);
    });

    it('401s on a portal-scoped token with NO clientId (never trusts an empty subject)', async () => {
      const noClient = jwt.sign({ scope: 'portal' }, JWT_SECRET, { expiresIn: '1h' });
      const res = await request(app)
        .post('/api/portal/estimate/deposit')
        .set('x-portal-token', noClient)
        .send({ invoiceId: 'inv-1' });
      expect(res.status).toBe(401);
    });

    it('401s on an expired portal token', async () => {
      const expired = jwt.sign({ clientId: CLIENT, scope: 'portal' }, JWT_SECRET, { expiresIn: -10 });
      const res = await request(app)
        .post('/api/portal/checkout')
        .set('x-portal-token', expired)
        .send({ invoiceId: 'inv-1' });
      expect(res.status).toBe(401);
    });

    it('401s on a token signed with an unsupported algorithm (e.g. HS384)', async () => {
      const wrongAlgo = jwt.sign({ clientId: CLIENT, scope: 'portal' }, JWT_SECRET, {
        algorithm: 'HS384',
        expiresIn: '1h',
      });
      const res = await request(app)
        .get('/api/portal/data')
        .set('x-portal-token', wrongAlgo);
      expect(res.status).toBe(401);
    });

    it('401s on magic-link validation when token algorithm is restricted to HS256', async () => {
      const wrongAlgo = jwt.sign({ clientId: CLIENT, scope: 'portal' }, JWT_SECRET, {
        algorithm: 'HS512',
        expiresIn: '1h',
      });
      const res = await request(app)
        .post('/api/auth/magic-link/validate')
        .send({ token: wrongAlgo });
      expect(res.status).toBe(401);
      expect(res.body?.valid).toBe(false);
    });
  });

  // =====================================================================
  // POST /api/portal/checkout — pay an invoice balance.
  // =====================================================================
  describe('POST /api/portal/checkout', () => {
    it('400s when invoiceId is missing from the body', async () => {
      const res = await request(app).post('/api/portal/checkout').set('x-portal-token', TOKEN()).send({});
      expect(res.status).toBe(400);
      expect(res.body?.error || '').toMatch(/invoiceId/i);
    });

    it('404s when the invoice does not exist (not a 500)', async () => {
      setInvoice(null);
      const res = await request(app)
        .post('/api/portal/checkout')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'nope' });
      expect(res.status).toBe(404);
    });

    it('403s when the invoice belongs to a DIFFERENT client (cross-scope)', async () => {
      setInvoice({ amount: 400, tenant_id: 'tenant-1', customer_id: OTHER_CLIENT, status: 'sent', data: {} });
      const res = await request(app)
        .post('/api/portal/checkout')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'inv-1' });
      expect(res.status).toBe(403);
      expect(res.body?.error || '').toMatch(/not your/i);
      // A rejected cross-scope request must never touch the ledger.
      expect(state.writes.length).toBe(0);
    });

    it('409s when the invoice is already settled (paid)', async () => {
      setInvoice({ amount: 400, tenant_id: 'tenant-1', customer_id: CLIENT, status: 'paid', data: {} });
      const res = await request(app)
        .post('/api/portal/checkout')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'inv-1' });
      expect(res.status).toBe(409);
      expect(res.body?.error || '').toMatch(/already/i);
    });

    it('returns the honest simulated-payment shape for a valid, unpaid invoice (no Stripe key)', async () => {
      setInvoice({ amount: 400, tenant_id: 'tenant-1', customer_id: CLIENT, status: 'sent', data: {} });
      const res = await request(app)
        .post('/api/portal/checkout')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'inv-1' });
      expect(res.status).toBe(200);
      // Mock mode: no real Stripe session, just an honest simulated redirect URL
      // carrying the mock marker (no live checkoutUrl).
      expect(typeof res.body?.simulatedUrl).toBe('string');
      expect(res.body.simulatedUrl).toMatch(/success=mock/);
      expect(res.body.checkoutUrl).toBeUndefined();
    });
  });

  // =====================================================================
  // POST /api/portal/estimate/sign — e-sign + accept + deposit-on-acceptance.
  // =====================================================================
  describe('POST /api/portal/estimate/sign', () => {
    it('400s when invoiceId and/or signer name are missing', async () => {
      const res = await request(app)
        .post('/api/portal/estimate/sign')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'inv-1' }); // no signerName
      expect(res.status).toBe(400);
      expect(res.body?.error || '').toMatch(/name/i);
    });

    it('400s on a malformed signature data-URI (rejects a non-image / abuse vector)', async () => {
      const res = await request(app)
        .post('/api/portal/estimate/sign')
        .set('x-portal-token', TOKEN())
        // gif is not in the png|jpeg allow-list -> rejected as invalid (and no injection substrings).
        .send({ invoiceId: 'inv-1', signerName: 'Jane', signatureDataUrl: 'data:image/gif;base64,R0lGODlhAQAB' });
      expect(res.status).toBe(400);
      expect(res.body?.error || '').toMatch(/signature/i);
    });

    it('400s on an oversized signature image (> 200KB cap)', async () => {
      const huge = 'data:image/png;base64,' + 'A'.repeat(200_001);
      const res = await request(app)
        .post('/api/portal/estimate/sign')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'inv-1', signerName: 'Jane', signatureDataUrl: huge });
      expect(res.status).toBe(400);
    });

    it('403s when the estimate belongs to a DIFFERENT client', async () => {
      setInvoice({ id: 'inv-1', customer_id: OTHER_CLIENT, tenant_id: 'tenant-1', status: 'sent', amount: 1000, data: {} });
      const res = await request(app)
        .post('/api/portal/estimate/sign')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'inv-1', signerName: 'Jane Homeowner' });
      expect(res.status).toBe(403);
      expect(res.body?.error || '').toMatch(/not your/i);
      // Cross-scope sign must not persist a signature or flip status.
      expect(invoiceUpdate()).toBeFalsy();
    });

    it('409s when the estimate is already accepted', async () => {
      setInvoice({ id: 'inv-1', customer_id: CLIENT, tenant_id: 'tenant-1', status: 'accepted', amount: 1000, data: {} });
      const res = await request(app)
        .post('/api/portal/estimate/sign')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'inv-1', signerName: 'Jane Homeowner' });
      expect(res.status).toBe(409);
      expect(res.body?.error || '').toMatch(/already/i);
    });

    it('409s when the estimate is already paid', async () => {
      setInvoice({ id: 'inv-1', customer_id: CLIENT, tenant_id: 'tenant-1', status: 'paid', amount: 1000, data: {} });
      const res = await request(app)
        .post('/api/portal/estimate/sign')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'inv-1', signerName: 'Jane Homeowner' });
      expect(res.status).toBe(409);
    });

    it('signs a valid estimate: 200 + records a signature block + accepted status', async () => {
      setInvoice({ id: 'inv-1', customer_id: CLIENT, tenant_id: 'tenant-1', status: 'sent', amount: 500, data: {} });
      const res = await request(app)
        .post('/api/portal/estimate/sign')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'inv-1', signerName: '  Jane Homeowner  ', acceptedTier: 'Better' });

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(res.body?.status).toBe('accepted');
      expect(typeof res.body?.signedAt).toBe('string');
      expect(Number.isNaN(Date.parse(res.body.signedAt))).toBe(false);
      // No deposit configured -> no charge step.
      expect(res.body?.depositRequired).toBe(false);
      expect(res.body?.depositAmount).toBe(0);
      expect(res.body?.depositCheckoutUrl).toBeNull();

      // The invoice write must flip to accepted AND persist a legally-meaningful signature block.
      const upd = invoiceUpdate();
      expect(upd).toBeTruthy();
      expect(upd.payload?.status).toBe('accepted');
      const sig = upd.payload?.data?.signature;
      expect(sig).toBeTruthy();
      expect(sig.name).toBe('Jane Homeowner'); // trimmed
      expect(sig.via).toBe('portal');
      expect(typeof sig.signedAt).toBe('string');
      expect(sig.acceptedTier).toBe('Better');
      expect(upd.payload?.data?.acceptedAt).toBe(sig.signedAt);
    });

    it('records the drawn signature image when a valid inline PNG is supplied', async () => {
      setInvoice({ id: 'inv-1', customer_id: CLIENT, tenant_id: 'tenant-1', status: 'sent', amount: 500, data: {} });
      const res = await request(app)
        .post('/api/portal/estimate/sign')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'inv-1', signerName: 'Jane', signatureDataUrl: TINY_PNG });
      expect(res.status).toBe(200);
      const sig = invoiceUpdate()?.payload?.data?.signature;
      expect(sig?.image).toBe(TINY_PNG);
    });

    it('returns the deposit fields (required + amount + simulated) when a deposit is configured', async () => {
      // 20% of $1000 = $200 deposit.
      setInvoice({ id: 'inv-1', customer_id: CLIENT, tenant_id: 'tenant-1', status: 'sent', amount: 1000, data: { depositPct: 20 } });
      const res = await request(app)
        .post('/api/portal/estimate/sign')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'inv-1', signerName: 'Jane Homeowner' });

      expect(res.status).toBe(200);
      expect(res.body?.status).toBe('accepted');
      expect(res.body?.depositRequired).toBe(true);
      expect(res.body?.depositAmount).toBe(200);
      // No Stripe key in this env -> honest simulated deposit, no live checkout URL.
      expect(res.body?.depositSimulated).toBe(true);
      expect(res.body?.depositCheckoutUrl).toBeNull();

      // The persisted invoice data should carry a pending deposit block.
      const upd = invoiceUpdate();
      expect(upd.payload?.data?.deposit?.required).toBe(true);
      expect(upd.payload?.data?.deposit?.amount).toBe(200);
      expect(upd.payload?.data?.deposit?.status).toBe('pending');
    });

    it('NEVER 500s on hostile / malformed bodies (client-error or success, never a crash)', async () => {
      // A valid unpaid estimate so bodies that pass validation reach the happy path.
      setInvoice({ id: 'inv-1', customer_id: CLIENT, tenant_id: 'tenant-1', status: 'sent', amount: 500, data: {} });
      const cases = [
        {}, // nothing
        { invoiceId: 'inv-1' }, // no name
        { signerName: 'Jane' }, // no invoiceId
        { invoiceId: 'inv-1', signerName: 123 }, // non-string name -> coerced to "123"
        { invoiceId: 'inv-1', signerName: { a: 1 } }, // object name -> coerced
        { invoiceId: 'inv-1', signerName: 'Jane', signatureDataUrl: 987 }, // non-string sig -> ignored
        { invoiceId: 'inv-1', signerName: 'Jane', acceptedTier: ['x', 'y'] }, // array tier -> coerced
        { invoiceId: 'inv-1', signerName: 'Jane', signatureDataUrl: 'not-a-uri' }, // bad sig -> 400
        { invoiceId: ['a', 'b'], signerName: 'Jane' }, // array id (truthy) -> read still scoped by fake
      ];
      for (const body of cases) {
        resetState();
        setInvoice({ id: 'inv-1', customer_id: CLIENT, tenant_id: 'tenant-1', status: 'sent', amount: 500, data: {} });
        const res = await request(app)
          .post('/api/portal/estimate/sign')
          .set('x-portal-token', TOKEN())
          .send(body as any);
        expect(res.status).not.toBe(500);
        expect([200, 400, 403, 409]).toContain(res.status);
      }
    });
  });

  // =====================================================================
  // POST /api/portal/estimate/deposit — re-open a pending deposit checkout.
  // =====================================================================
  describe('POST /api/portal/estimate/deposit', () => {
    it('400s when invoiceId is missing', async () => {
      const res = await request(app).post('/api/portal/estimate/deposit').set('x-portal-token', TOKEN()).send({});
      expect(res.status).toBe(400);
      expect(res.body?.error || '').toMatch(/invoiceId/i);
    });

    it('403s when the estimate belongs to a DIFFERENT client', async () => {
      setInvoice({ id: 'inv-1', customer_id: OTHER_CLIENT, tenant_id: 'tenant-1', status: 'accepted', amount: 1000, data: { depositPct: 20, deposit: { status: 'pending' } } });
      const res = await request(app)
        .post('/api/portal/estimate/deposit')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'inv-1' });
      expect(res.status).toBe(403);
      expect(res.body?.error || '').toMatch(/not your/i);
    });

    it('409s when the deposit was already paid (cannot be charged twice)', async () => {
      setInvoice({ id: 'inv-1', customer_id: CLIENT, tenant_id: 'tenant-1', status: 'accepted', amount: 1000, data: { depositPct: 20, deposit: { status: 'paid' } } });
      const res = await request(app)
        .post('/api/portal/estimate/deposit')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'inv-1' });
      expect(res.status).toBe(409);
      expect(res.body?.error || '').toMatch(/already paid/i);
    });

    it('400s when no deposit is due on the estimate', async () => {
      setInvoice({ id: 'inv-1', customer_id: CLIENT, tenant_id: 'tenant-1', status: 'accepted', amount: 1000, data: {} });
      const res = await request(app)
        .post('/api/portal/estimate/deposit')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'inv-1' });
      expect(res.status).toBe(400);
      expect(res.body?.error || '').toMatch(/no deposit/i);
    });

    it('returns the honest simulated deposit shape for a valid pending deposit (no Stripe key)', async () => {
      setInvoice({ id: 'inv-1', customer_id: CLIENT, tenant_id: 'tenant-1', status: 'accepted', amount: 1000, data: { depositPct: 20, deposit: { status: 'pending' } } });
      const res = await request(app)
        .post('/api/portal/estimate/deposit')
        .set('x-portal-token', TOKEN())
        .send({ invoiceId: 'inv-1' });
      expect(res.status).toBe(200);
      expect(res.body?.simulated).toBe(true);
      expect(res.body?.depositAmount).toBe(200);
      expect(typeof res.body?.simulatedUrl).toBe('string');
    });
  });
});
