## 2025-05-15 - [Keyboard Navigation Optimization & Safety]
**Learning:** When implementing keyboard navigation with the modulo operator (e.g., `setSelectedIndex((prev + 1) % list.length)`), always verify the list is not empty to avoid setting state to `NaN`. Additionally, memoizing filtered lists with `useMemo` is critical when those lists are dependencies for global event listener `useEffect` hooks, as it prevents unnecessary listener churn and improves performance.
**Action:** Always include a length check before modulo operations in navigation logic and use `useMemo` for any derived data used in hook dependency arrays.

## 2026-07-24 - [Semantic Access & Layout Alignment for Nested Buttons]
**Learning:** Converting interactive containers (like search triggers and user menus) to native `<button>` elements is essential for keyboard navigation and screen-reader accessibility. When refactoring these containers, raw block-level tags (like `div` or `p`) nested inside the button must be changed to inline or inline-block elements (`span`) to conform with valid HTML structure, and standard block attributes must be replaced with inline layouts to ensure proper flex alignment and avoid text-wrapping issues.
**Action:** Avoid nesting `div` or `p` tags inside `<button>`. Use flex-aligned `span` tags with appropriate styling blocks (like `block`) instead.
