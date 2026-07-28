## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.

## 2026-07-28 - Fail-Secure Twilio Webhook Signature Validation
**Vulnerability:** Fail-open signature validation on Twilio inbound SMS and Voice webhooks when TWILIO_AUTH_TOKEN is configured.
**Learning:** Webhook signature validation utilized try-catch blocks that caught all exceptions (e.g., missing signature header, malformed/invalid signature strings, or external SDK/library errors) and defaulted to returning 'true' (allowed). This pattern created a security bypass when the token was set.
**Prevention:** Always implement a fail-closed/fail-secure pattern. If signature validation is configured but throws an error or lacks critical inputs (like headers), explicitly reject the request (return 'false'). Additionally, gracefully construct the validation URL by ensuring protocol and host fallbacks are correctly set to prevent `TypeError: Invalid URL` errors under mock or testing environments.
