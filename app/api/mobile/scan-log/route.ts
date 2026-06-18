import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMobileSession } from '@/lib/mobileAuth';

export const dynamic = 'force-dynamic';

// Read endpoint for the mobile Scan History Log.
// Mirrors app/scan-log/page.tsx (all scan_log rows, newest first), splitting the
// timestamp into the {date, time} the mobile cards render.
const pad = (n: number) => String(n).padStart(2, '0');

export async function GET() {
  const session = await getMobileSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawLogs = await db.scanLog.findMany({ orderBy: { timestamp: 'desc' } });

  const logs = rawLogs.map((log) => {
    const ts = log.timestamp;
    return {
      id: log.id,
      date: `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}`,
      time: `${pad(ts.getHours())}:${pad(ts.getMinutes())}`,
      doc_no: log.doc_no ?? '',
      barcode: log.barcode,
      student: log.student_name,
      item_type: log.item_type,
      branch: log.branch,
      action: log.action_type,
      by: log.processed_by,
    };
  });

  return NextResponse.json({ logs });
}
