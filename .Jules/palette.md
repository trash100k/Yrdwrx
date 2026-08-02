## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-08-02 - [Hidden Native Inputs Focus Indicators]
**Learning:** Custom UI controls (like Checkbox, Toggle, and RadioGroup) that visually hide their native HTML inputs using `sr-only` will completely lose keyboard focus visual outlines. Using the Tailwind `peer` class on the hidden native input and applying `peer-focus-visible` ring utilities to the sibling visible custom element allows keyboard-navigating users to clearly see which input is focused without affecting mouse users.
**Action:** Always map peer-focus-visible rings and black background offset on visual siblings of hidden native input elements.
