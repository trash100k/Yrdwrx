## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-08-03 - [High-Contrast Focus Indicators & Avoid Double Tooltips]
**Learning:** In highly customized dark/atmospheric interfaces, native browser focus outlines can look out of place or be invisible, while native `title` attributes cause duplicate tooltip overlaps with custom floating `Tooltip` elements.
**Action:** Always wrap custom tooltip triggers with custom focus-visible ring styles (e.g., `focus-visible:ring-2 focus-visible:ring-forest-500`) and ensure native `title` attributes are removed when introducing custom animated `Tooltip` components.
