import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('auditAPI', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('list returns array of audit logs', async () => {
    const mockData = [{ id: 1, user_id: 1, action: 'create', entity_type: 'contract', entity_id: 1, created_at: '2026-01-01T00:00:00Z' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
    const { auditAPI } = await import('@/lib/audit-api');
    const result = await auditAPI.list();
    expect(result).toEqual(mockData);
  });

  it('listByContract sends correct query params', async () => {
    const mockData = [{ id: 1, action: 'update', entity_type: 'contract', entity_id: 42 }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
    const { auditAPI } = await import('@/lib/audit-api');
    const result = await auditAPI.listByContract(42);
    expect(result).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith('/api/audit-logs?entity_type=contract&entity_id=42', expect.any(Object));
  });

  it('listByEntityType sends correct query params', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
    const { auditAPI } = await import('@/lib/audit-api');
    await auditAPI.listByEntityType('supplement');
    expect(mockFetch).toHaveBeenCalledWith('/api/audit-logs?entity_type=supplement', expect.any(Object));
  });
});
