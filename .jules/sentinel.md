## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2025-06-20 - Secure Magic Link Side-Channel Pattern
**Vulnerability:** Information Disclosure and Potential Auth Bypass via exposed Magic Links in API responses and frontend logs.
**Learning:** Returning authentication tokens or magic links directly in API responses or displaying them in UI logs bypasses the security benefits of side-channel delivery (like email). It allows any authenticated staff member (or anyone with access to the client-side logs) to potentially intercept a user's login link.
**Prevention:** Authentication magic link generation must never return the token or link in the API response or log them to the console. Tokens must only be sent via a secure side-channel like email. The frontend should only receive a success confirmation, not the sensitive link itself.
