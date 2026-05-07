import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import StudentTrackerClient from './StudentTrackerClient';
import type { TrackerRow } from '@/components/StudentTrackerTable';

export const dynamic = 'force-dynamic';

export default async function StudentTrackerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/');

  const role = session.user.role;
  if (role === 'USER_BM') redirect('/inventory-branch');
  if (role !== 'SUPERADMIN' && role !== 'ADMIN_HQ') redirect('/');

  const raw = await db.inventory_distribution_new.findMany({
    where: { is_active: true },
    select: {
      student_id: true,
      student_name: true,
      branch_code: true,
      doc_no: true,
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
    orderBy: { doc_date: 'desc' },
  });

  const rows: TrackerRow[] = raw.map((r) => ({
    student_id: r.student_id,
    student_name: r.student_name ?? 'Unknown',
    branch_code: r.branch_code ?? '',
    doc_no: r.doc_no,
    doc_date: r.doc_date ? r.doc_date.toISOString() : null,
    package: r.package,
    sk_prep: r.sk_prep,
    sk_prep_date: r.sk_prep_date ? r.sk_prep_date.toISOString() : null,
    eg_prep: r.eg_prep,
    eg_prep_date: r.eg_prep_date ? r.eg_prep_date.toISOString() : null,
    bm_pickup: r.bm_pickup,
    bm_pickup_date: r.bm_pickup_date ? r.bm_pickup_date.toISOString() : null,
    student_received: r.student_received,
    student_received_date: r.student_received_date ? r.student_received_date.toISOString() : null,
    hq_prep_extension_days: r.hq_prep_extension_days,
    bm_pickup_extension_days: r.bm_pickup_extension_days,
    bm_handover_extension_days: r.bm_handover_extension_days,
  }));

  return <StudentTrackerClient rows={rows} userRole={role} />;
}
