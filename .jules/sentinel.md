## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2025-06-20 - Hex-Encoded IPv4-mapped IPv6 SSRF Bypass
**Vulnerability:** SSRF filters can be bypassed using hex-encoded IPv4-mapped IPv6 addresses (e.g., `::ffff:7f00:1`) if only dotted-decimal notation is handled.
**Learning:** Standard IP validation libraries or manual checks often overlook the hex variant of the IPv4-mapped IPv6 prefix. This allows attackers to point to local addresses like `127.0.0.1` while appearing as an IPv6 address to simple regex-based filters.
**Prevention:** Explicitly detect and unwrap hex-encoded IPv4-mapped IPv6 addresses by parsing the tail segments and converting them back to decimal for recursive validation. Also, explicitly block the unspecified address `::`.
