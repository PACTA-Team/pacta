const BASE = '/api/auth';

interface ForgotPasswordResponse {
  success: boolean;
  message?: string;
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

export const forgotPasswordAPI = {
  requestReset: (email: string) =>
    fetchJSON<ForgotPasswordResponse>(`${BASE}/forgot-password`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
};
