import CrudOperations from '@/lib/crud-operations';
import { createSuccessResponse } from '@/lib/create-response';
import { withAuth } from '@/lib/auth-middleware';
import { validateRequestBodyWithSchema } from '@/lib/api-utils';
import { createExampleSchema } from '@/lib/validation-schemas';

// GET request - list examples
export const GET = withAuth(async (request, { user }) => {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "10");
  const offset = parseInt(searchParams.get("offset") || "0");
  const search = searchParams.get("search");

  // Create CRUD operations instance with auth token
  const examplesCrud = new CrudOperations("examples");

  // Build filter conditions
  const filters: Record<string, any> = {};
  if (search) {
    // Search by name field using ilike for case-insensitive search
    filters.name = { operator: 'ilike', value: `%${search}%` };
  }

  const data = await examplesCrud.findMany(filters, { limit, offset });
  return createSuccessResponse(data);
});

// POST request - create example
export const POST = withAuth(async (request, { user }) => {
  const validatedBody = await validateRequestBodyWithSchema(request, createExampleSchema);

  const examplesCrud = new CrudOperations("examples");
  const data = await examplesCrud.create(validatedBody);
  return createSuccessResponse(data, 201);
});
