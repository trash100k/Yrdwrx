// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

let app: any;

beforeAll(async () => {
  delete process.env.GEMINI_API_KEY;
  process.env.REQUIRE_AUTH = 'false';
  const { createApp } = await import('../server');
  app = await createApp();
  process.env.REQUIRE_AUTH = 'false';
});

describe('Security Enhancements - URL-decoding, Malformed URI, and /api/translate Checks', () => {
  it('should block URL-encoded malicious extensions or traversals (bypassing raw URL checks)', async () => {
    // %2eenv is .env
    const res1 = await request(app).get('/api/%2eenv');
    expect(res1.status).toBe(403);
    expect(res1.body?.error).toMatch(/blocked for security reasons/i);

    // %2e%2e%2f is ../
    const res2 = await request(app).get('/api/%2e%2e%2fpasswd');
    expect(res2.status).toBe(403);
    expect(res2.body?.error).toMatch(/blocked for security reasons/i);
  });

  it('should reject malformed URI percent-encoding sequences with a 400 Bad Request', async () => {
    // %xx is a bad escape sequence
    const res = await request(app).get('/api/test%xx');
    expect(res.status).toBe(400);
    expect(res.body?.error).toMatch(/malformed uri/i);
  });

  it('should block strict patterns specifically on the /api/translate route body', async () => {
    // If we call /api/translate, the server has strict body pattern checks
    const res1 = await request(app)
      .post('/api/translate')
      .send({ text: 'evaluate filter' });
    expect(res1.status).toBe(403);
    expect(res1.body?.error).toMatch(/blocked for security reasons/i);

    const res2 = await request(app)
      .post('/api/translate')
      .send({ text: '../../config' });
    expect(res2.status).toBe(403);
    expect(res2.body?.error).toMatch(/blocked for security reasons/i);
  });

  it('should NOT block normal landscaping messages on the /api/translate route', async () => {
    const res = await request(app)
      .post('/api/translate')
      .send({
        text: 'translate this sentence to spanish please',
        targetLanguage: 'Spanish'
      });
    // Proves compatible/non-interfering: we don't block normal landscaping messages on this route
    expect(res.status).toBe(200);
  });
});
