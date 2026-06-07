import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should handle storage access errors gracefully and fall back to initial value', () => {
    // Simulate quota exceeded or private mode restricting localStorage
    const spy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Access denied');
    });

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));
    expect(result.current[0]).toBe('initial-value');

    // Make sure we can still set state in-memory
    act(() => {
      result.current[1]('new-value');
    });
    expect(result.current[0]).toBe('new-value');

    spy.mockRestore();
  });
});
