import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTranslate } from './useTranslate';
import { fetchApi } from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchApi: vi.fn(),
}));

describe('useTranslate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('bypasses translation if target language is english, null, or text is empty', () => {
    const { result, rerender } = renderHook(
      ({ text, targetLanguage }) => useTranslate(text, targetLanguage as string | null),
      { initialProps: { text: 'Hello', targetLanguage: 'en' as string | null } }
    );

    expect(result.current.translatedText).toBe('Hello');
    expect(result.current.isTranslating).toBe(false);
    expect(fetchApi).not.toHaveBeenCalled();

    rerender({ text: 'Hello', targetLanguage: null });
    expect(result.current.translatedText).toBe('Hello');
    expect(fetchApi).not.toHaveBeenCalled();

    rerender({ text: '', targetLanguage: 'es' });
    expect(result.current.translatedText).toBe('');
    expect(fetchApi).not.toHaveBeenCalled();
  });

  it('translates text successfully', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchApi).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ translatedText: 'Hola' }),
    } as any);

    const { result } = renderHook(() => useTranslate('Hello', 'es', 'context'));

    expect(result.current.translatedText).toBe('Hello');
    expect(result.current.isTranslating).toBe(false);

    // Using act for state changes that happen inside timeouts
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Crucial: since fetch Api resolves promises we also have to clear the microtask queue
    // after timers trigger the async function so react state gets updated.
    // wait for is async so we have to use real timers for it to work.
    vi.useRealTimers();

    await waitFor(() => {
      expect(result.current.translatedText).toBe('Hola');
    });

    expect(result.current.isTranslating).toBe(false);
    expect(fetchApi).toHaveBeenCalledTimes(1);
    expect(fetchApi).toHaveBeenCalledWith('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello', targetLanguage: 'es', sourceContext: 'context' }),
    });
  });

  it('uses cached translation on subsequent requests', async () => {
    vi.useFakeTimers();
    const uniqueText = 'Cache test string';
    vi.mocked(fetchApi).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ translatedText: 'Cache test traducido' }),
    } as any);

    const { result, unmount } = renderHook(() => useTranslate(uniqueText, 'es'));

    act(() => {
      vi.advanceTimersByTime(300);
    });

    vi.useRealTimers();

    await waitFor(() => {
      expect(result.current.translatedText).toBe('Cache test traducido');
    });

    expect(fetchApi).toHaveBeenCalledTimes(1);
    unmount();

    // Render again with the same unique text
    const { result: result2 } = renderHook(() => useTranslate(uniqueText, 'es'));

    // It should immediately return the cached translated text without waiting 300ms
    expect(result2.current.translatedText).toBe('Cache test traducido');

    // And fetch should still only be called once
    expect(fetchApi).toHaveBeenCalledTimes(1);
  });

  it('falls back to original text on API failure', async () => {
    vi.useFakeTimers();
    // First call succeeds
    vi.mocked(fetchApi).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ translatedText: 'Succès' }),
    } as any);

    const { result, rerender } = renderHook(
      ({ text }) => useTranslate(text, 'fr'),
      { initialProps: { text: 'Success test' } }
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(result.current.translatedText).toBe('Succès');
    });

    // Now fail the next API call
    vi.useFakeTimers();
    vi.mocked(fetchApi).mockResolvedValueOnce({
      ok: false,
    } as any);

    rerender({ text: 'Fail test' });

    act(() => {
      vi.advanceTimersByTime(300);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(result.current.isTranslating).toBe(false);
    });

    expect(result.current.translatedText).toBe('Fail test');
    expect(fetchApi).toHaveBeenCalledTimes(2);
  });

  it('falls back to original text on thrown error', async () => {
    vi.useFakeTimers();
    // First call succeeds
    vi.mocked(fetchApi).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ translatedText: 'Erfolg' }),
    } as any);

    const { result, rerender } = renderHook(
      ({ text }) => useTranslate(text, 'de'),
      { initialProps: { text: 'Success test' } }
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(result.current.translatedText).toBe('Erfolg');
    });

    // Now throw an error on the next API call
    vi.useFakeTimers();
    // We intentionally mock a rejection that we expect to be caught internally.
    // Suppress console.error in this specific test to avoid noise.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(fetchApi).mockRejectedValueOnce(new Error('Network error'));

    rerender({ text: 'Throw test' });

    act(() => {
      vi.advanceTimersByTime(300);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(result.current.isTranslating).toBe(false);
    });

    expect(result.current.translatedText).toBe('Throw test');
    expect(fetchApi).toHaveBeenCalledTimes(2);

    consoleErrorSpy.mockRestore();
  });

  it('debounces rapid changes', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchApi).mockResolvedValue({
      ok: true,
      json: async () => ({ translatedText: 'Debounced response' }),
    } as any);

    const { result, rerender } = renderHook(
      ({ text }) => useTranslate(text, 'it'),
      { initialProps: { text: 'A' } }
    );

    // Change quickly before 300ms expires
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ text: 'AB' });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ text: 'ABC' });

    // Now let it expire
    act(() => {
      vi.advanceTimersByTime(300);
    });

    vi.useRealTimers();

    await waitFor(() => {
      expect(result.current.translatedText).toBe('Debounced response');
    });

    expect(fetchApi).toHaveBeenCalledTimes(1);
    expect(fetchApi).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"text":"ABC"'),
      })
    );
  });
});
