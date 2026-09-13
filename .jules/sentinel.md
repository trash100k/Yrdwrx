## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-09-13 - URL Decoding in Security Threat Detection Middleware
**Vulnerability:** URL-encoded payload bypass (e.g., %2e%2e%2f or %2eenv) in security threat detection middleware.
**Learning:** The threat detection middleware checked `req.url` directly without URL decoding, allowing attackers to bypass blocked file extension and path pattern checks using percent-encoding.
**Prevention:** Always decode `req.url` using `decodeURIComponent` (handling malformed encoding gracefully with 400 Bad Request) before matching against blocked pattern lists.
