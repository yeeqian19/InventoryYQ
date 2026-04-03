import { db } from '@/lib/db';
import ScanLogClient from './ScanLogClient';

// This forces Next.js to always fetch fresh data when you load the page
export const dynamic = 'force-dynamic';

export default async function ScanLogPage() {
  // Fetch all logs from the database, ordered by newest first
  const rawLogs = await (db as any).scanLog.findMany({
    orderBy: {
      timestamp: 'desc',
    },
  });

  // Convert Prisma Date objects to standard strings so they can be passed to the Client Component safely
  const logs = rawLogs.map((log: any) => ({
    ...log,
    timestamp: log.timestamp.toISOString(),
  }));

  return (
    <div className="p-6 lg:p-10 min-h-screen bg-[#f3f7f9]">
      <ScanLogClient initialLogs={logs} />
    </div>
  );
}