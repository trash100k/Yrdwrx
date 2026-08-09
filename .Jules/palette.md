## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-08-09 - [Icon-only Header Buttons Tooltip and Focus Pattern]
**Learning:** Icon-only interactive buttons in global navigation headers require both explicit custom tooltips to replace native browser 'title' hover descriptions (preventing double tooltips) and visible high-contrast keyboard focus indicators (`focus-visible:ring-2 focus-visible:ring-forest-500 focus:outline-none`) to comply with accessibility standards. To implement these changes under strict 50-line git diff constraints, keeping layout button structure intact and wrapping them in compact JSX inline tags is highly effective.
**Action:** Always strip native `title` when wrapping interactive triggers in a custom `Tooltip`, and utilize focus visible classes to maintain high contrast.
