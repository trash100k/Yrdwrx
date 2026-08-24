// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

describe('JWT Verification Algorithm Enforcement', () => {
  let app: any;
  const JWT_SECRET = 'cutty-dev-only-ephemeral-secret';

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const { createApp } = await import('../server');
    app = await createApp();
  });

  it('validates a token signed with HS256 correctly', async () => {
    const validToken = jwt.sign({ clientId: 'client-123', tenantId: 'tenant-456', scope: 'portal' }, JWT_SECRET, { algorithm: 'HS256' });
    const res = await request(app)
      .post('/api/auth/magic-link/validate')
      .send({ token: validToken });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.clientId).toBe('client-123');
  });

  it('rejects a token signed with an unauthorized algorithm (HS384)', async () => {
    const invalidAlgToken = jwt.sign({ clientId: 'client-123', tenantId: 'tenant-456', scope: 'portal' }, JWT_SECRET, { algorithm: 'HS384' });
    const res = await request(app)
      .post('/api/auth/magic-link/validate')
      .send({ token: invalidAlgToken });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it('rejects portal requests using a token signed with an unauthorized algorithm (HS512)', async () => {
    const invalidPortalToken = jwt.sign({ clientId: 'client-123', tenantId: 'tenant-456', scope: 'portal' }, JWT_SECRET, { algorithm: 'HS512' });
    const res = await request(app)
      .get('/api/portal/data')
      .set('x-portal-token', invalidPortalToken);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired portal link/i);
  });
});
