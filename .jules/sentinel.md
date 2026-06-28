## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-06-28 - JWT and Admin Authorization Hardening
**Vulnerability:** Insecure default fallbacks for JWT secrets and lack of authorization on sensitive security endpoints.
**Learning:** Hardcoded fallbacks like 'cutty-super-secret-key-for-development' in production code allow attackers to forge valid authentication tokens if the environment variable is misconfigured or missing. Additionally, endpoints like '/api/security/threats' were explicitly unprotected by global auth middleware.
**Prevention:** Enforce strict validation of security-critical environment variables (JWT_SECRET, SAAS_ADMIN_EMAIL) at process startup in production. Centralize secret management to eliminate redundant fallbacks and ensure all sensitive endpoints are protected by both authentication and granular authorization checks.
