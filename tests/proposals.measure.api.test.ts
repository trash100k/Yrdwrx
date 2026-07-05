// @ts-nocheck
//
// HTTP-integration tests (supertest, mock mode — no live Stripe/Supabase/Gemini/Maps keys) for
// the PROPOSALS + PORTAL-PROPOSAL + MEASUREMENT/GEOCODE surface:
//
//   OWNER (authed /api routes — verifyFirebaseToken runs):
//     POST /api/proposals/send          persist + tenant-scope + mint a portal share token
//     GET  /api/proposals/engagement    tenant-scoped open/view readout
//
//   PORTAL (auth-EXCLUDED /api/portal/* — self-verifies a signed portal capability token):
//     POST /api/portal/proposal/view        token-scoped read + view logging
//     POST /api/portal/proposal/select-tier token-scoped tier pick → reflects onto the estimate
//
//   MEASUREMENT / GEO (mock-safe, honest-provenance):
//     POST /api/measure/property   no provider/AI key → honest source:"manual", areas null
//                                  (NEVER a fabricated measurement); bad input → 400
//     POST /api/geocode            no Maps key → deterministic stub (configured:false); bad → 400
//
// Supabase is driven offline exactly like tests/portal.money.api.test.ts + stripe.webhook: the
// server reaches Supabase only through `require("@supabase/supabase-js").createClient`, which
// vi.mock cannot intercept, so we monkeypatch createClient on the shared CJS module (via
// createRequire) to return a small in-memory fake keyed by row id. Everything stays in MOCK
// mode: no STRIPE/GEMINI/MAPS/REGRID keys → the endpoints return their honest simulated /
// stub / manual shapes instead of hitting a real provider.
//
// Two app instances are built from the ONE imported module:
//   • appDemo — REQUIRE_AUTH=false: exercises business logic (send/view/select-tier/measure/geocode).
//   • appAuth — REQUIRE_AUTH=true : exercises the auth gate (no bearer header → 401) on the
//     non-portal routes. REQUIRE_AUTH is captured at createApp() time, so we set it per build.
//
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'module';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const require2 = createRequire(import.meta.url);
const JWT_SECRET = 'proposals-measure-test-secret-abc';

// ---------------------------------------------------------------------------
// In-memory Supabase test double. Reads resolve by the `id` filter from a
// per-table map; writes are captured on `state.writes`. A customer_design_visions
// insert that requests `.select("id")` returns a generated id (the new proposal id).
// ---------------------------------------------------------------------------
const state: any = { invoices: {}, customers: {}, dvs: {}, writes: [], nextDvId: 'dv-created-1' };
function resetState() {
  state.invoices = {};
  state.customers = {};
  state.dvs = {};
  state.writes = [];
  state.nextDvId = 'dv-created-1';
}

function makeBuilder(table: string) {
  const ctx: any = { table, op: null, payload: null, filters: {}, selected: false };
  const builder: any = {
    insert(p: any) { ctx.op = 'insert'; ctx.payload = p; return builder; },
    update(p: any) { ctx.op = 'update'; ctx.payload = p; return builder; },
    upsert(p: any) { ctx.op = 'upsert'; ctx.payload = p; return builder; },
    delete() { ctx.op = 'delete'; return builder; },
    select(_c?: string) { if (!ctx.op) ctx.op = 'select'; ctx.selected = true; return builder; },
    eq(c: string, v: any) { ctx.filters[c] = v; return builder; },
    neq() { return builder; },
    in() { return builder; },
    ilike() { return builder; },
    filter() { return builder; },
    match() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    maybeSingle() { return exec(ctx); },
    single() { return exec(ctx); },
    // Thenable so bare `await sb.from(t).update(...).eq(...)` / `.insert(...)` resolve.
    then(res: any, rej: any) { return exec(ctx).then(res, rej); },
  };
  return builder;
}

async function exec(ctx: any) {
  const { table, op, filters } = ctx;
  if (op === 'insert' || op === 'update' || op === 'upsert' || op === 'delete') {
    state.writes.push({ table, op, payload: ctx.payload, filters });
    if (op === 'insert' && table === 'customer_design_visions' && ctx.selected) {
      return { data: { id: state.nextDvId }, error: null };
    }
    return { data: null, error: null };
  }
  // Reads — keyed by the `id` filter.
  const id = filters.id;
  if (table === 'invoices') return { data: state.invoices[id] ? { ...state.invoices[id] } : null, error: null };
  if (table === 'customers') return { data: state.customers[id] ? { ...state.customers[id] } : null, error: null };
  if (table === 'customer_design_visions') return { data: state.dvs[id] ? { ...state.dvs[id] } : null, error: null };
  // tenants / profiles / customer_messages / any unmodeled table resolve benignly.
  return { data: null, error: null };
}

const fakeSupabase = { from: (t: string) => makeBuilder(t) };

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------
const CLIENT = 'cust-A';
const OTHER_CLIENT = 'cust-B';
const TENANT = 'tenant-1';

const portalToken = (opts: any = {}) =>
  jwt.sign(
    {
      scope: 'portal',
      clientId: 'clientId' in opts ? opts.clientId : CLIENT,
      tenantId: opts.tenantId,
      proposalId: opts.proposalId,
      kind: opts.kind,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

const dvWrites = () => state.writes.filter((w: any) => w.table === 'customer_design_visions');
const dvUpdate = () => state.writes.find((w: any) => w.table === 'customer_design_visions' && w.op === 'update');
const dvInsert = () => state.writes.find((w: any) => w.table === 'customer_design_visions' && w.op === 'insert');
const invUpdate = () => state.writes.find((w: any) => w.table === 'invoices' && w.op === 'update');

// A fully-formed proposal design-vision row (linked to inv-1) used by the portal tests.
function seedProposal(overrides: any = {}) {
  state.dvs['dv-1'] = {
    id: 'dv-1',
    customer_id: CLIENT,
    tenant_id: TENANT,
    summary: 'Front foundation bed refresh',
    before_url: 'https://img/before.jpg',
    after_url: 'https://img/after.jpg',
    proposal: {
      title: 'Your Proposal',
      summary: 'Refresh the front beds and revive the lawn.',
      tiers: [
        { id: 'good', name: 'Essential', price: 100 },
        { id: 'better', name: 'Recommended', price: 200 },
        { id: 'best', name: 'Premium', price: 300 },
      ],
      recommendedTier: 'better',
      estimateInvoiceId: 'inv-1',
      status: 'sent',
      sentAt: '2026-06-01T00:00:00.000Z',
      viewCount: 0,
      views: [],
      ...(overrides.proposal || {}),
    },
    ...overrides.dv,
  };
  state.invoices['inv-1'] = {
    id: 'inv-1',
    customer_id: CLIENT,
    tenant_id: TENANT,
    amount: 200,
    status: 'sent',
    data: {},
    ...(overrides.invoice || {}),
  };
}

describe('proposals + portal-proposal + measure/geocode (mock mode)', () => {
  let appDemo: any; // REQUIRE_AUTH=false
  let appAuth: any; // REQUIRE_AUTH=true

  beforeAll(async () => {
    // Set BEFORE server import; dotenv won't clobber existing vars.
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://fake.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_fake';
    // Force every honest-mock branch: no external providers configured.
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.GEMINI_API_KEY;       // AI mock mode (measure → manual, not ai_estimate)
    delete process.env.GOOGLE_MAPS_PLATFORM_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;  // geocode → deterministic stub
    delete process.env.REGRID_API_KEY;
    delete process.env.MEASUREMENT_API_KEY;  // no measurement provider adapter

    // Swap the real Supabase factory on the shared CJS module BEFORE server.ts requires it.
    const supa = require2('@supabase/supabase-js');
    supa.createClient = () => fakeSupabase;

    const { createApp } = await import('../server');

    process.env.REQUIRE_AUTH = 'false';
    appDemo = await createApp();
    process.env.REQUIRE_AUTH = 'true';
    appAuth = await createApp();
    process.env.REQUIRE_AUTH = 'false'; // leave demo as the ambient default
  });

  beforeEach(() => {
    resetState();
  });

  // =====================================================================
  // AUTH GATE — the non-portal routes must reject an unauthenticated caller
  // when REQUIRE_AUTH is on (401 from the middleware, before any handler work).
  // =====================================================================
  describe('auth gate (REQUIRE_AUTH=true, no bearer header)', () => {
    it('401s POST /api/proposals/send', async () => {
      const res = await request(appAuth).post('/api/proposals/send').send({ customerId: CLIENT });
      expect(res.status).toBe(401);
      expect(res.body?.error || '').toMatch(/unauthorized/i);
    });

    it('401s GET /api/proposals/engagement', async () => {
      const res = await request(appAuth).get('/api/proposals/engagement');
      expect(res.status).toBe(401);
    });

    it('401s POST /api/measure/property', async () => {
      const res = await request(appAuth).post('/api/measure/property').send({ address: '1 Main St' });
      expect(res.status).toBe(401);
    });

    it('401s POST /api/geocode', async () => {
      const res = await request(appAuth).post('/api/geocode').send({ address: '1 Main St' });
      expect(res.status).toBe(401);
    });
  });

  // =====================================================================
  // POST /api/proposals/send — persist + tenant-scope + mint a share token.
  // =====================================================================
  describe('POST /api/proposals/send (demo)', () => {
    it('400s when the proposal is linked to no customer (and no estimate to derive one)', async () => {
      const res = await request(appDemo).post('/api/proposals/send').send({ estimateAmount: 500 });
      expect(res.status).toBe(400);
      expect(res.body?.error || '').toMatch(/customer/i);
      // Nothing persisted on a rejected request.
      expect(dvWrites().length).toBe(0);
    });

    it('404s when a linked estimate invoice does not exist (not a 500)', async () => {
      const res = await request(appDemo).post('/api/proposals/send').send({ invoiceId: 'ghost-invoice' });
      expect(res.status).toBe(404);
      expect(res.body?.error || '').toMatch(/estimate not found/i);
    });

    it('404s when the named customer does not exist', async () => {
      const res = await request(appDemo).post('/api/proposals/send').send({ customerId: 'ghost-customer' });
      expect(res.status).toBe(404);
      expect(res.body?.error || '').toMatch(/customer not found/i);
    });

    it('403s (tenant gate) when the derived customer is in a DIFFERENT workspace than the estimate', async () => {
      // The estimate pins tenant-1; its customer belongs to tenant-2 → cross-workspace → 403.
      state.invoices['inv-x'] = { id: 'inv-x', customer_id: 'cust-cross', amount: 500, tenant_id: 'tenant-1', status: 'sent', data: {} };
      state.customers['cust-cross'] = { id: 'cust-cross', tenant_id: 'tenant-2' };
      const res = await request(appDemo).post('/api/proposals/send').send({ invoiceId: 'inv-x' });
      expect(res.status).toBe(403);
      expect(res.body?.error || '').toMatch(/workspace/i);
      // A rejected cross-workspace send must never persist a proposal.
      expect(dvWrites().length).toBe(0);
    });

    it('sends a proposal for a valid customer: 200 + persists a "sent" proposal + mints a scoped token', async () => {
      state.customers[CLIENT] = { id: CLIENT, tenant_id: TENANT, first_name: 'Jane', last_name: 'Homeowner' };
      const res = await request(appDemo)
        .post('/api/proposals/send')
        .send({ customerId: CLIENT, estimateAmount: 1000, summary: 'Backyard makeover' });

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(res.body?.proposalId).toBe('dv-created-1');
      expect(res.body?.jwtMissing).toBe(false);
      expect(Array.isArray(res.body?.tiers)).toBe(true);
      expect(res.body.tiers.length).toBe(3); // good/better/best derived from the estimate

      // The minted share token is a portal capability pinned to THIS customer + proposal.
      expect(typeof res.body?.token).toBe('string');
      const decoded: any = jwt.verify(res.body.token, JWT_SECRET);
      expect(decoded.scope).toBe('portal');
      expect(decoded.clientId).toBe(CLIENT);
      expect(decoded.proposalId).toBe('dv-created-1');
      expect(decoded.kind).toBe('proposal');
      expect(typeof res.body?.shareUrl).toBe('string');
      expect(res.body.shareUrl).toContain(res.body.token);

      // The persisted design-vision row carries a "sent" proposal blob with tiers + sentAt.
      const ins = dvInsert();
      expect(ins).toBeTruthy();
      expect(ins.payload?.customer_id).toBe(CLIENT);
      expect(ins.payload?.proposal?.status).toBe('sent');
      expect(typeof ins.payload?.proposal?.sentAt).toBe('string');
      expect(Number.isNaN(Date.parse(ins.payload.proposal.sentAt))).toBe(false);
      expect(Array.isArray(ins.payload?.proposal?.tiers)).toBe(true);
    });

    it('derives customer + base amount from a linked estimate, and records estimateInvoiceId', async () => {
      state.invoices['inv-2'] = { id: 'inv-2', customer_id: CLIENT, amount: 500, tenant_id: TENANT, status: 'sent', data: {} };
      state.customers[CLIENT] = { id: CLIENT, tenant_id: TENANT };
      const res = await request(appDemo).post('/api/proposals/send').send({ invoiceId: 'inv-2' });
      expect(res.status).toBe(200);
      const ins = dvInsert();
      expect(ins?.payload?.proposal?.estimateInvoiceId).toBe('inv-2');
      // Middle (recommended) tier derives from the $500 estimate.
      const better = ins.payload.proposal.tiers.find((t: any) => t.id === 'better');
      expect(better?.price).toBe(500);
    });

    it('honors explicit owner-supplied tiers (sanitized, not overwritten by the deriver)', async () => {
      state.customers[CLIENT] = { id: CLIENT, tenant_id: TENANT };
      const res = await request(appDemo).post('/api/proposals/send').send({
        customerId: CLIENT,
        tiers: [
          { id: 'good', name: 'Starter', price: 250, bullets: ['mow', 'edge'] },
          { id: 'best', name: 'Deluxe', price: 900 },
        ],
      });
      expect(res.status).toBe(200);
      expect(res.body.tiers.length).toBe(2);
      const names = res.body.tiers.map((t: any) => t.name);
      expect(names).toContain('Starter');
      expect(names).toContain('Deluxe');
    });

    it('NEVER 500s on hostile / malformed bodies (client-error, 404, or success — never a crash)', async () => {
      state.customers[CLIENT] = { id: CLIENT, tenant_id: TENANT };
      const cases = [
        {},                                              // no customer / no estimate → 400
        { customerId: 123 },                             // numeric id coerced → 404 (no such row)
        { customerId: CLIENT, estimateAmount: 'abc' },   // non-numeric amount → NaN→0, still 200
        { customerId: CLIENT, tiers: 'not-an-array' },   // bad tiers → derived, 200
        { customerId: CLIENT, tiers: [null, 1, {}] },    // junk tier entries → sanitized, 200
        { invoiceId: ['a'] },                            // array id (truthy) → lookup miss → 404
        { customerId: { a: 1 } },                        // object id coerced → 404
      ];
      for (const body of cases) {
        resetState();
        state.customers[CLIENT] = { id: CLIENT, tenant_id: TENANT };
        const res = await request(appDemo).post('/api/proposals/send').send(body as any);
        expect(res.status).not.toBe(500);
        expect([200, 400, 403, 404]).toContain(res.status);
      }
    });
  });

  // =====================================================================
  // GET /api/proposals/engagement — tenant-scoped readout.
  // =====================================================================
  describe('GET /api/proposals/engagement (demo)', () => {
    it('returns an empty, well-formed readout when there is no resolvable tenant (never 500)', async () => {
      const res = await request(appDemo).get('/api/proposals/engagement');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.proposals)).toBe(true);
      expect(res.body.proposals.length).toBe(0);
      expect(res.body?.byInvoice).toEqual({});
    });
  });

  // =====================================================================
  // POST /api/portal/proposal/view — token-scoped read + view logging.
  // =====================================================================
  describe('POST /api/portal/proposal/view (portal token)', () => {
    it('401s with NO portal token', async () => {
      const res = await request(appDemo).post('/api/portal/proposal/view').send({ proposalId: 'dv-1' });
      expect(res.status).toBe(401);
      expect(res.body?.error || '').toMatch(/portal link/i);
    });

    it('401s on a token signed with the WRONG secret', async () => {
      const forged = jwt.sign({ scope: 'portal', clientId: CLIENT, proposalId: 'dv-1' }, 'attacker-secret', { expiresIn: '1h' });
      const res = await request(appDemo).post('/api/portal/proposal/view').set('x-portal-token', forged).send({});
      expect(res.status).toBe(401);
    });

    it('returns { proposal: null } for a plain portal token that pins no proposal', async () => {
      const res = await request(appDemo)
        .post('/api/portal/proposal/view')
        .set('x-portal-token', portalToken({ clientId: CLIENT }))
        .send({});
      expect(res.status).toBe(200);
      expect(res.body?.proposal).toBeNull();
    });

    it('loads the pinned proposal AND logs the open (viewCount 0→1, first/last stamped)', async () => {
      seedProposal();
      const res = await request(appDemo)
        .post('/api/portal/proposal/view')
        .set('x-portal-token', portalToken({ clientId: CLIENT, tenantId: TENANT, proposalId: 'dv-1', kind: 'proposal' }))
        .send({});
      expect(res.status).toBe(200);
      const p = res.body?.proposal;
      expect(p?.id).toBe('dv-1');
      expect(p?.viewCount).toBe(1);
      expect(p?.signed).toBe(false);
      expect(Array.isArray(p?.tiers)).toBe(true);
      expect(p.tiers.length).toBe(3);
      // The linked estimate is surfaced (amount from inv-1).
      expect(p?.estimateInvoiceId).toBe('inv-1');
      expect(p?.estimate?.amount).toBe(200);

      // View logging was PERSISTED: the row update carries an incremented, first-stamped view.
      const upd = dvUpdate();
      expect(upd).toBeTruthy();
      expect(upd.payload?.proposal?.viewCount).toBe(1);
      expect(typeof upd.payload?.proposal?.firstViewedAt).toBe('string');
      // A single view is below the follow-up threshold → no owner nudge stamped yet.
      expect(upd.payload?.proposal?.followUpSentAt == null).toBe(true);
    });

    it('stamps the owner follow-up once the open threshold (2) is crossed', async () => {
      // Already opened once (old timestamp so this open is not deduped) → this is the 2nd open.
      seedProposal({ proposal: { viewCount: 1, firstViewedAt: '2026-06-01T00:00:00.000Z', lastViewedAt: '2026-06-01T00:00:00.000Z' } });
      const res = await request(appDemo)
        .post('/api/portal/proposal/view')
        .set('x-portal-token', portalToken({ clientId: CLIENT, tenantId: TENANT, proposalId: 'dv-1', kind: 'proposal' }))
        .send({});
      expect(res.status).toBe(200);
      expect(res.body?.proposal?.viewCount).toBe(2);
      const upd = dvUpdate();
      expect(upd.payload?.proposal?.viewCount).toBe(2);
      expect(typeof upd.payload?.proposal?.followUpSentAt).toBe('string'); // nudge fired + stamped
    });

    it('reports signed:true (and does NOT nudge) when the linked estimate is already accepted', async () => {
      seedProposal({ invoice: { status: 'accepted' } });
      const res = await request(appDemo)
        .post('/api/portal/proposal/view')
        .set('x-portal-token', portalToken({ clientId: CLIENT, tenantId: TENANT, proposalId: 'dv-1', kind: 'proposal' }))
        .send({});
      expect(res.status).toBe(200);
      expect(res.body?.proposal?.signed).toBe(true);
      expect(res.body?.proposal?.status).toBe('signed');
      // Signed proposals are never nudged, even though the view still counts.
      expect(dvUpdate()?.payload?.proposal?.followUpSentAt == null).toBe(true);
    });

    it('404s when the pinned proposal belongs to a DIFFERENT client (token clientId ≠ row owner)', async () => {
      seedProposal();
      const res = await request(appDemo)
        .post('/api/portal/proposal/view')
        .set('x-portal-token', portalToken({ clientId: OTHER_CLIENT, tenantId: TENANT, proposalId: 'dv-1', kind: 'proposal' }))
        .send({});
      expect(res.status).toBe(404);
      // No view logged for a mismatched client.
      expect(dvUpdate()).toBeFalsy();
    });

    it('403s on a tenant-scope mismatch (right client, wrong tenant on the token)', async () => {
      seedProposal();
      const res = await request(appDemo)
        .post('/api/portal/proposal/view')
        .set('x-portal-token', portalToken({ clientId: CLIENT, tenantId: 'tenant-ZZZ', proposalId: 'dv-1', kind: 'proposal' }))
        .send({});
      expect(res.status).toBe(403);
      expect(res.body?.error || '').toMatch(/scope/i);
    });
  });

  // =====================================================================
  // POST /api/portal/proposal/select-tier — token-scoped tier pick.
  // =====================================================================
  describe('POST /api/portal/proposal/select-tier (portal token)', () => {
    it('401s with NO portal token', async () => {
      const res = await request(appDemo).post('/api/portal/proposal/select-tier').send({ proposalId: 'dv-1', tierId: 'better' });
      expect(res.status).toBe(401);
    });

    it('400s when tierId is missing', async () => {
      seedProposal();
      const res = await request(appDemo)
        .post('/api/portal/proposal/select-tier')
        .set('x-portal-token', portalToken({ clientId: CLIENT, tenantId: TENANT, proposalId: 'dv-1', kind: 'proposal' }))
        .send({});
      expect(res.status).toBe(400);
      expect(res.body?.error || '').toMatch(/tierId/i);
    });

    it('404s when the chosen tierId is not one of the proposal tiers', async () => {
      seedProposal();
      const res = await request(appDemo)
        .post('/api/portal/proposal/select-tier')
        .set('x-portal-token', portalToken({ clientId: CLIENT, tenantId: TENANT, proposalId: 'dv-1', kind: 'proposal' }))
        .send({ tierId: 'platinum' });
      expect(res.status).toBe(404);
      expect(res.body?.error || '').toMatch(/tier not found/i);
    });

    it('picks a tier: 200 + reflects the tier price onto the linked estimate + records the selection', async () => {
      seedProposal();
      const res = await request(appDemo)
        .post('/api/portal/proposal/select-tier')
        .set('x-portal-token', portalToken({ clientId: CLIENT, tenantId: TENANT, proposalId: 'dv-1', kind: 'proposal' }))
        .send({ tierId: 'best' });
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(res.body?.amount).toBe(300); // 'best' tier price
      expect(res.body?.tier?.id).toBe('best');

      // The linked estimate's amount is rewritten to the chosen tier's price...
      const iu = invUpdate();
      expect(iu).toBeTruthy();
      expect(iu.payload?.amount).toBe(300);
      expect(iu.payload?.data?.proposalTier?.id).toBe('best');
      // ...and the selection is recorded on the proposal.
      expect(dvUpdate()?.payload?.proposal?.selectedTier).toBe('best');
    });

    it('404s when a different client presents a token for this proposal', async () => {
      seedProposal();
      const res = await request(appDemo)
        .post('/api/portal/proposal/select-tier')
        .set('x-portal-token', portalToken({ clientId: OTHER_CLIENT, tenantId: TENANT, proposalId: 'dv-1', kind: 'proposal' }))
        .send({ tierId: 'better' });
      expect(res.status).toBe(404);
      // Cross-client selection must never touch the estimate.
      expect(invUpdate()).toBeFalsy();
    });

    it('409s when the linked estimate is already settled (accepted) — cannot re-pick a tier', async () => {
      seedProposal({ invoice: { status: 'accepted' } });
      const res = await request(appDemo)
        .post('/api/portal/proposal/select-tier')
        .set('x-portal-token', portalToken({ clientId: CLIENT, tenantId: TENANT, proposalId: 'dv-1', kind: 'proposal' }))
        .send({ tierId: 'good' });
      expect(res.status).toBe(409);
      expect(invUpdate()).toBeFalsy();
    });

    it('400s when the proposal has a valid tier but no linked estimate to accept', async () => {
      state.dvs['dv-noest'] = {
        id: 'dv-noest', customer_id: CLIENT, tenant_id: TENANT,
        proposal: { tiers: [{ id: 'good', name: 'Essential', price: 100 }], estimateInvoiceId: null },
      };
      const res = await request(appDemo)
        .post('/api/portal/proposal/select-tier')
        .set('x-portal-token', portalToken({ clientId: CLIENT, tenantId: TENANT, proposalId: 'dv-noest', kind: 'proposal' }))
        .send({ tierId: 'good' });
      expect(res.status).toBe(400);
      expect(res.body?.error || '').toMatch(/no estimate/i);
    });
  });

  // =====================================================================
  // POST /api/measure/property — honest provenance (no key → manual, no fake precision).
  // =====================================================================
  describe('POST /api/measure/property (demo, no provider/AI key)', () => {
    it('400s when address is missing', async () => {
      const res = await request(appDemo).post('/api/measure/property').send({});
      expect(res.status).toBe(400);
      expect(res.body?.error || '').toMatch(/address/i);
    });

    it('400s on empty / whitespace / non-string address (bad input, never a fabricated result)', async () => {
      for (const bad of [{ address: '' }, { address: '   ' }, { address: 123 }, { address: null }, { address: { a: 1 } }, { address: ['x'] }]) {
        const res = await request(appDemo).post('/api/measure/property').send(bad as any);
        expect(res.status).toBe(400);
      }
    });

    it('returns an HONEST manual result (source:"manual", all areas null, configured:false) — no fabricated precision', async () => {
      const res = await request(appDemo)
        .post('/api/measure/property')
        .send({ address: '742 Evergreen Terrace, Springfield IL' });
      expect(res.status).toBe(200);
      const b = res.body;
      expect(b?.source).toBe('manual');
      expect(b?.configured).toBe(false);
      // Critically: NO invented measurement — every area is explicitly null.
      expect(b?.lawnSqft).toBeNull();
      expect(b?.bedSqft).toBeNull();
      expect(b?.hardscapeSqft).toBeNull();
      expect(b?.lotSqft).toBeNull();
      expect(b?.provider).toBeNull();
      expect(b?.confidence).toBe('low');
      // The honesty note tells the operator to enter areas / configure a provider.
      expect(typeof b?.note).toBe('string');
      expect(b.note).toMatch(/manual|provider/i);
    });

    it('NEVER 500s across a spread of hostile bodies (400 for bad input, 200 manual otherwise)', async () => {
      const cases: any[] = [
        {},
        { address: '' },
        { address: 42 },
        { address: {} },
        { address: '   ' },
        { address: '900 Fabricated Ave, Nowhere' },
      ];
      for (const body of cases) {
        const res = await request(appDemo).post('/api/measure/property').send(body);
        expect(res.status).not.toBe(500);
        expect([200, 400]).toContain(res.status);
      }
    });
  });

  // =====================================================================
  // POST /api/geocode — mock-safe deterministic stub (no Maps key).
  // =====================================================================
  describe('POST /api/geocode (demo, no Maps key)', () => {
    it('400s on missing / empty / whitespace address', async () => {
      for (const bad of [{}, { address: '' }, { address: '   ' }, { address: null }]) {
        const res = await request(appDemo).post('/api/geocode').send(bad as any);
        expect(res.status).toBe(400);
        expect(res.body?.error || '').toMatch(/address/i);
      }
    });

    it('returns a labeled stub (configured:false, stub:true) with finite coords — not fake precision', async () => {
      const res = await request(appDemo).post('/api/geocode').send({ address: '350 Fifth Ave, New York NY' });
      expect(res.status).toBe(200);
      expect(res.body?.configured).toBe(false);
      expect(res.body?.stub).toBe(true);
      expect(res.body?.formatted).toBeNull();
      expect(Number.isFinite(res.body?.lat)).toBe(true);
      expect(Number.isFinite(res.body?.lng)).toBe(true);
    });

    it('is deterministic: the same address yields identical stub coords', async () => {
      const addr = { address: '1600 Amphitheatre Pkwy, Mountain View CA' };
      const a = await request(appDemo).post('/api/geocode').send(addr);
      const b = await request(appDemo).post('/api/geocode').send(addr);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(a.body.lat).toBe(b.body.lat);
      expect(a.body.lng).toBe(b.body.lng);
    });

    it('coerces a non-string address rather than 500ing (documents the actual contract)', async () => {
      const res = await request(appDemo).post('/api/geocode').send({ address: 90210 });
      expect(res.status).not.toBe(500);
      expect([200, 400]).toContain(res.status);
    });
  });
});
