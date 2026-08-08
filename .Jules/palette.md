## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-08-08 - [Interactive Tooltips and High-Contrast Focus Rings]
**Learning:** For abstract, icon-only interactive controls (such as header icons), custom accessible tooltips must always be matched with a high-contrast focus indicator (`focus-visible:ring-2 focus-visible:ring-forest-500 focus:outline-none`) to provide consistent mouse/keyboard affordances. Native browser tooltip attributes (e.g. `title`) must be removed to prevent overlapping double-tooltip rendering.
**Action:** Remove the `title` attribute when wrapping buttons in a custom `Tooltip` component and ensure they have prominent focus-visible focus ring styles.
