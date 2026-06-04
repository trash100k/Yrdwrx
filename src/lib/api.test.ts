import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchApi } from './api';
import { auth } from './firebase';

vi.mock('./firebase', () => ({
  auth: {
    currentUser: null,
  }
}));

describe('fetchApi', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(new Response());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    auth.currentUser = null;
  });

  it('should pass token in x-firebase-auth header when authenticated', async () => {
    const mockToken = 'mock-jwt-token';
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue(mockToken)
    } as any;

    await fetchApi('/api/test');

    expect(global.fetch).toHaveBeenCalledWith('/api/test', {
      headers: {
        'x-firebase-auth': `Bearer ${mockToken}`
      }
    });
  });

  it('should handle auth.currentUser.getIdToken rejection', async () => {
    const error = new Error('Token error');
    auth.currentUser = {
      getIdToken: vi.fn().mockRejectedValue(error)
    } as any;

    await fetchApi('/api/test');

    expect(console.error).toHaveBeenCalledWith('Failed to get auth token for fetch', error);
    // Should still proceed to fetch, just without the auth header
    expect(global.fetch).toHaveBeenCalledWith('/api/test', {});
  });
});
