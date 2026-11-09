## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-11-09 - Hex-Encoded IPv4-Mapped IPv6 and Unspecified Address SSRF Bypasses
**Vulnerability:** SSRF IP validation (`isPrivateIP`) allowed hex-encoded IPv4-mapped IPv6 addresses (e.g. `::ffff:7f00:1`), unspecified addresses (`::`), and bracketed hostnames (`[::1]`) to bypass private IP classification.
**Learning:** Standard regex checks looking only for dot-decimal `::ffff:x.x.x.x` miss hex representations of IPv4 addresses embedded in IPv6 (e.g., `7f00:1` for `127.0.0.1` or `a9fe:a9fe` for `169.254.169.254`). Moreover, the unspecified address `::` can bind or route to local services, and `net.isIP` fails on bracketed IPv6 notation.
**Prevention:** Strip URI bracket notation before IP parsing, explicitly check for unspecified address `::`, and unpack both dot-decimal and hex notations of IPv4-mapped IPv6 into standard IPv4 addresses before validating against private/link-local ranges.
