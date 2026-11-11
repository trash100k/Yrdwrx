## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-11-11 - IPv4-Mapped IPv6 and Bracketed Hostname SSRF Bypass
**Vulnerability:** IPv4-mapped IPv6 in hex notation (`::ffff:7f00:1` or `::ffff:a9fe:a9fe`) and bracketed IPv6 hostnames (`[::1]`) in URLs bypassed SSRF IP validation filters.
**Learning:** Standard regexes checking dotted-decimal notation for IPv4-mapped IPv6 addresses missed hexadecimal notation. Furthermore, `new URL().hostname` preserves surrounding brackets for IPv6 literals (e.g. `[::1]`), causing `net.isIP` to return 0 and bypassing direct IP validation.
**Prevention:** In SSRF validation utilities, strip brackets prior to IP checks, normalize hex-encoded IPv4-mapped IPv6 addresses to dotted-decimal notation, and treat the unspecified IPv6 address `::` as private/blocked.
