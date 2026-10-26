import { NextResponse } from 'next/server';

/**
 * Demo seeding has been permanently removed from production.
 * Only genuine user-uploaded materials and real assessments are processed.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Demo data seeding has been permanently removed. Please upload real study materials.' },
    { status: 404 }
  );
}
