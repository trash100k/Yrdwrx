## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-10-10 - [Settings & Composite Views Accessibility Standards]
**Learning:** In complex settings sections with custom toggle buttons and dynamic field inputs, missing `role="switch"`, `aria-checked`, and `<label htmlFor>`/`<input id>` associations trip automated `jest-axe` structural checks. Explicitly adding switch roles, explicit labels, and focus indicators allows composite settings screens to pass automated accessibility gating cleanly.
**Action:** Always pair custom icon toggle buttons with `role="switch"`, `aria-checked`, and `aria-label`, and ensure all form inputs have explicit `id`/`htmlFor` label bindings across composite sections.
