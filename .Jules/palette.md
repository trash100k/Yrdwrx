## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-07-29 - [Icon-Only Header Buttons Tooltip & Keyboard High-Contrast Pattern]
**Learning:** Icon-only header utility buttons require both clear accessible descriptions (like `aria-label`) and accessible tooltips on hover and focus to ensure screen-reader and sighted-user clarity. Removing native browser `title` attributes is crucial to prevent ugly double-tooltips, and adding dedicated high-contrast focus rings (e.g., `focus-visible:ring-2 focus-visible:ring-forest-500`) is essential to preserve professional keyboard navigability without introducing layout jank.
**Action:** Always wrap utility header actions in our custom `Tooltip` with bottom-positioning, strip any redundant native titles, and specify high-contrast focus-visible rings.
