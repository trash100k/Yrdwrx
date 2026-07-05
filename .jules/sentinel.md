## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2025-05-16 - Hex-Encoded IPv4-Mapped IPv6 SSRF Bypass
**Vulnerability:** SSRF bypass using hex-encoded IPv4-mapped IPv6 addresses (e.g., `::ffff:7f00:1` for `127.0.0.1`).
**Learning:** Standard IP validation libraries or simple regex might only handle dotted-decimal notation for IPv4-mapped IPv6 addresses. Attackers can use hex encoding to bypass filters that don't normalize the address before checking against private ranges.
**Prevention:** Ensure that SSRF filters normalize IP addresses, specifically handling both dotted-decimal and hex-encoded variants of IPv4-mapped IPv6 addresses, and explicitly block the unspecified address `::`.
