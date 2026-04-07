import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transporter } from '@/lib/emailTransport';
import { generateEmailHTML } from '@/lib/emailTemplate';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

interface BranchScanRequest {
  barcode: string;
  mode: 'PICKUP' | 'HANDOVER';
  branch?: string;
}

interface BranchScanResponse {
  message?: string;
  student_name?: string | null;
  error?: string;
}

export async function POST(req: Request): Promise<NextResponse<BranchScanResponse>> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json() as BranchScanRequest;
    const { barcode: rawBarcode, mode, branch: rawBranch } = body;

    const barcode = rawBarcode?.trim() || '';
    const branch = rawBranch?.trim() || '';

    if (!barcode) {
      return NextResponse.json({ error: 'Barcode is required.' }, { status: 400 });
    }

    if (mode !== 'PICKUP' && mode !== 'HANDOVER') {
      return NextResponse.json({ error: 'Invalid mode.' }, { status: 400 });
    }

    const record = await db.inventory_distribution_new.findFirst({
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

    // Block Accounting Records
    if (record.doc_no?.startsWith('FD-') || record.student_name?.toLowerCase().includes('interest')) {
      return NextResponse.json({ error: 'BLOCK: Accounting/Fixed Deposit record.' }, { status: 403 });
    }

    // Branch Check
    if (branch && record.branch_code && record.branch_code.toLowerCase() !== branch.toLowerCase()) {
      return NextResponse.json({ error: `Item belongs to ${record.branch_code}, not ${branch}.` }, { status: 400 });
    }

    // --- MODE: PICKUP ---
    if (mode === 'PICKUP') {
      const isSK = record.barcode_sk?.toLowerCase() === barcode.toLowerCase();
      const isEG = record.barcode_eg?.toLowerCase() === barcode.toLowerCase();

      if ((isSK && !record.sk_prep) || (isEG && !record.eg_prep)) {
        return NextResponse.json({ error: 'HQ has not packed this item yet!' }, { status: 400 });
      }
      if (record.bm_pickup) {
        return NextResponse.json({ error: 'Already Picked Up by Branch.' }, { status: 400 });
      }

      const updated = await db.inventory_distribution_new.update({
        where: { student_id: record.student_id },
        data: { bm_pickup: true, bm_pickup_date: new Date() }
      });
      return NextResponse.json({ message: 'Pickup Successful', student_name: updated.student_name });
    }

    // --- MODE: HANDOVER ---
    if (!record.bm_pickup) {
      return NextResponse.json({ error: 'Branch has not received this from HQ yet.' }, { status: 400 });
    }
    if (record.student_received) {
      return NextResponse.json({ error: 'Already Handed Over to Student.' }, { status: 400 });
    }

    // Skip photo upload and save to DB for now
    const updated = await db.inventory_distribution_new.update({
      where: { student_id: record.student_id },
      data: {
        student_received: true,
        student_received_date: new Date(),
      }
    });

    // Send email notification
    try {
      const timestamp = new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
      const html = generateEmailHTML({
        title: '✅ Enrollment Gift Handed Over',
        detailsArray: [
          { label: 'Student',    value: updated.student_name ?? 'N/A' },
          { label: 'Branch',     value: updated.branch_code  ?? 'N/A' },
          { label: 'Barcode',    value: rawBarcode },
          { label: 'Date & Time', value: timestamp },
        ],
      });
      await transporter.sendMail({
        from: `"Inventory System" <${process.env.SMTP_USER}>`,
        to: process.env.NOTIFY_EMAIL,
        subject: `✅ Handover Completed – ${updated.student_name}`,
        html,
      });
    } catch (emailErr) {
      console.error('Email send error:', emailErr);
    }

    return NextResponse.json({ message: 'Handover Successful', student_name: updated.student_name });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Branch Scan Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}