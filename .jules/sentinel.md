## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-21 - URL-Encoded Injection Middleware Bypass
**Vulnerability:** URL-Encoded bypasses (such as %2e%2e%2f for ../ or %2eenv for .env) allowed attackers to bypass the enterprise injection and restricted file extension filters.
**Learning:** Checking raw query/request URLs using simple substring checks (e.g. `url.includes(p)`) fails when malicious characters or file extensions are URL-encoded, as Express only decodes route parameters later in the routing cycle.
**Prevention:** Always decode request URLs with `decodeURIComponent` before performing WAF or injection detection signature checks, and safely catch any URI malformations to reject them with 400 Bad Request.
