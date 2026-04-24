import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCompanyFilter } from '../useCompanyFilter';
import { Company } from '@/types';

type ItemWithIds = { client_id: number; supplier_id: number };

const createItem = (clientId: number, supplierId: number): ItemWithIds => ({
  client_id: clientId,
  supplier_id: supplierId,
});

describe('useCompanyFilter', () => {
  const baseCompany: Company = { id: 1, name: 'TestCo', address: '', tax_id: '', company_type: 'single', created_at: '', updated_at: '' };

  it('returns all items when currentCompany is null', () => {
    const items = [createItem(1, 2), createItem(2, 3)];
    const { result } = renderHook(() => useCompanyFilter(items, null, 'all'));
    expect(result.current).toEqual(items);
  });

  it('returns all items when filter is "all"', () => {
    const items = [createItem(1, 2), createItem(2, 3)];
    const { result } = renderHook(() => useCompanyFilter(items, baseCompany, 'all'));
    expect(result.current).toEqual(items);
  });

  it('filters by numeric company ID', () => {
    const items = [createItem(1, 2), createItem(2, 3), createItem(3, 1)];
    const { result } = renderHook(() => useCompanyFilter(items, baseCompany, '1'));
    expect(result.current).toHaveLength(2);
    expect(result.current).toEqual([items[0], items[2]]);
  });

  describe('with ourRole parameter', () => {
    it('filters by client_id when filter="client" and ourRole="client"', () => {
      const items = [createItem(1, 2), createItem(2, 3), createItem(1, 3)];
      const { result } = renderHook(() => useCompanyFilter(items, baseCompany, 'client', 'client'));
      // Should return contracts where client_id === currentCompany.id (1)
      expect(result.current).toHaveLength(2);
      expect(result.current).toEqual([items[0], items[2]]);
    });

    it('filters by supplier_id when filter="supplier" and ourRole="supplier"', () => {
      const items = [createItem(1, 2), createItem(2, 3), createItem(1, 1)];
      const { result } = renderHook(() => useCompanyFilter(items, baseCompany, 'supplier', 'supplier'));
      // supplier_id === currentCompany.id (1)
      expect(result.current).toHaveLength(1);
      expect(result.current).toEqual([items[2]]);
    });

    it('returns all items when filter="client" but ourRole undefined (warns)', () => {
      const items = [createItem(1, 2), createItem(2, 3)];
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() => useCompanyFilter(items, baseCompany, 'client', undefined));
      expect(result.current).toEqual(items);
      expect(consoleSpy).toHaveBeenCalledWith('useCompanyFilter: ourRole required when companyFilter is client/supplier');
      consoleSpy.mockRestore();
    });
  });

  it('filters by numeric ID correctly', () => {
    const items = [createItem(1, 2), createItem(2, 3), createItem(3, 1)];
    const { result } = renderHook(() => useCompanyFilter(items, baseCompany, '2'));
    // Should match items where client_id===2 OR supplier_id===2 -> first item client_id=1 no; second client_id=2 yes; third supplier_id=1 no. But also third client_id=3 no.
    expect(result.current).toHaveLength(1);
    expect(result.current).toEqual([items[1]]);
  });
});
