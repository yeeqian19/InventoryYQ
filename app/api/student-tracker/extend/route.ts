import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { logScanAction } from '@/lib/logger';
import { computeTracker, stagesAfter, type TrackerStage } from '@/lib/trackerUtils';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }
  if (session.user.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Only SUPERADMIN can extend deadlines.' }, { status: 403 });
  }

  let body: { student_id?: number; days?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const studentId = Number(body.student_id);
  const days = Number(body.days);
  const reason = (body.reason ?? '').toString().slice(0, 255);

  if (!Number.isFinite(studentId) || studentId <= 0) {
    return NextResponse.json({ error: 'Invalid student_id.' }, { status: 400 });
  }
  if (!Number.isFinite(days) || days < 1 || days > 90) {
    return NextResponse.json({ error: 'Days must be between 1 and 90.' }, { status: 400 });
  }

  const student = await db.inventory_distribution_new.findUnique({
    where: { student_id: studentId },
  });
  if (!student) {
    return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
  }
  if (!student.is_active) {
    return NextResponse.json({ error: 'Student is not active.' }, { status: 400 });
  }

  const computed = computeTracker({
    doc_date: student.doc_date,
    package: student.package,
    sk_prep: student.sk_prep,
    sk_prep_date: student.sk_prep_date,
    eg_prep: student.eg_prep,
    eg_prep_date: student.eg_prep_date,
    bm_pickup: student.bm_pickup,
    bm_pickup_date: student.bm_pickup_date,
    student_received: student.student_received,
    student_received_date: student.student_received_date,
    hq_prep_extension_days: student.hq_prep_extension_days,
    bm_pickup_extension_days: student.bm_pickup_extension_days,
    bm_handover_extension_days: student.bm_handover_extension_days,
  });

  if (computed.stage === 'COMPLETED') {
    return NextResponse.json({ error: 'Cannot extend a completed student.' }, { status: 400 });
  }

  const stagesToExtend: TrackerStage[] = stagesAfter(computed.stage);
  const updateData: Record<string, { increment: number }> = {};
  if (stagesToExtend.includes('HQ_PREP')) updateData.hq_prep_extension_days = { increment: days };
  if (stagesToExtend.includes('BM_PICKUP')) updateData.bm_pickup_extension_days = { increment: days };
  if (stagesToExtend.includes('BM_HANDOVER')) updateData.bm_handover_extension_days = { increment: days };

  await db.inventory_distribution_new.update({
    where: { student_id: studentId },
    data: updateData,
  });

  await logScanAction({
    docNo: student.doc_no,
    barcode: student.barcode_sk || student.barcode_eg || `SID-${studentId}`,
    studentName: student.student_name || 'Unknown',
    itemType: 'TRACKER',
    branch: student.branch_code || 'N/A',
    actionType: 'EXTENDED',
    processedBy: `${session.user.email} +${days}d @ ${computed.stage}${reason ? ` (${reason})` : ''}`,
  });

  return NextResponse.json({
    success: true,
    student_id: studentId,
    days,
    stage: computed.stage,
    extended_stages: stagesToExtend,
  });
}
