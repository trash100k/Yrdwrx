## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-08-13 - Closeout High-Risk Invoice Action Gating
**Vulnerability:** Critical business-logic/safety bypass where high-risk invoice actions could be executed via the `doAll` function in `Closeout.tsx` without verifying explicit user confirmation.
**Learning:** Even if the UI disables/blocks the confirmation button, critical business operations must be verified programmatically at the execution function level to ensure that bypasses or race conditions cannot trigger unauthorized billing.
**Prevention:** Always enforce confirmation status programmatically on high-risk, money-adjacent, or destructive actions at the function level, and reject execution if unconfirmed.
