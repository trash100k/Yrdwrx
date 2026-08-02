## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-08-02 - Explicit JWT Verification Algorithms
**Vulnerability:** Potential JWT Algorithm Confusion / Key Confusion bypass via untrusted token headers.
**Learning:** Symmetric JWT verification without specifying explicit algorithms can allow algorithm confusion attacks, where an attacker could supply `none` or asymmetric signature algorithms to bypass verification checks.
**Prevention:** When verifying JWTs signed symmetrically with a shared secret, always pass an explicit `algorithms` list (e.g. `{ algorithms: ["HS256"] }`) to `jwt.verify` to restrict allowed verification schemes.
