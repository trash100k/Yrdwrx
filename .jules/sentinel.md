## 2025-06-19 - SSRF Protection in Onboarding Scrape
**Vulnerability:** Server-Side Request Forgery (SSRF) via user-provided URLs in the website scraping endpoint.
**Learning:** The application was fetching arbitrary user-provided URLs without validation, allowing potential access to internal network resources or cloud metadata services. Simple hostname blacklisting is insufficient as it can be bypassed via DNS entries pointing to local IPs or redirect chains.
**Prevention:** Always validate user-provided URLs using a robust utility that resolves the hostname via DNS and checks the resolved IP against private, loopback, and link-local ranges. Additionally, use 'redirect: "error"' in fetch calls to prevent redirect-based SSRF bypasses.
## 2025-06-29 - Magic Link Generation Protection
**Vulnerability:** Unauthenticated Magic Link Generation allowing anonymous JWT creation for any client email/ID.
**Learning:** The /api/auth/magic-link/generate endpoint was listed in AUTH_EXCLUDED_ROUTES, bypassing the Supabase auth middleware. This allowed any unauthenticated user to generate a valid 7-day magic link JWT for any known client, potentially facilitating unauthorized portal access.
**Prevention:** Remove sensitive utility endpoints from authentication exclusion lists. Authentication should be required for any action that generates signed tokens or grants access to sensitive tenant/client data. Additionally, never return raw JWT tokens in API responses if only a link is required.
