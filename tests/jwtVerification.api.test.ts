import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server';

describe('JWT verification algorithm restrictions', () => {
  let app: any;
  const JWT_SECRET = 'test-secret-12345678901234567890';

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.REQUIRE_AUTH = 'false';
    app = await createApp();
  });

  it('verifies JWT algorithm restrictions on auth routes', async () => {
    const validToken = jwt.sign({ clientId: 'c1', tenantId: 't1', email: 'u@example.com' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const invalidToken = jwt.sign({ clientId: 'c1', tenantId: 't1', email: 'u@example.com' }, JWT_SECRET, { algorithm: 'HS384', expiresIn: '1h' });
    const portalToken = jwt.sign({ clientId: 'c1', tenantId: 't1', scope: 'portal' }, JWT_SECRET, { algorithm: 'HS384', expiresIn: '1h' });

    const r1 = await request(app).post('/api/auth/magic-link/validate').send({ token: validToken });
    expect(r1.status).toBe(200);

    const r2 = await request(app).post('/api/auth/magic-link/validate').send({ token: invalidToken });
    expect(r2.status).toBe(401);

    const r3 = await request(app).get('/api/portal/data').set('x-portal-token', portalToken);
    expect(r3.status).toBe(401);
  });
});
