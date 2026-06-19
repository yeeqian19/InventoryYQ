import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMobileSession } from '@/lib/mobileAuth';
import { utcDayRange } from '@/lib/mobileDateFilter';

export const dynamic = 'force-dynamic';

// Read endpoint for the mobile Scan History Log.
// Mirrors app/scan-log/page.tsx (scan_log rows, newest first), windowed by the
// client-supplied date range (same as the web) and split into {date, time}.
const pad = (n: number) => String(n).padStart(2, '0');

export async function GET(request: NextRequest) {
  const session = await getMobileSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const range = utcDayRange(sp.get('start'), sp.get('end'));
  const rawLogs = await db.scanLog.findMany({
    where: { ...(range ? { timestamp: range } : {}) },
    orderBy: { timestamp: 'desc' },
  });

  const logs = rawLogs.map((log) => {
    // Display in Malaysia time (UTC+8) regardless of server timezone, matching the
    // web which renders the timestamp in the user's (Malaysia) browser-local time.
    const ts = new Date(log.timestamp.getTime() + log.timestamp.getTimezoneOffset() * 60000 + 8 * 60 * 60000);
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
