
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<User | null>;
  isAuthenticated: boolean;
  hasPermission: (role: User['role']) => boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/auth/me', { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setUser(data); })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User | null> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = await res.json();
      setUser(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    setUser(null);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string): Promise<User | null> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = await res.json();
      setUser(data);
      return data;
    } catch {
      return null;
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
