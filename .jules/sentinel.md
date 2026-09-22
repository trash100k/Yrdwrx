## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-09-22 - Explicit Algorithm Restriction in Symmetric JWT Verification
**Vulnerability:** Unrestricted algorithm selection during JWT verification in `jwt.verify` calls.
**Learning:** Omitting explicit `algorithms` parameter in `jwt.verify` allows potential algorithm-confusion or signature-bypass attacks where an attacker crafts tokens using weak or unexpected algorithms (e.g. HS384/HS512 or none).
**Prevention:** Always explicitly pass `{ algorithms: ["HS256"] }` in `jwt.verify` options when verifying tokens signed symmetrically with `JWT_SECRET`.
