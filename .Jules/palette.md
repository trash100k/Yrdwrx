## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-03-30 - [Modal Dialog ARIA & Keyboard Navigation Standard]
**Learning:** Shared dialog containers must couple React `useId()` with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` so screen readers accurately identify dialog boundaries and titles. Furthermore, global `keydown` listeners for `Escape` must check `isOpen` state to enable expected keyboard dismissal without leaky event listeners.
**Action:** When creating or refining modal or drawer components, systematically apply `role="dialog"`, dynamic `aria-labelledby` linkage, explicit `aria-label` on close buttons with high-contrast focus rings (`focus-visible:ring-2 focus-visible:ring-forest-500 focus:outline-none`), and Escape key listeners.
