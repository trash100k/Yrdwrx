## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-25 - URL-decoding in Pentest Protection Middleware
**Vulnerability:** URL-encoded bypasses of threat detection middleware (path traversal, file extensions, command injections) and malformed URI crashes.
**Learning:** When checking req.url directly for blocked file extensions (e.g. `.env`) and traversals (e.g. `../`), attackers can bypass raw string-matching filters using standard URL-encoding (e.g., `%2eenv` or `%2e%2e%2f`). Additionally, parsing malformed percentage encoding could throw unhandled exceptions and crash the process.
**Prevention:** Decode the request URL using `decodeURIComponent` before applying pattern matching, and gracefully catch any URIError with a 400 Bad Request to prevent unhandled process crashes. Use route-specific strict body matching when scanning hostile payloads for specific endpoints (like `/api/translate`) to avoid breaking normal operation.
