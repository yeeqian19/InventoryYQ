import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { logScanAction } from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { canEditHQ } from '@/lib/permissions';
import { giftNameForPackage } from '@/lib/studentUtils';
import type { ScanRequestBody, ScanResponse } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse<ScanResponse | { error: string }>> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only SUPERADMIN and ADMIN_HQ can operate HQ scan stations
  if (!canEditHQ(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden: HQ scan requires SUPERADMIN or ADMIN_HQ role.' }, { status: 403 });
  }

  try {
    const body = await request.json() as ScanRequestBody;
    const barcode = body.barcode;
    const station = body.station;

    if (!barcode) {
      return NextResponse.json({ error: 'No barcode provided' }, { status: 400 });
    }

    const stationNum = station || 1;
    const trimmedBarcode = barcode.trim().toUpperCase();
    
    const record = await db.inventory_distribution_new.findFirst({
      where: {
        OR: [
          { barcode_sk: { contains: trimmedBarcode, mode: 'insensitive' } },
          { barcode_eg: { contains: trimmedBarcode, mode: 'insensitive' } },
        ],
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'Barcode not found' }, { status: 404 });
    }

    // --- SAFETY CHECK: Handover (St 3) requires Pickup (St 2) ---
    if (stationNum === 3 && !record.bm_pickup) {
      return NextResponse.json({ 
        error: 'NOT READY: This item has not been picked up by the Branch Manager yet.' 
      }, { status: 400 });
    }

    const isSKBarcode = record.barcode_sk?.toUpperCase().includes(trimmedBarcode);

    // --- SETUP ATOMIC LOCK & UPDATE DATA ---
    const updateData: Record<string, unknown> = {};
    const lockCondition: Record<string, unknown> = {};
    let actionTypeForLogger: 'PREPARED' | 'PICKED UP' | 'RECEIVED' = 'PREPARED';

    if (stationNum === 1) {
      if (isSKBarcode) {
        updateData.sk_prep = true;
        updateData.sk_prep_date = new Date();
        lockCondition.sk_prep = false;
      } else {
        updateData.eg_prep = true;
        updateData.eg_prep_date = new Date();
        lockCondition.eg_prep = false;
      }
      actionTypeForLogger = 'PREPARED';
    } 
    else if (stationNum === 2) {
      updateData.bm_pickup = true;
      updateData.bm_pickup_date = new Date();
      lockCondition.bm_pickup = false;
      actionTypeForLogger = 'PICKED UP';
    } 
    else if (stationNum === 3) {
      updateData.student_received = true;
      updateData.student_received_date = new Date();
      updateData.proof_photo = null;
      lockCondition.student_received = false;
      actionTypeForLogger = 'RECEIVED';
    }

    // --- DATABASE UPDATE WITH ATOMIC LOCK ---
    const updateResult = await db.inventory_distribution_new.updateMany({
      where: { 
        student_id: record.student_id,
        ...lockCondition
      },
      data: updateData,
    });

    // If count is 0, the lock blocked it (already scanned)
    if (updateResult.count === 0) {
      return NextResponse.json({ error: 'ALREADY SCANNED / PROCESSED', student_name: record.student_name ?? undefined }, { status: 400 });
    }

    // --- DEDUCT FROM STOCK INVENTORY (Station 1 only) ---
    if (stationNum === 1 && updateResult.count > 0) {
      if (isSKBarcode) {
        // Deduct one packed starter kit
        await db.starterKit.updateMany({
          where: { id: 'default', packedCount: { gt: 0 } },
          data: { packedCount: { decrement: 1 } },
        });
      } else {
        // Deduct one unit of the matching enrollment gift
        const giftName = giftNameForPackage(record.package);
        if (giftName) {
          await db.inventory.updateMany({
            where: { name: { equals: giftName, mode: 'insensitive' }, isSkPart: false, currentCount: { gt: 0 } },
            data: { currentCount: { decrement: 1 } },
          });
        }
      }
    }

    // --- RECORD THE SCAN IN THE AUDIT TRAIL LOG ---
    await logScanAction({
      docNo: record.doc_no ?? null,
      barcode: trimmedBarcode,
      studentName: record.student_name ?? 'Unknown',
      itemType: isSKBarcode ? 'SK' : 'EG',
      branch: record.branch_code ?? 'HQ',
      actionType: actionTypeForLogger,
      processedBy: session.user?.name ?? 'System',
    });

    return NextResponse.json({
      success: true,
      message: `${record.student_name} approved!`,
      student_name: record.student_name ?? undefined,
      station: stationNum,
      photoSaved: false,
      itemType: isSKBarcode ? 'Starter Kit (SK)' : 'Enrollment Gift (EG)',
      branch: record.branch_code ?? 'N/A',
    }, { status: 200 });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Scan API error:', error);
    return NextResponse.json({ error: 'System Error: ' + message }, { status: 500 });
  }
}