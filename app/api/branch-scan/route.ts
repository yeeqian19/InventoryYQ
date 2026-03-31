import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { barcode: rawBarcode, mode, branch: rawBranch } = await req.json();

    // Sanitize inputs
    const barcode = rawBarcode?.trim() || '';
    const branch = rawBranch?.trim() || '';

    if (!barcode) {
      return NextResponse.json({ error: 'Barcode is required.' }, { status: 400 });
    }

    // 1. Find the student (Using updated schema)
    const record = await db.inventory_distribution.findFirst({
      where: {
        OR: [
          { barcode_sk: { equals: barcode, mode: 'insensitive' } },
          { barcode_eg: { equals: barcode, mode: 'insensitive' } }
        ]
      }
    });

    if (!record) {
      return NextResponse.json({ error: 'Barcode not found in database.' }, { status: 404 });
    }

    // --- NEW: ACCOUNTING SHIELD ---
    if (record.doc_no?.startsWith('FD-') || record.student_name?.toLowerCase().includes('interest')) {
      return NextResponse.json({ error: 'BLOCK: This is an accounting record (Fixed Deposit).' }, { status: 403 });
    }

    // 2. Validate Branch
    if (branch && record.branch_code && record.branch_code.toLowerCase() !== branch.toLowerCase()) {
      return NextResponse.json({ error: `Item belongs to ${record.branch_code}, not ${branch}.` }, { status: 400 });
    }

    const isSK = record.barcode_sk?.toLowerCase() === barcode.toLowerCase();
    const isEG = record.barcode_eg?.toLowerCase() === barcode.toLowerCase();

    // 3. PROCESS: BM PICKUP MODE
    if (mode === 'PICKUP') {
      if ((isSK && !record.sk_prep) || (isEG && !record.eg_prep)) {
        return NextResponse.json({ error: 'HQ has not packed this item yet!' }, { status: 400 });
      }
      if (record.bm_pickup) {
        return NextResponse.json({ error: 'Already Picked Up by Branch.' }, { status: 400 });
      }

      const updated = await db.inventory_distribution.update({
        where: { student_id: record.student_id }, // <--- FIXED: Changed from id
        data: { 
          bm_pickup: true,
          bm_pickup_date: new Date() // Added timestamp support
        }
      });
      return NextResponse.json({ message: 'Pickup Successful', student_name: updated.student_name });
    } 
    
    // 4. PROCESS: STUDENT HANDOVER MODE
    else if (mode === 'HANDOVER') {
      if (!record.bm_pickup) {
        return NextResponse.json({ error: 'Branch has not received this from HQ yet.' }, { status: 400 });
      }
      if (record.student_received) {
        return NextResponse.json({ error: 'Already Handed Over to Student.' }, { status: 400 });
      }

      const updated = await db.inventory_distribution.update({
        where: { student_id: record.student_id }, // <--- FIXED: Changed from id
        data: { 
          student_received: true,
          student_received_date: new Date() // Added timestamp support
        }
      });
      return NextResponse.json({ message: 'Handover Successful', student_name: updated.student_name });
    }

  } catch (error) {
    console.error("Branch Scan Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}