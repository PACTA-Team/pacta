import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, createToken } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createErrorResponse } from '@/lib/create-response';
import { z } from 'zod';

const setupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = setupSchema.safeParse(body);

    if (!parsed.success) {
      return createErrorResponse({
        errorMessage: parsed.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '),
        status: 400,
      });
    }

    const { name, email, password } = parsed.data;

    const db = getDb();

    // Check if any active admin already exists
    const existingAdmin = db.prepare(
      "SELECT id FROM users WHERE role = 'admin' AND status = 'active'"
    ).get();

    if (existingAdmin) {
      return createErrorResponse({
        errorMessage: 'Setup already completed. Admin account already exists.',
        status: 403,
      });
    }

    // Check if email already exists
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) {
      return createErrorResponse({
        errorMessage: 'Email already in use',
        status: 400,
      });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);

    db.prepare(
      'INSERT INTO users (id, name, email, username, password_hash, role, status, last_access, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, name, email, email.split('@')[0], passwordHash, 'admin', 'active', null, now);

    // Remove first-run flag
    const fs = require('fs');
    const path = require('path');
    const firstRunPath = path.join(process.cwd(), 'data', '.first-run');
    if (fs.existsSync(firstRunPath)) {
      fs.unlinkSync(firstRunPath);
    }

    const token = await createToken(id, 'admin');

    const response = NextResponse.json({
      success: true,
      data: {
        user: { id, name, email, role: 'admin' },
      },
    });

    const isProd = process.env.NODE_ENV === 'production';
    response.cookies.set('pacta_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    const isProd = process.env.NODE_ENV === 'production';
    return createErrorResponse({
      errorCode: error.code,
      errorMessage: isProd ? 'An internal error occurred' : error.message,
      status: 500,
    });
  }
}
