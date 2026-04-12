import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('notificationSettingsAPI', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('get returns settings', async () => {
    const mockData = { enabled: true, thresholds: [7, 14, 30], recipients: [] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
    const { notificationSettingsAPI } = await import('@/lib/notification-settings-api');
    const result = await notificationSettingsAPI.get();
    expect(result).toEqual(mockData);
  });

  it('update sends PUT', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'updated' }) });
    const { notificationSettingsAPI } = await import('@/lib/notification-settings-api');
    const result = await notificationSettingsAPI.update({ enabled: false, thresholds: [3, 7] });
    expect(result).toEqual({ status: 'updated' });
    expect(mockFetch).toHaveBeenCalledWith('/api/notification-settings', expect.objectContaining({ method: 'PUT' }));
  });
});
