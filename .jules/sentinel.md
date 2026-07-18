## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-18 - High-Risk Invoice Confirmation in Closeout Page
**Vulnerability:** Accidental or unauthorized high-risk operations execution. In the Tailgate Closeout flow, users could trigger bulk executions of proposed actions (like generating and sending invoices) without confirming the high-risk items first, potentially leading to incorrect billing or compliance slips if the UI-level button state was bypassed or mis-clicked.
**Learning:** Checking for state confirmation on individual action components isn't enough; the parent container's aggregate executor function must independently verify that all high-risk items included in the bulk execution list have been explicitly confirmed.
**Prevention:** Implement deep verification in aggregate execution handlers (such as `doAll` or `doBatch` loops) to reject processing if any action with risk level `"high"` is selected but does not exist in the confirmed state index.
