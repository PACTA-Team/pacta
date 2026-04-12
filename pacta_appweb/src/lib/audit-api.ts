const BASE = '/api/audit-logs';

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

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  previous_state: string | null;
  new_state: string | null;
  ip_address: string | null;
  created_at: string;
}

export const auditAPI = {
  list: (signal?: AbortSignal) =>
    fetchJSON<AuditLogEntry[]>(BASE, { signal }),

  listByContract: (contractId: number, signal?: AbortSignal) =>
    fetchJSON<AuditLogEntry[]>(`${BASE}?entity_type=contract&entity_id=${contractId}`, { signal }),

  listByEntityType: (entityType: string, signal?: AbortSignal) =>
    fetchJSON<AuditLogEntry[]>(`${BASE}?entity_type=${entityType}`, { signal }),
};
