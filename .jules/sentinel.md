## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-20 - URL-Encoded Bypass in Security Middleware
**Vulnerability:** Security bypass of file extension blocklists and path-traversal/command injection checks due to un-decoded `req.url` validation.
**Learning:** Checking the raw `req.url` allowed attackers to bypass blocked patterns (like `.env` or `../`) by URL-encoding characters (e.g., `%2eenv` or `%2e%2e%2f`). Since downstreams decode the path, this left a significant protection gap.
**Prevention:** Always URL-decode `req.url` using `decodeURIComponent` inside a robust try/catch block prior to any safety or blocking validation. Reject malformed percent-encoding sequences with a 400 Bad Request to prevent parser inconsistencies.
