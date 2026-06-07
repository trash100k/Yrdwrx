import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from './apiClient';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle JSON parse errors gracefully by throwing a readable error instead of crashing', async () => {
    const mockResponse = new Response('Invalid JSON payload {}<script>', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    // Pass retries=0 via config to prevent timeout
    await expect(ApiClient.get('http://localhost/api/test', { retries: 0 })).rejects.toThrow('Failed to parse JSON response');
  });
});
