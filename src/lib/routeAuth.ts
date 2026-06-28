// Pure route-classification helpers for the server's /api auth middleware.
// Kept pure + exported so the auth-exclusion logic is the single source of truth
// AND unit-testable (tests/routeAuth.test.ts) — getting it wrong silently skips
// auth on every route, so it must never drift.
//
// Excluded = reachable WITHOUT a Firebase token even when REQUIRE_AUTH is on:
//   - magic-link generate/validate  (client-portal JWT, self-contained)
//   - stripe webhook                (verified by Stripe signature, not our token)
//   - health                        (liveness probe; leaks nothing)
// NOTE: /api/playground/* now REQUIRES auth (was an open AI-cost-abuse hole) and
// /api/security/threats is NO LONGER excluded (admin-only; checked in the handler).

export const AUTH_EXCLUDED_ROUTES: string[] = [
  "/api/auth/magic-link/generate",
  "/api/auth/magic-link/validate",
  "/api/stripe/webhook",
  "/api/health",
];

export function isExcludedApiPath(fullPath: string): boolean {
  if (AUTH_EXCLUDED_ROUTES.includes(fullPath)) return true;
  // Public namespace: customer-facing intake (online booking / instant-quote). No login by
  // design — protected instead by a strict rate limiter + the injection scanner + input caps.
  if (fullPath.startsWith("/api/public/")) return true;
  return false;
}

// True when the path is an /api/* route that must carry a verified token.
export function requiresAuth(fullPath: string): boolean {
  if (!fullPath.startsWith("/api/")) return false;
  return !isExcludedApiPath(fullPath);
}
