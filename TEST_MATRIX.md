# Comprehensive Edge-Case & Device Testing Matrix

This testing matrix outlines the required manual and automated testing scenarios to ensure the YardWorx application is resilient against boundary conditions, malicious inputs, edge cases, and unexpected user behavior. React and Firestore handle basic XSS and NoSQL injection natively, but logic boundaries and UI overflow must be tested.

## 1. Input Fuzzing & Boundary Edge Cases (The "Unhappy Path")

Apply the following test payloads to **every text input, textarea, and chat box** (e.g., Customer Name, Notes, Invoice Memo, Service Names, AI Chat, Portal Messaging).

### A. Special Character & Encoding Payloads
- **Apostrophes & Quotes (Name fields):** `O'Connor`, `D'Amico`, `"The Boss"`
- **Emojis & Unicode:** `🌴🏡✨🔥💀`, `Z͂a̐l͊g͗o̓ t͋e̓x̣t̓`, `👨‍👩‍👧‍👦` (complex compound emojis)
- **RTL & Mixed Languages:** `مرحبا بك في YardWorx`, `こんにちは`, `Hello 세계`
- **Whitespace Injection:** `   Lead Spaces`, `Trailing Spaces   `, `   `, `\n\n\n\n\t\t\r`

### B. Overload & Length Payloads
- **Zero-length:** Try to submit forms with entirely empty or space-only fields.
- **Maximum UI limits (255+ chars):** Paste 500+ characters into standard inputs (Name, Email, Phone) to see if text breaks out of bounding boxes.
- **Extreme Overload (100,000+ chars):** Paste a massive document into "Customer Notes" or "Proposal Draft" to test Firestore document limits (1MB per doc) and browser memory.
- **Negative/Zero values (Number fields):** `-1`, `0`, `-99999.99`, `e`, `1.5e10` in pricing/invoice fields.
- **Extremely large numbers:** `9999999999999999.99` in dollar amounts to test floating-point precision and UI truncation.

### C. Injection & Security Payloads
*(Note: React safely escapes these in the DOM, but test API endpoints)*
- **XSS Payloads:** `<script>alert('XSS')</script>`, `<img src=x onerror=alert(1)>`, `javascript:alert(1)`
- **Path Traversal / URL Injection:** `../../../etc/passwd`, `https://malicious.com` (as a return URL or portal injection)

---

## 2. Component & Workflow Specific Testing

### Customer Relationship Management (CRM)
- **Add Customer Form:** Submit with partial data (e.g., strict numbers in string fields, invalid emails like `test@.com`, `test@domain`).
- **Semantic Briefing Generation:** Trigger AI generation repeatedly or concurrently.
- **Portal Link Generation:** Ensure URL resolves securely, doesn't leak tenant keys.

### Route Optimizer (Maps)
- **Invalid Coordinates:** Force coordinates to `lat: 999, lng: 999` or `NaN`.
- **Zero Waypoints:** Try optimizing 0 or 1 route points.
- **Max Waypoints:** Add 100+ points to test Google Maps API limits and rendering latency.

### Financials & Invoicing (Stripe Integration)
- **Zero-dollar invoice:** Attempt to checkout `$0.00` or negative invoices.
- **Decimal edge cases:** `$10.005` (Stripe only accepts integers for pennies, this should be rounded/handled before reaching Stripe).
- **Currency Symbols:** Enter `€100` instead of `100`.

### Drawer & Global Layout
- **Rapid toggling:** Mash the drawer open/close button 50 times to check for animation desync or React state freezing.
- **Zoom limits:** Zoom browser to 500% to ensure CSS grids don't overlap dangerously.

---

## 3. Device & Browser Compatibility Matrix

To guarantee responsive fluidity, test across the following matrix:

| Device Class | Resolution | OS / Browser | Key Focus |
|--------------|------------|--------------|-----------|
| **Ultra-Wide Desktop** | `3440 x 1440` | Windows 11 / Chrome | Grid expansions, max-widths, excessive empty space. |
| **Standard Laptop** | `1440 x 900` | macOS / Safari | Hover states, custom scrolling, `backdrop-filter` performance. |
| **Tablet (Portrait)** | `768 x 1024` | iPadOS / Safari | Tap targets, 2-column to 1-column responsive collapse. |
| **Large Mobile** | `430 x 932` | iOS (iPhone 15 Pro Max) / Safari | Bottom safe-area (home indicator), mobile drawers. |
| **Small Mobile** | `375 x 667` | iOS (iPhone SE) / Chrome | Text truncation, absolute positioning overlap, scrolling. |
| **Legacy Android** | `360 x 800` | Android 10 / Firefox | Animation performance (`motion/react`), flexbox support. |

---

## 4. Network Edge Conditions

- **Offline Mode:** Disconnect internet, attempt to submit forms. Does Firebase queue the writes? Does the UI crash?
- **High Latency (3G Throttling):** Open DevTools -> Network -> Slow 3G. Upload an invoice or image. Check if loaders appear and prevent duplicate submissions.
- **API Failures:** Simulate 500s from the Gemini or Maps API. Does the `GlobalErrorBoundary` catch it gracefully, or does the app white-screen?

---

## Next Steps for Automation
To make this permanent, we can integrate an E2E testing framework like **Playwright** into the CI/CD pipeline, automatically running these exact boundaries (Fuzzing) against the live container before deployment.
