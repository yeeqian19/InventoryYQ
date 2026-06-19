import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMobileSession } from '@/lib/mobileAuth';
import { hasEnrollmentGift } from '@/lib/studentUtils';

export const dynamic = 'force-dynamic';

// Read endpoint for the mobile Inventory (Branch) screen.
// Mirrors app/inventory-branch/page.tsx's formattedData, reshaped into the
// {type, state} rows the mobile queue renders. State collapses the workflow
// flags: prepared-at-HQ = EXPECTED, picked up by BM = READY, handed to student = DONE.
export async function GET(request: NextRequest) {
  const session = await getMobileSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  const branchCode = session.user.branchCode || '';
  const isHQ = role === 'SUPERADMIN' || role === 'ADMIN_HQ' || role === 'USER_RM';

  // Same role scoping as the web: HQ/RM/Superadmin can view any branch (the mobile
  // screen sends ?branch=<code> so we only ship that branch's rows, not the whole
  // table); USER_BM is always pinned to their own branch. Only SK/EG-prepared rows.
  const requestedBranch = request.nextUrl.searchParams.get('branch') ?? '';
  const scopedBranch = isHQ ? requestedBranch : branchCode;
  const roleFilter = {
    is_active: true,
    OR: [{ sk_prep: true }, { eg_prep: true }],
    ...(scopedBranch ? { branch_code: scopedBranch } : {}),
  };

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
    // Match the web (expectedFromHQ): a row only counts as EXPECTED if a prepared item
    // actually has a barcode. Rows prepped without a barcode fall into no bucket.
    const state = item.student_received
      ? 'DONE'
      : item.bm_pickup
        ? 'READY'
        : (item.sk_prep && hasSK) || (item.eg_prep && hasEG)
          ? 'EXPECTED'
          : 'NONE';

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
