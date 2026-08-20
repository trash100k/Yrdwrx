## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-08-20 - JWT Algorithm Restriction in Verification Calls
**Vulnerability:** Unrestricted JWT verification (`jwt.verify(token, secret)`) allowing signature algorithm manipulation or algorithm confusion attacks.
**Learning:** Calling `jwt.verify` without an explicit `algorithms` option defaults to accepting any algorithm allowed by the underlying library, exposing the application to algorithm confusion (e.g., using RS256 public key as an HMAC secret or `none` algorithm bypasses).
**Prevention:** Always explicitly pass `{ algorithms: ["HS256"] }` (or appropriate expected algorithm array) when verifying JWT tokens signed symmetrically with `JWT_SECRET`.
