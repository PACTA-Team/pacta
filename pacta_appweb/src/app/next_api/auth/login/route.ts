import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/lib/auth';
import { createErrorResponse } from '@/lib/create-response';
import { requestMiddleware, validateRequestBody } from '@/lib/api-utils';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const POST = requestMiddleware(async (request: NextRequest) => {
  const body = await validateRequestBody(request);

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse({
      errorMessage: parsed.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '),
      status: 400,
    });
  }

  const { email, password } = parsed.data;
  const result = await login(email, password);

  if (!result) {
    return createErrorResponse({
      errorMessage: 'Invalid email or password',
      status: 401,
    });
  }

  // Create response with user data (no token in body)
  const response = NextResponse.json({
    success: true,
    data: { user: result.user },
  });

  // Set httpOnly cookies
  const isProd = process.env.NODE_ENV === 'production';
  response.cookies.set('pacta_token', result.token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60,  // 8 hours
  });

  response.cookies.set('pacta_user', JSON.stringify({
    id: result.user.id,
    name: result.user.name,
    role: result.user.role,
  }), {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60,
  });

  return response;
});
