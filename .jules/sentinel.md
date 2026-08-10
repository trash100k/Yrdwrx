## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-08-10 - JWT Algorithm Confusion and Signature Bypass
**Vulnerability:** JWT Algorithm Confusion and Signature Bypass in Client Portal magic link token verification.
**Learning:** Symmetric JWT verification via `jwt.verify` was performed without specifying the allowed signature algorithms in the verification options. This allowed attackers to forge tokens using asymmetric algorithms (like RS256) where the public key is treated as the HMAC symmetric secret key (algorithm confusion) or using the 'none' algorithm to bypass signature validation entirely.
**Prevention:** Symmetrically verified JWTs signed with `JWT_SECRET` must always explicitly restrict the accepted signature algorithms to `['HS256']` via the verification options parameter (e.g., `{ algorithms: ["HS256"] }`), and signing should enforce HS256 explicitly.
