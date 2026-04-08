import CrudOperations from '@/lib/crud-operations';
import { createSuccessResponse, createErrorResponse } from '@/lib/create-response';
import { withAuth } from '@/lib/auth-middleware';
import { validateRequestBodyWithSchema } from '@/lib/api-utils';
import { updateExampleSchema } from '@/lib/validation-schemas';

// PUT request - update example by id
export const PUT = withAuth(async (request, { user }) => {
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop(); // Extract id from URL path

  if (!id) {
    return createErrorResponse({
      errorMessage: "ID parameter is required",
      status: 400,
    });
  }

  const validatedBody = await validateRequestBodyWithSchema(request, updateExampleSchema);

  const examplesCrud = new CrudOperations("examples");

  // Check if record exists
  const existing = await examplesCrud.findById(id);
  if (!existing) {
    return createErrorResponse({
      errorMessage: "Example not found",
      status: 404,
    });
  }

  const data = await examplesCrud.update(id, validatedBody);
  return createSuccessResponse(data);
});

// DELETE request - delete example by id
export const DELETE = withAuth(async (request, { user }) => {
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop(); // Extract id from URL path

  if (!id) {
    return createErrorResponse({
      errorMessage: "ID parameter is required",
      status: 400,
    });
  }

  const examplesCrud = new CrudOperations("examples");

  // Check if record exists
  const existing = await examplesCrud.findById(id);
  if (!existing) {
    return createErrorResponse({
      errorMessage: "Example not found",
      status: 404,
    });
  }

  await examplesCrud.delete(id);
  return createSuccessResponse({ id }, 200);
});