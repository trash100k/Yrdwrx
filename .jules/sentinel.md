## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-03-28 - Hex-encoded IPv4-mapped IPv6 and Bracketed IPv6 SSRF Bypasses
**Vulnerability:** SSRF validation bypass in `isPrivateIP` and `validateSafeUrl` using bracketed IPv6 hostnames (`http://[::1]/`) or hex-encoded IPv4-mapped IPv6 addresses (`::ffff:7f00:1`, `::ffff:a9fe:a9fe`).
**Learning:** `net.isIP` returns 0 for bracketed IPv6 hostnames (`[::1]`) extracted by `new URL().hostname`, bypassing direct IP private range checks. Additionally, regex matching `::ffff:127.0.0.1` misses hex notation `::ffff:7f00:1` (loopback) or `::ffff:a9fe:a9fe` (metadata service).
**Prevention:** Always strip enclosing brackets from IPv6 hostnames before checking `isIP`, and parse both dot-decimal and hex-encoded IPv4-mapped IPv6 addresses back to standard IPv4 dot-decimal notation for private IP range evaluation.
