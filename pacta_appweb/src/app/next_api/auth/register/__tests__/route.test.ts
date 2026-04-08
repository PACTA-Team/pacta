import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

describe('Task 6: Update Register Route for Admin Approval', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.JWT_SECRET = 'test-secret-for-register-testing!!';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('register route', () => {
    it('returns 400 when required fields are missing', async () => {
      const { POST } = await import('@/app/next_api/auth/register/route');
      const request = new Request('http://localhost/next_api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      });

      const response = await POST(request as NextRequest);
      expect(response.status).toBe(400);
    });

    it('creates user with status=pending and does NOT return token', async () => {
      const Database = (await import('better-sqlite3')).default;
      const fs = await import('fs');
      const path = await import('path');

      const schemaPath = path.resolve(__dirname, '../../../../../lib/schema.sql');
      const testDb = new Database(':memory:');
      testDb.pragma('foreign_keys = ON');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      testDb.exec(schema);

      vi.doMock('@/lib/db', () => ({
        getDb: () => testDb,
        getTestDb: () => testDb,
        closeDb: () => { testDb.close(); },
      }));

      const { POST } = await import('@/app/next_api/auth/register/route');
      const request = new Request('http://localhost/next_api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New User',
          username: 'newuser',
          password: 'SecureP@ss123!',
        }),
      });

      const response = await POST(request as NextRequest);
      expect(response.status).toBe(201);

      const body = await response.json();
      // Should NOT contain a token
      expect(body.data).not.toHaveProperty('token');
      // Should indicate pending approval
      expect(body.data.message).toContain('pending');
      expect(body.data.message).toContain('approval');

      // Verify user was created with pending status
      const user = testDb.prepare("SELECT * FROM users WHERE username = 'newuser'").get() as any;
      expect(user).toBeDefined();
      expect(user.status).toBe('pending');
      expect(user.role).toBe('viewer');

      testDb.close();
    });

    it('returns 409 when username already exists', async () => {
      const Database = (await import('better-sqlite3')).default;
      const fs = await import('fs');
      const path = await import('path');
      const bcrypt = await import('bcrypt');

      const schemaPath = path.resolve(__dirname, '../../../../../lib/schema.sql');
      const testDb = new Database(':memory:');
      testDb.pragma('foreign_keys = ON');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      testDb.exec(schema);

      const now = new Date().toISOString();
      const hash = await bcrypt.hash('existing-hash', 12);
      testDb.prepare(
        "INSERT INTO users (id, name, username, email, password_hash, role, status, last_access, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run('existing', 'Existing', 'taken', 'taken@pacta.local', hash, 'viewer', 'active', now, now);

      vi.doMock('@/lib/db', () => ({
        getDb: () => testDb,
        getTestDb: () => testDb,
        closeDb: () => { testDb.close(); },
      }));

      const { POST } = await import('@/app/next_api/auth/register/route');
      const request = new Request('http://localhost/next_api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New User',
          username: 'taken',
          password: 'SecureP@ss123!',
        }),
      });

      const response = await POST(request as NextRequest);
      expect(response.status).toBe(409);

      testDb.close();
    });
  });

  describe('password validation', () => {
    it('rejects password shorter than 12 characters', async () => {
      const { passwordSchema } = await import('@/lib/validation-schemas');
      const result = passwordSchema.safeParse('Short1!');
      expect(result.success).toBe(false);
    });

    it('rejects password without uppercase', async () => {
      const { passwordSchema } = await import('@/lib/validation-schemas');
      const result = passwordSchema.safeParse('lowercase12345!');
      expect(result.success).toBe(false);
    });

    it('rejects password without lowercase', async () => {
      const { passwordSchema } = await import('@/lib/validation-schemas');
      const result = passwordSchema.safeParse('UPPERCASE12345!');
      expect(result.success).toBe(false);
    });

    it('rejects password without number', async () => {
      const { passwordSchema } = await import('@/lib/validation-schemas');
      const result = passwordSchema.safeParse('NoNumberHere!aaaa');
      expect(result.success).toBe(false);
    });

    it('rejects password without special character', async () => {
      const { passwordSchema } = await import('@/lib/validation-schemas');
      const result = passwordSchema.safeParse('NoSpecial123456');
      expect(result.success).toBe(false);
    });

    it('accepts valid strong password', async () => {
      const { passwordSchema } = await import('@/lib/validation-schemas');
      const result = passwordSchema.safeParse('SecureP@ss123!');
      expect(result.success).toBe(true);
    });
  });
});
