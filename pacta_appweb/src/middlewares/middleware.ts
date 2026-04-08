import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { hasAdminUser } from '@/lib/seed';

// JWT secret (same as auth.ts)
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || crypto.randomUUID()
);

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = 100;
const AUTH_RATE_LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const AUTH_WINDOW_MS = 15 * 60 * 1000;

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const clientIP = request.headers.get('x-client-ip');

  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIP) return realIP;
  if (clientIP) return clientIP;

  const ua = request.headers.get('user-agent') || 'unknown';
  return Buffer.from(ua).toString('base64').slice(0, 16);
}

function checkRateLimit(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= max) return false;

  record.count++;
  return true;
}

// Path classifications
const PUBLIC_PATHS = ['/', '/login', '/_next/static', '/_next/image', '/favicon.ico', '/globals.css'];
const API_PATHS = ['/next_api'];
const SETUP_PATH = '/setup';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIP(request);

  // Stricter rate limiting for auth endpoints
  if (pathname.startsWith('/next_api/auth/')) {
    if (!checkRateLimit(ip, AUTH_RATE_LIMIT, AUTH_WINDOW_MS)) {
      return new NextResponse(JSON.stringify({ error: 'Too many attempts. Try again later.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else if (!checkRateLimit(ip, RATE_LIMIT, WINDOW_MS)) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': Math.ceil((rateLimitMap.get(ip)?.resetTime || Date.now()) / 1000).toString(),
      },
    });
  }

  // Setup wizard: only accessible if no admin exists
  if (pathname === SETUP_PATH) {
    if (hasAdminUser()) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // All other paths: redirect to setup if no admin
  if (!hasAdminUser() && pathname !== SETUP_PATH) {
    return NextResponse.redirect(new URL(SETUP_PATH, request.url));
  }

  // Skip auth for public paths
  if (PUBLIC_PATHS.some(p => {
    if (p === '/') return pathname === '/';
    return pathname === p || pathname.startsWith(p);
  })) {
    return NextResponse.next();
  }

  // Verify JWT from httpOnly cookie
  const token = request.cookies.get('pacta_token')?.value;
  if (!token) {
    // API routes return 401, page routes redirect to login
    if (API_PATHS.some(p => pathname.startsWith(p))) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Inject user info into request headers for downstream handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.sub as string);
    requestHeaders.set('x-user-role', (payload as any).role);
    requestHeaders.set('x-user-name', (payload as any).name || '');

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    // Invalid or expired token
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('pacta_token');
    response.cookies.delete('pacta_user');
    return response;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
