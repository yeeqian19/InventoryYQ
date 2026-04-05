import { db } from '@/lib/db';
import DashboardClient from './DashboardClient';
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { resolveBranchCode } from '@/lib/branchUtils';
import { resolveStudentType, hasEnrollmentGift, giftNameForPackage } from '@/lib/studentUtils';

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
  const rawData = await db.inventory_distribution.findMany({
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

      if (hasEnrollmentGift(row.package)) {
        const giftName = giftNameForPackage(row.package) ?? 'EG';
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

    return items;
  });

  // 4. Pass data AND user to the Client Component
  // Make sure DashboardClient.tsx is updated to accept the 'user' prop!
  return <DashboardClient dbData={formattedData} user={session.user} />;
}