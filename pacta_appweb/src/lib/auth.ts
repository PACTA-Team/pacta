import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import { getDb } from './db';

// JWT Secret: fail hard in production if not set
let JWT_SECRET: Uint8Array;

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production. Generate one with: openssl rand -base64 32');
  }
  console.warn('[WARN] JWT_SECRET not set. Using generated secret (server restart will invalidate all sessions)');
  JWT_SECRET = new TextEncoder().encode(crypto.randomUUID());
} else {
  JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
}

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = '8h';

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
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND status = ?').get(email, 'active') as any;

  if (!user) return null;

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  // Update last access
  db.prepare('UPDATE users SET last_access = ? WHERE id = ?').run(new Date().toISOString(), user.id);

  const token = await createToken(user.id, user.role);

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      lastAccess: user.last_access,
      createdAt: user.created_at,
    },
  };
}

export async function register(name: string, email: string, password: string, username?: string): Promise<{ user: any } | null> {
  const db = getDb();

  // Check if email or username exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username || null);
  if (existing) return null;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  db.prepare(
    'INSERT INTO users (id, name, email, username, password_hash, role, status, last_access, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name, email, username || null, passwordHash, 'viewer', 'pending', null, now);

  // Return user info without token (pending approval)
  return {
    user: {
      id,
      name,
      email,
      username: username || null,
      role: 'viewer',
      status: 'pending',
      createdAt: now,
    },
  };
}
