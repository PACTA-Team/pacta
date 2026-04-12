const BASE = '/api/notification-settings';

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface NotificationSettings {
  enabled: boolean;
  thresholds: number[];
  recipients: string[];
}

export const notificationSettingsAPI = {
  get: (signal?: AbortSignal) =>
    fetchJSON<NotificationSettings>(BASE, { signal }),

  update: (data: Partial<NotificationSettings>, signal?: AbortSignal) =>
    fetchJSON<{ status: string }>(BASE, {
      method: 'PUT',
      body: JSON.stringify(data),
      signal,
    }),
};
