## 2026-08-15 - URL-Encoded Threat Detection Bypass in Security Middleware
**Vulnerability:** Threat detection middleware checked `req.url` against blocked extensions (e.g. `.env`) and path patterns (e.g. `../`) without decoding percent-encoded sequences, allowing URL-encoded bypasses such as `%2eenv` or `%2e%2e%2f`.
**Learning:** Checking raw, undecoded request URLs against plain string/path blacklists fails to detect percent-encoded equivalents. Moreover, raw calls to `decodeURIComponent` can throw exceptions on malformed percent sequences (e.g., `%ff`), potentially resulting in uncaught 500 server crashes.
**Prevention:** Always decode request URLs with `decodeURIComponent` wrapped in a try/catch block prior to pattern inspection, rejecting malformed URL encodings with an explicit 400 Bad Request.

## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.
