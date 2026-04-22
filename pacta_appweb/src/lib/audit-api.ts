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

export interface AuditLog {
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

export interface AuditLogParams {
  limit?: number;
  offset?: number;
  entityType?: string;
  action?: string;
}

export async function getAuditLogs(
  userId: number,
  params?: AuditLogParams,
  signal?: AbortSignal
): Promise<AuditLog[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("user_id", userId.toString());
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.offset) searchParams.set("offset", params.offset.toString());
  if (params?.entityType) searchParams.set("entity_type", params.entityType);
  if (params?.action) searchParams.set("action", params.action);

  const res = await fetch(`${BASE}?${searchParams}`, { credentials: 'include', signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const auditAPI = {
  list: (signal?: AbortSignal) =>
    fetchJSON<AuditLog[]>(BASE, { signal }),

  listByContract: (contractId: number, signal?: AbortSignal) =>
    fetchJSON<AuditLog[]>(`${BASE}?entity_type=contract&entity_id=${contractId}`, { signal }),

  listByEntityType: (entityType: string, signal?: AbortSignal) =>
    fetchJSON<AuditLog[]>(`${BASE}?entity_type=${entityType}`, { signal }),

  getAuditLogs,
};
