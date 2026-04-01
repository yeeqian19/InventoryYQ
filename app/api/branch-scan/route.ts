import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(req: Request) {
  try {
    const { barcode: rawBarcode, mode, branch: rawBranch } = await req.json();

    const barcode = rawBarcode?.trim() || '';
    const branch = rawBranch?.trim() || '';

    if (!barcode) return NextResponse.json({ error: 'Barcode is required.' }, { status: 400 });

    if (mode !== 'PICKUP' && mode !== 'HANDOVER') {
      return NextResponse.json({ error: 'Invalid mode.' }, { status: 400 });
    }

    const record = await db.inventory_distribution.findFirst({
      where: {
        OR: [
          { barcode_sk: { equals: barcode, mode: 'insensitive' } },
          { barcode_eg: { equals: barcode, mode: 'insensitive' } }
        ]
      }
    });

    if (!record) return NextResponse.json({ error: 'Barcode not found in database.' }, { status: 404 });

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

      const updated = await db.inventory_distribution.update({
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

    // 🟢 UPDATED: Skip photo upload and save to DB for now
    const updated = await db.inventory_distribution.update({
      where: { student_id: record.student_id },
      data: {
        student_received: true,
        student_received_date: new Date(),
        // 🔴 proof_photo / google_drive_file_id removed so it won't crash
      }
    });

    // Send email notification (Still works!)
    try {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.NOTIFY_EMAIL,
        subject: `Handover Completed – ${updated.student_name}`,
        html: `
          <div style="font-family:sans-serif;padding:24px;max-width:500px;border:1px solid #e5e7eb;border-radius:12px">
            <h2 style="color:#10b981">✅ Enrollment Gift Handed Over</h2>
            <table style="width:100%;border-collapse:collapse;margin-top:16px">
              <tr><td style="padding:8px;color:#6b7280;font-size:13px">Student</td><td style="padding:8px;font-weight:bold">${updated.student_name}</td></tr>
              <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280;font-size:13px">Branch</td><td style="padding:8px;font-weight:bold">${updated.branch_code}</td></tr>
              <tr><td style="padding:8px;color:#6b7280;font-size:13px">Barcode</td><td style="padding:8px;font-family:monospace">${rawBarcode}</td></tr>
              <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280;font-size:13px">Date & Time</td><td style="padding:8px">${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}</td></tr>
              <tr><td style="padding:8px;color:#6b7280;font-size:13px">Photo Proof</td><td style="padding:8px;color:#ef4444">Pending Google Drive Setup</td></tr>
            </table>
            <p style="margin-top:24px;font-size:12px;color:#9ca3af">This is an automated message from My Inventory System.</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('Email send error:', emailErr);
    }

    return NextResponse.json({ message: 'Handover Successful', student_name: updated.student_name });

  } catch (error: any) {
    console.error('Branch Scan Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}