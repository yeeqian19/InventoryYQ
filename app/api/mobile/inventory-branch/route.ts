import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMobileSession } from '@/lib/mobileAuth';
import { hasEnrollmentGift } from '@/lib/studentUtils';

export const dynamic = 'force-dynamic';

// Read endpoint for the mobile Inventory (Branch) screen.
// Mirrors app/inventory-branch/page.tsx's formattedData, reshaped into the
// {type, state} rows the mobile queue renders. State collapses the workflow
// flags: prepared-at-HQ = EXPECTED, picked up by BM = READY, handed to student = DONE.
export async function GET() {
  const session = await getMobileSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  const branchCode = session.user.branchCode || '';

  // Same role-based scoping as the web: HQ/RM/Superadmin see all branches,
  // USER_BM sees only their assigned branch. Only rows with SK or EG prepared.
  const roleFilter =
    role === 'SUPERADMIN' || role === 'ADMIN_HQ' || role === 'USER_RM'
      ? { is_active: true, OR: [{ sk_prep: true }, { eg_prep: true }] }
      : { is_active: true, branch_code: branchCode, OR: [{ sk_prep: true }, { eg_prep: true }] };

  const rawData = await db.inventory_distribution_new.findMany({
    select: {
      student_id: true,
      student_name: true,
      branch_code: true,
      barcode_sk: true,
      barcode_eg: true,
      sk_prep: true,
      eg_prep: true,
      bm_pickup: true,
      student_received: true,
      type: true,
      package: true,
      doc_date: true,
    },
    where: roleFilter,
    orderBy: { doc_date: 'desc' },
  });

  const items = rawData.map((item) => {
    const eligibleForEG = hasEnrollmentGift(item.package, item.student_name);
    const egFallback =
      eligibleForEG && item.branch_code ? `${item.branch_code}-EG-${item.student_id}` : null;
    const egBarcode = item.barcode_eg || egFallback;
    const hasSK = !!item.barcode_sk;
    const hasEG = !!egBarcode;

    const type = hasSK && hasEG ? 'SK + EG' : hasEG ? 'EG' : 'SK';
    const state = item.student_received ? 'DONE' : item.bm_pickup ? 'READY' : 'EXPECTED';

    return {
      student_id: String(item.student_id),
      name: item.student_name || 'Unknown',
      branch: item.branch_code || 'N/A',
      pkg: item.package || 'N/A',
      type,
      state,
    };
  });

  return NextResponse.json({ items });
}
