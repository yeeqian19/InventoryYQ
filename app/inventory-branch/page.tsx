import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import BranchDashboardClient from './BranchDashboardClient';
import { db } from '@/lib/db';
import { resolveStudentType } from '@/lib/studentUtils';

export const dynamic = 'force-dynamic';

export default async function InventoryBranchPage() {
  const session = await getServerSession(authOptions);

  // Not logged in → back to home (login)
  if (!session?.user) redirect('/');

  const role       = session.user.role;
  const branchCode = session.user.branchCode || '';

  // Build the Prisma where clause based on role
  // SUPERADMIN / ADMIN_HQ / USER_RM → see all branches (view-only)
  // USER_BM → see only their assigned branch
  const roleFilter =
    role === 'SUPERADMIN' || role === 'ADMIN_HQ' || role === 'USER_RM'
      ? { is_active: true, OR: [{ sk_prep: true }, { eg_prep: true }] }
      : { is_active: true, branch_code: branchCode, OR: [{ sk_prep: true }, { eg_prep: true }] };

  const rawData = await db.inventory_distribution_new.findMany({
    select: {
      student_id:       true,
      student_name:     true,
      branch_code:      true,
      barcode_sk:       true,
      barcode_eg:       true,
      sk_prep:          true,
      eg_prep:          true,
      bm_pickup:        true,
      student_received: true,
      type:             true,
      package:          true,
      doc_date:         true,
    },
    where: roleFilter,
    orderBy: { doc_date: 'desc' },
  });

  const formattedData = rawData.map(item => ({
    student_id:      String(item.student_id),
    name:            item.student_name || 'Unknown',
    branch:          item.branch_code || 'N/A',
    skBarcode:       item.barcode_sk || null,
    egBarcode:       item.barcode_eg || null,
    skPrep:          item.sk_prep || false,
    egPrep:          item.eg_prep || false,
    bmPickup:        item.bm_pickup || false,
    studentReceived: item.student_received || false,
    studentType:     item.type || 'Unknown',
    package:         item.package || 'N/A',
  }));

  // ── Student Tracker rows ──────────────────────────────────────────────
  // Branch managers only see their own branch; HQ/RM see all active rows.
  const trackerWhere = role === 'USER_BM'
    ? { is_active: true, branch_code: branchCode }
    : { is_active: true };

  const trackerRaw = await db.inventory_distribution_new.findMany({
    where: trackerWhere,
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

  // Workflow only applies to NEW students — RENEWAL keeps existing kit, TRIAL
  // gets nothing. Filter so KPI counts and table reflect only the population
  // the SK + EG workflow actually applies to.
  const trackerRows = trackerRaw
    .filter((r) => resolveStudentType(r.type, r.package) === 'NEW')
    .map((r) => ({
    student_id: r.student_id,
    student_name: r.student_name ?? 'Unknown',
    branch_code: r.branch_code ?? '',
    doc_no: r.doc_no,
    doc_date: r.doc_date ? r.doc_date.toISOString() : null,
    package: r.package,
    type: r.type,
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

  return (
    <BranchDashboardClient
      initialData={formattedData}
      userRole={role}
      userBranchCode={branchCode}
      trackerRows={trackerRows}
    />
  );
}
