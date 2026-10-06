// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('POST /api/translate security checks', () => {
  let app: any;

  beforeAll(async () => {
    delete process.env.GEMINI_API_KEY; // force mock mode
    process.env.REQUIRE_AUTH = 'false';
    const { createApp } = await import('../server');
    app = await createApp();
  });

  it('blocks DAX injection payloads with a 403 status code', async () => {
    const res = await request(app)
      .post('/api/translate')
      .send({ text: 'evaluate filter(table)', targetLanguage: 'es' });
    expect(res.status).toBe(403);
    expect(res.body?.error || '').toMatch(/blocked for security/i);
  });

  it('blocks path traversal payloads in body for /api/translate with 403', async () => {
    const res = await request(app)
      .post('/api/translate')
      .send({ text: 'Test', targetLanguage: '../../../../etc/passwd' });
    expect(res.status).toBe(403);
    expect(res.body?.error || '').toMatch(/blocked for security/i);
  });

  it('allows valid translation requests with 200', async () => {
    const res = await request(app)
      .post('/api/translate')
      .send({ text: 'Hello', targetLanguage: 'es', sourceContext: 'Test' });
    expect(res.status).toBe(200);
    expect(res.body?.translatedText).toBeDefined();
  });
});
