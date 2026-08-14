## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-08-14 - SSRF Bypass via IPv6 Unspecified and Hex-Encoded IPv4-Mapped IPv6
**Vulnerability:** SSRF bypasses via unspecified IPv6 address `::` and hex-encoded IPv4-mapped IPv6 formats (e.g., `::ffff:7f00:1` / `::ffff:7f00:0001`).
**Learning:** Standard IP-based SSRF checkers often parse only dot-decimal mapped IPv6 (`::ffff:127.0.0.1`) and can overlook hex-encoded mapped formats or the unspecified address `::` which some operating systems resolve to localhost/loopback. Additionally, parsed hostnames with enclosing brackets (e.g., `[::1]`) can fail `isIP` checks, causing them to fall through to DNS lookup.
**Prevention:** Explicitly check and block unspecified addresses. Normalize and decode hex-encoded mapped formats back to standard IPv4 before checking private ranges, and strip enclosing brackets from IPv6 hostnames for accurate validation.
