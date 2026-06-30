## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-06-30 - [Header Accessibility and Discoverability]
**Learning:** Icon-only buttons without text labels can be confusing for users. Wrapping them in a `Tooltip` component provides immediate context on hover/focus without cluttering the UI. Additionally, converting interactive search trigger `div` elements to native `button` elements is essential for keyboard accessibility (tabbing and activation via Enter/Space).
**Action:** Always wrap icon-only header/action buttons in Tooltips and ensure all interactive elements use semantic HTML tags like `<button>` or `<a>`.
