import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('suppliersAPI', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  describe('list', () => {
    it('fetches suppliers', async () => {
      const mockData = [{ id: 1, name: 'Test Supplier' }];
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
      const { suppliersAPI } = await import('@/lib/suppliers-api');
      const result = await suppliersAPI.list();
      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith('/api/suppliers', expect.any(Object));
    });

    it('passes AbortSignal', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
      const { suppliersAPI } = await import('@/lib/suppliers-api');
      const controller = new AbortController();
      await suppliersAPI.list(controller.signal);
      expect(mockFetch).toHaveBeenCalledWith('/api/suppliers', expect.objectContaining({ signal: controller.signal }));
    });

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: 'Failed' }) });
      const { suppliersAPI } = await import('@/lib/suppliers-api');
      await expect(suppliersAPI.list()).rejects.toThrow('Failed');
    });
  });

  describe('getById', () => {
    it('fetches single supplier', async () => {
      const mockData = { id: 1, name: 'Test' };
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
      const { suppliersAPI } = await import('@/lib/suppliers-api');
      const result = await suppliersAPI.getById(1);
      expect(result).toEqual(mockData);
    });

    it('throws on 404', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: 'Not found' }) });
      const { suppliersAPI } = await import('@/lib/suppliers-api');
      await expect(suppliersAPI.getById(999)).rejects.toThrow('Not found');
    });
  });

  describe('create', () => {
    it('sends POST', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 1, status: 'created' }) });
      const { suppliersAPI } = await import('@/lib/suppliers-api');
      const result = await suppliersAPI.create({ name: 'Test', address: '123 Ave', reu_code: 'S001', contacts: 'Jane' });
      expect(result).toEqual({ id: 1, status: 'created' });
      expect(mockFetch).toHaveBeenCalledWith('/api/suppliers', expect.objectContaining({ method: 'POST' }));
    });
  });

  describe('update', () => {
    it('sends PUT', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'updated' }) });
      const { suppliersAPI } = await import('@/lib/suppliers-api');
      const result = await suppliersAPI.update(1, { name: 'Updated' });
      expect(result).toEqual({ status: 'updated' });
    });
  });

  describe('delete', () => {
    it('sends DELETE', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'deleted' }) });
      const { suppliersAPI } = await import('@/lib/suppliers-api');
      const result = await suppliersAPI.delete(1);
      expect(result).toEqual({ status: 'deleted' });
    });
  });

  describe('error handling', () => {
    it('handles non-JSON error body', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: 'Request failed' }) });
      const { suppliersAPI } = await import('@/lib/suppliers-api');
      await expect(suppliersAPI.list()).rejects.toThrow('Request failed');
    });

    it('handles missing error field', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });
      const { suppliersAPI } = await import('@/lib/suppliers-api');
      await expect(suppliersAPI.list()).rejects.toThrow('HTTP 500');
    });
  });
});
