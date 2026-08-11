## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-08-11 - [Custom Tooltips and High-Contrast Focus Indicators for Icon-Only Navigation]
**Learning:** Icon-only interface elements in a dense header must be made fully accessible by utilizing custom `Tooltip` components rather than browser-native `title` attributes (which cause duplicate, conflicting tooltip overlays). Keyboard users require high-contrast focus rings (`focus-visible:ring-2 focus-visible:ring-forest-500 focus:outline-none`) that trigger tooltip visibility on focus.
**Action:** Replace all native button titles with custom keyboard-aware tooltips and attach high-contrast focus states to ensure uniform keyboard and screen-reader accessibility.
