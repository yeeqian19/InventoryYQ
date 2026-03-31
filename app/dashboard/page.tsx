import { db } from '@/lib/db';
import DashboardClient from './DashboardClient'; // Make sure this path matches your setup!

export const dynamic = 'force-dynamic'; 

export default async function DashboardPage() {
  // THE FIX: We tell Prisma EXACTLY which columns to fetch so it stops looking for 'id'
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
    'ONL', 'SP', 'KD', 'DA', 'DK', 'BTHO', 'EGR', 'BSP', 'KW', 'TSG'
  ];

  const correctionMap: Record<string, string> = {
    'PJ': 'PJY',
    'KL': 'KLG'
  };

  const formattedData = rawData.flatMap((row: any) => {
    let finalBranch = 'UNKNOWN';

    if (row.doc_no) {
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

    if (finalBranch === 'UNKNOWN' && row.branch_code) {
      const rawCode = row.branch_code.toUpperCase().trim();
      finalBranch = correctionMap[rawCode] || rawCode;
    }

    const recordDate = row.doc_date 
      ? row.doc_date.toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0];

    const isSkPrepared = row.sk_prep === true || row.sk_prep === 'true' || row.sk_prep === 1;
    const isEgPrepared = row.eg_prep === true || row.eg_prep === 'true' || row.eg_prep === 1;

    // --- LOGIC: Safely check both type and package columns for "New" ---
    let sType = 'Other';
    const rawType = (row.type || '').trim().toLowerCase();
    const rawPkg = (row.package || '').trim().toLowerCase();

    if (rawType === 'new' || rawPkg === 'new') {
        sType = 'New';
    } else if (rawType === 'renewal') {
        sType = 'Renewal';
    } else if (rawType === 'trial') {
        sType = 'Trial';
    }

    const items = [];

    items.push({
      branch: finalBranch,
      itemType: 'Starter Kit (SK)',
      total: 1,
      prepared: isSkPrepared ? 1 : 0,
      unprepared: isSkPrepared ? 0 : 1,
      date: recordDate, 
      studentType: sType // Attaching the label!
    });

    if (row.barcode_eg && row.barcode_eg.trim() !== '') {
      items.push({
        branch: finalBranch,
        itemType: 'Enrollment Gift (EG)',
        total: 1,
        prepared: isEgPrepared ? 1 : 0,
        unprepared: isEgPrepared ? 0 : 1,
        date: recordDate, 
        studentType: sType // Attaching the label!
      });
    }

    return items;
  });

  return <DashboardClient dbData={formattedData} />;
}