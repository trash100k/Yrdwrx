## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-13 - IPv4-mapped IPv6 SSRF Bypass
**Vulnerability:** Server-Side Request Forgery (SSRF) filters could be bypassed using alternative IPv6 representations of private IPv4 addresses.
**Learning:** Common SSRF filters often only check dotted-decimal IPv4 or standard IPv6 strings. Hex-encoded IPv4-mapped IPv6 addresses (e.g., `::ffff:7f00:1`) can resolve to local interfaces and bypass checks that don't explicitly handle this representation.
**Prevention:** Strengthen IP validation utilities to correctly parse and recursively validate all representations of IPv4-mapped IPv6 addresses. Additionally, explicitly block the unspecified address `::` as it can also be used for local service probing.
