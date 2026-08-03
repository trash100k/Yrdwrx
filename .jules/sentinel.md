## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-08-03 - SSRF Bypass via Hex-Encoded Mapped IPv6 and Unspecified Address
**Vulnerability:** SSRF bypasses via hex-encoded IPv4-mapped IPv6 addresses (e.g., `::ffff:7f00:1`), fully expanded loopbacks (`0:0:0:0:0:0:0:1`), and unspecified addresses (`::`), which slipped past initial private IP regexes and checks.
**Learning:** Standard IP verification utilities often overlook non-decimal IPv4-mapped notation and uncompressed IPv6 representations. Furthermore, URL parsers can return bracketed hostnames (e.g., `[::1]`) which fail `net.isIP` validation, inadvertently deferring to DNS resolution where they may crash or bypass controls.
**Prevention:** Ensure `isPrivateIP` handles hex-encoded IPv4-mapped IPv6 segments and normalizes loopbacks and unspecified addresses. Strip enclosing brackets from hostnames prior to IP classification checks.
