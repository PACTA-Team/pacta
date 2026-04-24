import { useState, useEffect } from 'react';
import { Company } from '@/types';
import { companiesAPI } from '@/lib/companies-api';

/**
 * Hook to fetch and manage the user's own companies.
 * Returns list of companies and selected company state.
 */
export function useOwnCompanies() {
  const [ownCompanies, setOwnCompanies] = useState<Company[]>([]);
  const [selectedOwnCompany, setSelectedOwnCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadOwnCompanies = async () => {
      try {
        setLoading(true);
        const companies = await companiesAPI.listOwnCompanies();
        setOwnCompanies(companies);
        if (companies.length === 1) {
          setSelectedOwnCompany(companies[0]);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load companies');
        setError(error);
        console.error('Failed to load own companies:', err);
      } finally {
        setLoading(false);
      }
    };
    loadOwnCompanies();
  }, []);

  return {
    ownCompanies,
    selectedOwnCompany,
    setSelectedOwnCompany,
    loading,
    error,
  };
}
