// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Recurring / seasonal billing checkout. Without Stripe keys it returns a simulated response
// so the flow is demoable; validation still applies.
describe('Recurring billing (/api/stripe/recurring/checkout)', () => {
  let app: any;
  beforeAll(async () => {
    process.env.REQUIRE_AUTH = 'false';
    delete process.env.STRIPE_SECRET_KEY;
    const { createApp } = await import('../server');
    app = await createApp();
  });

  it('rejects an invalid interval', async () => {
    const res = await request(app).post('/api/stripe/recurring/checkout').send({ amount: 200, interval: 'hourly' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing/zero amount', async () => {
    const res = await request(app).post('/api/stripe/recurring/checkout').send({ interval: 'monthly' });
    expect(res.status).toBe(400);
  });

  it('returns a simulated plan when Stripe is not configured', async () => {
    const res = await request(app)
      .post('/api/stripe/recurring/checkout')
      .send({ amount: 200, interval: 'monthly', description: 'Weekly mowing', customerId: 'c1' });
    expect(res.status).toBe(200);
    expect(res.body?.simulated).toBe(true);
    expect(res.body?.interval).toBe('monthly');
  });
});
