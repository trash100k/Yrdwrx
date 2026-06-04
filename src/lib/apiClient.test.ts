import { describe, it, expect } from 'vitest';
import { ApiClient, ApiError } from './apiClient';

describe('ApiClient.handleResponse', () => {
  const handleResponse = (ApiClient as any).handleResponse.bind(ApiClient);

  it('should return parsed JSON when response is ok', async () => {
    const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await handleResponse(mockResponse);
    expect(result).toEqual({ data: 'test' });
  });

  it('should return empty object when status is 204 No Content', async () => {
    const mockResponse = new Response(null, {
      status: 204
    });
    const result = await handleResponse(mockResponse);
    expect(result).toEqual({});
  });

  it('should return empty object if response is ok but JSON is invalid', async () => {
    const mockResponse = new Response('invalid json', {
      status: 200
    });
    const result = await handleResponse(mockResponse);
    expect(result).toEqual({});
  });

  it('should throw ApiError with JSON message when response is not ok', async () => {
    const mockResponse = new Response(JSON.stringify({ message: 'Custom error' }), {
      status: 400
    });

    await expect(handleResponse(mockResponse)).rejects.toMatchObject({
      message: 'Custom error',
      status: 400,
      data: { message: 'Custom error' }
    });
  });

  it('should throw ApiError with fallback message when response is not ok and JSON has no message', async () => {
    const mockResponse = new Response(JSON.stringify({ other: 'data' }), {
      status: 500
    });

    await expect(handleResponse(mockResponse)).rejects.toMatchObject({
      message: 'An API error occurred',
      status: 500,
      data: { other: 'data' }
    });
  });

  it('should throw ApiError using statusText when response is not ok and body is invalid JSON', async () => {
    const mockResponse = new Response('Bad Gateway', {
      status: 502,
      statusText: 'Bad Gateway'
    });

    await expect(handleResponse(mockResponse)).rejects.toMatchObject({
      message: 'Bad Gateway',
      status: 502,
      data: { message: 'Bad Gateway' }
    });
  });

});
