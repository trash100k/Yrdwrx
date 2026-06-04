import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from './apiClient';
import { fetchApi } from './api';

// Mock dependencies
vi.mock('./api', () => ({
  fetchApi: vi.fn(),
}));

vi.mock('./firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

describe('ApiClient JSON Parse Error Fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return an empty object when response.json() throws a parsing error', async () => {
    // Create a mock Response that resolves ok but has a malformed body
    const mockResponse = new Response('malformed json body', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    vi.mocked(fetchApi).mockResolvedValue(mockResponse);

    const result = await ApiClient.get('/test-endpoint');

    expect(fetchApi).toHaveBeenCalledTimes(1);
    expect(result).toEqual({});
  });
});
