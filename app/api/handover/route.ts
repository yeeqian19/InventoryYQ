import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadToGoogleDrive } from '@/lib/googleDrive';
import { generateEmailHTML } from '@/lib/emailTemplate';
import { logScanAction } from '@/lib/logger';
import { sendEmail } from '@/lib/emailTransport';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import type { HandoverRequestBody } from '@/types';

interface UploadResult {
  fileId: string;
  webViewLink: string;
}

export async function POST(req: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json() as HandoverRequestBody;
    const { base64Data, barcode, studentName, branchCode } = body;

    if (!base64Data || !barcode) {
      return NextResponse.json({ error: 'base64Data and barcode are required.' }, { status: 400 });
    }

    // 1. Initial Check: Find the record to validate and get data for the logger
    const record = await db.inventory_distribution_new.findFirst({
      where: {
        is_active: true,
        OR: [
          { barcode_sk: { equals: barcode, mode: 'insensitive' } },
          { barcode_eg: { equals: barcode, mode: 'insensitive' } },
        ],
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'Barcode not found in database.' }, { status: 404 });
    }
    if (record.student_received) {
      return NextResponse.json({ error: 'Item already handed over to student.' }, { status: 400 });
    }

    const timestamp = new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
    const fileName = `${branchCode || record.branch_code || 'BR'}-${barcode}-${Date.now()}.jpg`;

    // Step A: Upload photo to Google Drive
    const { fileId, webViewLink }: UploadResult = await uploadToGoogleDrive(base64Data, fileName);

    // Step B: Update database with ATOMIC LOCK (fixes double email bug)
    const updateResult = await db.inventory_distribution_new.updateMany({
      where: {
        OR: [
          { barcode_sk: { equals: barcode, mode: 'insensitive' } },
          { barcode_eg: { equals: barcode, mode: 'insensitive' } },
        ],
        student_received: false,
      },
      data: {
        bm_pickup: true,
        student_received: true,
        student_received_date: new Date(),
        proof_photo: webViewLink,
      },
    });

    // If count is 0, it means someone double-clicked. Abort to prevent duplicate email!
    if (updateResult.count === 0) {
      return NextResponse.json({ error: 'Item was just handed over by another request.' }, { status: 400 });
    }

    // Step C: RECORD THE SCAN IN THE AUDIT TRAIL LOG
    await logScanAction({
      docNo: record.doc_no ?? null, 
      barcode: barcode,
      studentName: studentName || record.student_name || 'Unknown',
      itemType: barcode.includes('-SK-') ? 'SK' : 'EG',
      branch: branchCode || record.branch_code || 'Unknown',
      actionType: 'RECEIVED',
      processedBy: 'Branch Admin', 
    });

    // Step D: Send email using shared template
    const html = generateEmailHTML({
      title: '✅ Enrollment Gift Handed Over',
      detailsArray: [
        { label: 'Student', value: studentName || record.student_name || 'N/A' },
        { label: 'Branch', value: branchCode || record.branch_code || 'N/A' },
        { label: 'Barcode', value: barcode },
        { label: 'Date & Time', value: timestamp },
        {
          label: 'Photo Proof',
          value: 'View on Google Drive',
          isLink: true,
          linkHref: webViewLink,
          linkText: 'View on Google Drive',
        },
      ],
      photoLink: webViewLink,
    });

    await sendEmail({
      to: process.env.NOTIFY_EMAIL!,
      subject: `✅ Handover Complete – ${studentName || record.student_name || barcode}`,
      html,
    });

    return NextResponse.json({
      success: true,
      message: 'Handover complete & archived.',
      fileId,
      webViewLink,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Handover API error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}