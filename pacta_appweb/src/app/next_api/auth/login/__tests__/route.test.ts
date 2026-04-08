import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

describe('Task 5: Update Login Route to Set httpOnly Cookies', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.JWT_SECRET = 'test-secret-for-login-testing!!';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when email is missing', async () => {
    const { POST } = await import('@/app/next_api/auth/login/route');
    const request = new Request('http://localhost/next_api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test' }),
    });

    const response = await POST(request as NextRequest);
    expect(response.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const { POST } = await import('@/app/next_api/auth/login/route');
    const request = new Request('http://localhost/next_api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com' }),
    });

    const response = await POST(request as NextRequest);
    expect(response.status).toBe(400);
  });

  it('returns 401 for invalid credentials', async () => {
    const { POST } = await import('@/app/next_api/auth/login/route');
    const request = new Request('http://localhost/next_api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@test.com', password: 'wrong' }),
    });

    const response = await POST(request as NextRequest);
    expect(response.status).toBe(401);
  });

  it('sets httpOnly cookies on successful login', async () => {
    // First, we need a user in the DB. Set up test DB.
    const Database = (await import('better-sqlite3')).default;
    const fs = await import('fs');
    const path = await import('path');
    const bcrypt = await import('bcrypt');

    const schemaPath = path.resolve(__dirname, '../../../../../lib/schema.sql');
    const testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    testDb.exec(schema);

    // Create a test user
    const now = new Date().toISOString();
    const hash = await bcrypt.hash('SecureP@ss123!', 12);
    testDb.prepare(
      "INSERT INTO users (id, name, username, email, password_hash, role, status, last_access, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run('user-1', 'Test User', 'testuser', 'test@pacta.local', hash, 'admin', 'active', now, now);

    // Mock getDb
    vi.doMock('@/lib/db', () => ({
      getDb: () => testDb,
      getTestDb: () => testDb,
      closeDb: () => { testDb.close(); },
    }));

    const { POST } = await import('@/app/next_api/auth/login/route');
    const request = new Request('http://localhost/next_api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@pacta.local', password: 'SecureP@ss123!' }),
    });

    const response = await POST(request as NextRequest);

    expect(response.status).toBe(200);

    // Check that cookies are set in the response
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('pacta_token=');
    expect(setCookie).toContain('pacta_user=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/');

    testDb.close();
  });
});
