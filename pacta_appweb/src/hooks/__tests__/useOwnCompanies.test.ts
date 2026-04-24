import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOwnCompanies } from '../useOwnCompanies';
import { companiesAPI } from '@/lib/companies-api';
import { toast } from 'sonner';

vi.mock('@/lib/companies-api', () => ({
  companiesAPI: {
    listOwnCompanies: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('useOwnCompanies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty arrays and loading initially', () => {
    (companiesAPI.listOwnCompanies as any).mockImplementation(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useOwnCompanies());
    expect(result.current.ownCompanies).toEqual([]);
    expect(result.current.selectedOwnCompany).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('loads companies and sets first as selected when only one exists', async () => {
    const mockCompanies = [{ id: 1, name: 'Company A', company_type: 'single' as const, address: '', tax_id: '', created_at: '', updated_at: '' }];
    (companiesAPI.listOwnCompanies as any).mockResolvedValue(mockCompanies);
    const { result } = renderHook(() => useOwnCompanies());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.ownCompanies).toEqual(mockCompanies);
    expect(result.current.selectedOwnCompany).toEqual(mockCompanies[0]);
  });

  it('does not auto-select when multiple companies', async () => {
    const mockCompanies = [
      { id: 1, name: 'A', company_type: 'single', address: '', tax_id: '', created_at: '', updated_at: '' },
      { id: 2, name: 'B', company_type: 'single', address: '', tax_id: '', created_at: '', updated_at: '' },
    ];
    (companiesAPI.listOwnCompanies as any).mockResolvedValue(mockCompanies);
    const { result } = renderHook(() => useOwnCompanies());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.ownCompanies).toEqual(mockCompanies);
    expect(result.current.selectedOwnCompany).toBeNull();
  });

  it('handles error loading companies', async () => {
    (companiesAPI.listOwnCompanies as any).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useOwnCompanies());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(toast.error).toHaveBeenCalled();
  });
});
