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
const BASE = '/api/clients';

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

describe('clientsAPI', () => {
  describe('list', () => {
    it('fetches clients with correct method and credentials', async () => {
      const clients = [
        { id: 1, name: 'Acme Corp', address: '123 Main St', reu_code: 'R001', contacts: [], created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
      ];
      mockFetch.mockResolvedValue(okJSON(clients));

      const { clientsAPI } = await import('@/lib/clients-api');
      const result = await clientsAPI.list();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(BASE, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: undefined,
      });
      expect(result).toEqual(clients);
    });

    it('passes AbortSignal to fetch', async () => {
      mockFetch.mockResolvedValue(okJSON([]));
      const controller = new AbortController();

      const { clientsAPI } = await import('@/lib/clients-api');
      await clientsAPI.list(controller.signal);

      expect(mockFetch).toHaveBeenCalledWith(BASE, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
    });

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValue(errResponse(500, 'internal server error'));

      const { clientsAPI } = await import('@/lib/clients-api');

      await expect(clientsAPI.list()).rejects.toThrow('internal server error');
    });
  });

  describe('getById', () => {
    it('fetches a single client by id', async () => {
      const client = {
        id: 42,
        name: 'Beta LLC',
        address: '456 Oak Ave',
        reu_code: 'R042',
        contacts: [{ name: 'John', email: 'john@beta.com' }],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
      mockFetch.mockResolvedValue(okJSON(client));

      const { clientsAPI } = await import('@/lib/clients-api');
      const result = await clientsAPI.getById(42);

      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/42`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: undefined,
      });
      expect(result).toEqual(client);
    });

    it('throws 404 when client not found', async () => {
      mockFetch.mockResolvedValue(errResponse(404, 'client not found'));

      const { clientsAPI } = await import('@/lib/clients-api');

      await expect(clientsAPI.getById(999)).rejects.toThrow('client not found');
    });
  });

  describe('create', () => {
    const validPayload = {
      name: 'New Client',
      address: '789 Pine Rd',
      reu_code: 'R100',
      contacts: [{ name: 'Jane', email: 'jane@newclient.com' }],
    };

    it('creates a client with POST and returns response', async () => {
      const created = { id: 5, ...validPayload, created_at: '2025-06-01T00:00:00Z', updated_at: '2025-06-01T00:00:00Z' };
      mockFetch.mockResolvedValue(createdJSON(created));

      const { clientsAPI } = await import('@/lib/clients-api');
      const result = await clientsAPI.create(validPayload);

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

    it('includes optional contact fields', async () => {
      mockFetch.mockResolvedValue(createdJSON({ id: 6, ...validPayload, created_at: '2025-06-01T00:00:00Z', updated_at: '2025-06-01T00:00:00Z' }));

      const { clientsAPI } = await import('@/lib/clients-api');
      await clientsAPI.create({
        ...validPayload,
        contacts: [
          { name: 'Jane', email: 'jane@newclient.com', phone: '+1234567890' },
        ],
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.contacts[0].phone).toBe('+1234567890');
    });

    it('throws on conflict (duplicate reu_code)', async () => {
      mockFetch.mockResolvedValue(errResponse(409, "reu_code 'R001' already exists"));

      const { clientsAPI } = await import('@/lib/clients-api');

      await expect(clientsAPI.create(validPayload)).rejects.toThrow(
        "reu_code 'R001' already exists"
      );
    });

    it('throws on validation error (missing name)', async () => {
      mockFetch.mockResolvedValue(errResponse(400, 'name is required'));

      const { clientsAPI } = await import('@/lib/clients-api');

      await expect(clientsAPI.create(validPayload)).rejects.toThrow('name is required');
    });
  });

  describe('update', () => {
    const updatePayload = {
      name: 'Updated Client',
      address: '999 Elm St',
      reu_code: 'R200',
      contacts: [{ name: 'Bob', email: 'bob@updated.com' }],
    };

    it('updates a client with PUT and returns response', async () => {
      mockFetch.mockResolvedValue(okJSON({ status: 'updated' }));

      const { clientsAPI } = await import('@/lib/clients-api');
      const result = await clientsAPI.update(5, updatePayload);

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

      const { clientsAPI } = await import('@/lib/clients-api');
      await clientsAPI.update(5, {
        name: 'Partial Update',
        contacts: [{ name: 'Alice', email: 'alice@test.com', phone: '555-0100' }],
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.name).toBe('Partial Update');
      expect(body.contacts[0].phone).toBe('555-0100');
    });

    it('passes AbortSignal', async () => {
      mockFetch.mockResolvedValue(okJSON({ status: 'updated' }));
      const controller = new AbortController();

      const { clientsAPI } = await import('@/lib/clients-api');
      await clientsAPI.update(5, updatePayload, controller.signal);

      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/5`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
    });

    it('throws on 404', async () => {
      mockFetch.mockResolvedValue(errResponse(404, 'client not found'));

      const { clientsAPI } = await import('@/lib/clients-api');

      await expect(clientsAPI.update(999, updatePayload)).rejects.toThrow('client not found');
    });
  });

  describe('delete', () => {
    it('deletes a client with DELETE and returns response', async () => {
      mockFetch.mockResolvedValue(okJSON({ status: 'deleted' }));

      const { clientsAPI } = await import('@/lib/clients-api');
      const result = await clientsAPI.delete(5);

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

      const { clientsAPI } = await import('@/lib/clients-api');
      await clientsAPI.delete(5, controller.signal);

      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/5`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
    });

    it('throws on 404', async () => {
      mockFetch.mockResolvedValue(errResponse(404, 'client not found'));

      const { clientsAPI } = await import('@/lib/clients-api');

      await expect(clientsAPI.delete(999)).rejects.toThrow('client not found');
    });
  });

  describe('error handling', () => {
    it('falls back to "Request failed" when error body is not JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('bad json')),
      });

      const { clientsAPI } = await import('@/lib/clients-api');

      await expect(clientsAPI.list()).rejects.toThrow('Request failed');
    });

    it('includes HTTP status in error when body has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

      const { clientsAPI } = await import('@/lib/clients-api');

      await expect(clientsAPI.list()).rejects.toThrow('HTTP 500');
    });
  });
});
