## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2025-07-07 - Hex-encoded IPv4-mapped IPv6 SSRF Bypass
**Vulnerability:** SSRF bypass via hex-encoded IPv4-mapped IPv6 addresses (e.g., `::ffff:7f00:1`).
**Learning:** `isPrivateIP` was only handling dotted-decimal notation for IPv4-mapped IPv6. Attackers could use hex notation to bypass the filter. Additionally, the unspecified address `::` could be used to refer to the local host on some systems.
**Prevention:** Update `isPrivateIP` to parse hex-encoded portions of IPv4-mapped IPv6 addresses back to dotted-decimal for validation. Explicitly block `::` in the IPv6 loopback/link-local checks.
