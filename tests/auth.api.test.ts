// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Contract: server.ts exports `createApp(): Promise<Express>` which returns the fully
// configured app WITHOUT calling listen(). REQUIRE_AUTH is read at app-construction time
// (process.env.REQUIRE_AUTH === 'true'), so we MUST set it before createApp() runs.
//
// With REQUIRE_AUTH=true and NO x-firebase-auth header, the middleware returns 401 on the
// "missing/invalid token" branch — it never calls firebase-admin, so this stays offline.

describe('API auth enforcement (REQUIRE_AUTH=true)', () => {
  let app: any;

  beforeAll(async () => {
    process.env.REQUIRE_AUTH = 'true';
    // Import AFTER setting the env so createApp picks it up.
    const { createApp } = await import('../server');
    app = await createApp();
  });

  it('returns 401 for a protected route with no x-firebase-auth header', async () => {
    const res = await request(app)
      .post('/api/design/process')
      .send({ image: 'data:image/jpeg;base64,AAAA' });
    expect(res.status).toBe(401);
    expect(res.body?.error || '').toMatch(/unauthorized/i);
  });

  it('returns 401 for /api/crm/enrich with no auth header', async () => {
    const res = await request(app).post('/api/crm/enrich').send({});
    expect(res.status).toBe(401);
  });

  it('locks down /api/security/threats (admin-only; no longer public)', async () => {
    // Registered before the auth middleware, the handler does its own admin check and
    // returns 403 without credentials; either way it must no longer be publicly readable.
    const res = await request(app).get('/api/security/threats');
    expect([401, 403]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });

  it('does NOT 401 the stripe webhook for the auth reason (excluded route)', async () => {
    // The webhook is auth-excluded; it may fail signature verification (400) or behave
    // otherwise, but it must NOT be rejected as Unauthorized (401) by the auth middleware.
    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .send('{}');
    expect(res.status).not.toBe(401);
  });

  it('returns 401 for /api/playground/* (now auth-gated — was open AI-cost abuse)', async () => {
    const res = await request(app).post('/api/playground/chat').send({ prompt: 'hi' });
    expect(res.status).toBe(401);
  });

  it('does NOT 401 the health probe (excluded)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).not.toBe(401);
  });
});
