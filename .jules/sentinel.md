## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-03 - SSRF Bypass via Hex-Encoded IPv4-Mapped IPv6
**Vulnerability:** Server-Side Request Forgery (SSRF) bypasses in `isPrivateIP` validation.
**Learning:** Attackers can bypass simple IPv4-mapped IPv6 filters (e.g., `::ffff:127.0.0.1`) by using hex-encoded variants (e.g., `::ffff:7f00:1`). Additionally, the unspecified address `::` often binds to local interfaces and must be explicitly blocked.
**Prevention:** IP validation utilities must normalize IPv4-mapped IPv6 addresses by handling both dotted-decimal and hex-encoded representations before performing range checks. Always explicitly block the unspecified address `::`.
