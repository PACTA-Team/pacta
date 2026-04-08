import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'pacta.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbExists = fs.existsSync(DB_PATH);
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Initialize schema if this is a new database
    if (!dbExists) {
      initSchema(db);
    } else {
      // Run migrations for existing databases
      runMigrations(db);
    }
  }
  return db;
}

function runMigrations(database: Database.Database): void {
  // Add username column if not present
  try {
    database.exec('ALTER TABLE users ADD COLUMN username TEXT');
  } catch {
    // Column already exists, ignore
  }

  // Add 'pending', 'rejected', 'suspended' to status check if not present
  // SQLite doesn't support ALTER TABLE CHECK constraint, so we handle this at app level
}

function initSchema(database: Database.Database): void {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  database.exec(schema);
}

/**
 * Create an in-memory database for testing
 */
export function getTestDb(): Database.Database {
  const testDb = new Database(':memory:');
  testDb.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  testDb.exec(schema);
  return testDb;
}

/**
 * Close the database connection (for cleanup)
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
