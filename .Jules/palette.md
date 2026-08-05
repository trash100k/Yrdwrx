## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-08-05 - [Unified Accessible Icon-Only Header Buttons Pattern]
**Learning:** Icon-only action buttons in the global header must always be wrapped in the custom `Tooltip` component (using `position="bottom"`) and require the removal of any native `title` attribute to prevent redundant/overlapping native browser tooltips. Furthermore, they must explicitly define keyboard focus styles (`focus-visible:ring-2 focus-visible:ring-forest-500 focus:outline-none`) to ensure keyboard users have high-contrast focus indicators.
**Action:** Always wrap header icon-only buttons with `<Tooltip position="bottom" content="...">`, avoid native `title` attributes on buttons, and use unified `focus-visible` classes.
