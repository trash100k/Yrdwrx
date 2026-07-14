## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-07-14 - [Form Component Accessibility]
**Learning:** The project's shared `Input` and `Select` components lacked `aria-describedby` linkage, preventing screen readers from automatically announcing help text or error messages when the field gained focus. Providing unique IDs to these descriptive elements and linking them to the input/select via `aria-describedby` significantly improves form accessibility.
**Action:** Always ensure descriptive text (errors, help text) is programmatically linked to its associated form control using `aria-describedby` and `aria-invalid`.
