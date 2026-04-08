import { NextRequest } from "next/server";
import { createErrorResponse } from "./create-response";
import { z } from "zod";

/**
 * Validates that required environment variables are set
 */
export function validateEnv(): void {
  // SQLite doesn't require env vars for local dev
  // Only validate JWT_SECRET in production
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
}

/**
 * Parses common query parameters from a request URL
 */
export function parseQueryParams(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  return {
    limit: parseInt(searchParams.get("limit") || "10"),
    offset: parseInt(searchParams.get("offset") || "0"),
    id: searchParams.get("id"),
    search: searchParams.get("search"),
  };
}

/**
 * Validates and parses JSON request body with error handling
 */
export async function validateRequestBody(request: NextRequest): Promise<any> {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      throw new Error("Invalid request body");
    }

    return body;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON in request body");
    }
    throw error;
  }
}

/**
 * Validates request body against a Zod schema and sanitizes strings
 */
export async function validateRequestBodyWithSchema<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<T> {
  const body = await validateRequestBody(request);
  const sanitizedBody = sanitizeObject(body);

  try {
    return schema.parse(sanitizedBody);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }
    throw error;
  }
}

/**
 * Validates query parameters against a Zod schema
 */
export function validateQueryParams<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): T {
  const searchParams = request.nextUrl.searchParams;
  const queryData: Record<string, string> = {};

  // Convert URLSearchParams to plain object
  searchParams.forEach((value, key) => {
    queryData[key] = value;
  });

  try {
    return schema.parse(queryData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new Error(`Query validation failed: ${errorMessages}`);
    }
    throw error;
  }
}

/**
 * Sanitizes string inputs to prevent XSS attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input;

  return input
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes object properties recursively
 */
export function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (obj !== null && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
}

/**
 * Higher-order function Verify token
 */
export function requestMiddleware(
  handler: (request: NextRequest) => Promise<Response>
) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      return await handler(request);
    }
    catch (error: unknown) {
      // Pass through Response objects as-is
      if (error instanceof Response) {
        return error;
      }

      const isProd = process.env.NODE_ENV === 'production';
      const anyError = error as any;
      const rawMessage: string =
        typeof anyError?.message === "string"
          ? anyError.message
          : "Request failed";
      const status: number =
        typeof anyError?.status === "number"
          ? anyError.status
          : typeof anyError?.statusCode === "number"
          ? anyError.statusCode
          : 500;
      const errorCode: string | undefined =
        typeof anyError?.code === "string" ? anyError.code : undefined;

      // Sanitize error message in production
      const errorMessage = isProd
        ? (status >= 500 ? 'An internal error occurred' : rawMessage)
        : rawMessage;

      return createErrorResponse({
        errorCode,
        errorMessage,
        status,
      });
    }
  };
}
