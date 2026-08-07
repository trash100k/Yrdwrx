// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

describe('JWT Algorithm Restriction / Signature Bypass Prevention', () => {
  let app: any;
  const SECRET = process.env.JWT_SECRET || 'cutty-dev-only-ephemeral-secret';

  beforeAll(async () => {
    // Force require auth to match the standard config
    process.env.REQUIRE_AUTH = 'true';
    const { createApp } = await import('../server');
    app = await createApp();
  });

  it('accepts valid HS256 signed magic-link tokens', async () => {
    const payload = { clientId: 'c-1', tenantId: 't-1', email: 'test@example.com', scope: 'portal' };
    const token = jwt.sign(payload, SECRET, { algorithm: 'HS256', expiresIn: '1h' });

    const res = await request(app)
      .post('/api/auth/magic-link/validate')
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.clientId).toBe('c-1');
  });

  it('rejects magic-link tokens signed with HS384', async () => {
    const payload = { clientId: 'c-1', tenantId: 't-1', email: 'test@example.com', scope: 'portal' };
    const token = jwt.sign(payload, SECRET, { algorithm: 'HS384', expiresIn: '1h' });

    const res = await request(app)
      .post('/api/auth/magic-link/validate')
      .send({ token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it('rejects magic-link tokens signed with RS256 using the secret as a public key (algorithm confusion)', async () => {
    // Generate an RSA private/public keypair
    const { generateKeyPairSync } = await import('crypto');
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const payload = { clientId: 'c-1', tenantId: 't-1', email: 'test@example.com', scope: 'portal' };
    // Sign the token with RS256 private key
    const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '1h' });

    // Send it to the validator which uses the symmetric SECRET (e.g., public key as secret / algorithm confusion)
    const res = await request(app)
      .post('/api/auth/magic-link/validate')
      .send({ token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it('rejects magic-link tokens signed with algorithm none', async () => {
    const payload = { clientId: 'c-1', tenantId: 't-1', email: 'test@example.com', scope: 'portal' };
    // Sign token with algorithm none
    const token = jwt.sign(payload, '', { algorithm: 'none' });

    const res = await request(app)
      .post('/api/auth/magic-link/validate')
      .send({ token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });
});
