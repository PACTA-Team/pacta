import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('signersAPI', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('list returns array of signers', async () => {
    const mockData = [{ id: 1, company_id: 1, company_type: 'client', first_name: 'John', last_name: 'Doe' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
    const { signersAPI } = await import('@/lib/signers-api');
    const result = await signersAPI.list();
    expect(result).toEqual(mockData);
  });

  it('create sends POST', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 1, status: 'created' }) });
    const { signersAPI } = await import('@/lib/signers-api');
    const result = await signersAPI.create({ company_id: 1, company_type: 'client', first_name: 'John', last_name: 'Doe', position: 'CEO', phone: '555-1234', email: 'john@test.com' });
    expect(result).toEqual({ id: 1, status: 'created' });
  });

  it('update sends PUT', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'updated' }) });
    const { signersAPI } = await import('@/lib/signers-api');
    const result = await signersAPI.update(1, { first_name: 'Jane' });
    expect(result).toEqual({ status: 'updated' });
  });

  it('delete sends DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'deleted' }) });
    const { signersAPI } = await import('@/lib/signers-api');
    const result = await signersAPI.delete(1);
    expect(result).toEqual({ status: 'deleted' });
  });
});
