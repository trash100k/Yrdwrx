## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-29 - URL-Encoded Bypasses on Request Filtering
**Vulnerability:** URL-encoded bypasses of malicious extension and path traversal filters.
**Learning:** Simple string matching (`String.includes`) on raw request URLs (`req.url`) is vulnerable to URL-encoding bypasses (e.g., `%2e%2e%2f` instead of `../`). Express doesn't automatically decode raw `req.url` before it is processed by path filtering middleware.
**Prevention:** Decode raw URLs with `decodeURIComponent` inside try-catch blocks to catch and reject malformed URL encodings before performing checks.
