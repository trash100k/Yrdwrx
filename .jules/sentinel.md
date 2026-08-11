## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-08-11 - JWT Algorithm Confusion in Client Portal
**Vulnerability:** JWT Algorithm Confusion and Signature Bypass via missing algorithm enforcement in `jwt.verify`.
**Learning:** The application verified symmetric JWT portal tokens using `jwt.verify(token, JWT_SECRET)` without specifying an explicit `algorithms` option. This allowed potential signature bypasses where an attacker could forge tokens with the `none` algorithm or sign them with an asymmetric algorithm (like RS256) while treating the public key of the server as a symmetric key.
**Prevention:** Symmetrically signed JWTs must always specify `{ algorithms: ["HS256"] }` in `jwt.verify` options to ensure only the intended signature algorithm is accepted.
