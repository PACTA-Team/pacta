import type { Company, UserCompany } from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function listCompanies(): Promise<Company[]> {
  return request<Company[]>('/companies');
}

export async function getCompany(id: number): Promise<Company> {
  return request<Company>(`/companies/${id}`);
}

export async function createCompany(data: {
  name: string;
  address?: string;
  tax_id?: string;
  company_type: string;
  parent_id?: number;
}): Promise<{ id: number; name: string }> {
  return request<{ id: number; name: string }>('/companies', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCompany(id: number, data: {
  name?: string;
  address?: string;
  tax_id?: string;
}): Promise<{ status: string }> {
  return request<{ status: string }>(`/companies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCompany(id: number): Promise<{ status: string }> {
  return request<{ status: string }>(`/companies/${id}`, {
    method: 'DELETE',
  });
}

export async function getUserCompanies(): Promise<UserCompany[]> {
  return request<UserCompany[]>('/users/me/companies');
}

export async function switchCompany(id: number): Promise<{ company_id: number }> {
  return request<{ company_id: number }>(`/users/me/company/${id}`, {
    method: 'PATCH',
  });
}
