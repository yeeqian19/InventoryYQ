import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { canManageUsers } from '@/lib/permissions';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageUsers(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const studentId = parseInt(id, 10);
    if (isNaN(studentId)) return NextResponse.json({ error: 'Invalid student ID.' }, { status: 400 });

    const student = await db.inventory_distribution_new.findUnique({
      where: { student_id: studentId },
    });

    if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    if (!student.is_active) return NextResponse.json({ error: 'Student already deleted.' }, { status: 400 });

    await db.$transaction([
      db.deleted_invoices.create({
        data: {
          student_id: student.student_id,
          doc_no: student.doc_no,
          doc_date: student.doc_date,
          branch_code: student.branch_code,
          student_name: student.student_name,
          package: student.package,
          type: student.type,
          deleted_by: session.user.email ?? session.user.name ?? 'unknown',
        },
      }),
      db.inventory_distribution_new.update({
        where: { student_id: studentId },
        data: { is_active: false },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/students/[id]]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
