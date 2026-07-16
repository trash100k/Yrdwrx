## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-16 - Hex-Encoded IPv4-Mapped IPv6 SSRF Bypass
**Vulnerability:** Bypassing SSRF filters using hex-encoded IPv4-mapped IPv6 addresses (e.g., `::ffff:7f00:1`).
**Learning:** Standard IP validation libraries or custom logic often handle dotted-decimal mapping (e.g., `::ffff:127.0.0.1`) but fail to recognize the equivalent hex representation. This allows attackers to target local or private addresses by switching the notation.
**Prevention:** Hardened `isPrivateIP` to explicitly parse the hex tail of IPv4-mapped IPv6 addresses and recursively validate the resulting IPv4 address against private ranges.
