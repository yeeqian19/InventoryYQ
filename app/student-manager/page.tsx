import { db } from '@/lib/db';
import StudentManagerClient from './StudentManagerClient';

export const dynamic = 'force-dynamic';

export default async function StudentManagerPage() {
  const rawStudents = await db.inventory_distribution.findMany({
    select: {
      student_id: true,
      student_name: true,
      branch_code: true,
      barcode_sk: true,
      barcode_eg: true,
      doc_date: true,
      doc_no: true,
      type: true,      
      package: true,   
    },
    orderBy: {
      doc_date: 'desc', 
    },
  });

  const validBranches = [
    'ST', 'SA', 'PJY', 'AMP', 'CJY', 'KLG', 'BBB', 'SHA', 'RBY', 'KTG', 
    'ONL', 'SP', 'KD', 'DA', 'DK', 'BTHO', 'EGR', 'BSP', 'KW', 'TSG'
  ];
  const correctionMap: Record<string, string> = { 'PJ': 'PJY', 'KL': 'KLG' };

  const tableData = rawStudents.flatMap((student) => {
    let finalBranch = 'UNKNOWN';

    if (student.doc_no) {
      const parts = student.doc_no.toUpperCase().split(/[-_ ]+/); 
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
    if (finalBranch === 'UNKNOWN' && student.branch_code) {
      const rawCode = student.branch_code.toUpperCase().trim();
      finalBranch = correctionMap[rawCode] || rawCode;
    }

    let sType = 'Other';
    const rawType = (student.type || '').trim().toLowerCase();
    const rawPkg = (student.package || '').trim().toLowerCase();

    if (rawType === 'new' || rawPkg === 'new') {
        sType = 'New';
    } else if (rawType === 'renewal') {
        sType = 'Renewal';
    } else if (rawType === 'trial') {
        sType = 'Trial';
    }

    // --- THE SPLITTER LOGIC ---
    const rawName = student.student_name || 'Unknown';
    // Split the name if it contains "&", "and", or ","
    const individualNames = rawName.split(/&|,|\band\b/i).map(n => n.trim()).filter(n => n.length > 0);
    
    if (individualNames.length === 0) individualNames.push('Unknown');
    const hasEG = student.barcode_eg && student.barcode_eg.trim() !== '';

    // Create a unique row for each separated name
    return individualNames.map((name, index) => {
      // Because we generate barcodes automatically in the DB now, 
      // we just pull the DB barcode directly (unless you want this frontend override!)
      // I am keeping your frontend override intact here just in case you prefer it.
      const skBarcode = student.barcode_sk || `${finalBranch}-SK-${name}`;
      const egBarcode = hasEG ? (student.barcode_eg || `${finalBranch}-EG-${name}`) : 'N/A';

      // Safely handle the date object
      let formattedDate = '';
      if (student.doc_date) {
          try {
              formattedDate = new Date(student.doc_date).toISOString().split('T')[0];
          } catch (e) {
              formattedDate = '';
          }
      }

      return {
        student_id: `${student.student_id}-${index}`,
        name: name,
        branch: finalBranch,
        skBarcode: skBarcode,
        egBarcode: egBarcode,
        date: formattedDate,
        studentType: sType,
        package: student.package || null, 
      };
    });
  });

  return <StudentManagerClient initialData={tableData} />;
}