## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-07-31 - [Custom Inputs and Keyboard Focus Visibility]
**Learning:** When custom UI inputs (such as Toggle switches or Checkbox controls) visually hide their native HTML `<input type="checkbox">` elements (e.g., via Tailwind's `sr-only` class), keyboard-only users lose visual focus feedback entirely.
**Action:** Always attach the `peer` class to the native visually hidden input element and apply high-contrast focus rings (`peer-focus-visible:ring-2 peer-focus-visible:ring-forest-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black`) to the custom styled container divs.
