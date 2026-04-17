const BASE = '/api/admin/settings/notifications';

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

export interface ContractExpirySettings {
  thresholds_days: number[]; // e.g., [30, 15, 7]
}

export const contractExpirySettingsAPI = {
  get: (signal?: AbortSignal) =>
    fetchJSON<ContractExpirySettings>(BASE, { signal }),

  update: (settings: ContractExpirySettings, signal?: AbortSignal) =>
    fetchJSON<ContractExpirySettings>(BASE, {
      method: 'PUT',
      body: JSON.stringify(settings),
      signal,
    }),
};
