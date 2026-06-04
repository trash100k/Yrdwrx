import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLocalStorage } from './useLocalStorage';
import { safeStorage } from '../lib/storage';

vi.mock('../lib/storage', () => ({
  safeStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

describe('useLocalStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear console mocks
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should return initial value when window is defined but localStorage has no value', () => {
    vi.mocked(safeStorage.getItem).mockReturnValueOnce(null);

    const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

    expect(result.current[0]).toBe('initial');
    expect(safeStorage.getItem).toHaveBeenCalledWith('testKey');
  });

  it('should return parsed value when localStorage has a valid JSON string', () => {
    vi.mocked(safeStorage.getItem).mockReturnValueOnce(JSON.stringify('stored'));

    const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

    expect(result.current[0]).toBe('stored');
    expect(safeStorage.getItem).toHaveBeenCalledWith('testKey');
  });

  it('should fallback to initial value and log warning when getItem throws an error', () => {
    const error = new Error('Storage error');
    vi.mocked(safeStorage.getItem).mockImplementationOnce(() => {
      throw error;
    });

    const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

    expect(result.current[0]).toBe('initial');
    expect(safeStorage.getItem).toHaveBeenCalledWith('testKey');
    expect(console.warn).toHaveBeenCalledWith('Error reading localStorage key "testKey":', error);
  });

  it('should update value and call setItem when setter is called', () => {
    vi.mocked(safeStorage.getItem).mockReturnValueOnce(null);

    const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

    act(() => {
      result.current[1]('new value');
    });

    expect(result.current[0]).toBe('new value');
    expect(safeStorage.setItem).toHaveBeenCalledWith('testKey', JSON.stringify('new value'));
  });

  it('should update value with callback and call setItem when setter is called with function', () => {
    vi.mocked(safeStorage.getItem).mockReturnValueOnce(JSON.stringify(10));

    const { result } = renderHook(() => useLocalStorage('testKey', 10));

    act(() => {
      result.current[1]((prev) => prev + 5);
    });

    expect(result.current[0]).toBe(15);
    expect(safeStorage.setItem).toHaveBeenCalledWith('testKey', JSON.stringify(15));
  });

  it('should catch error and log warning when setItem throws an error', () => {
    vi.mocked(safeStorage.getItem).mockReturnValueOnce(null);
    const error = new Error('Set error');
    vi.mocked(safeStorage.setItem).mockImplementationOnce(() => {
      throw error;
    });

    const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

    act(() => {
      result.current[1]('new value');
    });

    expect(result.current[0]).toBe('new value');
    expect(safeStorage.setItem).toHaveBeenCalledWith('testKey', JSON.stringify('new value'));
    expect(console.warn).toHaveBeenCalledWith('Error setting localStorage key "testKey":', error);
  });
});
