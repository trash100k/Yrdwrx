// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const require2 = createRequire(import.meta.url);
const JWT_SECRET = 'jwt-verification-test-secret-123456';

describe('JWT Algorithm Confusion & Verification Hardening', () => {
  let app;
  const CLIENT = 'client-jwt-123';
  const TENANT = 'tenant-jwt-123';

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.REQUIRE_AUTH = 'false';
    process.env.SUPABASE_URL = 'https://fake.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_fake';

    function makeBuilder(table: string) {
      const ctx = { table };
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        neq() { return builder; },
        in() { return builder; },
        ilike() { return builder; },
        filter() { return builder; },
        match() { return builder; },
        maybeSingle() { return exec(ctx); },
        single() { return exec(ctx); },
        then(resolve, reject) {
          return exec(ctx).then(resolve, reject);
        },
      };
      return builder;
    }

    async function exec(ctx: any) {
      const { table } = ctx;
      if (table === 'customers') {
        return {
          data: {
            id: CLIENT,
            tenant_id: TENANT,
            first_name: 'Test',
            last_name: 'User',
          },
          error: null,
        };
      }
      if (table === 'tenants') {
        return {
          data: {
            id: TENANT,
            name: 'Test Tenant',
          },
          error: null,
        };
      }
      return { data: [], error: null };
    }

    const supa = require2('@supabase/supabase-js');
    supa.createClient = () => ({
      from: (table: string) => makeBuilder(table),
    });

    const { createApp } = await import('../server');
    app = await createApp();
  });

  const validPayload = { clientId: CLIENT, tenantId: TENANT, scope: 'portal' };

  it('allows valid HS256 tokens signed with JWT_SECRET', async () => {
    const validToken = jwt.sign(validPayload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const res = await request(app)
      .get('/api/portal/data')
      .set('x-portal-token', validToken);
    expect(res.status).toBe(200);
  });

  it('rejects tokens signed with the none algorithm', async () => {
    const noneToken = jwt.sign(validPayload, '', { algorithm: 'none' });
    const res = await request(app)
      .get('/api/portal/data')
      .set('x-portal-token', noneToken);
    expect(res.status).toBe(401);
  });

  it('rejects tokens signed with an unsupported symmetric algorithm (e.g., HS384)', async () => {
    const hs384Token = jwt.sign(validPayload, JWT_SECRET, { algorithm: 'HS384', expiresIn: '1h' });
    const res = await request(app)
      .get('/api/portal/data')
      .set('x-portal-token', hs384Token);
    expect(res.status).toBe(401);
  });

  it('rejects tokens signed with asymmetric private key (RS256) (algorithm confusion guard)', async () => {
    // Generate a 2048-bit RSA key pair dynamically
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Sign the token with RS256 using the private key
    const rs256Token = jwt.sign(validPayload, privateKey, { algorithm: 'RS256', expiresIn: '1h' });

    const res = await request(app)
      .get('/api/portal/data')
      .set('x-portal-token', rs256Token);
    expect(res.status).toBe(401);
  });

  it('rejects tokens signed with public key as symmetric secret (classic algorithm confusion attack)', async () => {
    const { publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // In a classic algorithm confusion attack, the server uses a public key as its verification key symmetrically.
    // If the server lacks algorithm verification, an attacker can sign a token with HS256 using the server's public key as the secret.
    // Let's verify that our endpoint blocks this because it strictly enforces { algorithms: ["HS256"] } with JWT_SECRET (not publicKey).
    const attackerToken = jwt.sign(validPayload, publicKey, { algorithm: 'HS256', expiresIn: '1h' });

    const res = await request(app)
      .get('/api/portal/data')
      .set('x-portal-token', attackerToken);
    expect(res.status).toBe(401);
  });
});
