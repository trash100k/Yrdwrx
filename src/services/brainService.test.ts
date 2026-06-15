import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRelevantMemory, ingestKnowledge } from './brainService';
import { getDocs, writeBatch, collection, query, where, doc } from 'firebase/firestore';
import { fetchApi } from '../lib/api';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  db: {},
}));

vi.mock('../lib/api', () => ({
  fetchApi: vi.fn(),
}));

describe('brainService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchRelevantMemory', () => {
    it('should return concatenated content of relevant memory docs', async () => {
      const mockDocs = [
        { data: () => ({ content: 'Memory part 1' }) },
        { data: () => ({ content: 'Memory part 2' }) },
      ];

      vi.mocked(getDocs).mockResolvedValue({ docs: mockDocs } as any);

      const result = await fetchRelevantMemory('test-topic');

      expect(collection).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith('topic', '==', 'test-topic');
      expect(query).toHaveBeenCalled();
      expect(getDocs).toHaveBeenCalled();
      expect(result).toBe('Memory part 1\n---\nMemory part 2');
    });

    it('should return an empty string if no relevant memories are found', async () => {
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

      const result = await fetchRelevantMemory('empty-topic');

      expect(result).toBe('');
    });

    it('should handle errors gracefully and return an empty string', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(getDocs).mockRejectedValue(new Error('Firestore error'));

      const result = await fetchRelevantMemory('error-topic');

      expect(consoleSpy).toHaveBeenCalledWith('Fetch Memory Failed:', expect.any(Error));
      expect(result).toBe('');

      consoleSpy.mockRestore();
    });
  });

  describe('ingestKnowledge', () => {
    it('should fetch and batch write knowledge nodes', async () => {
      const mockNodes = [
        { id: 1, content: 'Node 1' },
        { id: 2, content: 'Node 2' },
      ];

      vi.mocked(fetchApi).mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockNodes),
      } as any);

      const mockBatch = {
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(writeBatch).mockReturnValue(mockBatch as any);
      vi.mocked(doc).mockReturnValue('mock-doc-ref' as any);

      const result = await ingestKnowledge('test content', { type: 'test' });

      expect(fetchApi).toHaveBeenCalledWith('/api/knowledge/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test content', context: { type: 'test' } }),
      });
      expect(writeBatch).toHaveBeenCalled();
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.set).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
        content: 'Node 1',
        relevanceCount: 0,
      }));
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(result).toEqual(mockNodes);
    });

    it('should batch writes in chunks of 500', async () => {
      const mockNodes = Array.from({ length: 1200 }, (_, i) => ({ id: i, content: `Node ${i}` }));

      vi.mocked(fetchApi).mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockNodes),
      } as any);

      const mockBatch = {
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(writeBatch).mockReturnValue(mockBatch as any);

      await ingestKnowledge('large content', {});

      expect(writeBatch).toHaveBeenCalledTimes(3); // 500, 500, 200
      expect(mockBatch.set).toHaveBeenCalledTimes(1200);
      expect(mockBatch.commit).toHaveBeenCalledTimes(3);
    });

    it('should handle errors gracefully and return an empty array', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(fetchApi).mockRejectedValue(new Error('API error'));

      const result = await ingestKnowledge('error content', {});

      expect(consoleSpy).toHaveBeenCalledWith('Brain Ingestion Failed:', expect.any(Error));
      expect(result).toEqual([]);

      consoleSpy.mockRestore();
    });
  });
});
