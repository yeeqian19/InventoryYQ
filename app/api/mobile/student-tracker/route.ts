import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMobileSession } from '@/lib/mobileAuth';
import { resolveStudentType } from '@/lib/studentUtils';
import { computeTracker } from '@/lib/trackerUtils';

export const dynamic = 'force-dynamic';

// Read endpoint for the mobile Student Tracker screen.
// Mirrors app/student-tracker/page.tsx (NEW students only) and pre-computes the
// computeTracker() status/stage/deadline the mobile cards render.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortDate(d: Date | null): string {
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export async function GET() {
  const session = await getMobileSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Web: USER_BM → branch screen; only SUPERADMIN/ADMIN_HQ see the tracker.
  const role = session.user.role;
  if (role !== 'SUPERADMIN' && role !== 'ADMIN_HQ') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const raw = await db.inventory_distribution_new.findMany({
    where: { is_active: true },
    select: {
      student_id: true,
      student_name: true,
      branch_code: true,
      doc_no: true,
      doc_date: true,
      package: true,
      type: true,
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

  // Workflow only applies to NEW students (same filter as the web page).
  const rows = raw
    .filter((r) => resolveStudentType(r.type, r.package) === 'NEW')
    .map((r) => {
      const c = computeTracker(r);
      const hqDone = c.stage !== 'HQ_PREP';
      return {
        id: r.student_id,
        name: r.student_name ?? 'Unknown',
        doc_no: r.doc_no ?? '',
        branch: r.branch_code ?? '',
        package: r.package ?? '',
        type: 'NEW' as const,
        hqDone,
        pickupDone: !!r.bm_pickup,
        handoverDone: !!r.student_received,
        status: c.status,
        stage: c.stage,
        deadline: shortDate(c.deadline),
        daysRemaining: c.daysRemaining ?? 0,
      };
    });

  return NextResponse.json({ rows });
}
