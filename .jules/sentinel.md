## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-08-09 - Hex-Encoded IPv4-Mapped IPv6 SSRF Bypass
**Vulnerability:** Hex-encoded IPv4-mapped IPv6 address representation allows bypassing standard string-matching/decimal IPv4 validation.
**Learning:** Standard regexes or simple decimal-based parsers do not recognize hex-encoded IPv4-mapped IPv6 addresses (e.g., `::ffff:7f00:1` for `127.0.0.1` or `::ffff:0a00:0001` for `10.0.0.1`), allowing attackers to specify a private loopback/internal IP using IPv6 notation. In addition, the unspecified address `::` can serve as an alias for loopback on many systems.
**Prevention:** Always parse and translate hex-encoded IPv4-mapped IPv6 values to standard dot-decimal IPv4 recursively, block unspecified wildcard addresses (like `::`), and strip bracket framing from parsed URL hostnames to guarantee a clean IP validation path.
