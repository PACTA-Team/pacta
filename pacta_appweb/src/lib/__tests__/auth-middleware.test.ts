import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

describe('Task 4: Update Auth Middleware for Cookie-Based Auth', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function createMockRequest(headers: Record<string, string> = {}) {
    return {
      headers: new Headers(Object.entries(headers)),
      json: async () => ({}),
    } as unknown as NextRequest;
  }

  describe('withAuth', () => {
    it('calls handler with user info from headers when authenticated', async () => {
      const { withAuth } = await import('@/lib/auth-middleware');

      const handler = vi.fn().mockResolvedValue(new Response('OK'));
      const wrapped = withAuth(handler);

      const request = createMockRequest({
        'x-user-id': 'user-123',
        'x-user-role': 'admin',
        'x-user-name': 'Test User',
      });

      await wrapped(request);

      expect(handler).toHaveBeenCalledWith(request, {
        user: { id: 'user-123', role: 'admin', name: 'Test User' },
      });
    });

    it('returns 401 when x-user-id header is missing', async () => {
      const { withAuth } = await import('@/lib/auth-middleware');

      const handler = vi.fn();
      const wrapped = withAuth(handler);

      const request = createMockRequest({});
      const response = await wrapped(request);

      expect(response.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it('returns 401 when authorization header is present but x-user-id is missing', async () => {
      const { withAuth } = await import('@/lib/auth-middleware');

      const handler = vi.fn();
      const wrapped = withAuth(handler);

      const request = createMockRequest({
        'authorization': 'Bearer some-token',
      });
      const response = await wrapped(request);

      expect(response.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it('defaults role to viewer when x-user-role header is missing', async () => {
      const { withAuth } = await import('@/lib/auth-middleware');

      const handler = vi.fn().mockResolvedValue(new Response('OK'));
      const wrapped = withAuth(handler);

      const request = createMockRequest({
        'x-user-id': 'user-123',
      });

      await wrapped(request);

      expect(handler).toHaveBeenCalledWith(request, {
        user: { id: 'user-123', role: 'viewer', name: 'Unknown' },
      });
    });

    it('returns 500 when handler throws', async () => {
      const { withAuth } = await import('@/lib/auth-middleware');

      const handler = vi.fn().mockRejectedValue(new Error('DB error'));
      const wrapped = withAuth(handler);

      const request = createMockRequest({
        'x-user-id': 'user-123',
        'x-user-role': 'admin',
        'x-user-name': 'Test User',
      });

      const response = await wrapped(request);

      expect(response.status).toBe(500);
    });
  });

  describe('requireRole', () => {
    it('calls handler when user has allowed role', async () => {
      const { withAuth, requireRole } = await import('@/lib/auth-middleware');

      const handler = vi.fn().mockResolvedValue(new Response('OK'));
      const roleWrapped = requireRole(['admin', 'manager'])(handler);
      const wrapped = withAuth(roleWrapped);

      const request = createMockRequest({
        'x-user-id': 'user-123',
        'x-user-role': 'admin',
        'x-user-name': 'Test User',
      });

      await wrapped(request);
      expect(handler).toHaveBeenCalled();
    });

    it('returns 403 when user has insufficient role', async () => {
      const { withAuth, requireRole } = await import('@/lib/auth-middleware');

      const handler = vi.fn();
      const roleWrapped = requireRole(['admin'])(handler);
      const wrapped = withAuth(roleWrapped);

      const request = createMockRequest({
        'x-user-id': 'user-123',
        'x-user-role': 'viewer',
        'x-user-name': 'Test User',
      });

      const response = await wrapped(request);

      expect(response.status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
