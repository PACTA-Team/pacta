import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Mock fetch globally ---
const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.resetModules();
  mockFetch.mockReset();
  (globalThis as any).fetch = mockFetch;
});

afterEach(() => {
  (globalThis as any).fetch = originalFetch;
  vi.clearAllMocks();
});

// --- Helper: resolve API base ---
const BASE = '/api/contracts';

function okJSON(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function createdJSON(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 201,
    json: () => Promise.resolve(body),
  });
}

function errResponse(status: number, error: string) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  });
}

// --- Tests ---

describe('contractsAPI', () => {
  describe('list', () => {
    it('fetches contracts with correct method and credentials', async () => {
      const contracts = [
        { id: 1, internal_id: 'CNT-2025-0001', contract_number: 'C-001', title: 'Test', client_id: 1, supplier_id: 2, start_date: '2025-01-01', end_date: '2025-12-31', amount: 5000, type: 'service', status: 'active', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
      ];
      mockFetch.mockResolvedValue(okJSON(contracts));

      const { contractsAPI } = await import('@/lib/contracts-api');
      const result = await contractsAPI.list();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(BASE, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: undefined,
      });
      expect(result).toEqual(contracts);
    });

    it('passes AbortSignal to fetch', async () => {
      mockFetch.mockResolvedValue(okJSON([]));
      const controller = new AbortController();

      const { contractsAPI } = await import('@/lib/contracts-api');
      await contractsAPI.list(controller.signal);

      expect(mockFetch).toHaveBeenCalledWith(BASE, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
    });

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValue(errResponse(500, 'internal server error'));

      const { contractsAPI } = await import('@/lib/contracts-api');

      await expect(contractsAPI.list()).rejects.toThrow('internal server error');
    });
  });

  describe('getById', () => {
    it('fetches a single contract by id', async () => {
      const contract = {
        id: 42,
        internal_id: 'CNT-2025-0002',
        contract_number: 'C-002',
        title: 'Single Contract',
        client_id: 1,
        supplier_id: 2,
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        amount: 10000,
        type: 'purchase',
        status: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
      mockFetch.mockResolvedValue(okJSON(contract));

      const { contractsAPI } = await import('@/lib/contracts-api');
      const result = await contractsAPI.getById(42);

      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/42`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: undefined,
      });
      expect(result).toEqual(contract);
    });

    it('throws 404 when contract not found', async () => {
      mockFetch.mockResolvedValue(errResponse(404, 'contract not found'));

      const { contractsAPI } = await import('@/lib/contracts-api');

      await expect(contractsAPI.getById(999)).rejects.toThrow('contract not found');
    });
  });

  describe('create', () => {
    const validPayload = {
      contract_number: 'C-003',
      client_id: 1,
      supplier_id: 2,
      start_date: '2025-06-01',
      end_date: '2026-06-01',
      amount: 25000,
      type: 'compraventa',
      status: 'pending',
    };

    it('creates a contract with POST and returns response', async () => {
      const created = { id: 5, internal_id: 'CNT-2025-0003', status: 'created' };
      mockFetch.mockResolvedValue(createdJSON(created));

      const { contractsAPI } = await import('@/lib/contracts-api');
      const result = await contractsAPI.create(validPayload);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(BASE, {
        method: 'POST',
        body: JSON.stringify(validPayload),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: undefined,
      });
      expect(result).toEqual(created);
    });

    it('includes optional signer fields', async () => {
      mockFetch.mockResolvedValue(createdJSON({ id: 6, internal_id: 'CNT-2025-0004', status: 'created' }));

      const { contractsAPI } = await import('@/lib/contracts-api');
      await contractsAPI.create({
        ...validPayload,
        client_signer_id: 10,
        supplier_signer_id: 20,
        description: 'Test description',
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.client_signer_id).toBe(10);
      expect(body.supplier_signer_id).toBe(20);
      expect(body.description).toBe('Test description');
    });

    it('throws on conflict (duplicate contract number)', async () => {
      mockFetch.mockResolvedValue(errResponse(409, "contract number 'C-003' already exists"));

      const { contractsAPI } = await import('@/lib/contracts-api');

      await expect(contractsAPI.create(validPayload)).rejects.toThrow(
        "contract number 'C-003' already exists"
      );
    });

    it('throws on validation error (client not found)', async () => {
      mockFetch.mockResolvedValue(errResponse(400, 'client not found'));

      const { contractsAPI } = await import('@/lib/contracts-api');

      await expect(contractsAPI.create(validPayload)).rejects.toThrow('client not found');
    });
  });

  describe('update', () => {
    const updatePayload = {
      client_id: 1,
      supplier_id: 2,
      start_date: '2025-06-01',
      end_date: '2026-06-01',
      amount: 30000,
      type: 'compraventa',
      status: 'active',
    };

    it('updates a contract with PUT and returns response', async () => {
      mockFetch.mockResolvedValue(okJSON({ status: 'updated' }));

      const { contractsAPI } = await import('@/lib/contracts-api');
      const result = await contractsAPI.update(5, updatePayload);

      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/5`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: undefined,
      });
      expect(result).toEqual({ status: 'updated' });
    });

    it('includes optional fields when provided', async () => {
      mockFetch.mockResolvedValue(okJSON({ status: 'updated' }));

      const { contractsAPI } = await import('@/lib/contracts-api');
      await contractsAPI.update(5, {
        ...updatePayload,
        client_signer_id: 11,
        supplier_signer_id: 22,
        description: 'Updated desc',
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.client_signer_id).toBe(11);
      expect(body.supplier_signer_id).toBe(22);
      expect(body.description).toBe('Updated desc');
    });

    it('passes AbortSignal', async () => {
      mockFetch.mockResolvedValue(okJSON({ status: 'updated' }));
      const controller = new AbortController();

      const { contractsAPI } = await import('@/lib/contracts-api');
      await contractsAPI.update(5, updatePayload, controller.signal);

      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/5`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
    });

    it('throws on 404', async () => {
      mockFetch.mockResolvedValue(errResponse(404, 'contract not found'));

      const { contractsAPI } = await import('@/lib/contracts-api');

      await expect(contractsAPI.update(999, updatePayload)).rejects.toThrow('contract not found');
    });
  });

  describe('delete', () => {
    it('deletes a contract with DELETE and returns response', async () => {
      mockFetch.mockResolvedValue(okJSON({ status: 'deleted' }));

      const { contractsAPI } = await import('@/lib/contracts-api');
      const result = await contractsAPI.delete(5);

      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/5`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: undefined,
      });
      expect(result).toEqual({ status: 'deleted' });
    });

    it('passes AbortSignal', async () => {
      mockFetch.mockResolvedValue(okJSON({ status: 'deleted' }));
      const controller = new AbortController();

      const { contractsAPI } = await import('@/lib/contracts-api');
      await contractsAPI.delete(5, controller.signal);

      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/5`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
    });

    it('throws on 404', async () => {
      mockFetch.mockResolvedValue(errResponse(404, 'contract not found'));

      const { contractsAPI } = await import('@/lib/contracts-api');

      await expect(contractsAPI.delete(999)).rejects.toThrow('contract not found');
    });
  });

  describe('error handling', () => {
    it('falls back to "Request failed" when error body is not JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('bad json')),
      });

      const { contractsAPI } = await import('@/lib/contracts-api');

      await expect(contractsAPI.list()).rejects.toThrow('Request failed');
    });

    it('includes HTTP status in error when body has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

      const { contractsAPI } = await import('@/lib/contracts-api');

      await expect(contractsAPI.list()).rejects.toThrow('HTTP 500');
    });
  });
});
