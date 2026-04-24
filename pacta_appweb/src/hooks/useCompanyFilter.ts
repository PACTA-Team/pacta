import { useMemo } from 'react';
import { Company } from '@/types';

/**
 * Hook to filter contracts/items by company based on current company context and role.
 *
 * @param items - Array of items to filter (must have client_id and supplier_id fields)
 * @param currentCompany - The currently selected owning company
 * @param companyFilter - Filter value: 'all' | 'client' | 'supplier' | companyId (string)
 * @param ourRole - Optional role context needed when companyFilter is 'client' or 'supplier'
 * @returns Filtered array of items
 *
 * @example
 * // Filter by specific company
 * const filtered = useCompanyFilter(contracts, currentCompany, '123');
 *
 * @example
 * // Filter by role (ourRole required)
 * const filtered = useCompanyFilter(contracts, currentCompany, 'client', 'client');
 * // Shows contracts where our company is the client
 */
export function useCompanyFilter<T extends { client_id: number; supplier_id: number }>(
  items: T[],
  currentCompany: Company | null,
  companyFilter: string,
  ourRole?: 'client' | 'supplier'
): T[] {
  return useMemo(() => {
    if (!currentCompany || companyFilter === 'all') {
      return items;
    }

    // If companyFilter is a numeric ID (as string)
    const numericId = parseInt(companyFilter, 10);
    if (!isNaN(numericId)) {
      return items.filter(
        item => item.client_id === numericId || item.supplier_id === numericId
      );
    }

    // If companyFilter is 'client' or 'supplier', needs ourRole
    if (companyFilter === 'client' || companyFilter === 'supplier') {
      if (!ourRole) {
        console.warn('useCompanyFilter: ourRole required when companyFilter is client/supplier');
        return items;
      }
      // 'client' filter means: show contracts where OUR company is the client
      // 'supplier' filter: show contracts where OUR company is the supplier
      return items.filter(item =>
        companyFilter === 'client'
          ? item.client_id === currentCompany.id
          : item.supplier_id === currentCompany.id
      );
    }

    return items;
  }, [items, currentCompany, companyFilter, ourRole]);
}
