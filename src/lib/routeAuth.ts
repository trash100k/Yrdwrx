// Pure route-classification helpers for the server's /api auth middleware.
// Kept pure + exported so the auth-exclusion logic is the single source of truth
// AND unit-testable (tests/routeAuth.test.ts) — getting it wrong silently skips
// auth on every route, so it must never drift.
//
// Excluded = reachable WITHOUT a logged-in (Supabase) token even when REQUIRE_AUTH is on:
//   - magic-link VALIDATE           (verifies a signed token; minting it is now authed)
//   - /api/portal/*                 (client portal — self-verifies the magic-link capability
//                                     token in the handler; the visitor has no app session)
//   - stripe webhook                (verified by Stripe signature, not our token)
//   - health                        (liveness probe; leaks nothing)
// NOTE: /api/auth/magic-link/GENERATE now REQUIRES auth — only a signed-in owner may mint a
// portal link, and the handler verifies the client belongs to their tenant. /api/playground/*
// requires auth (was an open AI-cost-abuse hole); /api/security/threats is admin-only.

export const AUTH_EXCLUDED_ROUTES: string[] = [
  "/api/auth/magic-link/validate",
  "/api/stripe/webhook",
  "/api/health",
  "/api/quickbooks/callback", // Intuit OAuth redirect (carries its own code+state)
];

export function isExcludedApiPath(fullPath: string): boolean {
  if (AUTH_EXCLUDED_ROUTES.includes(fullPath)) return true;
  // Public namespace: customer-facing intake (online booking / instant-quote). No login by
  // design — protected instead by a strict rate limiter + the injection scanner + input caps.
  if (fullPath.startsWith("/api/public/")) return true;
  // Client portal: the handlers verify the signed magic-link capability token themselves and
  // scope every query to that token's client+tenant. The visitor has no Supabase session.
  if (fullPath.startsWith("/api/portal/")) return true;
  return false;
}

// True when the path is an /api/* route that must carry a verified token.
export function requiresAuth(fullPath: string): boolean {
  if (!fullPath.startsWith("/api/")) return false;
  return !isExcludedApiPath(fullPath);
}
