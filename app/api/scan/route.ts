import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { logScanAction } from '@/lib/logger'; // 👈 NEW: Imported the logger

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const barcode = body.barcode as string;
    const station = Number(body.station);

    if (!barcode) return NextResponse.json({ error: 'No barcode provided' }, { status: 400 });

    const stationNum = station || 1;
    const trimmedBarcode = barcode.trim().toUpperCase();
    
    let record = await db.inventory_distribution.findFirst({
      where: {
        OR: [
          { barcode_sk: { contains: trimmedBarcode, mode: 'insensitive' } },
          { barcode_eg: { contains: trimmedBarcode, mode: 'insensitive' } },
        ],
      },
    });

    if (!record) return NextResponse.json({ error: 'Barcode not found' }, { status: 404 });

    // --- SAFETY CHECK: Handover (St 3) requires Pickup (St 2) ---
    if (stationNum === 3 && !record.bm_pickup) {
      return NextResponse.json({ 
        error: 'NOT READY: This item has not been picked up by the Branch Manager yet.' 
      }, { status: 400 });
    }

    const isSKBarcode = record.barcode_sk?.toUpperCase().includes(trimmedBarcode);
    const isEGBarcode = record.barcode_eg?.toUpperCase().includes(trimmedBarcode);

    // --- SETUP ATOMIC LOCK & UPDATE DATA ---
    let updateData: any = {};
    let lockCondition: any = {};
    let actionTypeForLogger: 'PREPARED' | 'PICKED UP' | 'RECEIVED' = 'PREPARED';

    if (stationNum === 1) {
      if (isSKBarcode) {
        updateData = { sk_prep: true, sk_prep_date: new Date() };
        lockCondition = { sk_prep: false }; // Lock
      } else {
        updateData = { eg_prep: true, eg_prep_date: new Date() };
        lockCondition = { eg_prep: false }; // Lock
      }
      actionTypeForLogger = 'PREPARED';
    } 
    else if (stationNum === 2) {
      updateData = { bm_pickup: true, bm_pickup_date: new Date() };
      lockCondition = { bm_pickup: false }; // Lock
      actionTypeForLogger = 'PICKED UP';
    } 
    else if (stationNum === 3) {
      updateData = { 
        student_received: true, 
        student_received_date: new Date(),
        proof_photo: null 
      };
      lockCondition = { student_received: false }; // Lock
      actionTypeForLogger = 'RECEIVED';
    }

    // --- DATABASE UPDATE WITH ATOMIC LOCK ---
    const updateResult = await (db.inventory_distribution as any).updateMany({
      where: { 
        student_id: record.student_id,
        ...lockCondition // 👈 The Bouncer! Prevents double-scans perfectly
      },
      data: updateData,
    });

    // If count is 0, the lock blocked it (already scanned)
    if (updateResult.count === 0) {
      return NextResponse.json({ error: 'ALREADY SCANNED / PROCESSED', student_name: record.student_name }, { status: 400 });
    }

    // --- 🚨 RECORD THE SCAN IN THE AUDIT TRAIL LOG 🚨 ---
    await logScanAction({
      docNo: record.doc_no || 'N/A',
      barcode: trimmedBarcode,
      studentName: record.student_name || 'Unknown',
      itemType: isSKBarcode ? 'SK' : 'EG',
      branch: record.branch_code || 'HQ', // Defaults to HQ if missing
      actionType: actionTypeForLogger,
      // Assigns processedBy based on the station number
      processedBy: stationNum === 1 ? 'Ashwin (HQ)' : (stationNum === 2 ? 'BM (Approve)' : 'Admin (Approve)'),
    });

    return NextResponse.json({
      success: true,
      message: `${record.student_name} approved!`,
      student_name: record.student_name,
      station: stationNum,
      photoSaved: false,
      itemType: isSKBarcode ? 'Starter Kit (SK)' : 'Enrollment Gift (EG)',
      branch: record.branch_code ?? 'N/A',
    }, { status: 200 });

  } catch (error: any) {
    console.error('Scan API error:', error);
    return NextResponse.json({ error: 'System Error: ' + error.message }, { status: 500 });
  }
}