## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-06-23 - [Icon-Only Interaction Discoverability]
**Learning:** Icon-only buttons in headers often lack immediate clarity for sighted users. Adding tooltips that mirror the `aria-label` provides a necessary visual bridge, improving discoverability without increasing permanent visual noise.
**Action:** Proactively wrap icon-only header actions in the `Tooltip` component to ensure all interactive elements have both a visual and accessible label.
