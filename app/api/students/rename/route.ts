import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { studentId, newName } = await req.json();
    if (!studentId || !newName?.trim()) {
      return NextResponse.json({ error: 'studentId and newName are required' }, { status: 400 });
    }

    const id = parseInt(studentId.split('-')[0]);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid studentId' }, { status: 400 });
    }

    const existing = await db.inventory_distribution_new.findUnique({ where: { student_id: id } });
    if (!existing) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Check unique constraint: another row with same doc_no + new name
    if (existing.doc_no) {
      const conflict = await db.inventory_distribution_new.findFirst({
        where: {
          doc_no: existing.doc_no,
          student_name: newName.trim(),
          student_id: { not: id },
        },
      });
      if (conflict) {
        return NextResponse.json({ error: 'A student with that name already exists on the same invoice' }, { status: 409 });
      }
    }

    await db.inventory_distribution_new.update({
      where: { student_id: id },
      data: { student_name: newName.trim() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/students/rename]', err);
    return NextResponse.json({ error: 'Failed to rename student' }, { status: 500 });
  }
}
