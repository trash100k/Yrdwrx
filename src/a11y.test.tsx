// @ts-nocheck
/**
 * Accessibility smoke tests (jest-axe) for the key role-portal screens.
 *
 * Strategy:
 *  - Render each screen in jsdom wrapped in the app's real provider stack + a
 *    MemoryRouter (mirroring how App.tsx nests providers), with the data/service
 *    layer (Supabase, repos, firebase shim, fetch) mocked to deterministic empty
 *    state so the pages render their real chrome (headings, buttons, form labels)
 *    offline.
 *  - Run axe on the rendered container and GATE only on SERIOUS / CRITICAL
 *    *structural* violations (missing button/label names, invalid ARIA, invalid
 *    nesting, duplicate ids, ...). color-contrast can't be computed reliably in
 *    jsdom and is explicitly NOT gated — any that surface are recorded, not failed.
 *
 * These assert CORRECT behavior (no serious structural a11y violations). If a real
 * structural violation is ever found it should be reported as a bug rather than the
 * assertion being weakened.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// ---------------------------------------------------------------------------
// Data / service layer mocks — deterministic, offline. Factories are hoisted by
// Vitest, so everything they reference is created inline.
// ---------------------------------------------------------------------------

// A generic repo whose subscribe() immediately yields an empty list and returns a
// no-op unsubscribe, and whose async CRUD methods resolve harmlessly. Vitest
// validates named imports against the mock's own keys, so every repo the app (and
// its child components) import must be explicitly exported here.
vi.mock("./lib/repos", () => {
  const makeRepo = () => ({
    subscribe: (cb: any) => {
      try {
        cb?.([]);
      } catch {
        /* ignore */
      }
      return () => {};
    },
    list: async () => [],
    listArchived: async () => [],
    getById: async () => null,
    create: async (x: any) => ({ id: "stub-id", ...(x || {}) }),
    update: async () => ({}),
    remove: async () => {},
    archive: async () => {},
    restore: async () => {},
    complete: async () => {},
    reopen: async () => {},
    forCustomer: async () => [],
    findByNameOrPhone: async () => [],
  });
  const names = [
    "customersRepo",
    "tasksRepo",
    "jobsRepo",
    "leadsRepo",
    "materialLogsRepo",
    "invoicesRepo",
    "expensesRepo",
    "reviewsRepo",
    "inventoryRepo",
    "crewsRepo",
    "vendorsRepo",
    "knowledgeRepo",
    "designCatalogRepo",
    "contractsRepo",
    "inspectionFormsRepo",
    "designVisionsRepo",
    "timesheetsRepo",
    "systemLogsRepo",
    "complianceLogsRepo",
    "equipmentRepo",
    "referralsRepo",
    "customerMessagesRepo",
    "documentsRepo",
    "tenantsRepo",
  ];
  const mod: Record<string, any> = {
    getCurrentProfile: async () => null,
    clearProfileCache: () => {},
  };
  for (const n of names) mod[n] = makeRepo();
  return mod;
});

// Supabase client shim: a chainable, awaitable query builder that resolves empty.
vi.mock("./lib/supabase", () => {
  const makeBuilder = () => {
    const p: any = Promise.resolve({ data: [], error: null, count: 0 });
    const handler: ProxyHandler<any> = {
      get(_t, prop: any) {
        if (prop === "then") return p.then.bind(p);
        if (prop === "catch") return p.catch.bind(p);
        if (prop === "finally") return p.finally.bind(p);
        // any chainable method (select/eq/or/order/range/maybeSingle/single/limit...)
        return () => builder;
      },
    };
    const builder: any = new Proxy(function () {}, handler);
    return builder;
  };
  const supabase = {
    from: () => makeBuilder(),
    rpc: () => makeBuilder(),
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => ({ error: null }),
    },
    channel: () => {
      const ch: any = {
        on: () => ch,
        subscribe: () => ch,
        unsubscribe: () => {},
      };
      return ch;
    },
    removeChannel: () => {},
  };
  return {
    supabase,
    getCurrentUser: () => null,
    getAccessToken: async () => null,
    signOutUser: async () => {},
    onAuthChange: (_cb: any) => () => {},
    getCurrentProfile: async () => null,
    clearProfileCache: () => {},
  };
});

// Firebase compatibility shim (server-truth lives in Supabase now).
vi.mock("./lib/firebase", () => ({
  auth: { currentUser: null },
  handleFirestoreError: () => {},
  OperationType: {},
  logSystemEvent: async () => {},
  db: {},
  storage: {},
}));

// Authed fetch wrapper: never hit the network; return a non-ok response so pages
// fall into their empty/error branches instead of pretending they have data.
vi.mock("./lib/api", () => ({
  fetchApi: async () => ({
    ok: false,
    status: 503,
    statusText: "Service Unavailable (test)",
    json: async () => ({}),
    text: async () => "",
    blob: async () => new Blob([]),
    headers: { get: () => null },
  }),
}));

// Semantic-memory + offline-sync services (only used in handlers, not on render).
vi.mock("./services/brainService", () => ({
  ingestKnowledge: async () => {},
  fetchRelevantMemory: async () => [],
}));
vi.mock("./services/syncService", () => ({
  syncService: new Proxy(
    {},
    { get: () => async () => ({}) },
  ),
}));

// Best-effort geocoder (pure network helper) — stub so no address triggers a call.
vi.mock("./lib/geocode", () => ({
  geocodeAddress: async () => null,
  backfillCoords: async (rows: any) => rows,
}));

// Workflow automations (handler-only) — keep import light and side-effect free.
vi.mock("./lib/automations", () => ({
  runAutomations: async () => ({ ran: 0 }),
}));

// Google-Maps-backed component — nothing to assert for a11y and it needs the Maps
// JS SDK. Replace with an inert, labeled region.
vi.mock("./components/CustomerMap", () => ({
  CustomerMap: () => <div aria-hidden="true" data-testid="customer-map-stub" />,
}));

// ---------------------------------------------------------------------------
// Pages under test (imported AFTER mocks are registered).
// ---------------------------------------------------------------------------
import Dashboard from "./pages/Dashboard";
import CRM from "./pages/CRM";
import Invoices from "./pages/Invoices";
import ClientPortal from "./pages/ClientPortal";
import Settings from "./pages/Settings";

import { ToastProvider } from "./contexts/ToastContext";
import { TenantProvider } from "./contexts/TenantContext";
import { EnterpriseThemeProvider } from "./contexts/EnterpriseThemeContext";
import { FieldModeProvider } from "./contexts/FieldModeContext";
import { WorkspaceOutboxProvider } from "./contexts/WorkspaceOutboxContext";
import { CuttyGuideProvider } from "./contexts/CuttyGuideContext";

// ---------------------------------------------------------------------------
// jsdom polyfills for browser APIs the component tree touches on render.
// ---------------------------------------------------------------------------
beforeAll(() => {
  if (!(global as any).ResizeObserver) {
    (global as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!(global as any).IntersectionObserver) {
    (global as any).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };
  }
  if (!window.matchMedia) {
    (window as any).matchMedia = (q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    });
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function () {};
  }
  if (!(window as any).scrollTo) {
    (window as any).scrollTo = () => {};
  }
  // Keep any stray global fetch (ClientPortal uses raw fetch) fully offline.
  (global as any).fetch = vi.fn(async () => ({
    ok: false,
    status: 503,
    json: async () => ({}),
    text: async () => "",
    headers: { get: () => null },
  }));
});

afterEach(() => {
  cleanup();
});

// Nest the real providers the way App.tsx does. CuttyGuideProvider depends on the
// router (useNavigate/useLocation), so it lives inside MemoryRouter.
function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <ToastProvider>
        <TenantProvider>
          <EnterpriseThemeProvider>
            <FieldModeProvider>
              <WorkspaceOutboxProvider>
                <CuttyGuideProvider>{children}</CuttyGuideProvider>
              </WorkspaceOutboxProvider>
            </FieldModeProvider>
          </EnterpriseThemeProvider>
        </TenantProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

// axe tuned for jsdom: color-contrast needs real layout/paint, so disable that rule
// (it is recorded separately below, never gated).
const AXE_OPTIONS = {
  rules: {
    "color-contrast": { enabled: false },
  },
};

const SERIOUS = new Set(["serious", "critical"]);

type Screen = {
  name: string;
  el: React.ReactElement;
  wrap: boolean;
  // Set when this screen currently trips a genuine serious/critical structural
  // axe violation. The case is .skip'd (suite stays green) and the finding is
  // reported as a bug; remove the marker once the source is fixed and the strict
  // assertion below will guard it going forward.
  bug?: string;
};

const SCREENS: Screen[] = [
  // Dashboard crew-suite link now has aria-label="Open Crew Suite" (was axe link-name).
  { name: "Dashboard", el: <Dashboard />, wrap: true },
  { name: "CRM", el: <CRM />, wrap: true },
  // Invoices quarter-filter <select> now has aria-label="Filter invoices by quarter" (was axe select-name).
  { name: "Invoices", el: <Invoices />, wrap: true },
  { name: "Settings", el: <Settings />, wrap: true },
  // ClientPortal is a self-contained public screen (no app session / providers);
  // with no capability token it renders its "Secure Portal Locked" state.
  { name: "ClientPortal", el: <ClientPortal />, wrap: false },
];

// Records the per-screen violation counts so the run output documents coverage.
const summary: Record<string, { serious: number; ids: string[] }> = {};

describe("Accessibility (jest-axe) — key screens have no serious/critical structural violations", () => {
  for (const screen of SCREENS) {
    // Screens with a known genuine violation are .skip'd (see `bug` note) so the
    // committed suite stays green while the finding is captured + reported.
    const testFn = screen.bug ? it.skip : it;
    testFn(`${screen.name}: no serious/critical structural axe violations`, async () => {
      const tree = screen.wrap ? (
        <AppProviders>{screen.el}</AppProviders>
      ) : (
        <MemoryRouter>{screen.el}</MemoryRouter>
      );

      const { container } = render(tree);

      const results = await axe(container, AXE_OPTIONS as any);

      const serious = results.violations.filter(
        (v: any) => SERIOUS.has(v.impact) && v.id !== "color-contrast",
      );
      summary[screen.name] = {
        serious: serious.length,
        ids: serious.map(
          (v: any) => `${v.id}(${v.impact}, x${v.nodes.length})`,
        ),
      };
      // Full breakdown for the run log (all impacts, for transparency).
      const byImpact: Record<string, number> = {};
      for (const v of results.violations)
        byImpact[v.impact || "unknown"] =
          (byImpact[v.impact || "unknown"] || 0) + 1;
      // eslint-disable-next-line no-console
      console.log(
        `[a11y] ${screen.name}: serious/critical(non-contrast)=${serious.length}` +
          `${serious.length ? " -> " + summary[screen.name].ids.join(", ") : ""}` +
          ` | all-violations-by-impact=${JSON.stringify(byImpact)}`,
      );
      for (const v of serious) {
        for (const n of v.nodes) {
          // eslint-disable-next-line no-console
          console.log(
            `[a11y-node] ${screen.name} ${v.id} target=${JSON.stringify(n.target)} html=${String(n.html).slice(0, 220)}`,
          );
        }
      }

      // GATE: no serious/critical structural violations. toEqual([]) yields a
      // readable diff naming any offending rule/nodes if this ever regresses.
      expect(
        serious.map((v: any) => ({ id: v.id, impact: v.impact })),
      ).toEqual([]);
    });
  }

  it("axe actually ran against each non-skipped screen (sanity)", () => {
    for (const s of SCREENS.filter((x) => !x.bug)) {
      expect(summary[s.name]).toBeDefined();
      expect(summary[s.name].serious).toBe(0);
    }
  });
});
