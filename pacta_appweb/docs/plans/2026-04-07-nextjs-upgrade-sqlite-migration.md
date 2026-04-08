# Next.js Security Upgrade + SQLite Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade Next.js to patch CVE-2025-66478 and replace Supabase/PostgREST with local SQLite + bcrypt auth.

**Architecture:** Replace Supabase database with better-sqlite3 (synchronous, file-based), swap Supabase JWT auth for local bcrypt + JWT via jose, and keep all existing API route interfaces unchanged.

**Tech Stack:** Next.js 15.5.0, better-sqlite3, bcrypt, jose, TypeScript, Zod

---

## Task 1: Upgrade Next.js and Remove Supabase Dependencies

**Files:**
- Modify: `package.json`
- Modify: `next.config.ts:34,63` (CSP headers)

**Step 1: Update package.json dependencies**

Change in `package.json`:
```json
// Change:
"next": "15.2.4"  →  "next": "15.5.0"

// Remove these lines entirely:
"@supabase/postgrest-js": "^1.19.4",
"@supabase/supabase-js": "^2.85.0",

// Change eslint-config-next to match next version:
"eslint-config-next": "15.2.4"  →  "eslint-config-next": "15.5.0"
```

**Step 2: Update CSP headers in next.config.ts**

Replace both occurrences of `https://api.supabase.co` in the `connect-src` values with just `'self'`:

```typescript
// Line ~34 (api route CSP):
value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self';",

// Line ~63 (page CSP):
value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self';",
```

**Step 3: Reinstall dependencies**

Run: `rm -rf node_modules package-lock.json && npm install`
Expected: Clean install with no ERESOLVE errors

**Step 4: Verify Next.js version**

Run: `npm list next`
Expected: `pacta@0.1.0 → next@15.5.0`

**Step 5: Commit**

```bash
git add package.json next.config.ts
git commit -m "chore: upgrade next.js to 15.5.0, remove supabase deps"
```

---

## Task 2: Add SQLite and bcrypt Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Add new dependencies**

Run these commands:
```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3 bcrypt
```

Note: `bcrypt` is a runtime dependency (not dev), install without `-D`:
```bash
npm install bcrypt
```

**Step 2: Verify installation**

Run: `node -e "require('better-sqlite3'); console.log('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add better-sqlite3 and bcrypt dependencies"
```

---

## Task 3: Create SQLite Database Layer

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/schema.sql`
- Modify: `.gitignore`

**Step 1: Create schema.sql**

Create `src/lib/schema.sql`:

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin', 'manager', 'editor', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    last_access TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    reu_code TEXT NOT NULL,
    contacts TEXT NOT NULL,
    document_url TEXT,
    document_key TEXT,
    document_name TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    reu_code TEXT NOT NULL,
    contacts TEXT NOT NULL,
    document_url TEXT,
    document_key TEXT,
    document_name TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS authorized_signers (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    company_type TEXT NOT NULL CHECK(company_type IN ('client', 'supplier')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    position TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    document_url TEXT,
    document_key TEXT,
    document_name TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    contract_number TEXT NOT NULL,
    title TEXT NOT NULL,
    client_id TEXT NOT NULL REFERENCES clients(id),
    supplier_id TEXT NOT NULL REFERENCES suppliers(id),
    client_signer_id TEXT NOT NULL,
    supplier_signer_id TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('service', 'purchase', 'lease', 'partnership', 'employment', 'other')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('active', 'expired', 'pending', 'cancelled')),
    description TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supplements (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES contracts(id),
    supplement_number TEXT NOT NULL,
    description TEXT NOT NULL,
    effective_date TEXT NOT NULL,
    modifications TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'active')),
    document_url TEXT,
    document_key TEXT,
    document_name TEXT,
    client_signer_id TEXT NOT NULL,
    supplier_signer_id TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES contracts(id),
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_url TEXT NOT NULL,
    file_key TEXT NOT NULL,
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES contracts(id),
    contract_number TEXT NOT NULL,
    contract_title TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('expiration_30', 'expiration_15', 'expiration_7')),
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread', 'read', 'acknowledged')),
    created_at TEXT NOT NULL,
    read_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES contracts(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    timestamp TEXT NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_supplier_id ON contracts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_supplements_contract_id ON supplements(contract_id);
CREATE INDEX IF NOT EXISTS idx_documents_contract_id ON documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_notifications_contract_id ON notifications(contract_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_contract_id ON audit_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
```

**Step 2: Create db.ts**

Create `src/lib/db.ts`:

```typescript
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

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Initialize schema if this is a new database
    const isNew = !fs.existsSync(DB_PATH) || fs.statSync(DB_PATH).size === 0;
    if (isNew) {
      initSchema(db);
    }
  }
  return db;
}

function initSchema(database: Database.Database): void {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  database.exec(schema);
}

/**
 * Create an in-memory database for testing
 */
export function getTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
  return db;
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

export type Row = Database.Row;
```

**Step 3: Update .gitignore**

Add to the end of `.gitignore`:

```
# SQLite database
data/*.db
data/*.db-wal
data/*.db-shm
```

**Step 4: Create data directory**

Run: `mkdir -p data`

**Step 5: Verify database initialization**

Run: `node -e "const {getDb} = require('./src/lib/db'); const db = getDb(); console.log('Tables:', db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all().map(t => t.name)); process.exit(0)"`

Expected: Array of table names including `users`, `clients`, `suppliers`, `contracts`, etc.

**Step 6: Commit**

```bash
git add src/lib/db.ts src/lib/schema.sql .gitignore data/.gitkeep
git commit -m "feat: add SQLite database layer with schema"
```

---

## Task 4: Create Seed Data

**Files:**
- Create: `src/lib/seed.ts`

**Step 1: Create seed.ts**

Create `src/lib/seed.ts`:

```typescript
import { getDb } from './db';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

export async function seedDatabase(): Promise<void> {
  const db = getDb();

  // Check if data already exists
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0) {
    return; // Already seeded
  }

  const now = new Date().toISOString();

  // Hash default admin password
  const passwordHash = await bcrypt.hash('pacta123', BCRYPT_ROUNDS);

  // Insert admin user
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, status, last_access, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('1', 'Pacta User', 'admin@pacta.local', passwordHash, 'admin', 'active', now, now);

  // Insert sample client
  db.prepare(`
    INSERT INTO clients (id, name, address, reu_code, contacts, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('1', 'Sample Client SA', '123 Main St', 'REU-001', 'contact@sample.com', '1', now, now);

  // Insert sample supplier
  db.prepare(`
    INSERT INTO suppliers (id, name, address, reu_code, contacts, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('1', 'Sample Supplier SRL', '456 Oak Ave', 'REU-002', 'info@supplier.com', '1', now, now);

  console.log('Database seeded successfully');
}
```

**Step 2: Wire seed into dev server**

The seed should run on first API request. No changes needed to `db.ts` since it auto-initializes schema. The seed function will be called from the health check or first API request.

For now, create a simple init endpoint. Modify `src/app/next_api/health/route.ts`:

```typescript
import { createSuccessResponse } from '@/lib/create-response';
import { requestMiddleware } from "@/lib/api-utils";
import { seedDatabase } from '@/lib/seed';

// Seed on first request
let seeded = false;

// GET request - health check endpoint
export const GET = requestMiddleware(async () => {
  if (!seeded) {
    await seedDatabase();
    seeded = true;
  }
  return createSuccessResponse({ status: 'ok' });
});

// POST request - health check endpoint
export const POST = requestMiddleware(async () => {
  return createSuccessResponse({ status: 'ok' });
});
```

**Step 3: Verify seed works**

Run: `npm run dev` then `curl http://localhost:3000/next_api/health`
Expected: `{"success":true,"data":{"status":"ok"}}`

Then verify admin user exists:
Run: `node -e "const {getDb} = require('./src/lib/db'); const db = getDb(); console.log(db.prepare('SELECT id, name, email, role FROM users').all())"`
Expected: Admin user record

**Step 4: Commit**

```bash
git add src/lib/seed.ts src/app/next_api/health/route.ts
git commit -m "feat: add seed data with default admin user"
```

---

## Task 5: Rewrite Auth System (bcrypt + JWT)

**Files:**
- Create: `src/lib/auth.ts` (replace existing auth.ts)
- Modify: `src/lib/auth-middleware.ts` (rewrite)
- Modify: `.env.example`

**Step 1: Create new auth.ts**

Replace `src/lib/auth.ts` entirely:

```typescript
import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import { getDb } from './db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars!!'
);

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = '24h';

// Warn if using default secret
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('WARNING: Using default JWT_SECRET. Set a secure secret in production!');
}

export interface JWTPayload {
  sub: string;  // user id
  role: string;
  iat?: number;
  exp?: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      sub: payload.sub!,
      role: (payload as any).role,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<{ token: string; user: any } | null> {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND status = ?', email, 'active').get();

  if (!user) return null;

  const valid = await verifyPassword(password, (user as any).password_hash);
  if (!valid) return null;

  // Update last access
  db.prepare('UPDATE users SET last_access = ? WHERE id = ?', new Date().toISOString(), (user as any).id).run();

  const token = await createToken((user as any).id, (user as any).role);

  return {
    token,
    user: {
      id: (user as any).id,
      name: (user as any).name,
      email: (user as any).email,
      role: (user as any).role,
      status: (user as any).status,
      lastAccess: (user as any).last_access,
      createdAt: (user as any).created_at,
    },
  };
}

export async function register(name: string, email: string, password: string): Promise<{ token: string; user: any } | null> {
  const db = getDb();

  // Check if email exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return null;

  const id = Date.now().toString();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  db.prepare(
    'INSERT INTO users (id, name, email, password_hash, role, status, last_access, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name, email, passwordHash, 'viewer', 'active', now, now);

  return login(email, password);
}
```

**Step 2: Rewrite auth-middleware.ts**

Replace `src/lib/auth-middleware.ts` entirely:

```typescript
import { NextRequest } from 'next/server';
import { verifyToken, JWTPayload } from './auth';
import { getDb } from './db';
import { createErrorResponse } from './create-response';

/**
 * Middleware to authenticate requests using JWT tokens
 */
export async function authenticateRequest(request: NextRequest): Promise<{ user: any; token: string } | Response> {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse({
        errorMessage: 'Authorization header with Bearer token required',
        status: 401,
      });
    }

    const token = authHeader.substring(7);

    if (!token) {
      return createErrorResponse({
        errorMessage: 'JWT token is required',
        status: 401,
      });
    }

    const payload = await verifyToken(token);

    if (!payload) {
      return createErrorResponse({
        errorMessage: 'Invalid or expired token',
        status: 401,
      });
    }

    // Fetch user from database
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, role, status, last_access, created_at FROM users WHERE id = ?', payload.sub).get();

    if (!user || (user as any).status !== 'active') {
      return createErrorResponse({
        errorMessage: 'User not found or inactive',
        status: 401,
      });
    }

    return { user, token };
  } catch (error) {
    console.error('Authentication error:', error);
    return createErrorResponse({
      errorMessage: 'Authentication failed',
      status: 401,
    });
  }
}

/**
 * Higher-order function that wraps route handlers with authentication
 */
export function withAuth(
  handler: (request: NextRequest, context: { user: any; token: string }) => Promise<Response>
) {
  return async (request: NextRequest): Promise<Response> => {
    const authResult = await authenticateRequest(request);

    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, token } = authResult;

    try {
      return await handler(request, { user, token });
    } catch (error) {
      console.error('Handler error:', error);

      const anyError = error as any;
      const errorMessage: string =
        typeof anyError?.message === "string"
          ? anyError.message
          : "Internal server error";
      const status: number =
        typeof anyError?.statusCode === "number"
          ? anyError.statusCode
          : 500;

      return createErrorResponse({
        errorMessage,
        status,
      });
    }
  };
}
```

**Step 3: Update .env.example**

Replace `.env.example` content:

```
JWT_SECRET = your-jwt-secret-min-32-characters
```

**Step 4: Commit**

```bash
git add src/lib/auth.ts src/lib/auth-middleware.ts .env.example
git commit -m "feat: replace Supabase auth with bcrypt + JWT"
```

---

## Task 6: Create Auth API Routes

**Files:**
- Create: `src/app/next_api/auth/login/route.ts`
- Create: `src/app/next_api/auth/register/route.ts`

**Step 1: Create login route**

Create `src/app/next_api/auth/login/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { login } from '@/lib/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/create-response';
import { requestMiddleware, validateRequestBody } from '@/lib/api-utils';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const POST = requestMiddleware(async (request: NextRequest) => {
  const body = await validateRequestBody(request);

  try {
    const { email, password } = loginSchema.parse(body);
  } catch (e) {
    return createErrorResponse({
      errorMessage: (e as z.ZodError).errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '),
      status: 400,
    });
  }

  const { email, password } = loginSchema.parse(body);
  const result = await login(email, password);

  if (!result) {
    return createErrorResponse({
      errorMessage: 'Invalid email or password',
      status: 401,
    });
  }

  return createSuccessResponse({ token: result.token, user: result.user });
});
```

**Step 2: Create register route**

Create `src/app/next_api/auth/register/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { register } from '@/lib/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/create-response';
import { requestMiddleware, validateRequestBody } from '@/lib/api-utils';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const POST = requestMiddleware(async (request: NextRequest) => {
  const body = await validateRequestBody(request);

  try {
    const { name, email, password } = registerSchema.parse(body);
  } catch (e) {
    return createErrorResponse({
      errorMessage: (e as z.ZodError).errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '),
      status: 400,
    });
  }

  const { name, email, password } = registerSchema.parse(body);
  const result = await register(name, email, password);

  if (!result) {
    return createErrorResponse({
      errorMessage: 'Email already registered',
      status: 409,
    });
  }

  return createSuccessResponse({ token: result.token, user: result.user }, 201);
});
```

**Step 3: Test login flow**

Run: `npm run dev`

Then test:
```bash
# Login with default admin
curl -X POST http://localhost:3000/next_api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pacta.local","password":"pacta123"}'
```
Expected: `{"success":true,"data":{"token":"eyJ...","user":{...}}}`

**Step 4: Commit**

```bash
git add src/app/next_api/auth/login/route.ts src/app/next_api/auth/register/route.ts
git commit -m "feat: add auth API routes (login, register)"
```

---

## Task 7: Rewrite CRUD Operations for SQLite

**Files:**
- Modify: `src/lib/crud-operations.ts` (complete rewrite)
- Modify: `src/lib/api-utils.ts` (remove SUPABASE_* validation)

**Step 1: Rewrite crud-operations.ts**

Replace `src/lib/crud-operations.ts` entirely:

```typescript
import { getDb } from "./db";

/**
 * Custom error classes for better error handling
 */
export class ValidationError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public code?: string, public statusCode: number = 500) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Type for filter values supporting both simple and advanced operators
 */
type FilterValue = any | { operator: string; value: any };

/**
 * Utility class for common CRUD operations with SQLite
 */
export default class CrudOperations {
  constructor(private tableName: string) {}

  /**
   * Fetches multiple records with optional filtering, sorting, and pagination
   */
  async findMany(
    filters?: Record<string, FilterValue>,
    params?: {
      limit?: number;
      offset?: number;
      orderBy?: {
        column: string;
        direction: "asc" | "desc";
      };
    },
  ) {
    const { limit, offset, orderBy } = params || {};

    let sql = `SELECT * FROM ${this.tableName}`;
    const values: any[] = [];
    const whereClauses: string[] = [];

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object' && value !== null && 'operator' in value && 'value' in value) {
            const { operator, value: val } = value;
            switch (operator) {
              case 'eq':
                whereClauses.push(`${key} = ?`);
                values.push(val);
                break;
              case 'neq':
                whereClauses.push(`${key} != ?`);
                values.push(val);
                break;
              case 'gt':
                whereClauses.push(`${key} > ?`);
                values.push(val);
                break;
              case 'lt':
                whereClauses.push(`${key} < ?`);
                values.push(val);
                break;
              case 'gte':
                whereClauses.push(`${key} >= ?`);
                values.push(val);
                break;
              case 'lte':
                whereClauses.push(`${key} <= ?`);
                values.push(val);
                break;
              case 'like':
                whereClauses.push(`${key} LIKE ?`);
                values.push(val);
                break;
              case 'ilike':
                whereClauses.push(`LOWER(${key}) LIKE LOWER(?)`);
                values.push(val);
                break;
              case 'in':
                const placeholders = (val as any[]).map(() => '?').join(',');
                whereClauses.push(`${key} IN (${placeholders})`);
                values.push(...val);
                break;
              default:
                throw new ValidationError(`Unsupported filter operator: ${operator}`);
            }
          } else {
            whereClauses.push(`${key} = ?`);
            values.push(value);
          }
        }
      });
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    if (orderBy) {
      const dir = orderBy.direction === 'asc' ? 'ASC' : 'DESC';
      sql += ` ORDER BY ${orderBy.column} ${dir}`;
    }

    if (limit && offset !== undefined) {
      sql += ` LIMIT ? OFFSET ?`;
      values.push(limit, offset);
    }

    try {
      const db = getDb();
      const rows = db.prepare(sql).all(...values);
      return rows;
    } catch (error: any) {
      console.error(`Database error in findMany for ${this.tableName}: ${error.message}`);
      throw new DatabaseError(`Failed to fetch ${this.tableName}: ${error.message}`, error.code);
    }
  }

  /**
   * Fetches a single record by its ID
   */
  async findById(id: string | number) {
    try {
      const db = getDb();
      const row = db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id);
      return row || null;
    } catch (error: any) {
      console.error(`Database error in findById for ${this.tableName}: ${error.message}`);
      throw new DatabaseError(`Failed to fetch ${this.tableName} by id: ${error.message}`, error.code);
    }
  }

  /**
   * Creates a new record in the table
   */
  async create(data: Record<string, any>) {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(',');
    const values = Object.values(data);

    const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

    try {
      const db = getDb();
      const result = db.prepare(sql).run(...values);
      return db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(result.lastInsertRowid);
    } catch (error: any) {
      console.error(`Database error in create for ${this.tableName}: ${error.message}`);
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new ValidationError(`Duplicate entry in ${this.tableName}`);
      }
      if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        throw new ValidationError(`Invalid foreign key reference in ${this.tableName}`);
      }
      throw new DatabaseError(`Failed to create ${this.tableName}: ${error.message}`, error.code);
    }
  }

  /**
   * Updates an existing record by ID
   */
  async update(id: string | number, data: Record<string, any>) {
    const columns = Object.keys(data);
    const setClause = columns.map(col => `${col} = ?`).join(',');
    const values = [...Object.values(data), id];

    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;

    try {
      const db = getDb();
      const result = db.prepare(sql).run(...values);

      if (result.changes === 0) {
        return null;
      }

      return db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id);
    } catch (error: any) {
      console.error(`Database error in update for ${this.tableName}: ${error.message}`);
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new ValidationError(`Duplicate entry in ${this.tableName}`);
      }
      throw new DatabaseError(`Failed to update ${this.tableName}: ${error.message}`, error.code);
    }
  }

  /**
   * Deletes a record by ID
   */
  async delete(id: string | number) {
    try {
      const db = getDb();
      const result = db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);

      if (result.changes === 0) {
        return null;
      }

      return { id };
    } catch (error: any) {
      console.error(`Database error in delete for ${this.tableName}: ${error.message}`);
      throw new DatabaseError(`Failed to delete ${this.tableName}: ${error.message}`, error.code);
    }
  }
}
```

**Step 2: Update api-utils.ts**

Replace the `validateEnv` function in `src/lib/api-utils.ts`:

Change from:
```typescript
export function validateEnv(): void {
  const requiredVars = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
  ];
  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}
```

To:
```typescript
export function validateEnv(): void {
  // SQLite doesn't require env vars for local dev
  // Only validate JWT_SECRET in production
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/crud-operations.ts src/lib/api-utils.ts
git commit -m "refactor: rewrite CRUD operations for SQLite"
```

---

## Task 8: Update Example API Routes

**Files:**
- Modify: `src/app/next_api/example/route.ts`
- Modify: `src/app/next_api/example/[id]/route.ts`

**Step 1: Update example/route.ts**

The existing example routes use `CrudOperations` with a token parameter. The new `CrudOperations` constructor no longer takes a token. Update both files:

In `src/app/next_api/example/route.ts`, change:
```typescript
// From:
const examplesCrud = new CrudOperations("examples", token);

// To:
const examplesCrud = new CrudOperations("examples");
```

Remove the import for `createPostgrestClient` if present (it won't be, since we replaced the whole file).

**Step 2: Update example/[id]/route.ts**

Same change in `src/app/next_api/example/[id]/route.ts`:
```typescript
// From:
const examplesCrud = new CrudOperations("examples", token);

// To:
const examplesCrud = new CrudOperations("examples");
```

**Step 3: Create examples table for testing**

Add to `src/lib/schema.sql` before the indexes section:

```sql
-- Examples table (for testing/demo purposes)
CREATE TABLE IF NOT EXISTS examples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

**Step 4: Commit**

```bash
git add src/app/next_api/example/route.ts src/app/next_api/example/[id]/route.ts src/lib/schema.sql
git commit -m "fix: update example routes for SQLite CRUD interface"
```

---

## Task 9: Remove Supabase References from Frontend Storage

**Files:**
- Modify: `src/lib/storage.ts` (keep as-is, it's localStorage-based frontend storage)
- Modify: `src/lib/auth.ts` (frontend auth - already replaced in Task 5)

**Step 1: Verify storage.ts is independent**

The `src/lib/storage.ts` file uses localStorage (browser-side) and is NOT connected to Supabase. It should remain unchanged - it handles frontend state independently of the backend API.

**Step 2: Verify no remaining Supabase imports**

Run: `grep -r "@supabase" src/ --include="*.ts" --include="*.tsx"`
Expected: No matches

**Step 3: Verify no remaining SUPABASE_ env references**

Run: `grep -r "SUPABASE" src/ --include="*.ts" --include="*.tsx"`
Expected: No matches

**Step 4: Commit (if any changes found)**

```bash
git add -A
git commit -m "chore: remove remaining Supabase references"
```

---

## Task 10: Build Verification and Cleanup

**Files:**
- All files (verification only)

**Step 1: Run lint**

Run: `npm run lint`
Expected: No errors (eslint is configured to ignore during builds)

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 3: Start dev server**

Run: `npm run dev`

**Step 4: Test health endpoint**

Run: `curl http://localhost:3000/next_api/health`
Expected: `{"success":true,"data":{"status":"ok"}}`

**Step 5: Test auth flow**

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/next_api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pacta.local","password":"pacta123"}' \
  | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).data.token))")

# Use token to access protected endpoint
curl http://localhost:3000/next_api/example \
  -H "Authorization: Bearer $TOKEN"
```
Expected: `{"success":true,"data":[]}` (empty array, no examples yet)

**Step 6: Test invalid auth**

Run: `curl http://localhost:3000/next_api/example -H "Authorization: Bearer invalid-token"`
Expected: `{"success":false,"errorCode":null,"errorMessage":"Invalid or expired token","status":401}`

**Step 7: Final commit**

```bash
git add -A
git commit -m "chore: verify build and auth flow"
```

---

## Task 11: Update .env.example and Documentation

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

**Step 1: Update .env.example**

Ensure `.env.example` contains:

```
JWT_SECRET = your-jwt-secret-min-32-characters-long-and-secure
```

**Step 2: Update README.md**

Add a "Getting Started" section after the existing intro:

```markdown
## Getting Started

### Prerequisites

- Node.js 18+
- pnpm or npm

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and set JWT_SECRET
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. The SQLite database will be created automatically in `data/pacta.db`

5. Default login credentials:
   - Email: `admin@pacta.local`
   - Password: `pacta123`

### API Endpoints

- `POST /next_api/auth/login` - Login with email/password
- `POST /next_api/auth/register` - Register new user
- `GET /next_api/health` - Health check
- `GET /next_api/example` - List examples (requires auth)
- `POST /next_api/example` - Create example (requires auth)
- `PUT /next_api/example/:id` - Update example (requires auth)
- `DELETE /next_api/example/:id` - Delete example (requires auth)
```

**Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "docs: update env vars and README for SQLite migration"
```

---

## Summary of Files Changed

| Action | File |
|--------|------|
| Modify | `package.json` |
| Modify | `next.config.ts` |
| Modify | `.gitignore` |
| Modify | `.env.example` |
| Modify | `README.md` |
| Modify | `src/lib/crud-operations.ts` |
| Modify | `src/lib/api-utils.ts` |
| Modify | `src/lib/auth.ts` |
| Modify | `src/lib/auth-middleware.ts` |
| Modify | `src/lib/storage.ts` (no changes, verified) |
| Modify | `src/app/next_api/health/route.ts` |
| Modify | `src/app/next_api/example/route.ts` |
| Modify | `src/app/next_api/example/[id]/route.ts` |
| Create | `src/lib/db.ts` |
| Create | `src/lib/schema.sql` |
| Create | `src/lib/seed.ts` |
| Create | `src/app/next_api/auth/login/route.ts` |
| Create | `src/app/next_api/auth/register/route.ts` |
| Create | `data/` directory |
