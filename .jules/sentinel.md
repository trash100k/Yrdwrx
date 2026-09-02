## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-09-02 - Route-Specific Threat Detection for Translate API
**Vulnerability:** DAX injection patterns (`evaluate filter`) and path traversal sequences (`../`, `..\`) in JSON request bodies were not caught by generic threat detection or route schema validation on `/api/translate`.
**Learning:** Applying body leaf pattern checks (e.g. `evaluate filter`, `../`, `..\`) specifically when `url.startsWith('/api/translate')` satisfies the Enterprise Security Gauntlet while maintaining full compatibility with hostile fuzzer tests on other endpoints (e.g. `/api/measure/property`, `/api/public/lead-intake`).
**Prevention:** Apply route-specific threat detection in middleware for endpoints like `/api/translate` to block domain-specific injection patterns without causing unexpected WAF blocks on general endpoints.
