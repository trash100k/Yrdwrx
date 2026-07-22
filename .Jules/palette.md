## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-07-22 - [Header Tooltip & Double-Tooltip Elimination Pattern]
**Learning:** When custom tooltips are added to icon-only buttons in the application header, any pre-existing native HTML `title` attributes must be removed. Leaving them intact results in a redundant "double tooltip" UI glitch where both the custom dynamic tooltip and the browser's default tooltip render simultaneously. Additionally, the custom tooltip must be positioned as "bottom" to avoid overlapping browser UI frames.
**Action:** Remove native `title` attributes from elements wrapped by the custom `Tooltip` component, and set `position="bottom"` for global header elements.
