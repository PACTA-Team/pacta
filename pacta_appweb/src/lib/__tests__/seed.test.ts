import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const SCHEMA_PATH = path.join(__dirname, '../schema.sql');

function createFreshDb(): Database.Database {
  const testDb = new Database(':memory:');
  testDb.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  testDb.exec(schema);
  return testDb;
}

// Mutable reference that each test can reset
let currentTestDb: Database.Database | null = null;

vi.mock('@/lib/db', () => ({
  getDb: () => {
    if (!currentTestDb) {
      currentTestDb = createFreshDb();
    }
    return currentTestDb;
  },
  getTestDb: () => createFreshDb(),
  closeDb: () => { currentTestDb = null; },
}));

describe('Task 2: Remove Hardcoded Default Credentials', () => {
  beforeEach(() => {
    currentTestDb = createFreshDb();
    vi.resetModules();
  });

  afterEach(() => {
    if (currentTestDb) {
      currentTestDb.close();
      currentTestDb = null;
    }
    vi.clearAllMocks();
  });

  describe('seedDatabase', () => {
    it('does NOT create a default admin user', async () => {
      const { seedDatabase } = await import('@/lib/seed');
      await seedDatabase();

      const adminCount = currentTestDb!.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
      expect(adminCount.count).toBe(0);
    });

    it('creates only schema, no users', async () => {
      const { seedDatabase } = await import('@/lib/seed');
      await seedDatabase();

      const userCount = currentTestDb!.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      expect(userCount.count).toBe(0);

      // Tables should exist but be empty (no sample data due to FK constraints)
      const tables = currentTestDb!.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
      expect(tables.length).toBeGreaterThan(5);
    });

    it('is idempotent - does not fail if called when data exists', async () => {
      const { seedDatabase } = await import('@/lib/seed');
      await seedDatabase();
      // Second call should not throw
      await seedDatabase();
    });
  });

  describe('hasAdminUser', () => {
    it('returns false when no admin exists', async () => {
      const { hasAdminUser } = await import('@/lib/seed');
      expect(hasAdminUser()).toBe(false);
    });

    it('returns true when admin exists', async () => {
      const now = new Date().toISOString();
      currentTestDb!.prepare(
        "INSERT INTO users (id, name, username, email, password_hash, role, status, last_access, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run('admin-1', 'Admin', 'admin', 'admin@test.com', 'hash', 'admin', 'active', now, now);

      const { hasAdminUser } = await import('@/lib/seed');
      expect(hasAdminUser()).toBe(true);
    });
  });

  describe('createAdminUser', () => {
    it('creates an admin user successfully', async () => {
      const { createAdminUser } = await import('@/lib/seed');
      const result = await createAdminUser('Test Admin', 'admin', 'SecureP@ss123!');

      expect(result.success).toBe(true);

      const admin = currentTestDb!.prepare("SELECT * FROM users WHERE role = 'admin'").get() as any;
      expect(admin).toBeDefined();
      expect(admin.name).toBe('Test Admin');
      expect(admin.username).toBe('admin');
      expect(admin.role).toBe('admin');
      expect(admin.status).toBe('active');
    });

    it('fails if admin already exists', async () => {
      const { createAdminUser } = await import('@/lib/seed');

      const result1 = await createAdminUser('Admin One', 'admin1', 'SecureP@ss123!');
      expect(result1.success).toBe(true);

      const result2 = await createAdminUser('Admin Two', 'admin2', 'SecureP@ss123!');
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Admin user already exists');
    });

    it('fails if username is already taken', async () => {
      // Insert a non-admin user with the target username (no admin exists yet)
      const now = new Date().toISOString();
      currentTestDb!.prepare(
        "INSERT INTO users (id, name, username, email, password_hash, role, status, last_access, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run('existing', 'Existing', 'taken', 'existing@test.com', 'hash', 'viewer', 'active', now, now);

      const { createAdminUser } = await import('@/lib/seed');
      const result = await createAdminUser('New Admin', 'taken', 'SecureP@ss123!');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Username already taken');
    });
  });
});
