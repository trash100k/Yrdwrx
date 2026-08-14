## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-08-14 - [Double Tooltip Prevention and Positioning]
**Learning:** Interactive icon-only header buttons should be wrapped with custom `Tooltip` components instead of relying on native `title` attributes. To prevent overlapping tooltips, any existing native `title` attributes must be removed. Furthermore, for top header actions, setting `position="bottom"` is crucial to ensure tooltips do not overflow into the browser's native window borders or UI elements.
**Action:** For all global navigation or header interactive actions, utilize `<Tooltip position="bottom">`, strip native `title` attributes, and enforce high-contrast focus rings for keyboard navigators.
