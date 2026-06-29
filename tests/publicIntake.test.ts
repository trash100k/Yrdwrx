// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Public online-booking intake: unauthenticated by design (auth-excluded), but validated +
// rate-limited. Leads persist to Supabase; when the service role isn't configured the
// endpoint returns 503 (booking unavailable) rather than faking success and dropping the lead.

describe('Public lead intake (/api/public/*)', () => {
  let app: any;
  beforeAll(async () => {
    process.env.REQUIRE_AUTH = 'true'; // even with auth ON, /api/public/* must NOT 401
    delete process.env.GEMINI_API_KEY;
    const { createApp } = await import('../server');
    app = await createApp();
  });

  it('does NOT require auth (excluded namespace)', async () => {
    const res = await request(app).post('/api/public/lead-intake').send({});
    expect(res.status).not.toBe(401);
  });

  it('400s when name + a contact method are missing', async () => {
    const res = await request(app).post('/api/public/lead-intake').send({ tenantId: 't1' });
    expect(res.status).toBe(400);
  });

  it('400s when tenantId is missing', async () => {
    const res = await request(app).post('/api/public/lead-intake').send({ name: 'Jane', email: 'j@x.com' });
    expect(res.status).toBe(400);
  });

  it('503s (does not fake success) when persistence is unavailable', async () => {
    // No SUPABASE_SERVICE_ROLE_KEY in the test env -> the lead cannot be saved, so the
    // endpoint must NOT pretend to succeed (the old behavior silently dropped the lead).
    const res = await request(app)
      .post('/api/public/lead-intake')
      .send({ tenantId: 't1', name: 'Jane Doe', email: 'jane@example.com', serviceInterest: 'Mowing', message: 'Weekly please' });
    expect(res.status).toBe(503);
    expect(res.body?.success).not.toBe(true);
  });

  it('returns a tenant name for the booking page', async () => {
    const res = await request(app).get('/api/public/tenant/t1');
    expect(res.status).toBe(200);
    expect(typeof res.body?.name).toBe('string');
  });
});
