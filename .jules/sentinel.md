## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-06 - Hex IPv4-Mapped IPv6 and Bracketed Hostname SSRF Bypasses
**Vulnerability:** SSRF filters in `isPrivateIP` and `validateSafeUrl` failed to identify hex-encoded IPv4-mapped IPv6 addresses (`::ffff:7f00:1`, `::ffff:a9fe:a9fe`), the unspecified address `::`, and bracketed IPv6 hostnames like `[::1]`.
**Learning:** WHATWG `URL.hostname` preserves enclosing brackets for IPv6 literals (e.g. `[::1]`), causing Node's `net.isIP()` to return 0 and skip direct IP validation. Additionally, IPv4-mapped IPv6 can be written in hexadecimal words rather than dotted-decimal, allowing private/metadata IPs to bypass simple dotted-decimal regex matching.
**Prevention:** Strip surrounding brackets (`[...]`) from URL hostnames before IP checks, detect and unwrap hex-encoded `::ffff:XXXX:XXXX` into standard IPv4 octets for private IP range evaluation, and treat `::` as an unroutable/private address.
