import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMobileSession } from '@/lib/mobileAuth';
import { rangeForPreset, type DatePreset } from '@/lib/trackerUtils';

export const dynamic = 'force-dynamic';

// Read endpoint for the mobile Scan History Log.
// Mirrors app/scan-log/page.tsx (scan_log rows, newest first), windowed by a date
// preset (default thisWeek, matching the web) and split into {date, time}.
const pad = (n: number) => String(n).padStart(2, '0');

function timestampWhere(preset: string): { timestamp?: { gte: Date; lte: Date } } {
  const { start, end } = rangeForPreset((preset || 'all') as DatePreset);
  if (!start || !end) return {};
  return { timestamp: { gte: new Date(`${start}T00:00:00`), lte: new Date(`${end}T23:59:59.999`) } };
}

export async function GET(request: NextRequest) {
  const session = await getMobileSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const preset = request.nextUrl.searchParams.get('preset') ?? 'thisWeek';
  const rawLogs = await db.scanLog.findMany({
    where: { ...timestampWhere(preset) },
    orderBy: { timestamp: 'desc' },
  });

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
