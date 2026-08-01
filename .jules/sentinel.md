## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-08-01 - JWT Verification Algorithm Confusion
**Vulnerability:** Algorithm Confusion / Key Confusion in symmetric JWT verification.
**Learning:** Calling `jwt.verify(token, secret)` without explicitly specifying the allowed algorithm options allows any algorithm supported by the library and compatible with the secret key/public key structure. An attacker can construct a token signed with an asymmetric algorithm (e.g. RS256) but use the public key as the symmetric secret key, leading to successful verification bypass in certain library configurations.
**Prevention:** Always explicitly specify the expected algorithm(s) (such as `{ algorithms: ["HS256"] }` for symmetric keys) in the options parameter of `jwt.verify` to restrict verification to approved signing protocols.
