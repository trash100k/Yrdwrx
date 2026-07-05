// @ts-nocheck
//
// Stripe money-path API tests (supertest, mock mode — no live Stripe/Supabase keys).
//
// Focus: the webhook idempotency guard (the durable `stripe_events` claim from migration 0016)
// that stops a redelivered `checkout.session.completed` from crediting an invoice twice, plus
// signature-verification failure modes and the simulated base+per-seat+metered subscribe /
// recurring-checkout shapes returned when Stripe isn't configured.
//
// How the durable guard is exercised without a real Postgres:
//   `server.ts` reaches Supabase exclusively through `require("@supabase/supabase-js").createClient`.
//   We monkeypatch that factory on the shared CJS module (via createRequire, the same cache the
//   server's internal `require` resolves) to return a small in-memory fake that faithfully models
//   the two behaviours the guard depends on:
//     • stripe_events.upsert(..., { ignoreDuplicates:true }).select("id")  ->  1 row (claimed) the
//       first time an id is seen, 0 rows (already claimed) on any redelivery. This is the exact
//       INSERT ... ON CONFLICT DO NOTHING contract the exactly-once logic keys off.
//     • invoices select/update  ->  so we can assert the ledger was credited EXACTLY once.
//   (vi.mock does NOT intercept server.ts's internal require in this repo, and .env.local injects a
//   real, network-blocked Supabase host — hence the require-cache monkeypatch.)
//
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'module';
import request from 'supertest';

const require2 = createRequire(import.meta.url);
const Stripe = require2('stripe'); // CJS callable form, matching server.ts's require("stripe")(key)

const WEBHOOK_SECRET = 'whsec_test_secret';
const DUMMY_KEY = 'sk_test_dummy'; // constructEvent is a local HMAC check; no network, no real key needed.

// ---------------------------------------------------------------------------
// In-memory Supabase test double. Models only the tables the webhook touches.
// ---------------------------------------------------------------------------
const db: any = {
  stripeEvents: new Set<string>(), // the durable idempotency claim store
  invoices: new Map<string, any>(),
  tenants: new Map<string, any>(),
  invoiceUpdateCount: 0,
  tenantUpdateCount: 0,
};
function resetDb() {
  db.stripeEvents.clear();
  db.invoices.clear();
  db.tenants.clear();
  db.invoiceUpdateCount = 0;
  db.tenantUpdateCount = 0;
}

function makeBuilder(table: string) {
  const ctx: any = { table, op: null, payload: null, filters: {} };
  const builder: any = {
    upsert(p: any, _opts?: any) { ctx.op = 'upsert'; ctx.payload = p; return builder; },
    insert(p: any) { ctx.op = 'insert'; ctx.payload = p; return builder; },
    update(p: any) { ctx.op = 'update'; ctx.payload = p; return builder; },
    delete() { ctx.op = 'delete'; return builder; },
    select(_cols?: string) { if (!ctx.op) ctx.op = 'select'; return builder; },
    eq(c: string, v: any) { ctx.filters[c] = v; return builder; },
    ilike() { return builder; },
    limit() { return builder; },
    maybeSingle() { return exec(ctx); },
    then(res: any, rej: any) { return exec(ctx).then(res, rej); },
  };
  return builder;
}

async function exec(ctx: any) {
  const { table, op } = ctx;
  if (table === 'stripe_events') {
    if (op === 'upsert') {
      const id = ctx.payload.id;
      // ON CONFLICT DO NOTHING: first claim returns the row, a redelivery returns nothing.
      if (db.stripeEvents.has(id)) return { data: [], error: null };
      db.stripeEvents.add(id);
      return { data: [{ id }], error: null };
    }
    if (op === 'delete') { db.stripeEvents.delete(ctx.filters.id); return { data: null, error: null }; }
    return { data: null, error: null };
  }
  if (table === 'invoices') {
    if (op === 'select') {
      const inv = db.invoices.get(ctx.filters.id);
      return { data: inv ? { ...inv } : null, error: null };
    }
    if (op === 'update') {
      const cur = db.invoices.get(ctx.filters.id) || {};
      db.invoices.set(ctx.filters.id, { ...cur, ...ctx.payload });
      db.invoiceUpdateCount++;
      return { data: null, error: null };
    }
  }
  if (table === 'tenants') {
    if (op === 'update') {
      const cur = db.tenants.get(ctx.filters.id) || {};
      db.tenants.set(ctx.filters.id, { ...cur, ...ctx.payload });
      db.tenantUpdateCount++;
      return { data: null, error: null };
    }
    if (op === 'select') {
      const t = db.tenants.get(ctx.filters.id);
      return { data: t ? { ...t } : null, error: null };
    }
  }
  // Any unmodeled table (e.g. notification dispatch reads) resolves benignly.
  return { data: null, error: null };
}

const fakeSupabase = { from: (t: string) => makeBuilder(t) };

// ---------------------------------------------------------------------------

describe('Stripe money path (webhook idempotency + billing shapes)', () => {
  let app: any;
  let stripe: any;

  const post = (payload: string, sig?: string) => {
    const req = request(app).post('/api/stripe/webhook').set('Content-Type', 'application/json');
    if (sig !== undefined) req.set('stripe-signature', sig);
    return req.send(payload);
  };
  const sign = (payload: string, secret = WEBHOOK_SECRET) =>
    stripe.webhooks.generateTestHeaderString({ payload, secret });

  const ENV_KEYS = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
  const envSnapshot: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const k of ENV_KEYS) envSnapshot[k] = process.env[k];
    process.env.REQUIRE_AUTH = 'false';
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    // Present + non-empty so getServiceSupabase() builds a client; the URL value is irrelevant
    // because we replace createClient below with an in-memory fake (no network).
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://fake.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_fake';

    // Swap the real Supabase factory on the shared CJS module BEFORE server.ts requires it.
    const supa = require2('@supabase/supabase-js');
    supa.createClient = () => fakeSupabase;

    stripe = new Stripe(DUMMY_KEY);
    const { createApp } = await import('../server');
    app = await createApp();
  });

  afterAll(() => {
    // Restore any env vars we mutated so a shared-process suite run stays unaffected.
    for (const k of ENV_KEYS) {
      if (envSnapshot[k] === undefined) delete process.env[k];
      else process.env[k] = envSnapshot[k];
    }
  });

  // ---- Webhook: signature + idempotency ---------------------------------
  describe('POST /api/stripe/webhook', () => {
    beforeEach(() => {
      // constructEvent needs a key to build the stripe client; a dummy is fine (local HMAC).
      process.env.STRIPE_SECRET_KEY = DUMMY_KEY;
      process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
      resetDb();
    });

    it('rejects a request with no stripe-signature header (400, not 500)', async () => {
      const payload = JSON.stringify({ id: 'evt_nosig', type: 'checkout.session.completed', data: { object: {} } });
      const res = await post(payload); // no signature
      expect(res.status).toBe(400);
      expect(db.invoiceUpdateCount).toBe(0);
    });

    it('rejects a tampered/invalid signature (400)', async () => {
      const payload = JSON.stringify({ id: 'evt_badsig', type: 'checkout.session.completed', data: { object: {} } });
      const res = await post(payload, 't=1,v1=deadbeefdeadbeef');
      expect(res.status).toBe(400);
      expect(db.invoiceUpdateCount).toBe(0);
    });

    it('400s when the webhook secret is not configured (never reaches signature check)', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      const payload = JSON.stringify({ id: 'evt_nosecret', type: 'checkout.session.completed', data: { object: {} } });
      // Even a validly-signed body must be refused when the server has no configured secret.
      const res = await post(payload, sign(payload));
      expect(res.status).toBe(400);
    });

    // THE key test: a redelivered checkout.session.completed must credit the invoice ONCE.
    it('is idempotent: the SAME event id delivered twice credits the invoice exactly once', async () => {
      db.invoices.set('inv_dup', { amount: 500, data: {}, status: 'sent', tenant_id: 't1', customer_id: 'c1' });
      const payload = JSON.stringify({
        id: 'evt_dup_once',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_dup', amount_total: 10000, metadata: { invoiceId: 'inv_dup' } } },
      });
      const sig = sign(payload);

      const r1 = await post(payload, sig);
      const r2 = await post(payload, sig); // exact redelivery, same event id

      expect(r1.status).toBe(200);
      expect(r1.body?.received).toBe(true);
      expect(r1.body?.duplicate).toBeFalsy(); // first delivery actually applied

      expect(r2.status).toBe(200);
      expect(r2.body?.received).toBe(true);
      expect(r2.body?.duplicate).toBe(true); // redelivery short-circuited

      // Ledger credited exactly once: one update, $100 applied (not $200), status -> partial.
      expect(db.invoiceUpdateCount).toBe(1);
      const inv = db.invoices.get('inv_dup');
      expect(inv.data.amountPaid).toBe(100);
      expect(inv.data.payments).toHaveLength(1);
      expect(inv.status).toBe('partial');
    });

    // Durable stripe_events guard in isolation: an event another worker/instance already claimed
    // (present in the durable store but unseen by THIS worker's in-memory fast-path) must NOT be
    // re-applied — this is the real cross-worker exactly-once claim.
    it('durable stripe_events guard: an already-claimed event id is not re-applied', async () => {
      db.stripeEvents.add('evt_preclaimed'); // simulate a prior worker's committed claim
      db.invoices.set('inv_pre', { amount: 500, data: {}, status: 'sent', tenant_id: 't1', customer_id: 'c1' });
      const payload = JSON.stringify({
        id: 'evt_preclaimed',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_pre', amount_total: 10000, metadata: { invoiceId: 'inv_pre' } } },
      });

      const res = await post(payload, sign(payload));

      expect(res.status).toBe(200);
      expect(res.body?.duplicate).toBe(true);
      expect(db.invoiceUpdateCount).toBe(0); // never credited — the durable claim blocked it
      expect(db.invoices.get('inv_pre').data.amountPaid).toBeUndefined();
    });

    // A first-time, validly-signed subscription checkout applies the tenant tier.
    it('applies a SaaS subscription tier on first delivery (mode=subscription)', async () => {
      const payload = JSON.stringify({
        id: 'evt_tier_pro',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_sub', mode: 'subscription', metadata: { tenantId: 't9', tier: 'pro' } } },
      });
      const res = await post(payload, sign(payload));
      expect(res.status).toBe(200);
      expect(res.body?.received).toBe(true);
      expect(db.tenantUpdateCount).toBe(1);
      expect(db.tenants.get('t9')?.tier).toBe('pro');
    });
  });

  // ---- Simulated billing shapes (no Stripe key => simulated:true) --------
  describe('simulated checkout shapes (mock mode, no Stripe key)', () => {
    beforeEach(() => {
      delete process.env.STRIPE_SECRET_KEY; // force the simulated branch
    });

    it('POST /api/stripe/subscribe returns the base + per-seat + metered shape', async () => {
      const res = await request(app).post('/api/stripe/subscribe').send({ tier: 'pro' });
      expect(res.status).toBe(200);
      const b = res.body || {};
      expect(b.simulated).toBe(true);
      expect(b.tier).toBe('pro');
      // Pro includes 3 seats; with none requested there are no extra (billable) seats.
      expect(b.seats).toBe(3);
      expect(b.includedSeats).toBe(3);
      expect(b.extraSeats).toBe(0);
      // Base + per-seat pricing surfaced (integer cents), and the metered meters list present.
      expect(typeof b.baseCents).toBe('number');
      expect(b.baseCents).toBeGreaterThan(0);
      expect(typeof b.seatCents).toBe('number');
      expect(Array.isArray(b.meteredMeters)).toBe(true);
    });

    it('POST /api/stripe/subscribe bills only seats ABOVE the included count', async () => {
      const res = await request(app).post('/api/stripe/subscribe').send({ tier: 'pro', seats: 5 });
      expect(res.status).toBe(200);
      expect(res.body?.simulated).toBe(true);
      expect(res.body?.seats).toBe(5);
      expect(res.body?.includedSeats).toBe(3);
      expect(res.body?.extraSeats).toBe(2);
    });

    it('POST /api/stripe/subscribe rejects an unknown tier (400)', async () => {
      const res = await request(app).post('/api/stripe/subscribe').send({ tier: 'platinum' });
      expect(res.status).toBe(400);
    });

    it('POST /api/stripe/recurring/checkout returns a simulated recurring plan', async () => {
      const res = await request(app)
        .post('/api/stripe/recurring/checkout')
        .send({ amount: 200, interval: 'monthly', description: 'Weekly mowing', customerId: 'c1' });
      expect(res.status).toBe(200);
      expect(res.body?.simulated).toBe(true);
      expect(res.body?.interval).toBe('monthly');
      expect(res.body?.amount).toBe(200);
    });

    it('POST /api/stripe/recurring/checkout rejects an invalid interval (400)', async () => {
      const res = await request(app).post('/api/stripe/recurring/checkout').send({ amount: 200, interval: 'hourly' });
      expect(res.status).toBe(400);
    });

    it('POST /api/stripe/recurring/checkout rejects a below-minimum amount (400)', async () => {
      const res = await request(app).post('/api/stripe/recurring/checkout').send({ amount: 0.1, interval: 'monthly' });
      expect(res.status).toBe(400);
    });
  });
});
