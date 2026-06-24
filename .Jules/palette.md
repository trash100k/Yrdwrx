## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2025-05-16 - [Accessibility: Non-semantic Interactive Elements]
**Learning:** Generic containers like `div` used as interactive elements lack semantic meaning for screen readers and are excluded from the default tab order. Converting these to native `button` elements instantly improves accessibility by providing keyboard focusability and the "button" role to assistive technologies.
**Action:** Always prefer native `button` or `a` elements for interactive components. When converting from a `div`, ensure `type="button"` is set to prevent form submission side effects, and add `focus-visible` rings for keyboard users.
