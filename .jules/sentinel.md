## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-11-02 - IPv6 and Hex-Encoded Mapped IPv6 SSRF Bypasses
**Vulnerability:** SSRF filter bypasses in `isPrivateIP` and `validateSafeUrl` via hex-encoded IPv4-mapped IPv6 (e.g. `::ffff:7f00:1`, `::ffff:a9fe:a9fe`), unspecified IPv6 (`::`), and bracketed IPv6 hostnames (`[::1]`).
**Learning:** `net.isIP()` returns 0 for bracketed IPv6 strings (like `[::1]`), causing direct IP checks to fail unless brackets are stripped. Furthermore, standard regexes matching `::ffff:d.d.d.d` miss hex-segment IPv4-mapped representations (`::ffff:7f00:1`) and IPv4-compatible IPv6 addresses, and `::` binds to 0.0.0.0/localhost on many operating systems without matching typical loopback ranges.
**Prevention:** Strip surrounding brackets before running `net.isIP()`, decode hex-encoded IPv4-mapped/compatible IPv6 segments into standard IPv4 dotted quads for recursive validation, and explicitly include `::` in the private/loopback check.
