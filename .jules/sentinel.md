## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-09-02 - Threat Detection WAF Alignment for Injection and System Path Signatures
**Vulnerability:** DAX injection patterns (`evaluate filter`) and severe system path/command signatures (`/etc/passwd`, `cmd.exe`) in JSON request bodies were not caught by WAF content pattern checks.
**Learning:** Checking severe system command/file signatures (`/etc/passwd`, `cmd.exe`, `/bin/sh`) alongside SQLi/NoSQL/XSS patterns on body string leaves prevents payload bypasses without causing false positives on ordinary user text.
**Prevention:** Include DAX and system-file/command signatures in WAF leaf scanning rules so hostile injection payloads are blocked consistently across all API endpoints.
