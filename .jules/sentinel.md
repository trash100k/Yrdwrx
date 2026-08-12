## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-08-12 - Explicit JWT Algorithm Enforcement
**Vulnerability:** JWT signature verification algorithm confusion and signature bypass.
**Learning:** Utilizing symmetric JWT verification (`jwt.verify`) without explicitly specifying the allowed algorithms can expose the application to signature bypasses or algorithm confusion (e.g., using 'none' algorithm or substituting asymmetric algorithms like RS256/public-key combinations).
**Prevention:** Always explicitly pass options specifying the allowed verification algorithms (such as `{ algorithms: ["HS256"] }` for symmetric keys) in all `jwt.verify` calls to ensure signature verification constraints are strictly enforced by the library.
