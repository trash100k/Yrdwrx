## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2025-07-10 - SSRF Bypass via Hex-Encoded IPv4-Mapped IPv6
**Vulnerability:** `isPrivateIP` failed to detect hex-encoded IPv4-mapped IPv6 addresses (e.g., `::ffff:7f00:1`) and the unspecified address (`::`), allowing SSRF bypasses.
**Learning:** `isPrivateIP` only handled dotted-decimal IPv4-mapped IPv6. Some libraries resolve/return addresses in hex format, which bypasses simple string prefix checks if not explicitly handled.
**Prevention:** Always parse and normalize IP addresses before validation. For IPv4-mapped IPv6, support both dotted-decimal and hex-encoded tails by converting them back to standard IPv4 for recursive checking.
