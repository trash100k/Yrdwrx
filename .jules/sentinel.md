## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-02 - SSRF via IPv4-Mapped IPv6 Addresses
**Vulnerability:** Server-Side Request Forgery (SSRF) bypass using IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`).
**Learning:** The `isPrivateIP` utility only checked standard IPv4 and IPv6 formats. Attackers could bypass these checks by providing local addresses in the `::ffff:a.b.c.d` format, which many networking stacks treat as local but the application failed to recognize as private.
**Prevention:** Normalize IPv4-mapped IPv6 addresses by stripping the `::ffff:` prefix before performing octet-based range checks. Also, explicitly block the IPv6 unspecified address (`::`).
