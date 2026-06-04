import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchApi } from './api';
import { auth } from './firebase';

// Mock the firebase auth module
vi.mock('./firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('fetchApi', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Default auth mock state
    auth.currentUser = null;

    // Mock window.location for testing host-specific logic
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      host: 'example.com',
    } as Location;

    // Default fetch response
    mockFetch.mockResolvedValue(new Response('OK'));

    // Suppress console.error in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore window.location
    window.location = originalLocation;
    vi.restoreAllMocks();
  });

  it('should call fetch with original arguments if url does not contain /api/', async () => {
    await fetchApi('https://example.com/other-path');
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/other-path', {});
  });

  it('should call fetch without auth header if url is /api/ but no current user exists', async () => {
    await fetchApi('/api/data');
    expect(mockFetch).toHaveBeenCalledWith('/api/data', {});
  });

  it('should add auth header if url is /api/ and current user exists', async () => {
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('test-token'),
    } as any;

    await fetchApi('/api/data');

    expect(auth.currentUser.getIdToken).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith('/api/data', {
      headers: {
        'x-firebase-auth': 'Bearer test-token',
      },
    });
  });

  it('should add auth header if url contains window.location.host + /api/', async () => {
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('test-token'),
    } as any;

    await fetchApi('https://example.com/api/data');

    expect(auth.currentUser.getIdToken).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/api/data', {
      headers: {
        'x-firebase-auth': 'Bearer test-token',
      },
    });
  });

  it('should preserve existing headers when adding the auth header', async () => {
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('test-token'),
    } as any;

    const initialHeaders = { 'Content-Type': 'application/json' };
    await fetchApi('/api/data', { headers: initialHeaders });

    expect(mockFetch).toHaveBeenCalledWith('/api/data', {
      headers: {
        'Content-Type': 'application/json',
        'x-firebase-auth': 'Bearer test-token',
      },
    });
  });

  it('should handle failure to get auth token gracefully and proceed with fetch without token', async () => {
    auth.currentUser = {
      getIdToken: vi.fn().mockRejectedValue(new Error('Token error')),
    } as any;

    await fetchApi('/api/data');

    expect(console.error).toHaveBeenCalledWith('Failed to get auth token for fetch', expect.any(Error));
    expect(mockFetch).toHaveBeenCalledWith('/api/data', {}); // Proceeded without adding header
  });

  it('should handle different input types: string', async () => {
    await fetchApi('/non-api-path');
    expect(mockFetch).toHaveBeenCalledWith('/non-api-path', {});
  });

  it('should handle different input types: URL object', async () => {
    const url = new URL('https://example.com/non-api-path');
    await fetchApi(url);
    expect(mockFetch).toHaveBeenCalledWith(url, {});
  });

  it('should handle different input types: Request object', async () => {
    const request = new Request('https://example.com/non-api-path');
    await fetchApi(request);
    expect(mockFetch).toHaveBeenCalledWith(request, {});
  });

  it('should handle Request object with /api/ and add auth header', async () => {
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('test-token'),
    } as any;

    const request = new Request('https://example.com/api/data');
    await fetchApi(request);

    expect(mockFetch).toHaveBeenCalledWith(request, {
      headers: {
        'x-firebase-auth': 'Bearer test-token',
      },
    });
  });
});
