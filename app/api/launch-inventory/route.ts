import { NextResponse } from 'next/server';

/**
 * Whatever is calling /api/launch-inventory expects this endpoint to exist.
 * We don't know what payload it sends — just redirect to /marketing so the
 * user lands on the right page.
 */
export async function GET() {
  return NextResponse.redirect(new URL('/marketing', 'http://localhost:3000'));
}

export async function POST() {
  return NextResponse.redirect(new URL('/marketing', 'http://localhost:3000'));
}
