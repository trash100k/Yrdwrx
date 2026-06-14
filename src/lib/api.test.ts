import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchApi } from './api';
import { auth } from './firebase';

// Mock the firebase module
vi.mock('./firebase', () => {
  return {
    auth: {
      currentUser: null,
    },
  };
});

describe('fetchApi', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    // Save original fetch and mock it
    originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(new Response('ok'));

    // Reset mocks
    vi.clearAllMocks();

    // Set a predictable host for testing location matches
    Object.defineProperty(window, 'location', {
      value: { host: 'localhost:3000' },
      writable: true,
    });
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  it('should call fetch without modifications for non-api URLs', async () => {
    Object.defineProperty(auth, 'currentUser', {
      value: {
        getIdToken: vi.fn().mockResolvedValue('mock-token'),
      },
      configurable: true
    });

    await fetchApi('https://example.com/data');

    expect(global.fetch).toHaveBeenCalledWith('https://example.com/data', {});
    expect(auth.currentUser?.getIdToken).not.toHaveBeenCalled();
  });

  it('should not add auth header for api URLs if user is not authenticated', async () => {
    Object.defineProperty(auth, 'currentUser', {
      value: null,
      configurable: true
    });

    await fetchApi('/api/data');

    expect(global.fetch).toHaveBeenCalledWith('/api/data', {});
  });

  it('should add auth header for relative api URLs if user is authenticated', async () => {
    Object.defineProperty(auth, 'currentUser', {
      value: {
        getIdToken: vi.fn().mockResolvedValue('mock-token'),
      },
      configurable: true
    });

    await fetchApi('/api/data', { method: 'POST' });

    expect(global.fetch).toHaveBeenCalledWith('/api/data', {
      method: 'POST',
      headers: {
        'x-firebase-auth': 'Bearer mock-token',
      },
    });
  });

  it('should handle URL objects properly', async () => {
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('mock-token'),
    } as any;

    const url = new URL('http://localhost:3000/api/data');

    await fetchApi(url);

    expect(global.fetch).toHaveBeenCalledWith(url, {
      headers: {
        'x-firebase-auth': 'Bearer mock-token',
      },
    });
  });

  it('should add auth header for absolute api URLs matching the host if user is authenticated', async () => {
    Object.defineProperty(auth, 'currentUser', {
      value: {
        getIdToken: vi.fn().mockResolvedValue('mock-token'),
      },
      configurable: true
    });

    await fetchApi('http://localhost:3000/api/data');

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/data', {
      headers: {
        'x-firebase-auth': 'Bearer mock-token',
      },
    });
  });

  it('should handle Request objects properly (using absolute URL)', async () => {
    Object.defineProperty(auth, 'currentUser', {
      value: {
        getIdToken: vi.fn().mockResolvedValue('mock-token'),
      },
      configurable: true
    });

    // Use absolute URL for Request object as required in Vitest jsdom
    const req = new Request('http://localhost:3000/api/data', { method: 'GET' });

    await fetchApi(req);

    expect(global.fetch).toHaveBeenCalledWith(req, {
      headers: {
        'x-firebase-auth': 'Bearer mock-token',
      },
    });
  });

  it('should gracefully handle errors when getting the auth token', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    Object.defineProperty(auth, 'currentUser', {
      value: {
        getIdToken: vi.fn().mockRejectedValue(new Error('Token fetch failed')),
      },
      configurable: true
    });

    await fetchApi('/api/data');

    expect(consoleSpy).toHaveBeenCalledWith('Failed to get auth token for fetch', expect.any(Error));
    expect(global.fetch).toHaveBeenCalledWith('/api/data', {}); // Fetches without the header

    consoleSpy.mockRestore();
  });

  it('should execute error path completely when auth.currentUser.getIdToken rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    auth.currentUser = {
      getIdToken: vi.fn().mockRejectedValue(new Error('Simulated rejection for error path')),
    } as any;

    await fetchApi('/api/data', { headers: { 'X-Custom-Header': 'value' } });

    expect(consoleSpy).toHaveBeenCalledWith('Failed to get auth token for fetch', expect.any(Error));
    expect(global.fetch).toHaveBeenCalledWith('/api/data', { headers: { 'X-Custom-Header': 'value' } });

    consoleSpy.mockRestore();
  });

  it('should preserve existing headers when adding the auth token', async () => {
    Object.defineProperty(auth, 'currentUser', {
      value: {
        getIdToken: vi.fn().mockResolvedValue('mock-token'),
      },
      configurable: true
    });

    await fetchApi('/api/data', {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/data', {
      headers: {
        'Content-Type': 'application/json',
        'x-firebase-auth': 'Bearer mock-token',
      },
    });
  });
});
