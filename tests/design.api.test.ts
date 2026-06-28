// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Mock mode: with no GEMINI_API_KEY, server.ts swaps generateContent for getMockText().
// The /api/design/process system instruction contains "Cutty Logic Core" + "landscape
// architect", so getMockText returns the well-shaped design object:
//   { identifiedAreas:[...], botanicalViolations:[...], visionSummary, estimatedMaterials:[...],
//     strategicValue, approvalRequired }
// The route returns that object (post catalog-pricing pass) as JSON 200.

const TINY_IMAGE =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

const SERVICE_CATALOG = [
  {
    name: 'Plants & Trees',
    services: [
      { name: 'Limelight Hydrangea (3-Gallon)', price: 49 },
      { name: 'Double-Shredded Hardwood Mulch', price: 60 },
    ],
  },
];

describe('POST /api/design/process (mock mode, auth off)', () => {
  let app: any;

  beforeAll(async () => {
    process.env.REQUIRE_AUTH = 'false';
    delete process.env.GEMINI_API_KEY; // force mock mode
    const { createApp } = await import('../server');
    app = await createApp();
  });

  it('returns 200 with the mock design shape', async () => {
    const res = await request(app)
      .post('/api/design/process')
      .send({
        image: TINY_IMAGE,
        prompt: 'Refresh the front foundation bed and revive the lawn.',
        settings: { serviceCatalog: SERVICE_CATALOG },
      });

    expect(res.status).toBe(200);
    const body = res.body;
    expect(body).toBeTypeOf('object');

    // Core shape from getMockText's "Cutty Logic Core" branch.
    expect(Array.isArray(body.identifiedAreas)).toBe(true);
    expect(body.identifiedAreas.length).toBeGreaterThan(0);
    expect(body.identifiedAreas[0]).toHaveProperty('description');
    expect(body.identifiedAreas[0]).toHaveProperty('suggestion');

    expect(Array.isArray(body.estimatedMaterials)).toBe(true);
    expect(body.estimatedMaterials.length).toBeGreaterThan(0);
    expect(body.estimatedMaterials[0]).toHaveProperty('item');

    expect(body).toHaveProperty('visionSummary');
    expect(body).toHaveProperty('strategicValue');
    expect(body).toHaveProperty('approvalRequired');
  });

  it('rejects a request missing the image with 400', async () => {
    const res = await request(app).post('/api/design/process').send({ prompt: 'no image' });
    expect(res.status).toBe(400);
    expect(res.body?.error || '').toMatch(/image/i);
  });
});
