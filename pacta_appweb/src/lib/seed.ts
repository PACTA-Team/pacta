import { getDb } from './db';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

/**
 * Seed database with initial data.
 * NO default users - admin is created via /setup wizard.
 */
export async function seedDatabase(): Promise<void> {
  const db = getDb();

  // Check if data already exists
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0) {
    return; // Already seeded
  }

  const now = new Date().toISOString();

  // Note: We don't seed sample clients/suppliers here because they require
  // a valid created_by user reference. Sample data can be added via the UI.
  console.log('[SEED] Database schema initialized. Run /setup wizard to create admin.');
}

/**
 * Check if admin user exists in the database.
 * Used by middleware to determine if /setup should be accessible.
 */
export function hasAdminUser(): boolean {
  const db = getDb();
  const result = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
  return result.count > 0;
}

/**
 * Create admin user (called only by /setup wizard).
 */
export async function createAdminUser(name: string, username: string, password: string): Promise<{ success: boolean; error?: string }> {
  const db = getDb();

  // Check if admin already exists
  if (hasAdminUser()) {
    return { success: false, error: 'Admin user already exists' };
  }

  // Check if username is taken
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return { success: false, error: 'Username already taken' };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  db.prepare(`
    INSERT INTO users (id, name, username, email, password_hash, role, status, last_access, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, username, `${username}@pacta.local`, passwordHash, 'admin', 'active', now, now);

  console.log(`[SETUP] Admin user created: ${username}`);
  return { success: true };
}
