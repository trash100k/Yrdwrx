## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-23 - SSRF Bypass via IPv6 Encodings and Unspecified Addresses
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass through hex-encoded IPv4-mapped IPv6 addresses (e.g., `::ffff:7f00:1`) and unspecified IPv6 addresses (e.g., `::`).
**Learning:** Standard parser/matcher rules checking for string patterns or decimals like `127.0.0.1` or `::ffff:127.0.0.1` fail to detect hex-encoded mapped formats or unspecified/all-zero IPv6 hosts that resolve internally.
**Prevention:** Parse hex-encoded IPv4-mapped IPv6 suffixes to their decimal IPv4 equivalents and recursively validate them against private subnets. Explicitly clean and check all-zero/unspecified IPv6 configurations.
