## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-09-01 - URL Decoding in Threat Detection Middleware
**Vulnerability:** URL-encoded injection and path traversal bypasses in threat detection middleware.
**Learning:** Checking raw `req.url` strings against security rules without decoding allowed URL-encoded payloads (e.g. `%2e%2e%2f`) to bypass pattern matching.
**Prevention:** Always decode and normalize URL paths using `decodeURIComponent` inside a try/catch block prior to pattern matching, rejecting malformed encodings with a 400 status.
