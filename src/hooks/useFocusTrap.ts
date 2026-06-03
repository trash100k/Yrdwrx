// @ts-nocheck
import { useEffect, useRef, MutableRefObject } from 'react';

export function useFocusTrap<T extends HTMLElement>(isActive: boolean): MutableRefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!isActive) return;
    const container = ref.current;
    if (!container) return;

    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable]'
    ].join(',');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelectors)
      ).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement || document.activeElement === container) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement || document.activeElement === container) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    
    // Auto focus first input if nothing is focused inside container
    if (!container.contains(document.activeElement)) {
       const initialFocusable = Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors))
          .find(el => el.offsetWidth > 0 || el.offsetHeight > 0);
       if (initialFocusable) {
         requestAnimationFrame(() => {
            if (container.contains(document.activeElement)) return;
            initialFocusable.focus()
         });
       }
    }

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);

  return ref;
}
