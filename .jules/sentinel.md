## 2026-07-31 - IPv6 and Hex-Mapped IPv4 SSRF Bypass in isPrivateIP
**Vulnerability:** Server-Side Request Forgery (SSRF) bypasses via hex-encoded IPv4-mapped IPv6 addresses (e.g. ::ffff:7f00:1) and unspecified addresses (e.g. ::) which were not handled by standard regex parsing of IPv4-mapped IPv6 or standard private IPv6 range matching.
**Learning:** Node's net.isIP identifies hex-encoded IPv4-mapped IPv6 as a valid IPv6 address, but typical regex checking for ::ffff:<IPv4> only parses dot-decimal notation, allowing hex representations to evade checks while still resolving to private addresses like localhost.
**Prevention:** Always parse and expand hex-encoded segments in IPv4-mapped IPv6 addresses to decimal components to perform standard private range checks, and explicitly block the unspecified address '::'.

## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.
