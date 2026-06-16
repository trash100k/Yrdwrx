import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compressImage } from './imageUtils';

describe('compressImage', () => {
    let mockFileReader: any;
    let mockImage: any;
    let mockCanvas: any;
    let mockContext: any;

    beforeEach(() => {
        // Mock FileReader
        mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            onerror: null as any,
            result: 'data:image/png;base64,mock-data',
        };
        vi.stubGlobal('FileReader', function() { return mockFileReader; });

        // Mock Image
        mockImage = {
            onload: null as any,
            onerror: null as any,
            src: '',
            width: 2000,
            height: 1000,
        };
        vi.stubGlobal('Image', function() { return mockImage; });

        // Mock Canvas & Context
        mockContext = {
            drawImage: vi.fn(),
        };
        mockCanvas = {
            getContext: vi.fn(() => mockContext),
            toDataURL: vi.fn(() => 'data:image/jpeg;base64,compressed-data'),
            width: 0,
            height: 0,
        };

        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
            if (tagName === 'canvas') {
                return mockCanvas as any;
            }
            return originalCreateElement(tagName);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('successfully compresses an image and scales width down', async () => {
        const file = new File([''], 'test.png', { type: 'image/png' });

        const promise = compressImage(file, 1200, 1200, 0.8);

        // Trigger FileReader onload
        mockFileReader.onload({ target: { result: mockFileReader.result } });

        // Trigger Image onload
        mockImage.onload();

        const result = await promise;

        expect(result).toBe('data:image/jpeg;base64,compressed-data');
        expect(mockCanvas.width).toBe(1200); // 2000 scaled to 1200
        expect(mockCanvas.height).toBe(600); // 1000 scaled proportionally
        expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
        expect(mockContext.drawImage).toHaveBeenCalledWith(mockImage, 0, 0, 1200, 600);
    });

    it('successfully compresses an image and scales height down', async () => {
        mockImage.width = 1000;
        mockImage.height = 2000;
        const file = new File([''], 'test.png', { type: 'image/png' });

        const promise = compressImage(file, 1200, 1200, 0.8);

        mockFileReader.onload({ target: { result: mockFileReader.result } });
        mockImage.onload();

        const result = await promise;

        expect(result).toBe('data:image/jpeg;base64,compressed-data');
        expect(mockCanvas.width).toBe(600); // 1000 scaled proportionally
        expect(mockCanvas.height).toBe(1200); // 2000 scaled to 1200
    });

    it('does not scale if image is smaller than max dimensions', async () => {
        mockImage.width = 800;
        mockImage.height = 600;
        const file = new File([''], 'test.png', { type: 'image/png' });

        const promise = compressImage(file, 1200, 1200, 0.8);

        mockFileReader.onload({ target: { result: mockFileReader.result } });
        mockImage.onload();

        const result = await promise;

        expect(result).toBe('data:image/jpeg;base64,compressed-data');
        expect(mockCanvas.width).toBe(800);
        expect(mockCanvas.height).toBe(600);
    });

    it('rejects if FileReader fails to read file', async () => {
        const file = new File([''], 'test.png', { type: 'image/png' });

        const promise = compressImage(file);

        mockFileReader.onerror();

        await expect(promise).rejects.toThrow('Failed to read file');
    });

    it('rejects if reader result is empty', async () => {
        const file = new File([''], 'test.png', { type: 'image/png' });

        const promise = compressImage(file);

        mockFileReader.onload({ target: { result: null } });

        await expect(promise).rejects.toThrow('Empty reader result');
    });

    it('rejects if Image fails to load', async () => {
        const file = new File([''], 'test.png', { type: 'image/png' });

        const promise = compressImage(file);

        mockFileReader.onload({ target: { result: mockFileReader.result } });
        mockImage.onerror();

        await expect(promise).rejects.toThrow('Failed to load image for compression');
    });

    it('resolves with rawDataUrl if canvas getContext returns null', async () => {
        mockCanvas.getContext.mockReturnValue(null);
        const file = new File([''], 'test.png', { type: 'image/png' });

        const promise = compressImage(file);

        mockFileReader.onload({ target: { result: mockFileReader.result } });
        mockImage.onload();

        const result = await promise;

        expect(result).toBe(mockFileReader.result);
    });

    it('resolves with rawDataUrl if canvas toDataURL throws error (Safari fallback)', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockCanvas.toDataURL.mockImplementation(() => {
            throw new Error('Tainted canvas');
        });
        const file = new File([''], 'test.png', { type: 'image/png' });

        const promise = compressImage(file);

        mockFileReader.onload({ target: { result: mockFileReader.result } });
        mockImage.onload();

        const result = await promise;

        expect(result).toBe(mockFileReader.result);
        expect(consoleWarnSpy).toHaveBeenCalledWith('Canvas toDataURL failed during compressImage', expect.any(Error));
    });
});
