## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-08-06 - JWT Algorithm Confusion and Signature Bypass Protection
**Vulnerability:** JWT algorithm confusion vulnerability due to unconstrained `jwt.verify` calls.
**Learning:** Unrestricted signature verification allows an attacker to manipulate the header of a JSON Web Token to change the algorithm to 'none' or asymmetric public-key types, effectively bypassing or confusing key verification and forging valid capability payloads.
**Prevention:** Always restrict accepted algorithms on symmetric token verification calls by explicitly passing options like `{ algorithms: ["HS256"] }` to `jwt.verify`.
