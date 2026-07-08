## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2025-07-08 - SSRF Bypass via Hex-Encoded IPv4-Mapped IPv6
**Vulnerability:** `isPrivateIP` check bypass via hex-encoded IPv4-mapped IPv6 addresses (e.g., `::ffff:7f00:1`) and the unspecified address `::`.
**Learning:** Standard regex-based unwrapping of IPv4-mapped IPv6 addresses only handled dotted-decimal notation. Hex-encoded versions were still recognized as valid IPv6 by the `net` module but bypassed the specific private-range checks.
**Prevention:** Explicitly block the unspecified address `::`. When handling IPv4-mapped IPv6, normalize both dotted-decimal and hex-encoded tails before recursively checking against private IPv4 ranges.
