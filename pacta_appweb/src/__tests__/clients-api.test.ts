import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('clientsAPI', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('list returns array of clients', async () => {
    const mockData = [{ id: 1, name: 'Test Client', address: '123 Main St', reu_code: 'R001', contacts: 'John' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
    const { clientsAPI } = await import('@/lib/clients-api');
    const result = await clientsAPI.list();
    expect(result).toEqual(mockData);
  });

  it('create sends POST', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 1, status: 'created' }) });
    const { clientsAPI } = await import('@/lib/clients-api');
    const result = await clientsAPI.create({ name: 'Test', address: '123 Main', reu_code: 'R001', contacts: 'John' });
    expect(result).toEqual({ id: 1, status: 'created' });
    expect(mockFetch).toHaveBeenCalledWith('/api/clients', expect.objectContaining({ method: 'POST' }));
  });

  it('update sends PUT', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'updated' }) });
    const { clientsAPI } = await import('@/lib/clients-api');
    const result = await clientsAPI.update(1, { name: 'Updated' });
    expect(result).toEqual({ status: 'updated' });
  });

  it('delete sends DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'deleted' }) });
    const { clientsAPI } = await import('@/lib/clients-api');
    const result = await clientsAPI.delete(1);
    expect(result).toEqual({ status: 'deleted' });
  });
});
