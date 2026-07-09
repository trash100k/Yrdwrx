## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2025-05-16 - [Header Accessibility & Interaction Polish]
**Learning:** Icon-only buttons in dense headers benefit significantly from `Tooltip` components to provide immediate clarity on hover, especially when native `title` attributes are removed to prevent "double tooltips". Furthermore, ensuring all interactive header elements have `focus-visible:ring-2` indicators is critical for keyboard-only navigation in high-contrast or dark-themed applications.
**Action:** Always wrap icon-only buttons in `Tooltip`, remove redundant `title` attributes, and apply consistent `focus-visible` ring styles to interactive elements.
