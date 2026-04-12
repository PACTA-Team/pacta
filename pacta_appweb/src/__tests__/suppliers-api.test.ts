import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('suppliersAPI', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('list returns array of suppliers', async () => {
    const mockData = [{ id: 1, name: 'Test Supplier' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
    const { suppliersAPI } = await import('@/lib/suppliers-api');
    const result = await suppliersAPI.list();
    expect(result).toEqual(mockData);
  });

  it('create sends POST', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 1, status: 'created' }) });
    const { suppliersAPI } = await import('@/lib/suppliers-api');
    const result = await suppliersAPI.create({ name: 'Test', address: '456 Ave', reu_code: 'S001', contacts: 'Jane' });
    expect(result).toEqual({ id: 1, status: 'created' });
  });

  it('update sends PUT', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'updated' }) });
    const { suppliersAPI } = await import('@/lib/suppliers-api');
    const result = await suppliersAPI.update(1, { name: 'Updated' });
    expect(result).toEqual({ status: 'updated' });
  });

  it('delete sends DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'deleted' }) });
    const { suppliersAPI } = await import('@/lib/suppliers-api');
    const result = await suppliersAPI.delete(1);
    expect(result).toEqual({ status: 'deleted' });
  });
});
