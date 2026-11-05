## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-06 - Hex IPv4-Mapped IPv6 & Bracketed Hostname SSRF Bypasses
**Vulnerability:** SSRF filters can be bypassed when IP literals are supplied as bracketed IPv6 strings (e.g. `[::1]`) or hex-encoded IPv4-mapped IPv6 addresses (e.g. `::ffff:7f00:1` or `::ffff:a9fe:a9fe`).
**Learning:** Standard WHATWG URL parsers leave square brackets on `url.hostname` for IPv6 literals, causing `net.isIP(url.hostname)` to return 0 and skip direct IP validation. Furthermore, IPv4-mapped IPv6 addresses can be represented in hex notation instead of dotted-decimal, evading naive regex matching for IPv4 patterns while still resolving to loopback, CGNAT, private, or cloud metadata endpoints.
**Prevention:** Strip surrounding brackets prior to `isIP` checking and normalize hex-encoded IPv4-mapped IPv6 addresses into standard dotted-decimal IPv4 octets to recursively apply private IP range checks. Also explicitly block the unspecified address `::`.
