import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Company, UserCompany } from '../types';
import { listCompanies, getUserCompanies, switchCompany } from '../lib/companies-api';

interface CompanyContextType {
  currentCompany: Company | null;
  userCompanies: UserCompany[];
  isMultiCompany: boolean;
  switchCompany: (id: number) => Promise<void>;
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [userCompanies, setUserCompanies] = useState<UserCompany[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCompanies = useCallback(async () => {
    try {
      const [companies, userComps] = await Promise.all([
        listCompanies(),
        getUserCompanies(),
      ]);
      setUserCompanies(userComps);
      if (companies.length > 0) {
        const defaultComp = userComps.find(c => c.is_default);
        const targetId = defaultComp ? defaultComp.company_id : companies[0].id;
        const current = companies.find(c => c.id === targetId) || companies[0];
        setCurrentCompany(current);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const handleSwitch = useCallback(async (id: number) => {
    await switchCompany(id);
    window.location.reload();
  }, []);

  const isMultiCompany = userCompanies.length > 1;

  return (
    <CompanyContext.Provider value={{
      currentCompany,
      userCompanies,
      isMultiCompany,
      switchCompany: handleSwitch,
      loading,
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
