// @ts-nocheck
//
// End-to-end lock for the per-tenant OUTBOUND rate limit (Scenario A — "1000 tenants each
// blasting 1000 emails"). Proves POST /api/email/send returns 429 + Retry-After once a tenant
// exceeds OUTBOUND_PER_MINUTE, and that the cap is PER-TENANT (a second tenant is unaffected).
//
// Harness mirrors tests/stripe.checkout.bola.api.test.ts: monkeypatch createClient to a fake
// serving BOTH the auth client (auth.getUser → req.user.uid) and the service client (profiles →
// tenant). No email provider is configured, so sendEmail returns a simulated success (offline).
// OUTBOUND_PER_MINUTE is set to 3 before createApp so the cap trips fast.
//
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';
import request from 'supertest';

const require2 = createRequire(import.meta.url);

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
  if (op && op !== 'select') return { data: null, error: null };
  if (table === 'profiles') {
    const map: any = { 'uid-A': 'tenant-A', 'uid-B': 'tenant-B' };
    const tid = map[filters.firebase_uid];
    return tid ? { data: { firebase_uid: filters.firebase_uid, tenant_id: tid, role: 'owner' }, error: null } : { data: null, error: null };
  }
  if (table === 'tenants') return { data: { id: filters.id }, error: null };
  return { data: null, error: null };
}
const fakeClient = {
  auth: {
    getUser: async (token: string) => {
      const map: any = { 'tok-A': { id: 'uid-A', email: 'a@t.io' }, 'tok-B': { id: 'uid-B', email: 'b@t.io' } };
      return map[token] ? { data: { user: map[token] }, error: null } : { data: { user: null }, error: { message: 'bad' } };
    },
  },
  from: (t: string) => makeBuilder(t),
};

describe('POST /api/email/send — per-tenant outbound rate limit (Scenario A)', () => {
  let app: any;

  beforeAll(async () => {
    process.env.REQUIRE_AUTH = 'true';
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://fake.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon_fake';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_fake';
    process.env.OUTBOUND_PER_MINUTE = '3'; // trip the cap fast
    process.env.OUTBOUND_PER_DAY = '100000';
    delete process.env.RESEND_API_KEY; // no provider → sendEmail simulated (offline)
    delete process.env.EMAIL_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const supa = require2('@supabase/supabase-js');
    supa.createClient = () => fakeClient;

    const { createApp } = await import('../server');
    app = await createApp();
    process.env.REQUIRE_AUTH = 'false';
  });

  const send = (token: string) =>
    request(app).post('/api/email/send').set('Authorization', `Bearer ${token}`).send({ to: 'x@customer.io', subject: 'Hi' });

  it('allows up to the per-minute cap, then 429s with Retry-After', async () => {
    for (let i = 0; i < 3; i++) {
      const ok = await send('tok-A');
      expect(ok.status).toBe(200);
    }
    const blocked = await send('tok-A');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(String(blocked.body?.error || '')).toMatch(/rate limit/i);
  });

  it('the cap is PER-TENANT — a different tenant is not throttled by tenant-A\'s blast', async () => {
    // tenant-A is already capped from the previous test; tenant-B starts fresh.
    const b = await send('tok-B');
    expect(b.status).toBe(200);
  });

  it('still 401s with no bearer token', async () => {
    const res = await request(app).post('/api/email/send').send({ to: 'x@customer.io', subject: 'Hi' });
    expect(res.status).toBe(401);
  });
});
