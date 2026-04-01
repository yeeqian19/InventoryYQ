import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

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

    // --- DUPLICATE CHECK ---
    if (stationNum === 1 && ((isSKBarcode && record.sk_prep) || (isEGBarcode && record.eg_prep))) {
        return NextResponse.json({ error: 'ALREADY SCANNED AT PACKING', student_name: record.student_name }, { status: 400 });
    } else if (stationNum === 2 && record.bm_pickup) {
        return NextResponse.json({ error: 'ALREADY PICKED UP', student_name: record.student_name }, { status: 400 });
    } else if (stationNum === 3 && record.student_received) {
        return NextResponse.json({ error: 'ALREADY RECEIVED BY STUDENT', student_name: record.student_name }, { status: 400 });
    }

    // Photo upload for station 3 is handled by /api/inventory
    const savedFileName = null;

    // --- DATABASE UPDATE ---
    let updateData: any = {};
    if (stationNum === 1) {
      updateData = isSKBarcode 
        ? { sk_prep: true, sk_prep_date: new Date() } 
        : { eg_prep: true, eg_prep_date: new Date() };
    } else if (stationNum === 2) {
      updateData = { bm_pickup: true, bm_pickup_date: new Date() };
    } else if (stationNum === 3) {
      updateData = { 
        student_received: true, 
        student_received_date: new Date(),
        proof_photo: savedFileName 
      };
    }

    const updatedRecord = await db.inventory_distribution.update({
      where: { student_id: record.student_id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `${updatedRecord.student_name} approved!`,
      student_name: updatedRecord.student_name,
      station: stationNum,
      photoSaved: !!savedFileName,
      itemType: isSKBarcode ? 'Starter Kit (SK)' : 'Enrollment Gift (EG)',
      branch: updatedRecord.branch_code ?? 'N/A',
    }, { status: 200 });

  } catch (error: any) {
    console.error('Scan API error:', error);
    return NextResponse.json({ error: 'System Error: ' + error.message }, { status: 500 });
  }
}