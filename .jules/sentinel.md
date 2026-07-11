## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2025-07-11 - SSRF Bypass via Hex-Encoded IPv4-Mapped IPv6
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass in `isPrivateIP` using hex-encoded IPv4-mapped IPv6 addresses (e.g., `::ffff:7f00:1` for `127.0.0.1`).
**Learning:** Standard IP libraries or regex-based unwrappers often only handle dotted-decimal notation for IPv4-mapped addresses. Modern systems (including Node's `fetch` and `net` module in some contexts) may resolve or accept hex-encoded tails, allowing attackers to slip private IPs past filters that only look for `127.0.0.1` or `169.254.x.x` patterns.
**Prevention:** SSRF filters must explicitly handle both dotted-decimal and hex-encoded tails for `::ffff:` mapped addresses. Always unwrap and recursively validate the embedded address against private ranges.
