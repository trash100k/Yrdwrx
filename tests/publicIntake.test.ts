// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Public online-booking intake: unauthenticated by design (auth-excluded), but validated +
// rate-limited. In mock/no-Firebase-creds mode the write simulates so the UX still completes.

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

  it('accepts a valid submission (simulated write in mock mode)', async () => {
    const res = await request(app)
      .post('/api/public/lead-intake')
      .send({ tenantId: 't1', name: 'Jane Doe', email: 'jane@example.com', serviceInterest: 'Mowing', message: 'Weekly please' });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('returns a tenant name for the booking page', async () => {
    const res = await request(app).get('/api/public/tenant/t1');
    expect(res.status).toBe(200);
    expect(typeof res.body?.name).toBe('string');
  });
});
