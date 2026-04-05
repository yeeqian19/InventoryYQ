import { db } from '@/lib/db';
import StudentManagerClient from './StudentManagerClient';
import { resolveBranchCode } from '@/lib/branchUtils';
import { resolveStudentType } from '@/lib/studentUtils';

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

  const tableData = rawStudents.flatMap((student) => {
    const finalBranch = resolveBranchCode(student.branch_code, student.doc_no);
    const sType = resolveStudentType(student.type, student.package);

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
          } catch {
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