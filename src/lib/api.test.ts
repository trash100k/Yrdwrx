import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchApi } from './api';
import { auth } from './firebase';

vi.mock('./firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

describe('fetchApi', () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();
  let originalConsoleError: any;
  let mockConsoleError: any;

  beforeEach(() => {
    global.fetch = mockFetch;
    originalConsoleError = console.error;
    mockConsoleError = vi.fn();
    console.error = mockConsoleError;
    mockFetch.mockClear();
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ data: 'ok' }), { status: 200 }));
    vi.mocked(auth).currentUser = null;

    // Set a predictable window location for the tests
    Object.defineProperty(window, 'location', {
      value: {
        host: 'example.com',
      },
      writable: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  it('should call fetch with unchanged input and init for non-API route', async () => {
    await fetchApi('https://example.com/external');
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/external', {});
  });

  it('should call fetch with unchanged input and init for non-API route when auth exists', async () => {
    vi.mocked(auth).currentUser = {
      getIdToken: vi.fn().mockResolvedValue('test-token'),
    } as any;

    await fetchApi('https://example.com/external', { method: 'POST' });
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/external', { method: 'POST' });
  });

  it('should not add auth header for API route if user is not authenticated', async () => {
    await fetchApi('/api/data');
    expect(mockFetch).toHaveBeenCalledWith('/api/data', {});
  });

  it('should add auth header for API route starting with /api/ when user is authenticated', async () => {
    vi.mocked(auth).currentUser = {
      getIdToken: vi.fn().mockResolvedValue('test-token-123'),
    } as any;

    await fetchApi('/api/secure-data');

    expect(mockFetch).toHaveBeenCalledWith('/api/secure-data', {
      headers: {
        'x-firebase-auth': 'Bearer test-token-123',
      },
    });
  });

  it('should add auth header for absolute API route containing host + /api/ when user is authenticated', async () => {
    vi.mocked(auth).currentUser = {
      getIdToken: vi.fn().mockResolvedValue('test-token-456'),
    } as any;

    await fetchApi('https://example.com/api/secure-data');

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/api/secure-data', {
      headers: {
        'x-firebase-auth': 'Bearer test-token-456',
      },
    });
  });

  it('should preserve existing headers when adding auth header', async () => {
    vi.mocked(auth).currentUser = {
      getIdToken: vi.fn().mockResolvedValue('test-token-789'),
    } as any;

    await fetchApi('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom': 'Value',
      },
      body: JSON.stringify({ key: 'value' }),
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom': 'Value',
        'x-firebase-auth': 'Bearer test-token-789',
      },
      body: '{"key":"value"}',
    });
  });

  it('should handle getIdToken failure gracefully and continue with original fetch', async () => {
    const error = new Error('Token fetch failed');
    vi.mocked(auth).currentUser = {
      getIdToken: vi.fn().mockRejectedValue(error),
    } as any;

    await fetchApi('/api/data', { headers: { 'Existing': 'Header' } });

    expect(mockConsoleError).toHaveBeenCalledWith('Failed to get auth token for fetch', error);
    expect(mockFetch).toHaveBeenCalledWith('/api/data', { headers: { 'Existing': 'Header' } });
  });

  it('should handle Request object input', async () => {
    // jsdom Request requires absolute URL
    const request = new Request('http://example.com/api/data', { method: 'GET' });
    vi.mocked(auth).currentUser = {
      getIdToken: vi.fn().mockResolvedValue('token-req'),
    } as any;

    await fetchApi(request);

    expect(mockFetch).toHaveBeenCalledWith(request, {
      headers: {
        'x-firebase-auth': 'Bearer token-req',
      },
    });
  });

  it('should handle URL object input', async () => {
    const url = new URL('https://example.com/api/data');
    vi.mocked(auth).currentUser = {
      getIdToken: vi.fn().mockResolvedValue('token-url'),
    } as any;

    await fetchApi(url);

    expect(mockFetch).toHaveBeenCalledWith(url, {
      headers: {
        'x-firebase-auth': 'Bearer token-url',
      },
    });
  });
});
