import { db } from '@/lib/db';
import StudentManagerClient from './StudentManagerClient';
import { resolveBranchCode } from '@/lib/branchUtils';
import { resolveStudentType } from '@/lib/studentUtils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { canManageUsers, canUndoScans } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function StudentManagerPage() {
  const session = await getServerSession(authOptions);
  const canDelete = session ? canManageUsers(session.user.role) : false;
  const canUndo = session ? canUndoScans(session.user.role) : false;

  const rawStudents = await db.inventory_distribution_new.findMany({
    where: { is_active: true },
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
      sk_prep: true,
      sk_prep_date: true,
      eg_prep: true,
      eg_prep_date: true,
      bm_pickup: true,
      bm_pickup_date: true,
      student_received: true,
      student_received_date: true,
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
      doc_no: student.doc_no || '',
      branch: finalBranch,
      skBarcode,
      egBarcode,
      date: formattedDate,
      studentType: sType,
      package: student.package || null,
      sk_prep: student.sk_prep,
      sk_prep_date: student.sk_prep_date?.toISOString() ?? null,
      eg_prep: student.eg_prep,
      eg_prep_date: student.eg_prep_date?.toISOString() ?? null,
      bm_pickup: student.bm_pickup,
      bm_pickup_date: student.bm_pickup_date?.toISOString() ?? null,
      student_received: student.student_received,
      student_received_date: student.student_received_date?.toISOString() ?? null,
    };
  });

  return <StudentManagerClient initialData={tableData} canDelete={canDelete} canUndo={canUndo} />;
}