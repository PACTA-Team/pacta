import { AuthorizedSigner } from '@/types';

const BASE = '/api/signers';

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

export interface CreateSignerRequest {
  company_id: number;
  company_type: 'client' | 'supplier';
  first_name: string;
  last_name: string;
  position: string;
  phone: string;
  email: string;
}

export interface UpdateSignerRequest {
  company_id?: number;
  company_type?: 'client' | 'supplier';
  first_name?: string;
  last_name?: string;
  position?: string;
  phone?: string;
  email?: string;
}

export const signersAPI = {
  list: (signal?: AbortSignal): Promise<AuthorizedSigner[]> =>
    fetchJSON<AuthorizedSigner[]>(BASE, { signal }),

  listByCompany: (companyId: number, companyType: 'client' | 'supplier', signal?: AbortSignal): Promise<AuthorizedSigner[]> =>
    fetchJSON<AuthorizedSigner[]>(`${BASE}?company_id=${companyId}&company_type=${companyType}`, { signal }),

  getById: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, { signal }),

  create: (data: CreateSignerRequest, signal?: AbortSignal) =>
    fetchJSON(BASE, {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }),

  update: (id: number, data: UpdateSignerRequest, signal?: AbortSignal) =>
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
