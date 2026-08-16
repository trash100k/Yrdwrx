## 2026-08-16 - IPv6 Bracket Delimiters and Hex-encoded Mapped Addresses in SSRF Validation
**Vulnerability:** URL parser returns IPv6 hostnames with enclosing brackets (e.g. `[::1]`) which causes `isIP` to fail classification and bypass direct IP checks in `validateSafeUrl`. Additionally, hex-encoded IPv4-mapped IPv6 addresses (e.g. `::ffff:7f00:1`) were not recognized as mapped v4 addresses in `isPrivateIP`.
**Learning:** `new URL('http://[::1]').hostname` evaluates to `'[::1]'`, which Node's `isIP` returns 0 for. Strip brackets prior to IP classification.
**Prevention:** Strip leading and trailing brackets from hostnames before passing them to `isIP()` or `isPrivateIP()`, and parse hex representations in IPv4-mapped IPv6 addresses.

## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.
