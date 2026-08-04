## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-08-04 - WAF URL-encoded Bypass Protection
**Vulnerability:** WAF bypass via percent-encoded URI obfuscation (e.g. `%2e%2e%2f` for `../` path traversal, or `%2eenv` to bypass `.env` blocked file extension check).
**Learning:** Checking raw, un-decoded `req.url` strings in custom security middlewares leaves the system vulnerable to URL-encoding evasion techniques. Obfuscated strings slip past extension or keyword blacklists but resolve to the malicious paths at downlevel routers or file handlers.
**Prevention:** Always decode request URLs via `decodeURIComponent` inside WAF/security middlewares before performing pattern matching, and gracefully capture `URIError` to prevent unhandled process crashes.
