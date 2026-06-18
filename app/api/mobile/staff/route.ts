import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMobileSession } from '@/lib/mobileAuth';

// Read endpoint for the mobile Staff Management screen.
// Runs the SAME query as the web app's staff-management/page.tsx so the data matches.
export async function GET() {
  const session = await getMobileSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Staff management is superadmin-only on the web.
  if (session.user.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const staff = await db.users.findMany({
    select: { id: true, name: true, email: true, role: true, branch_name: true, created_at: true },
    orderBy: { role: 'asc' },
  });

  return NextResponse.json({
    staff: staff.map((s) => ({
      id: s.id,
      name: s.name ?? '',
      email: s.email,
      role: s.role ?? 'USER_BM',
      branch: s.branch_name ?? '—',
    })),
  });
}
