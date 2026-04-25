
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@/types';
import { checkSetupStatus } from '@/lib/setup-api';
import { CSRFManager } from '@/lib/csrf';

export interface SetupData {
  company_id?: number;
  company_name?: string;
  company_address?: string;
  company_tax_id?: string;
  company_phone?: string;
  company_email?: string;
  role_at_company: string;
  first_supplier_id?: number;
  first_client_id?: number;
  authorized_signers: Array<{name: string; position: string; email: string}>;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ user: User | null; needs_setup?: boolean; error?: string }>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<{ user: User | null; error?: string }>;
  isAuthenticated: boolean;
  hasPermission: (role: User['role']) => boolean;
  isLoading: boolean;
  needsSetup: boolean;
  setupStatus: string;
  submitSetup: (setupData: SetupData) => Promise<unknown>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupStatus, setSetupStatus] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/auth/me', { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setUser(data); })
      .catch(async () => {
        const needsSetup = await checkSetupStatus();
        if (needsSetup) {
          window.location.href = '/setup/init';
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ user: User | null; needs_setup?: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMessage = errorData?.error || 'Login failed';
        return { user: null, error: errorMessage };
      }
      const response = await res.json();
      if (response.needs_setup) {
        setNeedsSetup(true);
        setSetupStatus(response.setup_status || '');
        window.location.href = '/setup/profile';
        return { user: null, needs_setup: true };
      }
      setUser(response);
      return { user: response };
    } catch (err) {
      return { user: null, error: err instanceof Error ? err.message : 'Network error' };
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (error) {
      console.warn('Logout API failed:', error);
    } finally {
      CSRFManager.clear();
      setUser(null);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string): Promise<{ user: User | null; error?: string }> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
        credentials: 'include',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMessage = errorData?.error || 'Registration failed';
        return { user: null, error: errorMessage };
      }
      const data = await res.json();
      setUser(data);
      return { user: data };
    } catch (err) {
      return { user: null, error: err instanceof Error ? err.message : 'Network error' };
    }
  }, []);

  const hasPermission = useCallback((requiredRole: User['role']): boolean => {
    if (!user) return false;
    const roleHierarchy: Record<User['role'], number> = {
      viewer: 1,
      editor: 2,
      manager: 3,
      admin: 4,
    };
    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  }, [user]);

  const submitSetup = useCallback(async (setupData: SetupData): Promise<unknown> => {
    const res = await fetch('/api/setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(setupData),
    });
    if (!res.ok) {
      throw new Error('Failed to submit setup');
    }
    const data = await res.json();
    setNeedsSetup(false);
    setSetupStatus('pending_activation');
    return data;
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" role="status" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
          <p className="mt-4 text-sm text-muted-foreground">Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        register,
        isAuthenticated: user !== null,
        hasPermission,
        isLoading,
        needsSetup,
        setupStatus,
        submitSetup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
