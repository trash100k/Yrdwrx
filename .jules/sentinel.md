## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-06-23 - [Magic Link Token Leakage & Hardcoded Secrets]
**Vulnerability:** Authentication tokens (JWT) were being returned in the API response and a hardcoded fallback secret was used for signing.
**Learning:** Returning authentication links directly in the API response allows client-side interception and leakage via logs or network monitoring. Additionally, hardcoded fallback secrets in code undermine the entire security model if environment variables are misconfigured.
**Prevention:** Never return sensitive tokens or links in API responses; use secure side-channels (email/SMS). Enforce strict validation of cryptographic secrets at runtime, throwing errors if they are missing from the environment.
