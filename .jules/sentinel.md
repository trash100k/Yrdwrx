## 2025-05-14 - Critical Authentication Bypass in Express Middleware
**Vulnerability:** A total authentication bypass was discovered in the `verifyFirebaseToken` middleware. The middleware was mounted using `app.use("/api/", verifyFirebaseToken)`, and it attempted to validate routes using `req.path`.
**Learning:** In Express, when middleware is mounted on a subpath, `req.path` only contains the portion of the URL *after* the mount point. For example, a request to `/api/test` results in `req.path` being `/test`. The middleware had a check `if (!req.path.startsWith('/api/')) { return next(); }`, which always evaluated to true for API routes, effectively bypassing all authentication.
**Prevention:** Always use `req.baseUrl + req.path` or `req.originalUrl` when performing route-based logic in mounted middleware to ensure the full path is used for matching.

## 2026-05-24 - SSRF Mitigation via Redirect Control and IP Validation
**Vulnerability:** The `/api/agent/onboarding-scrape` endpoint allowed arbitrary URL fetching, posing a Server-Side Request Forgery (SSRF) risk where internal services could be scanned or accessed.
**Learning:** Simple hostname validation is insufficient if the HTTP client follows redirects, as a "safe" URL can redirect to a restricted internal IP after the initial check.
**Prevention:** Always validate URLs against private IP ranges and explicitly set `redirect: 'error'` (or 'manual') when using `fetch` on user-provided URLs to prevent redirect-based bypasses.
