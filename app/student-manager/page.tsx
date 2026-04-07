import { db } from '@/lib/db';
import StudentManagerClient from './StudentManagerClient';
import { resolveBranchCode } from '@/lib/branchUtils';
import { resolveStudentType } from '@/lib/studentUtils';

export const dynamic = 'force-dynamic';

export default async function StudentManagerPage() {
  const rawStudents = await db.inventory_distribution_new.findMany({
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

  const tableData = rawStudents.map((student) => {
    const finalBranch = resolveBranchCode(student.branch_code, student.doc_no);
    const sType = resolveStudentType(student.type, student.package);
    const hasEG = student.barcode_eg && student.barcode_eg.trim() !== '';

    const skBarcode = student.barcode_sk || `${finalBranch}-SK-${student.student_id}`;
    const egBarcode = hasEG ? (student.barcode_eg || '') : 'N/A';

    let formattedDate = '';
    if (student.doc_date) {
      try {
        formattedDate = new Date(student.doc_date).toISOString().split('T')[0];
      } catch {
        formattedDate = '';
      }
    }

    return {
      student_id: String(student.student_id),
      name: student.student_name || 'Unknown',
      branch: finalBranch,
      skBarcode,
      egBarcode,
      date: formattedDate,
      studentType: sType,
      package: student.package || null,
    };
  });

  return <StudentManagerClient initialData={tableData} />;
}