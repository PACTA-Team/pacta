import { NextRequest } from 'next/server';
import { register } from '@/lib/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/create-response';
import { requestMiddleware, validateRequestBody } from '@/lib/api-utils';
import { registerSchema } from '@/lib/validation-schemas';

export const POST = requestMiddleware(async (request: NextRequest) => {
  const body = await validateRequestBody(request);

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse({
      errorMessage: parsed.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '),
      status: 400,
    });
  }

  const { name, username, password } = parsed.data;

  // Use email-like format for internal storage (username@pacta.local)
  const email = `${username}@pacta.local`;

  const result = await register(name, email, password, username);

  if (!result) {
    return createErrorResponse({
      errorMessage: 'Username already taken',
      status: 409,
    });
  }

  // Don't return token - user must wait for admin approval
  return createSuccessResponse({
    message: 'Registration successful. Your account is pending admin approval.',
    userId: result.user.id,
  }, 201);
});
