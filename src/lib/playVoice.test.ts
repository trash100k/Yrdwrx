import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { playVoice } from './playVoice';

describe('playVoice', () => {
  let mockFetch: any;
  let mockConsoleError: any;

  // AudioContext mocks
  let mockCreateBuffer: any;
  let mockGetChannelData: any;
  let mockCreateBufferSource: any;
  let mockConnect: any;
  let mockStart: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup AudioContext mock methods
    mockGetChannelData = vi.fn().mockReturnValue(new Float32Array(10));
    mockCreateBuffer = vi.fn().mockReturnValue({
      getChannelData: mockGetChannelData
    });

    mockConnect = vi.fn();
    mockStart = vi.fn();
    mockCreateBufferSource = vi.fn().mockReturnValue({
      connect: mockConnect,
      start: mockStart,
      buffer: null
    });

    const MockAudioContext = function(this: any) {
      this.createBuffer = mockCreateBuffer;
      this.createBufferSource = mockCreateBufferSource;
      this.destination = 'mock-destination';
    };

    // Using defineProperty to mock window.AudioContext because stubGlobal doesn't seem to work with 'new' properly
    Object.defineProperty(window, 'AudioContext', { value: MockAudioContext, configurable: true, writable: true });

    // Mock atob
    vi.stubGlobal('atob', vi.fn().mockReturnValue('\x00\x01\x02\x03\x04')); // 5 bytes mock string
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (window as any).AudioContext;
  });

  it('should fetch and play voice data successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue({ audio: 'bW9jaw==' }) // 'mock' in base64
    });

    await playVoice('hello world');

    // 1. Verify fetch was called with correct parameters
    expect(mockFetch).toHaveBeenCalledWith('/api/agent/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello world' })
    });

    // 2. Verify AudioContext setup
    expect(mockCreateBuffer).toHaveBeenCalledWith(1, 2, 24000); // 5 bytes / 2 = 2 samples
    expect(mockGetChannelData).toHaveBeenCalledWith(0);

    // 3. Verify audio routing and playback
    expect(mockCreateBufferSource).toHaveBeenCalled();
    expect(mockConnect).toHaveBeenCalledWith('mock-destination');
    expect(mockStart).toHaveBeenCalled();

    // Ensure no errors logged
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  it('should handle response with no audio data gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue({}) // No 'audio' field
    });

    await playVoice('test');

    expect(mockFetch).toHaveBeenCalled();
    expect(mockCreateBuffer).not.toHaveBeenCalled();
    expect(mockCreateBufferSource).not.toHaveBeenCalled();
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  it('should catch and log errors during playback', async () => {
    const error = new Error('Network error');
    mockFetch.mockRejectedValueOnce(error);

    await playVoice('test');

    expect(mockConsoleError).toHaveBeenCalledWith('Voice playback failed', error);
  });

  it('should fallback to webkitAudioContext if AudioContext is not defined', async () => {
    // Remove AudioContext, and add webkitAudioContext
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('atob', vi.fn().mockReturnValue('\x00\x01'));

    // Mock webkitAudioContext specifically
    const MockWebkitAudioContext = function(this: any) {
      this.createBuffer = mockCreateBuffer;
      this.createBufferSource = mockCreateBufferSource;
      this.destination = 'mock-destination';
    };

    // Explicitly define webkitAudioContext on window
    Object.defineProperty(window, 'webkitAudioContext', { value: MockWebkitAudioContext, configurable: true, writable: true });
    // And ensure AudioContext is undefined
    Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true, writable: true });

    mockFetch.mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue({ audio: 'YmFzZTY0' })
    });

    await playVoice('hello again');

    expect(mockCreateBuffer).toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalled();

    // Restore window properties
    delete (window as any).webkitAudioContext;
  });
});
