import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRole } from './useRole';
import { safeStorage } from '../lib/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';

// Mock dependencies
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('../lib/storage', () => ({
  safeStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe('useRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should start with loading true and role null', () => {
    // Mock onAuthStateChanged to do nothing initially
    (onAuthStateChanged as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => vi.fn());

    const { result } = renderHook(() => useRole());

    expect(result.current.loadingRole).toBe(true);
    expect(result.current.role).toBe(null);
  });

  it('should set role to owner if unauthenticated and demo mode is active', () => {
    (safeStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('active');

    (onAuthStateChanged as unknown as ReturnType<typeof vi.fn>).mockImplementation((auth, callback) => {
      // Simulate unauthenticated
      callback(null);
      return vi.fn(); // Return unsubscribe function
    });

    const { result } = renderHook(() => useRole());

    expect(result.current.loadingRole).toBe(false);
    expect(result.current.role).toBe('owner');
  });

  it('should set role to null if unauthenticated and demo mode is inactive', () => {
    (safeStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

    (onAuthStateChanged as unknown as ReturnType<typeof vi.fn>).mockImplementation((auth, callback) => {
      // Simulate unauthenticated
      callback(null);
      return vi.fn(); // Return unsubscribe function
    });

    const { result } = renderHook(() => useRole());

    expect(result.current.loadingRole).toBe(false);
    expect(result.current.role).toBe(null);
  });

  it('should set role to data.role if authenticated and doc exists', () => {
    const mockUser = { uid: 'user123' };

    (onAuthStateChanged as unknown as ReturnType<typeof vi.fn>).mockImplementation((auth, callback) => {
      // Simulate authenticated
      callback(mockUser);
      return vi.fn(); // unsubAuth
    });

    (onSnapshot as unknown as ReturnType<typeof vi.fn>).mockImplementation((docRef, callback) => {
      // Simulate snapshot exists
      callback({
        exists: () => true,
        data: () => ({ role: 'admin' }),
      });
      return vi.fn(); // unsubDoc
    });

    const { result } = renderHook(() => useRole());

    expect(result.current.loadingRole).toBe(false);
    expect(result.current.role).toBe('admin');
  });

  it('should set role to client (fallback) if authenticated but doc does not exist', () => {
    const mockUser = { uid: 'user123' };

    (onAuthStateChanged as unknown as ReturnType<typeof vi.fn>).mockImplementation((auth, callback) => {
      // Simulate authenticated
      callback(mockUser);
      return vi.fn(); // unsubAuth
    });

    (onSnapshot as unknown as ReturnType<typeof vi.fn>).mockImplementation((docRef, callback) => {
      // Simulate snapshot does not exist
      callback({
        exists: () => false,
      });
      return vi.fn(); // unsubDoc
    });

    const { result } = renderHook(() => useRole());

    expect(result.current.loadingRole).toBe(false);
    expect(result.current.role).toBe('client');
  });

  describe('hasPermission', () => {
    it('should return false if role is null', () => {
      (safeStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (onAuthStateChanged as unknown as ReturnType<typeof vi.fn>).mockImplementation((auth, callback) => {
        callback(null);
        return vi.fn();
      });

      const { result } = renderHook(() => useRole());
      expect(result.current.hasPermission('client')).toBe(false);
    });

    it('should correctly evaluate permissions based on hierarchy', () => {
      (onAuthStateChanged as unknown as ReturnType<typeof vi.fn>).mockImplementation((auth, callback) => {
        callback({ uid: 'user123' });
        return vi.fn();
      });

      (onSnapshot as unknown as ReturnType<typeof vi.fn>).mockImplementation((docRef, callback) => {
        callback({
          exists: () => true,
          data: () => ({ role: 'admin' }),
        });
        return vi.fn();
      });

      const { result } = renderHook(() => useRole());

      // admin has role 4
      expect(result.current.hasPermission('owner')).toBe(false); // owner is 5
      expect(result.current.hasPermission('admin')).toBe(true); // admin is 4
      expect(result.current.hasPermission('foreman')).toBe(true); // foreman is 3
      expect(result.current.hasPermission('employee')).toBe(true); // employee is 2
      expect(result.current.hasPermission('client')).toBe(true); // client is 1
    });
  });
});
