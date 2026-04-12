const BASE = '/api/contracts';

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

export interface CreateContractRequest {
  contract_number: string;
  title: string;
  client_id: number;
  supplier_id: number;
  client_signer_id?: number;
  supplier_signer_id?: number;
  start_date: string;
  end_date: string;
  amount: number;
  type?: string;
  status?: string;
  description?: string;
}

export interface UpdateContractRequest {
  title: string;
  client_id: number;
  supplier_id: number;
  client_signer_id?: number;
  supplier_signer_id?: number;
  start_date: string;
  end_date: string;
  amount: number;
  type: string;
  status: string;
  description?: string;
}

export const contractsAPI = {
  list: (signal?: AbortSignal) =>
    fetchJSON(BASE, { signal }),

  getById: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, { signal }),

  create: (data: CreateContractRequest, signal?: AbortSignal) =>
    fetchJSON(BASE, {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }),

  update: (id: number, data: UpdateContractRequest, signal?: AbortSignal) =>
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
