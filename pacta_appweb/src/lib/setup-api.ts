export interface SetupCompanyData {
  name: string;
  address?: string;
  tax_id?: string;
}

export interface SetupSubsidiaryData {
  name: string;
  address?: string;
  tax_id?: string;
  client: {
    name: string;
    address?: string;
    reu_code?: string;
    contacts?: string;
  };
  supplier: {
    name: string;
    address?: string;
    reu_code?: string;
    contacts?: string;
  };
}

export interface SetupRequest {
  company_mode: 'single' | 'multi';
  company: SetupCompanyData;
  admin: {
    name: string;
    email: string;
    password: string;
  };
  client: {
    name: string;
    address?: string;
    reu_code?: string;
    contacts?: string;
  };
  supplier: {
    name: string;
    address?: string;
    reu_code?: string;
    contacts?: string;
  };
  subsidiaries?: SetupSubsidiaryData[];
}

export interface SetupResponse {
  status: string;
  company_id: number;
  admin_id: number;
}

export interface SetupStatusResponse {
  needs_setup: boolean;
}

export async function checkSetupStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/setup/status');
    if (!res.ok) return false;
    const data: SetupStatusResponse = await res.json();
    return data.needs_setup;
  } catch {
    return false;
  }
}

export async function runSetup(data: SetupRequest): Promise<SetupResponse | null> {
  try {
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Setup failed');
    }
    return await res.json();
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Network error');
  }
}
