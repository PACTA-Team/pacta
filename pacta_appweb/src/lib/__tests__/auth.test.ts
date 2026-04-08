import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Task 1: JWT Secret Management', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear module cache so each test gets fresh module state
    vi.resetModules();
    // Reset env
    process.env = { ...originalEnv };
    delete (process.env as Record<string, unknown>).JWT_SECRET;
    delete (process.env as Record<string, unknown>).NODE_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it('throws in production when JWT_SECRET is not set', async () => {
    (process.env as Record<string, unknown>).NODE_ENV = 'production';
    delete (process.env as Record<string, unknown>).JWT_SECRET;

    await expect(async () => {
      await import('@/lib/auth');
    }).rejects.toThrow('JWT_SECRET environment variable is required in production');
  });

  it('succeeds in production when JWT_SECRET is set', async () => {
    (process.env as Record<string, unknown>).NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-very-secure-secret-that-is-at-least-32-chars!!';

    // Should not throw
    const auth = await import('@/lib/auth');
    expect(auth.createToken).toBeDefined();
    expect(auth.verifyToken).toBeDefined();
  });

  it('succeeds in development without JWT_SECRET (uses generated secret)', async () => {
    (process.env as Record<string, unknown>).NODE_ENV = 'development';
    delete (process.env as Record<string, unknown>).JWT_SECRET;

    // Should not throw
    const auth = await import('@/lib/auth');
    expect(auth.createToken).toBeDefined();
  });

  it('uses a consistent secret when JWT_SECRET is provided', async () => {
    process.env.JWT_SECRET = 'test-secret-value-min-32-characters!!';

    const auth = await import('@/lib/auth');
    const token = await auth.createToken('user-1', 'admin');
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const payload = await auth.verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('user-1');
    expect(payload!.role).toBe('admin');
  });
});
