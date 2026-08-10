// @ts-nocheck
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'module';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const require2 = createRequire(import.meta.url);
const JWT_SECRET = 'jwt-verification-test-secret-12345';

// Mock Supabase to keep it offline.
const fakeSupabase = {
  from: () => ({
    select: () => ({
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
    }),
  }),
};

describe('API JWT verification validation', () => {
  let app: any;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.REQUIRE_AUTH = 'false';
    process.env.SUPABASE_URL = 'https://fake.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_fake';
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.GEMINI_API_KEY;

    // Swap the real Supabase factory on the shared CJS module BEFORE server.ts requires it.
    const supa = require2('@supabase/supabase-js');
    supa.createClient = () => fakeSupabase;

    const { createApp } = await import('../server');
    app = await createApp();
  });

  it('successfully validates a valid HS256 token', async () => {
    const payload = { clientId: 'client-1', tenantId: 'tenant-1', email: 'test@example.com', scope: 'portal' };
    const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

    const res = await request(app)
      .post('/api/auth/magic-link/validate')
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.clientId).toBe('client-1');
  });

  it('rejects a token signed with an unsupported algorithm (HS384)', async () => {
    const payload = { clientId: 'client-1', tenantId: 'tenant-1', email: 'test@example.com', scope: 'portal' };
    const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS384', expiresIn: '1h' });

    const res = await request(app)
      .post('/api/auth/magic-link/validate')
      .send({ token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it('rejects a token using the "none" algorithm (signature bypass)', async () => {
    // Construct a JWT with "alg": "none" header
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64').replace(/=/g, '');
    const payload = Buffer.from(JSON.stringify({ clientId: 'client-1', scope: 'portal' })).toString('base64').replace(/=/g, '');
    const token = `${header}.${payload}.`;

    const res = await request(app)
      .post('/api/auth/magic-link/validate')
      .send({ token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it('rejects an algorithm confusion attempt (RS256 header with HS256 key)', async () => {
    const payload = { clientId: 'client-1', tenantId: 'tenant-1', email: 'test@example.com', scope: 'portal' };

    // An attacker signs a token using the symmetric secret JWT_SECRET, but specifies "RS256" in the header.
    // If jwt.verify does not restrict algorithms, it might try to verify using RS256, or if algorithm confusion is successful,
    // the system treats the public key symmetrically.
    // Here we generate a token signed symmetrically but labeled as RS256 in the header.
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64').replace(/=/g, '');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '');

    // We symmetrically sign the header + payload using HMAC-SHA256 (simulating the confusion attempt)
    const crypto = require('crypto');
    const signature = crypto.createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payloadB64}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const token = `${header}.${payloadB64}.${signature}`;

    const res = await request(app)
      .post('/api/auth/magic-link/validate')
      .send({ token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });
});
