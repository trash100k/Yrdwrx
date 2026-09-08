## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-03-30 - [Consent Banner Accessibility Standard]
**Learning:** Fixed bottom cookie/privacy consent banners require `role="region"` with a descriptive `aria-label` so screen reader users can jump directly to them. Additionally, icon-only dismiss buttons need explicit `aria-label` and `type="button"` with `focus-visible:ring-2` focus rings for keyboard navigation.
**Action:** Always wrap fixed bottom banners with `role="region"`, provide explicit ARIA labels for dismiss icon buttons, and add high-contrast `focus-visible` focus indicators on all banner action buttons.
