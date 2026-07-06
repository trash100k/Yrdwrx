## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-06 - SSRF Bypass via IPv4-mapped IPv6 hex encoding
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in `isPrivateIP` validation.
**Learning:** Hex-encoded IPv4-mapped IPv6 addresses (e.g., `::ffff:7f00:1`) were not correctly identified by the previous SSRF filter, which only handled dotted-decimal notation. Additionally, the unspecified address `::` was not explicitly blocked, which can sometimes be interpreted as localhost.
**Prevention:** Always normalize and validate all variations of IPv4-mapped IPv6 addresses, including hex-encoded formats, against private IP ranges. Explicitly block the unspecified address `::` in SSRF filters.
