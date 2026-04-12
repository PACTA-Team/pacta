import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('signersAPI', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  describe('list', () => {
    it('fetches signers', async () => {
      const mockData = [{ id: 1, company_id: 1, company_type: 'client', first_name: 'John', last_name: 'Doe' }];
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
      const { signersAPI } = await import('@/lib/signers-api');
      const result = await signersAPI.list();
      expect(result).toEqual(mockData);
    });
  });

  describe('getById', () => {
    it('fetches single signer', async () => {
      const mockData = { id: 1, first_name: 'John' };
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
      const { signersAPI } = await import('@/lib/signers-api');
      const result = await signersAPI.getById(1);
      expect(result).toEqual(mockData);
    });
  });

  describe('create', () => {
    it('sends POST', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 1, status: 'created' }) });
      const { signersAPI } = await import('@/lib/signers-api');
      const result = await signersAPI.create({ company_id: 1, company_type: 'client', first_name: 'John', last_name: 'Doe', position: 'CEO', phone: '555-1234', email: 'john@test.com' });
      expect(result).toEqual({ id: 1, status: 'created' });
    });
  });

  describe('update', () => {
    it('sends PUT', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'updated' }) });
      const { signersAPI } = await import('@/lib/signers-api');
      const result = await signersAPI.update(1, { first_name: 'Jane' });
      expect(result).toEqual({ status: 'updated' });
    });
  });

  describe('delete', () => {
    it('sends DELETE', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'deleted' }) });
      const { signersAPI } = await import('@/lib/signers-api');
      const result = await signersAPI.delete(1);
      expect(result).toEqual({ status: 'deleted' });
    });
  });

  describe('error handling', () => {
    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400, json: () => Promise.resolve({ error: 'Bad request' }) });
      const { signersAPI } = await import('@/lib/signers-api');
      await expect(signersAPI.list()).rejects.toThrow('Bad request');
    });

    it('handles missing error field', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });
      const { signersAPI } = await import('@/lib/signers-api');
      await expect(signersAPI.list()).rejects.toThrow('HTTP 500');
    });
  });
});
