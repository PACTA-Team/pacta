import { Client } from '@/types';

const BASE = '/api/clients';

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

export interface CreateClientRequest {
  name: string;
  address: string;
  reu_code: string;
  contacts: string;
  document_url?: string;
  document_key?: string;
}

export interface UpdateClientRequest {
  name?: string;
  address?: string;
  reu_code?: string;
  contacts?: string;
}

export const clientsAPI = {
  list: (signal?: AbortSignal): Promise<Client[]> =>
    fetchJSON<Client[]>(BASE, { signal }),

  listByCompany: (companyId: number, signal?: AbortSignal): Promise<Client[]> =>
    fetchJSON<Client[]>(`${BASE}?company_id=${companyId}`, { signal }),

  getById: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, { signal }),

  create: (data: CreateClientRequest, signal?: AbortSignal, companyId?: number) =>
    fetchJSON(companyId ? `${BASE}?company_id=${companyId}` : BASE, {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }),

  update: (id: number, data: UpdateClientRequest, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      signal,
    }),

  delete: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'DELETE',
      signal,
    }),
};
