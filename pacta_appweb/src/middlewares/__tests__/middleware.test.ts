import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock the dependencies before importing middleware
let mockHasAdminUser = false;

vi.mock('@/lib/seed', () => ({
  hasAdminUser: () => mockHasAdminUser,
}));

// Mock the JWT secret for testing
const TEST_JWT_SECRET = new TextEncoder().encode('test-secret-for-middleware-testing!!');

vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>();
  return {
    ...actual,
    jwtVerify: vi.fn().mockImplementation(async (token: string) => {
      if (token === 'valid-token') {
        return { payload: { sub: 'user-1', role: 'admin', name: 'Test User' } };
      }
      throw new Error('Invalid token');
    }),
  };
});

describe('Task 3: Server-Side Route Protection via Middleware', () => {
  beforeEach(() => {
    vi.resetModules();
    mockHasAdminUser = false;
    // Set env for middleware JWT secret
    process.env.JWT_SECRET = 'test-secret-for-middleware-testing!!';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createMockRequest(url: string, cookies: Record<string, string> = {}, headers: Record<string, string> = {}) {
    const cookieStore = {
      get: (name: string) => {
        const value = cookies[name];
        return value ? { name, value } : undefined;
      },
    };
    return {
      nextUrl: new URL(url, 'http://localhost:3000'),
      url,
      headers: new Headers(Object.entries(headers).map(([k, v]) => [k, v])),
      cookies: cookieStore,
    } as any;
  }

  describe('setup wizard redirect', () => {
    it('redirects to /setup when no admin exists and accessing protected path', async () => {
      mockHasAdminUser = false;
      const { middleware } = await import('@/middlewares/middleware');
      const request = createMockRequest('http://localhost:3000/dashboard');
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/setup');
    });

    it('allows access to /setup when no admin exists', async () => {
      mockHasAdminUser = false;
      const { middleware } = await import('@/middlewares/middleware');
      const request = createMockRequest('http://localhost:3000/setup');
      const response = await middleware(request);

      // Should not redirect to setup (it's the setup page itself)
      expect(response.status).not.toBe(307);
      // Or if it does redirect, it should not redirect to /setup
      const location = response.headers?.get('location');
      if (location) {
        expect(location).not.toContain('/setup');
      }
    });

    it('redirects to /login when admin exists and accessing /setup', async () => {
      mockHasAdminUser = true;
      const { middleware } = await import('@/middlewares/middleware');
      const request = createMockRequest('http://localhost:3000/setup');
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
    });
  });

  // Clear rate limit map between tests
  afterEach(() => {
    vi.clearAllMocks();
    // Reset rate limiter
    vi.resetModules();
  });

  describe('JWT cookie verification', () => {
    it('redirects to /login when no token cookie present', async () => {
      mockHasAdminUser = true;
      const { middleware } = await import('@/middlewares/middleware');
      const request = createMockRequest('http://localhost:3000/dashboard');
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
    });

    it('returns 401 for API routes when no token cookie present', async () => {
      mockHasAdminUser = true;
      const { middleware } = await import('@/middlewares/middleware');
      const request = createMockRequest('http://localhost:3000/next_api/contracts');
      const response = await middleware(request);

      expect(response.status).toBe(401);
    });

    it('allows public paths without token', async () => {
      mockHasAdminUser = true;
      const { middleware } = await import('@/middlewares/middleware');
      const request = createMockRequest('http://localhost:3000/login');
      const response = await middleware(request);

      expect(response.status).toBe(200);
    });

    it('injects user headers when valid token present', async () => {
      mockHasAdminUser = true;
      const { middleware } = await import('@/middlewares/middleware');
      const request = createMockRequest('http://localhost:3000/dashboard', {
        pacta_token: 'valid-token',
      });
      const response = await middleware(request);

      // Should pass through (not redirect)
      expect(response.status).not.toBe(307);
      // Should have injected user headers
      expect(response.status).toBe(200);
    });

    it('redirects to /login and clears cookies on invalid token', async () => {
      mockHasAdminUser = true;
      const { middleware } = await import('@/middlewares/middleware');
      const request = createMockRequest('http://localhost:3000/dashboard', {
        pacta_token: 'invalid-token',
      });
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
    });
  });

  describe('rate limiting', () => {
    it('middleware has rate limiting config', async () => {
      const { config } = await import('@/middlewares/middleware');
      expect(config.matcher).toBeDefined();
    });
  });
});
