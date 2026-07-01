## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-07-01 - [Semantic Search Trigger & Label Association]
**Learning:** Custom interactive containers for search triggers (like a div) should always be native <button> elements with type="button". Maintaining a consistent 'id' (e.g., "system-search") is critical for association with existing <label htmlFor="..."> elements, ensuring proper screen reader support and keyboard focus behavior.
**Action:** Convert custom search/palette triggers to semantic buttons and verify ID/label pairings.
