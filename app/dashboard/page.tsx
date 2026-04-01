import { db } from '@/lib/db';
import DashboardClient from './DashboardClient'; 

export const dynamic = 'force-dynamic'; 

export default async function DashboardPage() {
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

  const formattedData = rawData.flatMap((row: any) => {
    // 1. IMPROVED BRANCH MAPPING
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

    const recordDate = row.doc_date 
      ? row.doc_date.toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0];

    // Standardizing Boolean Check
    const isSkPrepared = row.sk_prep === true || row.sk_prep === 'true' || row.sk_prep === 1;
    const isEgPrepared = row.eg_prep === true || row.eg_prep === 'true' || row.eg_prep === 1;

    // 2. SYNCED TYPE LOGIC (Match RM Dashboard Labels)
    let sType = 'OTHER';
    const rawType = (row.type || '').trim().toUpperCase();
    const rawPkg = (row.package || '').trim().toUpperCase();

    if (rawType.includes('NEW') || rawPkg.includes('NEW')) {
        sType = 'NEW';
    } else if (rawType.includes('RENEWAL')) {
        sType = 'RENEWAL';
    } else if (rawType.includes('TRIAL')) {
        sType = 'TRIAL';
    }

    const items = [];

    // Unit 1: Starter Kit (Always counted per student)
    items.push({
      branch: finalBranch,
      itemType: 'Starter Kit (SK)',
      total: 1,
      prepared: isSkPrepared ? 1 : 0,
      unprepared: isSkPrepared ? 0 : 1,
      date: recordDate, 
      studentType: sType 
    });

    // Unit 2: Enrollment Gift (Only if barcode was generated in DB)
    if (row.barcode_eg && row.barcode_eg.trim() !== '' && row.barcode_eg !== 'N/A') {
      items.push({
        branch: finalBranch,
        itemType: 'Enrollment Gift (EG)',
        total: 1,
        prepared: isEgPrepared ? 1 : 0,
        unprepared: isEgPrepared ? 0 : 1,
        date: recordDate, 
        studentType: sType 
      });
    }

    return items;
  });

  return <DashboardClient dbData={formattedData} />;
}