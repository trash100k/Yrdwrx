## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-06-29 - [Semantic Interactive Elements & Visual Discoverability]
**Learning:** Custom interactive containers (like a `div` for a search trigger) must be converted to native `<button>` elements to be accessible to keyboard users and screen readers. Additionally, providing visual feedback for icon-only buttons via the `Tooltip` component (using the button's `aria-label` for content) significantly improves discoverability for sighted users.
**Action:** Always use native `<button type="button">` for interactive triggers, ensure they have proper `id` association with `<label htmlFor="...">`, and wrap icon-only buttons in `Tooltip` components.
