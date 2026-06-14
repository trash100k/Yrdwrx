import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeStorage } from './storage';

describe('SafeStorage', () => {
  let originalLocalStorage: Storage;

  beforeEach(() => {
    originalLocalStorage = window.localStorage;
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  describe('isSupported property', () => {
    let originalLocalStorage2: Storage;

    beforeEach(() => {
      originalLocalStorage2 = window.localStorage;
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage2,
        writable: true,
        configurable: true,
      });
    });

    it('returns false when window is undefined', () => {
      vi.stubGlobal('window', undefined);
      expect((safeStorage as any).isSupported).toBe(false);
    });

    it('returns false when localStorage.setItem throws an error', () => {
      const mockLocalStorage = {
        setItem: vi.fn(() => {
          throw new Error('QuotaExceededError');
        }),
        removeItem: vi.fn(),
      } as unknown as Storage;

      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
        configurable: true,
      });

      expect((safeStorage as any).isSupported).toBe(false);
    });

    it('returns true when localStorage is supported and works', () => {
      const mockLocalStorage = {
        setItem: vi.fn(),
        removeItem: vi.fn(),
      } as unknown as Storage;

      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
        configurable: true,
      });

      expect((safeStorage as any).isSupported).toBe(true);
    });
  });

  describe('when localStorage is fully supported', () => {
    beforeEach(() => {
      const store: Record<string, string> = {};
      const mockLocalStorage = {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value.toString();
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key];
        }),
        clear: vi.fn(() => {
          for (const key in store) {
            delete store[key];
          }
        }),
        key: vi.fn(),
        length: 0,
      } as unknown as Storage;

      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
        configurable: true,
      });
    });

    it('should store and retrieve items using localStorage', () => {
      safeStorage.setItem('test-key-1', 'test-value-1');
      expect(window.localStorage.setItem).toHaveBeenCalledWith('test-key-1', 'test-value-1');
      expect(window.localStorage.setItem).toHaveBeenCalledWith('__test__', '__test__');

      const value = safeStorage.getItem('test-key-1');
      expect(window.localStorage.getItem).toHaveBeenCalledWith('test-key-1');
      expect(value).toBe('test-value-1');
    });

    it('should remove items from localStorage', () => {
      safeStorage.setItem('test-key-2', 'test-value-2');
      safeStorage.removeItem('test-key-2');

      expect(window.localStorage.removeItem).toHaveBeenCalledWith('test-key-2');
      expect(safeStorage.getItem('test-key-2')).toBeNull();
    });
  });

  describe('when localStorage throws an error on setItem (e.g., QuotaExceededError)', () => {
    beforeEach(() => {

      const mockLocalStorage = {
        getItem: vi.fn(),
        setItem: vi.fn((key: string) => {
          throw new Error('QuotaExceededError');
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(),
        length: 0,
      } as unknown as Storage;

      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
        configurable: true,
      });
    });

    it('should fall back to memory fallback for storing and retrieving items', () => {
      safeStorage.setItem('fallback-key-1', 'fallback-value-1');

      const value = safeStorage.getItem('fallback-key-1');
      expect(value).toBe('fallback-value-1');
    });

    it('should fall back to memory fallback for removing items', () => {
      safeStorage.setItem('fallback-key-2', 'fallback-value-2');
      safeStorage.removeItem('fallback-key-2');

      const value = safeStorage.getItem('fallback-key-2');
      expect(value).toBeNull();
    });
  });

  describe('when localStorage access is completely denied (throws on property access)', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('Access is denied for this document.');
        },
        configurable: true,
      });
    });

    it('should seamlessly use memory fallback', () => {
      safeStorage.setItem('denied-key-1', 'denied-value-1');
      expect(safeStorage.getItem('denied-key-1')).toBe('denied-value-1');

      safeStorage.removeItem('denied-key-1');
      expect(safeStorage.getItem('denied-key-1')).toBeNull();
    });
  });
});
