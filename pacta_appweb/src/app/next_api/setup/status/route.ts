import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Lightweight endpoint to check if first-run setup is needed
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const admin = db.prepare(
      "SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1"
    ).get();

    return NextResponse.json({
      firstRun: !admin,
    });
  } catch {
    // If DB error, assume not first run
    return NextResponse.json({ firstRun: false });
  }
}
