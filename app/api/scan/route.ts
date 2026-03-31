import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { barcode, station } = await request.json();

    if (!barcode || typeof barcode !== 'string') {
      return NextResponse.json({ error: 'Invalid barcode' }, { status: 400 });
    }

    const stationNum = station || 1;
    if (![1, 2, 3].includes(stationNum)) {
      return NextResponse.json({ error: 'Invalid station' }, { status: 400 });
    }

    const trimmedBarcode = barcode.trim().toUpperCase();
    
    // 1. Search for the record (Using the updated student_id schema)
    let record = await db.inventory_distribution.findFirst({
      where: {
        OR: [
          { barcode_sk: { contains: trimmedBarcode, mode: 'insensitive' } },
          { barcode_eg: { contains: trimmedBarcode, mode: 'insensitive' } },
        ],
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'Barcode not found in system' }, { status: 404 });
    }

    // --- NEW: ACCOUNTING SHIELD ---
    // If someone tries to scan a bank/accounting record that snuck in, block it!
    if (record.doc_no?.startsWith('FD-') || record.student_name?.toLowerCase().includes('interest')) {
      return NextResponse.json({ error: 'BLOCK: This is an accounting record, not a student kit.' }, { status: 403 });
    }

    // 2. Determine Barcode Type (SK vs EG)
    const isSKBarcode = record.barcode_sk?.toUpperCase().includes(trimmedBarcode);
    const isEGBarcode = record.barcode_eg?.toUpperCase().includes(trimmedBarcode);

    // 3. Check for "Already Scanned" status
    if (stationNum === 1) {
      if ((isSKBarcode && record.sk_prep) || (isEGBarcode && record.eg_prep)) {
        const originalDate = isSKBarcode ? record.sk_prep_date : record.eg_prep_date;
        return NextResponse.json({
            error: 'ALREADY SCANNED',
            student_name: record.student_name,
            timestamp: originalDate,
          }, { status: 400 });
      }
    } else if (stationNum === 2) {
      if (record.bm_pickup) {
        return NextResponse.json({
            error: 'ALREADY SCANNED',
            student_name: record.student_name,
            timestamp: record.bm_pickup_date,
          }, { status: 400 });
      }
    } else if (stationNum === 3) {
      if (record.student_received) {
        return NextResponse.json({
            error: 'ALREADY SCANNED',
            student_name: record.student_name,
            timestamp: record.student_received_date,
          }, { status: 400 });
      }
    }

    // 4. Update Database (FIXED: Using student_id instead of id)
    let updatedRecord;
    if (stationNum === 1) {
      updatedRecord = await db.inventory_distribution.update({
        where: { student_id: record.student_id }, // <--- CHANGED FROM id
        data: isSKBarcode 
          ? { sk_prep: true, sk_prep_date: new Date() } 
          : { eg_prep: true, eg_prep_date: new Date() },
      });
    } else if (stationNum === 2) {
      updatedRecord = await db.inventory_distribution.update({
        where: { student_id: record.student_id }, // <--- CHANGED FROM id
        data: { bm_pickup: true, bm_pickup_date: new Date() },
      });
    } else if (stationNum === 3) {
      updatedRecord = await db.inventory_distribution.update({
        where: { student_id: record.student_id }, // <--- CHANGED FROM id
        data: { student_received: true, student_received_date: new Date() },
      });
    }

    // 5. Response logic
    const finalStudentName = updatedRecord!.student_name || 'Unknown Student';
    const stationNames: Record<number, string> = {
      1: '1. PACKING (HQ)',
      2: '2. BRANCH PICKUP',
      3: '3. STUDENT HANDOVER',
    };

    return NextResponse.json({
      success: true,
      message: `${finalStudentName} approved successfully`,
      student_name: finalStudentName,
      station: stationNames[stationNum],
      itemType: isSKBarcode ? 'Starter Kit (SK)' : 'Enrollment Gift (EG)',
      branch: updatedRecord!.branch_code || 'HQ',
      barcodeType: isSKBarcode ? 'SK' : 'EG',
      docNo: updatedRecord!.doc_no,
    }, { status: 200 });

  } catch (error) {
    console.error('Scan API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}