const BASE = '/api/system-settings';

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

export interface SystemSetting {
  id: number;
  key: string;
  value?: string;
  category: string;
  updated_by?: number;
  updated_at: string;
}

export interface UpdateSetting {
  key: string;
  value: string;
}

export const settingsAPI = {
  getAll: (signal?: AbortSignal) =>
    fetchJSON<SystemSetting[]>(BASE, { signal }),

  update: (settings: UpdateSetting[], signal?: AbortSignal) =>
    fetchJSON<SystemSetting[]>(BASE, {
      method: 'PUT',
      body: JSON.stringify(settings),
      signal,
    }),
};