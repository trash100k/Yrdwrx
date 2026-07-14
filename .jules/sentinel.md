## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-14 - Unconfirmed High-Risk Action Guard in Closeout
**Vulnerability:** Authorization/Safety Bypass in Closeout `doAll`.
**Learning:** The `doAll` function executed all selected actions regardless of their `confirmed` status, relying only on the UI to disable the button. However, the logic allowed for high-risk actions (like invoicing) to be executed if they were programmatically selected but not manually confirmed.
**Prevention:** Always enforce safety gates (like `confirmed`) within the execution logic itself, not just in the UI-level button disabling. In `doAll`, filter actions by both selection and confirmation for high-risk types.
