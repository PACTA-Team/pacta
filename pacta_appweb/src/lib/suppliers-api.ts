import { Supplier } from '@/types';

const BASE = '/api/suppliers';

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

export interface CreateSupplierRequest {
  name: string;
  address: string;
  reu_code: string;
  contacts: string;
  document_url?: string;
  document_key?: string;
}

export interface UpdateSupplierRequest {
  name?: string;
  address?: string;
  reu_code?: string;
  contacts?: string;
}

export const suppliersAPI = {
  list: (signal?: AbortSignal): Promise<Supplier[]> =>
    fetchJSON<Supplier[]>(BASE, { signal }),

  listByCompany: (companyId: number, signal?: AbortSignal): Promise<Supplier[]> =>
    fetchJSON<Supplier[]>(`${BASE}?company_id=${companyId}`, { signal }),

  getById: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, { signal }),

  create: (data: CreateSupplierRequest, signal?: AbortSignal, companyId?: number) =>
    fetchJSON(companyId ? `${BASE}?company_id=${companyId}` : BASE, {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }),

  update: (id: number, data: UpdateSupplierRequest, signal?: AbortSignal) =>
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
