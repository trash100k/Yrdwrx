## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2025-06-20 - Authentication Middleware Bypass via req.path
**Vulnerability:** Authentication bypass for `/api/` endpoints due to incorrect path matching in middleware.
**Learning:** When Express middleware is mounted on a subpath (e.g., `app.use("/api/", ...)`), `req.path` is relative to that mount point. A check like `req.path.startsWith("/api/")` inside such middleware will always fail, causing the middleware to skip authentication for all routes.
**Prevention:** Use `req.originalUrl` for global path matching or be aware that `req.path` is relative to the middleware's mount point. Always verify authentication coverage with integration tests.
