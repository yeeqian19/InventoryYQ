import { db } from '@/lib/db';
import ScanLogClient from './ScanLogClient';
import type { ScanLogEntry, ItemType, ActionType } from '@/types';

// This forces Next.js to always fetch fresh data when you load the page
export const dynamic = 'force-dynamic';

export default async function ScanLogPage() {
  // Fetch all logs from the database, ordered by newest first
  const rawLogs = await db.scanLog.findMany({
    orderBy: { timestamp: 'desc' },
  });

  // Convert Prisma Date objects to strings so they can be serialised to the Client Component
  const logs = rawLogs.map((log) => ({
    id: log.id,
    doc_no: log.doc_no,
    barcode: log.barcode,
    student_name: log.student_name,
    item_type: log.item_type as ItemType,
    branch: log.branch,
    action_type: log.action_type as ActionType,
    processed_by: log.processed_by,
    timestamp: log.timestamp.toISOString(),
  }));

  return (
    <div className="p-6 lg:p-10 min-h-screen bg-[#f3f7f9]">
      <ScanLogClient initialLogs={logs} />
    </div>
  );
}