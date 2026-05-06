import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { canUndoScans } from '@/lib/permissions';
import { logScanAction } from '@/lib/logger';
import { giftNameForPackage } from '@/lib/studentUtils';

type Stage = 'sk_prep' | 'eg_prep' | 'bm_pickup' | 'student_received';
const VALID_STAGES: Stage[] = ['sk_prep', 'eg_prep', 'bm_pickup', 'student_received'];

interface UndoRequestBody {
  studentId: number;
  stage: Stage;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canUndoScans(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden — only SUPERADMIN can undo scans.' }, { status: 403 });
  }

  try {
    const { studentId, stage } = (await req.json()) as UndoRequestBody;

    if (!studentId || !stage) {
      return NextResponse.json({ error: 'studentId and stage are required.' }, { status: 400 });
    }
    if (!VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: 'Invalid stage.' }, { status: 400 });
    }

    const record = await db.inventory_distribution_new.findUnique({
      where: { student_id: studentId },
    });
    if (!record) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    if (!record.is_active) return NextResponse.json({ error: 'Student is deleted.' }, { status: 400 });

    // Strict reverse-order rule — can't undo an earlier stage if a later one is still true
    if ((stage === 'sk_prep' || stage === 'eg_prep') && (record.bm_pickup || record.student_received)) {
      return NextResponse.json(
        { error: 'Cannot undo Prep — student is already at Pickup or Received. Undo the later stages first.' },
        { status: 400 }
      );
    }
    if (stage === 'bm_pickup' && record.student_received) {
      return NextResponse.json(
        { error: 'Cannot undo Pickup — student already Received. Undo Received first.' },
        { status: 400 }
      );
    }

    if (!record[stage]) {
      return NextResponse.json({ error: `Stage "${stage}" is not active — nothing to undo.` }, { status: 400 });
    }

    // Build the stage-specific update + log shape
    const updateData: Record<string, unknown> = {};
    let actionType: 'UNDO_PREPARED' | 'UNDO_PICKED UP' | 'UNDO_RECEIVED';
    let itemType: 'SK' | 'EG';
    let barcodeForLog: string;

    if (stage === 'sk_prep') {
      updateData.sk_prep = false;
      updateData.sk_prep_date = null;
      actionType = 'UNDO_PREPARED';
      itemType = 'SK';
      barcodeForLog = record.barcode_sk ?? '';
    } else if (stage === 'eg_prep') {
      updateData.eg_prep = false;
      updateData.eg_prep_date = null;
      actionType = 'UNDO_PREPARED';
      itemType = 'EG';
      barcodeForLog = record.barcode_eg ?? '';
    } else if (stage === 'bm_pickup') {
      updateData.bm_pickup = false;
      updateData.bm_pickup_date = null;
      updateData.bm_pickup_photo = null;
      actionType = 'UNDO_PICKED UP';
      itemType = record.barcode_sk ? 'SK' : 'EG';
      barcodeForLog = record.barcode_sk ?? record.barcode_eg ?? '';
    } else {
      updateData.student_received = false;
      updateData.student_received_date = null;
      updateData.proof_photo = null;
      actionType = 'UNDO_RECEIVED';
      itemType = record.barcode_sk ? 'SK' : 'EG';
      barcodeForLog = record.barcode_sk ?? record.barcode_eg ?? '';
    }

    // Atomic guard — only flip the stage if it's still currently true
    const result = await db.inventory_distribution_new.updateMany({
      where: { student_id: studentId, [stage]: true },
      data: updateData,
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Concurrent update — please refresh and retry.' }, { status: 409 });
    }

    // Re-credit stock for prep undo (mirrors the deduction in /api/scan station 1)
    if (stage === 'sk_prep') {
      await db.starterKit.updateMany({
        where: { id: 'default' },
        data: { namedCount: { increment: 1 }, packedCount: { increment: 1 } },
      });
    } else if (stage === 'eg_prep') {
      const giftName = giftNameForPackage(record.package);
      if (giftName) {
        await db.inventory.updateMany({
          where: { name: { equals: giftName, mode: 'insensitive' }, isSkPart: false },
          data: { currentCount: { increment: 1 } },
        });
      }
    }

    await logScanAction({
      docNo: record.doc_no ?? null,
      barcode: barcodeForLog,
      studentName: record.student_name ?? 'Unknown',
      itemType,
      branch: record.branch_code ?? 'HQ',
      actionType,
      processedBy: `${session.user?.name ?? 'SUPERADMIN'} (UNDO)`,
    });

    return NextResponse.json({ success: true, stage, studentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/scan/undo]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
