import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { barcode, newName } = await req.json();
    if (!barcode || !newName?.trim()) {
      return NextResponse.json({ error: 'barcode and newName are required' }, { status: 400 });
    }

    const result = await db.inventory_distribution_new.updateMany({
      where: { barcode_sk: barcode },
      data: { student_name: newName.trim() },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/students/rename]', err);
    return NextResponse.json({ error: 'Failed to rename student' }, { status: 500 });
  }
}
