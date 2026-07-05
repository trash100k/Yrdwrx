// @ts-nocheck
//
// Regression lock for the cross-tenant BOLA on POST /api/stripe/checkout (API1 / IDOR).
//
// The bug (found by two independent audits): the invoice-payment branch loaded the invoice by
// body-supplied `invoiceId` with NO check that it belongs to the caller's tenant. Any
// authenticated user could pass ANOTHER tenant's invoiceId and (a) read its amount back in the
// checkout response and (b) drive that foreign invoice to `paid` via the webhook
// (metadata.invoiceId). The fix derives the caller's tenant from the verified token
// (resolveTenant → profiles.firebase_uid) and 403s a mismatch — mirroring the portal path.
//
// Harness (mirrors tests/portal.money.api.test.ts): server.ts reaches Supabase only through
// `require("@supabase/supabase-js").createClient`. We monkeypatch that on the shared CJS module
// to a small in-memory fake that serves BOTH the auth client (auth.getUser → req.user.uid) and
// the service client (from(...) reads for profiles/tenants/invoices). REQUIRE_AUTH=true so the
// real token middleware runs; STRIPE_SECRET_KEY is set to a dummy so the handler reaches the
// invoice lookup (an unset key returns early with `simulated`). Every ASSERTED path returns
// BEFORE any Stripe network call:
//   - foreign invoice        → 403 (ownership fails first)
//   - own invoice, no amount → 400 (ownership PASSED, then the "no amount" guard) — offline proof
//   - unknown invoice        → 404 (no leak)
//   - no bearer token        → 401
//
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';
import request from 'supertest';

const require2 = createRequire(import.meta.url);

// Invoices keyed by id. inv-B belongs to a DIFFERENT tenant than the caller (uid-A → tenant-A).
const INVOICES: Record<string, any> = {
  'inv-A': { amount: 500, tenant_id: 'tenant-A' },        // owned, valid (would reach Stripe — not asserted)
  'inv-A-noamt': { amount: null, tenant_id: 'tenant-A' }, // owned, no amount → 400 AFTER ownership passes
  'inv-B': { amount: 999, tenant_id: 'tenant-B' },        // FOREIGN → must 403
};

function makeBuilder(table: string) {
  const ctx: any = { table, op: null, filters: {} };
  const builder: any = {
    insert() { ctx.op = 'insert'; return builder; },
    update() { ctx.op = 'update'; return builder; },
    upsert() { ctx.op = 'upsert'; return builder; },
    delete() { ctx.op = 'delete'; return builder; },
    select() { if (!ctx.op) ctx.op = 'select'; return builder; },
    eq(c: string, v: any) { ctx.filters[c] = v; return builder; },
    neq() { return builder; },
    maybeSingle() { return exec(ctx); },
    single() { return exec(ctx); },
    then(res: any, rej: any) { return exec(ctx).then(res, rej); },
  };
  return builder;
}

async function exec(ctx: any) {
  const { table, op, filters } = ctx;
  if (op && op !== 'select') return { data: null, error: null }; // benign write
  if (table === 'profiles') {
    return filters.firebase_uid === 'uid-A'
      ? { data: { firebase_uid: 'uid-A', tenant_id: 'tenant-A', role: 'owner' }, error: null }
      : { data: null, error: null };
  }
  if (table === 'tenants') {
    if (filters.id === 'tenant-A') return { data: { id: 'tenant-A' }, error: null };
    if (filters.id === 'tenant-B') return { data: { id: 'tenant-B', stripe_account_id: 'acct_B' }, error: null };
    return { data: null, error: null };
  }
  if (table === 'invoices') {
    const inv = INVOICES[filters.id];
    return { data: inv ? { ...inv } : null, error: null };
  }
  return { data: null, error: null };
}

// One fake object doubles as the auth client (auth.getUser) AND the service client (from).
const fakeClient = {
  auth: {
    getUser: async (token: string) =>
      token === 'tok-A'
        ? { data: { user: { id: 'uid-A', email: 'a@tenant-a.io' } }, error: null }
        : { data: { user: null }, error: { message: 'invalid token' } },
  },
  from: (t: string) => makeBuilder(t),
};

describe('POST /api/stripe/checkout — cross-tenant BOLA regression (API1)', () => {
  let app: any;

  beforeAll(async () => {
    process.env.REQUIRE_AUTH = 'true';
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://fake.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon_fake';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_fake';
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'; // reach the invoice lookup (unset → early simulated)
    delete process.env.GEMINI_API_KEY;

    const supa = require2('@supabase/supabase-js');
    supa.createClient = () => fakeClient;

    const { createApp } = await import('../server');
    app = await createApp();
    // Restore the repo's demo default for the shared process env (each app captured REQUIRE_AUTH already).
    process.env.REQUIRE_AUTH = 'false';
  });

  const auth = (r: any) => r.set('Authorization', 'Bearer tok-A');

  it('403s when the invoice belongs to ANOTHER tenant (the exploit)', async () => {
    const res = await auth(request(app).post('/api/stripe/checkout')).send({ invoiceId: 'inv-B' });
    expect(res.status).toBe(403);
    // Must NOT leak the foreign invoice amount anywhere in the body.
    expect(JSON.stringify(res.body)).not.toContain('999');
  });

  it('lets the OWNER through the ownership gate (own invoice → 400 "no amount", not 403)', async () => {
    // This invoice IS the caller's — the ownership check passes, and the very next guard
    // ("Invoice has no amount") fires. Reaching that 400 proves the gate did not block the owner,
    // and it happens BEFORE any Stripe call, so the test stays offline.
    const res = await auth(request(app).post('/api/stripe/checkout')).send({ invoiceId: 'inv-A-noamt' });
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(403);
    expect(String(res.body?.error || '')).toMatch(/amount/i);
  });

  it('404s (no leak) for an invoice id that does not exist', async () => {
    const res = await auth(request(app).post('/api/stripe/checkout')).send({ invoiceId: 'inv-ghost' });
    expect(res.status).toBe(404);
  });

  it('401s with no bearer token (route requires auth)', async () => {
    const res = await request(app).post('/api/stripe/checkout').send({ invoiceId: 'inv-A' });
    expect(res.status).toBe(401);
  });
});
