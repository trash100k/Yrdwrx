// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// QuickBooks is wired but degrades cleanly until QBO_CLIENT_ID/SECRET are configured.
describe('QuickBooks integration guards', () => {
  let app: any;
  beforeAll(async () => {
    process.env.REQUIRE_AUTH = 'false';
    delete process.env.QBO_CLIENT_ID;
    delete process.env.QBO_CLIENT_SECRET;
    const { createApp } = await import('../server');
    app = await createApp();
  });

  it('status reports not configured / not connected', async () => {
    const res = await request(app).get('/api/quickbooks/status');
    expect(res.status).toBe(200);
    expect(res.body?.configured).toBe(false);
    expect(res.body?.connected).toBe(false);
  });

  it('connect 503s when QuickBooks is not configured', async () => {
    const res = await request(app).get('/api/quickbooks/connect');
    expect(res.status).toBe(503);
    expect(res.body?.code).toBe('QBO_UNCONFIGURED');
  });

  it('sync 503s when QuickBooks is not configured', async () => {
    const res = await request(app).post('/api/quickbooks/sync').send({});
    expect(res.status).toBe(503);
  });

  it('callback is auth-excluded but 400s without code/state', async () => {
    const res = await request(app).get('/api/quickbooks/callback');
    // 503 (unconfigured) or 400 (missing code) — never 401.
    expect(res.status).not.toBe(401);
  });
});
