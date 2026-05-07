import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { computeTracker } from '@/lib/trackerUtils';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }
  const role = session.user.role;
  if (role !== 'SUPERADMIN' && role !== 'ADMIN_HQ' && role !== 'USER_RM') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const startParam = url.searchParams.get('start');
  const endParam = url.searchParams.get('end');

  const where: {
    is_active: boolean;
    doc_date?: { gte?: Date; lte?: Date };
  } = { is_active: true };

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (startParam) {
    const start = new Date(`${startParam}T00:00:00.000Z`);
    if (!isNaN(start.getTime())) dateFilter.gte = start;
  }
  if (endParam) {
    const end = new Date(`${endParam}T23:59:59.999Z`);
    if (!isNaN(end.getTime())) dateFilter.lte = end;
  }
  if (dateFilter.gte || dateFilter.lte) where.doc_date = dateFilter;

  const rows = await db.inventory_distribution_new.findMany({
    where,
    select: {
      doc_date: true,
      package: true,
      sk_prep: true,
      sk_prep_date: true,
      eg_prep: true,
      eg_prep_date: true,
      bm_pickup: true,
      bm_pickup_date: true,
      student_received: true,
      student_received_date: true,
      hq_prep_extension_days: true,
      bm_pickup_extension_days: true,
      bm_handover_extension_days: true,
    },
  });

  const stats = rows.reduce(
    (acc, r) => {
      const c = computeTracker(r);
      acc.total += 1;
      if (c.status === 'ON_TRACK') acc.onTrack += 1;
      else if (c.status === 'DUE_SOON') acc.dueSoon += 1;
      else if (c.status === 'OVERDUE') acc.overdue += 1;
      else if (c.status === 'COMPLETED') acc.completed += 1;
      return acc;
    },
    { total: 0, onTrack: 0, dueSoon: 0, overdue: 0, completed: 0 },
  );

  return NextResponse.json(stats);
}
