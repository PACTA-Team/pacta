const BASE = '/api/auth';

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const registrationAPI = {
  register: (name: string, email: string, password: string, mode: 'email' | 'approval', companyName?: string, companyId?: number) =>
    fetchJSON(`${BASE}/register`, {
      method: 'POST',
      body: JSON.stringify({ name, email, password, mode, company_name: companyName, company_id: companyId }),
    }),

  verifyCode: (email: string, code: string) =>
    fetchJSON(`${BASE}/verify-code`, {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
};

export const approvalsAPI = {
  listPending: () => fetchJSON('/api/approvals/pending'),
  approve: (approvalId: number, companyId?: number, notes?: string, role?: string) =>
    fetchJSON('/api/approvals', {
      method: 'POST',
      body: JSON.stringify({ approval_id: approvalId, action: 'approve', company_id: companyId, notes, role }),
    }),
  reject: (approvalId: number, notes?: string) =>
    fetchJSON('/api/approvals', {
      method: 'POST',
      body: JSON.stringify({ approval_id: approvalId, action: 'reject', notes }),
    }),
};

export const usersCompanyAPI = {
  assignCompany: (userId: number, companyId: number) =>
    fetchJSON(`/api/users/${userId}/company`, {
      method: 'PATCH',
      body: JSON.stringify({ company_id: companyId }),
    }),
};
