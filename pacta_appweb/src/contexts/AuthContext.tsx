'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<User | null>;
  isAuthenticated: boolean;
  hasPermission: (role: User['role']) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('pacta_token') : null;
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('pacta_user') : null;
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<User | null> => {
    try {
      const res = await fetch('/next_api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.data) return null;

      const { token: newToken, user: loggedInUser } = json.data;
      setToken(newToken);
      setUser(loggedInUser);
      localStorage.setItem('pacta_token', newToken);
      localStorage.setItem('pacta_user', JSON.stringify(loggedInUser));
      return loggedInUser;
    } catch {
      return null;
    }
  };

  const logout = (): void => {
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pacta_token');
      localStorage.removeItem('pacta_user');
    }
  };

  const register = async (name: string, email: string, password: string): Promise<User | null> => {
    try {
      const res = await fetch('/next_api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.data) return null;

      const { token: newToken, user: newUser } = json.data;
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('pacta_token', newToken);
      localStorage.setItem('pacta_user', JSON.stringify(newUser));
      return newUser;
    } catch {
      return null;
    }
  };

  const hasPermission = (requiredRole: User['role']): boolean => {
    if (!user) return false;
    const roleHierarchy: Record<User['role'], number> = {
      viewer: 1,
      editor: 2,
      manager: 3,
      admin: 4,
    };
    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  };

  if (isLoading) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        register,
        isAuthenticated: user !== null,
        hasPermission,
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
