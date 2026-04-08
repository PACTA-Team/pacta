import { createSuccessResponse } from '@/lib/create-response';
import { getDb } from '@/lib/db';

// GET request - health check endpoint (read-only, no side effects)
export async function GET() {
  try {
    const db = getDb();
    db.prepare('SELECT 1').get();
    return Response.json(createSuccessResponse({ status: 'ok' }));
  } catch {
    return Response.json(
      { error: { message: 'Database connection failed' } },
      { status: 500 }
    );
  }
}