## 2025-05-15 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) in the `/api/agent/onboarding-scrape` endpoint.
**Learning:** The endpoint allowed users to provide any URL, which the server would then fetch. This could be exploited to probe internal network services or access sensitive metadata services (like GCP or AWS metadata).
**Prevention:** Always validate user-provided URLs against a whitelist of allowed protocols and a blacklist of private IP ranges. Additionally, use `redirect: 'error'` when fetching to prevent bypasses via malicious redirects.
