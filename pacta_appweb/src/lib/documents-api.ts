const BASE = '/api/documents';

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { ...options.headers },
    signal: options.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface APIDocument {
  id: number;
  entity_id: number;
  entity_type: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export const documentsAPI = {
  list: (entityId: number, entityType: string, signal?: AbortSignal) =>
    fetchJSON<APIDocument[]>(`${BASE}?entity_id=${entityId}&entity_type=${entityType}`, { signal }),

  upload: (file: File, entityId: number, entityType: string, signal?: AbortSignal) => {
    const form = new FormData();
    form.append('file', file);
    form.append('entity_id', String(entityId));
    form.append('entity_type', entityType);
    return fetchJSON<APIDocument>(BASE, {
      method: 'POST',
      body: form,
      signal,
    });
  },

  download: (id: number) => {
    window.open(`${BASE}/${id}/download`, '_blank');
  },

  delete: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'DELETE',
      signal,
    }),
};
