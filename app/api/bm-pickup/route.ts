import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadToGoogleDrive } from '@/lib/googleDrive';
import { generateEmailHTML } from '@/lib/emailTemplate';
import { logScanAction } from '@/lib/logger';
import { transporter } from '@/lib/emailTransport';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import type { BmPickupRequestBody } from '@/types';

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
    const body = await req.json() as BmPickupRequestBody;
    const { base64Data, barcode, branchCode } = body;

    if (!base64Data || !barcode) {
      return NextResponse.json(
        { error: 'base64Data and barcode are required.' },
        { status: 400 }
      );
    }

    // Validate the record exists and is ready for BM Pickup
    const record = await db.inventory_distribution.findFirst({
      where: {
        OR: [
          { barcode_sk: { equals: barcode, mode: 'insensitive' } },
          { barcode_eg: { equals: barcode, mode: 'insensitive' } },
        ],
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'Barcode not found in database.' }, { status: 404 });
    }
    if (record.bm_pickup) {
      return NextResponse.json({ error: 'Item already picked up by Branch.' }, { status: 400 });
    }

    const timestamp = new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
    const fileName = `BM-${branchCode || record.branch_code || 'BR'}-${barcode}-${Date.now()}.jpg`;

    // Step A: Upload photo to Google Drive
    const { fileId, webViewLink }: UploadResult = await uploadToGoogleDrive(base64Data, fileName);

    // Step B: Update database with ATOMIC LOCK (fixes double email bug)
    const updateResult = await db.inventory_distribution.updateMany({
      where: {
        OR: [
          { barcode_sk: { equals: barcode, mode: 'insensitive' } },
          { barcode_eg: { equals: barcode, mode: 'insensitive' } },
        ],
        bm_pickup: false,
      },
      data: {
        bm_pickup: true,
        bm_pickup_date: new Date(),
        bm_pickup_photo: webViewLink,
      },
    });

    // If count is 0, it means someone double-clicked. Abort to prevent duplicate email!
    if (updateResult.count === 0) {
      return NextResponse.json({ error: 'Item was just picked up by another request.' }, { status: 400 });
    }

    // Step C: RECORD THE SCAN IN THE AUDIT TRAIL LOG
    await logScanAction({
      docNo: record.doc_no ?? null, 
      barcode: barcode,
      studentName: record.student_name ?? 'Unknown',
      itemType: barcode.includes('-SK-') ? 'SK' : 'EG',
      branch: branchCode || record.branch_code || 'Unknown',
      actionType: 'PICKED UP',
      processedBy: 'BM (Terminal)', 
    });

    // Step D: Build and send the HTML email
    const html = generateEmailHTML({
      title: '✅ BM Pick Up Confirmed',
      detailsArray: [
        { label: 'Branch Code', value: branchCode || record.branch_code || 'N/A' },
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

    await transporter.sendMail({
      from: `"Inventory System" <${process.env.SMTP_USER}>`,
      to: process.env.NOTIFY_EMAIL,
      subject: `✅ BM Pick Up Confirmed – ${branchCode || record.branch_code} / ${barcode}`,
      html,
    });

    return NextResponse.json({
      success: true,
      message: 'BM Pickup complete & archived.',
      fileId,
      webViewLink,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('BM Pickup API error:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}