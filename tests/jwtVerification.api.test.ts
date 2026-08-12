// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

describe('JWT Verification & Algorithm Confusion Protection', () => {
  let app: any;
  const testSecret = 'test-jwt-secret-key-123456';

  beforeAll(async () => {
    process.env.REQUIRE_AUTH = 'true';
    process.env.JWT_SECRET = testSecret;
    // Import AFTER setting the env so createApp picks it up.
    const { createApp } = await import('../server');
    app = await createApp();
  });

  it('accepts and validates a correctly signed HS256 magic-link token', async () => {
    const payload = { clientId: 'client-123', tenantId: 'tenant-123', email: 'test@example.com', scope: 'portal' };
    const token = jwt.sign(payload, testSecret, { algorithm: 'HS256', expiresIn: '7d' });

    const res = await request(app)
      .post('/api/auth/magic-link/validate')
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      valid: true,
      clientId: 'client-123',
      tenantId: 'tenant-123',
      email: 'test@example.com',
    });
  });

  it('accepts and validates a correctly signed HS256 portal token for data access', async () => {
    const payload = { clientId: 'client-123', tenantId: 'tenant-123', scope: 'portal' };
    const token = jwt.sign(payload, testSecret, { algorithm: 'HS256', expiresIn: '7d' });

    // Since /api/portal/data hits Supabase, we expect it to try and resolve the database,
    // which might return 503 or 404/500 depending on mock config.
    // However, it should NOT return 401 (Unauthorized: Invalid or expired portal link),
    // which is returned when verifyPortalToken returns null.
    const res = await request(app)
      .get('/api/portal/data')
      .set('x-portal-token', token);

    expect(res.status).not.toBe(401);
  });

  it('rejects tokens signed with HS384', async () => {
    const payload = { clientId: 'client-123', tenantId: 'tenant-123', email: 'test@example.com', scope: 'portal' };
    const token = jwt.sign(payload, testSecret, { algorithm: 'HS384', expiresIn: '7d' });

    const res = await request(app)
      .post('/api/auth/magic-link/validate')
      .send({ token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it('rejects tokens signed with HS512', async () => {
    const payload = { clientId: 'client-123', tenantId: 'tenant-123', email: 'test@example.com', scope: 'portal' };
    const token = jwt.sign(payload, testSecret, { algorithm: 'HS512', expiresIn: '7d' });

    const res = await request(app)
      .post('/api/auth/magic-link/validate')
      .send({ token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it('rejects tokens using the "none" algorithm', async () => {
    const payload = { clientId: 'client-123', tenantId: 'tenant-123', email: 'test@example.com', scope: 'portal' };
    const token = jwt.sign(payload, '', { algorithm: 'none' });

    const res = await request(app)
      .post('/api/auth/magic-link/validate')
      .send({ token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it('rejects asymmetric RS256 signatures (algorithm confusion attack)', async () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const payload = { clientId: 'client-123', tenantId: 'tenant-123', email: 'test@example.com', scope: 'portal' };
    const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '7d' });

    const res = await request(app)
      .post('/api/auth/magic-link/validate')
      .send({ token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });
});
