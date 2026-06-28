// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Twilio inbound SMS webhook: form-encoded, auth-excluded, always replies with valid TwiML.
describe('Twilio inbound SMS (/api/public/sms/inbound)', () => {
  let app: any;
  beforeAll(async () => {
    process.env.REQUIRE_AUTH = 'true'; // must still accept the webhook (registered before auth)
    delete process.env.TWILIO_AUTH_TOKEN; // skip signature check in test
    const { createApp } = await import('../server');
    app = await createApp();
  });

  it('accepts a form-encoded inbound message and returns TwiML (not 401)', async () => {
    const res = await request(app)
      .post('/api/public/sms/inbound')
      .type('form')
      .send({ From: '+15551234567', To: '+15557654321', Body: 'Can you mow Friday?' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/xml/);
    expect(res.text).toMatch(/<Response/);
  });
});
