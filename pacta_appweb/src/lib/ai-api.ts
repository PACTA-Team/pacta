const BASE = '/api/ai';

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

export interface GenerateContractRequest {
  contract_type: string;
  amount: number;
  start_date: string;
  end_date: string;
  client_id: number;
  supplier_id: number;
  description?: string;
}

export interface ReviewContractRequest {
  contract_id: number;
  text: string;
  document_url?: string;
}

export interface GenerateResponse {
  text: string;
  error?: string;
}

export interface ReviewResponse {
  summary: string;
  risks: Array<{
    clause: string;
    risk: 'high' | 'medium' | 'low';
    suggestion: string;
  }>;
  missing_clauses: string[];
  overall_risk: 'high' | 'medium' | 'low';
}

export const aiAPI = {
  generateContract: (data: GenerateContractRequest, signal?: AbortSignal) =>
    fetchJSON<GenerateResponse>(`${BASE}/generate-contract`, {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }),

  reviewContract: (data: ReviewContractRequest, signal?: AbortSignal) =>
    fetchJSON<ReviewResponse>(`${BASE}/review-contract`, {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }),

  testConnection: (provider: string, apiKey: string, model: string, endpoint?: string) =>
    fetchJSON<{ status: string; message: string }>(`${BASE}/test`, {
      method: 'POST',
      body: JSON.stringify({ provider, api_key: apiKey, model, endpoint }),
    }),
};
