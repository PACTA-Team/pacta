const BASE = '/api/notifications';

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

export interface APINotification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string | null;
  entity_id: number | null;
  entity_type: string | null;
  read_at: string | null;
  created_at: string;
}

export const notificationsAPI = {
  list: (unreadOnly = false, signal?: AbortSignal) =>
    fetchJSON<APINotification[]>(`${BASE}${unreadOnly ? '?unread=true' : ''}`, { signal }),

  count: (signal?: AbortSignal) =>
    fetchJSON<{ unread: number }>(`${BASE}/count`, { signal }),

  markRead: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}/read`, {
      method: 'PATCH',
      signal,
    }),

  markAllRead: (signal?: AbortSignal) =>
    fetchJSON(`${BASE}/mark-all-read`, {
      method: 'PATCH',
      signal,
    }),

  delete: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'DELETE',
      signal,
    }),
};
