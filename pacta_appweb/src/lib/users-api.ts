const BASE = '/api/users';

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

export interface APIUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'editor' | 'viewer';
  status: 'active' | 'inactive' | 'locked';
  last_access: string | null;
  created_at: string;
  updated_at: string;
}

export const usersAPI = {
  list: (signal?: AbortSignal) =>
    fetchJSON<APIUser[]>(BASE, { signal }),

  getById: (id: number, signal?: AbortSignal) =>
    fetchJSON<APIUser>(`${BASE}/${id}`, { signal }),

  create: (name: string, email: string, password: string, role: string, signal?: AbortSignal) =>
    fetchJSON(BASE, {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
      signal,
    }),

  update: (id: number, name: string, email: string, role: string, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, email, role }),
      signal,
    }),

  delete: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'DELETE',
      signal,
    }),

  resetPassword: (id: number, newPassword: string, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify({ new_password: newPassword }),
      signal,
    }),

  updateStatus: (id: number, status: 'active' | 'inactive' | 'locked', signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      signal,
    }),
};
