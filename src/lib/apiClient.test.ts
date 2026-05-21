import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient, ApiError } from './apiClient';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('handleResponse', () => {
    // Testing happy path
    it('should return JSON for successful response', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      // @ts-ignore - testing private method
      const result = await ApiClient.handleResponse(mockResponse);
      expect(result).toEqual({ success: true });
    });

    // Testing 204 No Content
    it('should return empty object for 204 No Content', async () => {
      const mockResponse = new Response(null, { status: 204 });
      // @ts-ignore - testing private method
      const result = await ApiClient.handleResponse(mockResponse);
      expect(result).toEqual({});
    });

    // Testing parsing failure on successful response
    it('should return empty object if JSON parsing fails on successful response', async () => {
      const mockResponse = new Response('Invalid JSON', { status: 200 });
      // @ts-ignore - testing private method
      const result = await ApiClient.handleResponse(mockResponse);
      expect(result).toEqual({});
    });

    // Testing error responses with JSON payload
    it('should throw ApiError with message from error data', async () => {
      const mockResponse = new Response(JSON.stringify({ message: 'Custom error message' }), {
        status: 400,
        statusText: 'Bad Request',
      });

      try {
        // @ts-ignore
        await ApiClient.handleResponse(mockResponse);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe('Custom error message');
        expect((error as ApiError).status).toBe(400);
        expect((error as ApiError).data).toEqual({ message: 'Custom error message' });
      }
    });

    // Testing error responses without JSON payload
    it('should throw ApiError with statusText when JSON parsing fails for error response', async () => {
      const mockResponse = new Response('Not Found', {
        status: 404,
        statusText: 'Not Found',
      });

      try {
        // @ts-ignore
        await ApiClient.handleResponse(mockResponse);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe('Not Found');
        expect((error as ApiError).status).toBe(404);
        expect((error as ApiError).data).toEqual({ message: 'Not Found' });
      }
    });

    // Testing error responses with JSON payload but no message
    it('should throw ApiError with default message when error JSON has no message', async () => {
      const mockResponse = new Response(JSON.stringify({ otherField: 'value' }), {
        status: 500,
      });

      try {
        // @ts-ignore
        await ApiClient.handleResponse(mockResponse);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe('An API error occurred');
        expect((error as ApiError).status).toBe(500);
      }
    });
  });

  describe('request methods', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should make GET request correctly', async () => {
      const mockFetch = global.fetch as vi.Mock;
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: 'get' }), { status: 200 }));

      const result = await ApiClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/test'), expect.objectContaining({
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }));
      expect(result).toEqual({ data: 'get' });
    });

    it('should make POST request correctly', async () => {
      const mockFetch = global.fetch as vi.Mock;
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: 'post' }), { status: 200 }));

      const result = await ApiClient.post('/test', { name: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/test'), expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      }));
      expect(result).toEqual({ data: 'post' });
    });

    it('should implement retry logic for 5xx errors', async () => {
      const mockFetch = global.fetch as vi.Mock;
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: 'success' }), { status: 200 }));

      const result = await ApiClient.get('/test', { retries: 1 });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: 'success' });
    });

    it('should not retry for 4xx errors', async () => {
      const mockFetch = global.fetch as vi.Mock;
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Bad request' }), { status: 400 }));

      try {
        await ApiClient.get('/test', { retries: 2 });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(400);
      }
    });
  });
});
