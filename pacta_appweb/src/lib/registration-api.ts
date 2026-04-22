const BASE = '/api/auth';

interface RegistrationResponse {
  status: 'pending_email' | 'pending_approval' | 'success';
}

interface VerifyCodeResponse {
  success: boolean;
}

interface PendingApproval {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  company_name: string;
  company_id: number | null;
  requested_role: string;
  status: string;
  created_at: string;
}

interface ApprovalsResponse {
  success: boolean;
}

interface CompanyAssignResponse {
  success: boolean;
}

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
  register: (name: string, email: string, password: string, language?: string) =>
    fetchJSON<RegistrationResponse>(`${BASE}/register`, {
      method: 'POST',
      body: JSON.stringify({
        name, email, password,
        language: language || 'en',
      }),
    }),

  verifyCode: (email: string, code: string) =>
    fetchJSON<VerifyCodeResponse>(`${BASE}/verify-code`, {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
};

export const approvalsAPI = {
  listPending: () => fetchJSON<PendingApproval[]>('/api/approvals/pending'),
  approve: (approvalId: number, companyId?: number, notes?: string, role?: string) =>
    fetchJSON<ApprovalsResponse>('/api/approvals', {
      method: 'POST',
      body: JSON.stringify({ approval_id: approvalId, action: 'approve', company_id: companyId, notes, role }),
    }),
  reject: (approvalId: number, notes?: string) =>
    fetchJSON<ApprovalsResponse>('/api/approvals', {
      method: 'POST',
      body: JSON.stringify({ approval_id: approvalId, action: 'reject', notes }),
    }),
};

export const usersCompanyAPI = {
  assignCompany: (userId: number, companyId: number) =>
    fetchJSON<CompanyAssignResponse>(`/api/users/${userId}/company`, {
      method: 'PATCH',
      body: JSON.stringify({ company_id: companyId }),
    }),
};
