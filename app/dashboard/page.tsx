import { db } from '@/lib/db';
import DashboardClient from './DashboardClient'; 
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

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

  const validBranches = [
    'ST', 'SA', 'PJY', 'AMP', 'CJY', 'KLG', 'BBB', 'SHA', 'RBY', 'KTG', 
    'ONL', 'SP', 'KD', 'DA', 'DK', 'BTHO', 'EGR', 'BSP', 'KW', 'TSG', 'HQ'
  ];

  const correctionMap: Record<string, string> = {
    'PJ': 'PJY',
    'KL': 'KLG',
    'KUALA LUMPUR': 'KLG'
  };

  // 3. Format Data with Business Logic
  const formattedData: FormattedItem[] = rawData.flatMap((row: any) => {
    let finalBranch = 'UNKNOWN';
    const rawBranchCode = (row.branch_code || '').toUpperCase().trim();

    if (validBranches.includes(rawBranchCode)) {
      finalBranch = rawBranchCode;
    } else if (correctionMap[rawBranchCode]) {
      finalBranch = correctionMap[rawBranchCode];
    } else if (row.doc_no) {
      const parts = row.doc_no.toUpperCase().split(/[-_ ]+/); 
      for (const part of parts) {
        if (validBranches.includes(part)) {
          finalBranch = part;
          break;
        }
        if (correctionMap[part]) {
          finalBranch = correctionMap[part];
          break;
        }
      }
    }

    const recordDate = row.doc_date instanceof Date 
      ? row.doc_date.toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0];

    const isSkPrepared = row.sk_prep === true || row.sk_prep === 'true' || row.sk_prep === 1;
    const isEgPrepared = row.eg_prep === true || row.eg_prep === 'true' || row.eg_prep === 1;

    let sType = 'NEW';
    const rawType = (row.type || '').trim().toUpperCase();
    const rawPkg = (row.package || '').trim().toUpperCase();

    if (rawType.includes('RENEWAL')) {
      sType = 'RENEWAL';
    } else if (rawType.includes('TRIAL')) {
      sType = 'TRIAL';
    } else {
      sType = 'NEW'; 
    }

    const items = [];

    if (sType === 'NEW') {
      items.push({
        branch: finalBranch,
        itemType: 'Starter Kit (SK)',
        total: 1,
        prepared: isSkPrepared ? 1 : 0,
        unprepared: isSkPrepared ? 0 : 1,
        date: recordDate, 
        studentType: sType 
      });

      const is9M = /\b9\b/.test(rawPkg) || rawPkg.includes('9M');
      const is12M = /\b12\b/.test(rawPkg) || rawPkg.includes('12M');

      if (is9M || is12M) {
        const giftName = is12M ? 'SMARTWATCH' : 'LEGO';
        items.push({
          branch: finalBranch,
          itemType: `Enrollment Gift (EG) - ${giftName}`,
          total: 1,
          prepared: isEgPrepared ? 1 : 0,
          unprepared: isEgPrepared ? 0 : 1,
          date: recordDate, 
          studentType: sType 
        });
      }
    } 

    return items;
  });

  // 4. Pass data AND user to the Client Component
  // Make sure DashboardClient.tsx is updated to accept the 'user' prop!
  return <DashboardClient dbData={formattedData} user={session.user} />;
}