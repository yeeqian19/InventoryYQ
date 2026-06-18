import { db } from '@/lib/db';
import DashboardClient from './DashboardClient';
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { resolveBranchCode } from '@/lib/branchUtils';
import { resolveStudentType, hasEnrollmentGift, giftNameForPackage } from '@/lib/studentUtils';
import { computeTracker } from '@/lib/trackerUtils';
// resolveStudentType is also used below to scope tracker stats to NEW students.

export const dynamic = 'force-dynamic'; 

// Define the shape of the data we are sending to the client
interface FormattedItem {
  branch: string;
  itemType: string;
  total: number;
  prepared: number;
  unprepared: number;
  date: string;
  studentType: string;
}

export default async function DashboardPage() {
  // 1. Protection: Check if user is logged in
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  // 2. Fetch Data from Database
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
      student_name: true,
    }
  });

  // 3. Format Data with Business Logic
  const formattedData: FormattedItem[] = rawData.flatMap((row) => {
    const finalBranch = resolveBranchCode(row.branch_code, row.doc_no);

    const recordDate = row.doc_date instanceof Date
      ? row.doc_date.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const isSkPrepared = row.sk_prep === true;
    const isEgPrepared = row.eg_prep === true;
    const sType = resolveStudentType(row.type, row.package);
    const items: FormattedItem[] = [];

    // NEW: SK always + EG if 12M (LEGO)
    if (sType === 'NEW') {
      items.push({
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
        items.push({
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

    // TRIAL: no SK, no EG — trial students don't receive inventory
    // RENEWAL: no SK, no EG — student already has their kit from initial enrollment

    return items;
  });

  // 4. Compute tracker stats (default scope = Last Week of doc_date)
  const today = new Date();
  const lastWeekEnd = new Date();
  lastWeekEnd.setDate(today.getDate() - today.getDay()); // Sunday of last week
  lastWeekEnd.setHours(23, 59, 59, 999);
  const lastWeekStart = new Date(lastWeekEnd);
  lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
  lastWeekStart.setHours(0, 0, 0, 0);

  const trackerRaw = await db.inventory_distribution_new.findMany({
    where: {
      is_active: true,
      doc_date: { gte: lastWeekStart, lte: lastWeekEnd },
    },
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

  // Workflow only applies to NEW students — exclude RENEWAL/TRIAL from the
  // dashboard strip counts so they match the tracker page numbers.
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

  return <DashboardClient dbData={formattedData} user={session.user} trackerStats={trackerStats} />;
}