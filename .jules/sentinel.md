## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-15 - Hex-Encoded IPv4-Mapped IPv6 SSRF Bypass
**Vulnerability:** SSRF filter bypass using hex-encoded IPv4-mapped IPv6 addresses (e.g., `::ffff:7f00:1`).
**Learning:** Standard IP parsing and regex-based extraction of IPv4-mapped IPv6 addresses often only look for dotted-decimal notation (e.g., `::ffff:127.0.0.1`). However, many networking stacks and libraries (including Node's `net.isIP`) recognize hex-encoded versions as valid IPv6 addresses, which can bypass filters that don't specifically account for this format.
**Prevention:** Explicitly detect hex-encoded IPv4-mapped IPv6 patterns, decode them into their equivalent IPv4 decimal components, and recursively validate them against private address ranges. Additionally, ensure the unspecified address (`::`) is explicitly blocked.
