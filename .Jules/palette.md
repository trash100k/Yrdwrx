## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2025-05-16 - [Semantic Search & Discoverability]
**Learning:** Converting custom search trigger containers (like a `div`) to native `<button>` elements with `type="button"` and `aria-label` ensures proper keyboard navigation and semantic role identification. Furthermore, wrapping icon-only buttons in a `Tooltip` component provides critical visual feedback for sighted users while maintaining accessibility for screen readers via `aria-label`.
**Action:** Always use native interactive elements for triggers and provide tooltips for icon-only buttons to enhance discoverability.
