## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-07-27 - [Toggle Switch & Form Select Accessibility Compliance]
**Learning:** Using `aria-checked` on native `<button>` elements triggers structural accessibility validation warnings under axe-core unless they have a `role="switch"` (or role of checkbox/radio). Additionally, `<select>` elements require direct programmatic association with their `<label>` elements via `htmlFor` and `id` to pass the `select-name` check.
**Action:** Always specify `role="switch"` when designing toggle buttons that use `aria-checked`, and enforce proper `id`/`htmlFor` linkage for all custom select controls.
