import { NextRequest, NextResponse } from 'next/server';

// Paths that don't need setup check
const PUBLIC_PATHS = ['/setup', '/next_api/setup'];
// Static assets that should bypass setup check
const STATIC_PREFIXES = ['/_next/static', '/_next/image', '/favicon.ico'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public paths and static assets
  if (
    PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/')) ||
    STATIC_PREFIXES.some(p => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // Skip API routes that handle their own auth
  if (pathname.startsWith('/next_api/auth/')) {
    return NextResponse.next();
  }

  // Check FIRST_RUN env variable (set by postinst when no admin exists)
  const isFirstRun = process.env.FIRST_RUN === 'true';

  if (isFirstRun) {
    const setupUrl = new URL('/setup', request.url);
    return NextResponse.redirect(setupUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
