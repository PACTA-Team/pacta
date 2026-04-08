import { NextRequest } from 'next/server';
import { createErrorResponse } from './create-response';

/**
 * Middleware to authenticate requests using headers set by Next.js middleware.
 * Middleware verifies the JWT cookie and injects user info into headers.
 */
export function withAuth(
  handler: (request: NextRequest, context: { user: { id: string; role: string; name: string } }) => Promise<Response>
) {
  return async (request: NextRequest): Promise<Response> => {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    const userName = request.headers.get('x-user-name');

    if (!userId) {
      return createErrorResponse({
        errorMessage: 'Unauthorized',
        status: 401,
      });
    }

    const user = {
      id: userId,
      role: userRole || 'viewer',
      name: userName || 'Unknown',
    };

    try {
      return await handler(request, { user });
    } catch (error) {
      console.error('Handler error:', error);

      const isProd = process.env.NODE_ENV === 'production';
      return createErrorResponse({
        errorMessage: isProd ? 'An internal error occurred' : (error as Error)?.message || 'Internal server error',
        status: 500,
      });
    }
  };
}

/**
 * Require specific roles to access a route.
 * Usage: withAuth(requireRole(['admin', 'manager'])(handler))
 */
export function requireRole(allowedRoles: string[]) {
  return (
    handler: (request: NextRequest, context: { user: { id: string; role: string; name: string } }) => Promise<Response>
  ) => {
    return async (
      request: NextRequest,
      context: { user: { id: string; role: string; name: string } }
    ): Promise<Response> => {
      if (!allowedRoles.includes(context.user.role)) {
        return createErrorResponse({
          errorMessage: 'Forbidden: insufficient permissions',
          status: 403,
        });
      }
      return handler(request, context);
    };
  };
}
