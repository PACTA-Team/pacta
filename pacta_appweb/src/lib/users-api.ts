const BASE = '/api/users';

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

export interface APIUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'editor' | 'viewer';
  status: 'active' | 'inactive' | 'locked';
  last_access: string | null;
  created_at: string;
  updated_at: string;
}

export const usersAPI = {
  list: (signal?: AbortSignal) =>
    fetchJSON<APIUser[]>(BASE, { signal }),

  getById: (id: number, signal?: AbortSignal) =>
    fetchJSON<APIUser>(`${BASE}/${id}`, { signal }),

  create: (name: string, email: string, password: string, role: string, signal?: AbortSignal) =>
    fetchJSON(BASE, {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
      signal,
    }),

  update: (id: number, name: string, email: string, role: string, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, email, role }),
      signal,
    }),

  delete: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'DELETE',
      signal,
    }),

  resetPassword: (id: number, newPassword: string, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify({ new_password: newPassword }),
      signal,
    }),

  updateStatus: (id: number, status: 'active' | 'inactive' | 'locked', signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      signal,
    }),
};

export const usersCompanyAPI = {
  assignCompany: (userId: number, companyId: number) =>
    fetchJSON(`/api/users/${userId}/company`, {
      method: 'PATCH',
      body: JSON.stringify({ company_id: companyId }),
    }),
};

export interface Profile {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'editor' | 'viewer';
  status: 'active' | 'inactive' | 'locked';
  last_access: string | null;
  created_at: string;
  updated_at: string;
  digital_signature_url: string | null;
  public_cert_url: string | null;
}

export const profileAPI = {
  getProfile: (signal?: AbortSignal) =>
    fetchJSON<Profile>('/api/user/profile', { signal }),

  updateProfile: (name: string, email: string, signal?: AbortSignal) =>
    fetchJSON<Profile>('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name, email }),
      signal,
    }),

  changePassword: (currentPassword: string, newPassword: string, signal?: AbortSignal) =>
    fetchJSON<{ status: string }>('/api/user/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      signal,
    }),
};

export type CertType = 'digital_signature' | 'public_cert';

async function fetchFormData<T>(url: string, formData: FormData, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const certificateAPI = {
  upload: async (certType: CertType, file: File, signal?: AbortSignal) => {
    const formData = new FormData();
    formData.append('type', certType);
    formData.append('file', file);
    return fetchFormData<Profile>('/api/user/certificate', formData, signal);
  },

  delete: async (certType: CertType, signal?: AbortSignal) => {
    const res = await fetch(`/api/user/certificate/${certType}`, {
      method: 'DELETE',
      credentials: 'include',
      signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Delete failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return { status: 'deleted' };
  },
};
