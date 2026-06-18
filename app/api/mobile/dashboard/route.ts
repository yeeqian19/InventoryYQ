import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMobileSession } from '@/lib/mobileAuth';
import { resolveBranchCode } from '@/lib/branchUtils';
import { resolveStudentType, hasEnrollmentGift, giftNameForPackage } from '@/lib/studentUtils';
import { computeTracker } from '@/lib/trackerUtils';

export const dynamic = 'force-dynamic';

// Read endpoint for the mobile Distribution Dashboard.
// Mirrors app/dashboard/page.tsx so the mobile numbers match the web exactly.
interface FormattedItem {
  branch: string;
  itemType: string;
  total: number;
  prepared: number;
  unprepared: number;
  date: string;
  studentType: string;
}

export async function GET() {
  const session = await getMobileSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawData = await db.inventory_distribution_new.findMany({
    where: { is_active: true },
    select: {
      student_id: true,
      doc_no: true,
      doc_date: true,
      branch_code: true,
      sk_prep: true,
      eg_prep: true,
      type: true,
      package: true,
      barcode_eg: true,
      // NOTE: the web page.tsx calls hasEnrollmentGift(pkg, student_name) but omits
      // student_name from its select, so the forced-EG override (commit 45d8a8d) never
      // fires on the web dashboard. We select it here so mobile reflects the intended
      // behaviour. Flagged to the team — the web select should be fixed to match.
      student_name: true,
    },
  });

  const items: FormattedItem[] = rawData.flatMap((row) => {
    const finalBranch = resolveBranchCode(row.branch_code, row.doc_no);
    const recordDate =
      row.doc_date instanceof Date
        ? row.doc_date.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

    const isSkPrepared = row.sk_prep === true;
    const isEgPrepared = row.eg_prep === true;
    const sType = resolveStudentType(row.type, row.package);
    const out: FormattedItem[] = [];

    if (sType === 'NEW') {
      out.push({
        branch: finalBranch,
        itemType: 'Starter Kit (SK)',
        total: 1,
        prepared: isSkPrepared ? 1 : 0,
        unprepared: isSkPrepared ? 0 : 1,
        date: recordDate,
        studentType: sType,
      });

      if (hasEnrollmentGift(row.package, row.student_name)) {
        const giftName = giftNameForPackage(row.package, row.student_name) ?? 'EG';
        out.push({
          branch: finalBranch,
          itemType: `Enrollment Gift (EG) - ${giftName}`,
          total: 1,
          prepared: isEgPrepared ? 1 : 0,
          unprepared: isEgPrepared ? 0 : 1,
          date: recordDate,
          studentType: sType,
        });
      }
    }

    return out;
  });

  // Tracker strip stats — default scope = Last Week of doc_date (matches the web).
  const today = new Date();
  const lastWeekEnd = new Date();
  lastWeekEnd.setDate(today.getDate() - today.getDay());
  lastWeekEnd.setHours(23, 59, 59, 999);
  const lastWeekStart = new Date(lastWeekEnd);
  lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
  lastWeekStart.setHours(0, 0, 0, 0);

  const trackerRaw = await db.inventory_distribution_new.findMany({
    where: { is_active: true, doc_date: { gte: lastWeekStart, lte: lastWeekEnd } },
    select: {
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
  });

  const trackerStats = trackerRaw
    .filter((r) => resolveStudentType(r.type, r.package) === 'NEW')
    .reduce(
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

  return NextResponse.json({ items, trackerStats });
}
