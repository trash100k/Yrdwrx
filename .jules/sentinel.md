## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-10-28 - SSRF Bypass via IPv6 Notation Variants and Bracketed IP Hostnames
**Vulnerability:** SSRF validation bypass in `isPrivateIP` / `validateSafeUrl` via bracketed IPv6 strings (`[::1]`), unspecified IPv6 (`::`, `::0`), expanded loopbacks (`0:0:0:0:0:0:0:1`), and hex-encoded IPv4-mapped IPv6 notation (`::ffff:7f00:1`).
**Learning:** `net.isIP()` rejects bracketed IP strings like `[::1]`, causing `isPrivateIP` to return false. Standard regex for IPv4-mapped IPv6 only matched dotted decimal `::ffff:127.0.0.1` and missed hex notation `::ffff:7f00:1`.
**Prevention:** Always un-bracket IP hostnames before testing with `net.isIP()`, convert hex pairs in IPv4-mapped IPv6 into dotted decimal format, and match all IPv6 unspecified (`::`, `0:0:0:0:0:0:0:0`) and loopback representations.
