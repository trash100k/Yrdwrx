## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-07-30 - [Header Tooltip Integration & Native Attribute Conflicts]
**Learning:** When integrating custom hover tooltips on icon-only header controls, native `title` attributes must be removed to avoid double-tooltip visual glitches. Additionally, wrapping conditionally hidden controls (such as buttons hidden on small screens with `hidden sm:flex`) in a non-responsive `Tooltip` wrapper can break mobile layouts or cause phantom hitboxes; the responsiveness rules must wrap the outer `Tooltip` container itself.
**Action:** Remove native `title` when adding custom tooltips, configure `position="bottom"` for header items to avoid overlapping top-bar menus, and match the visibility media queries on the outermost Tooltip container.
