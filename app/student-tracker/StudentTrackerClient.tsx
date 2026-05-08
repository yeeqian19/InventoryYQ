'use client';

import { useRouter } from 'next/navigation';
import StudentTrackerTable, { type TrackerRow } from '@/components/StudentTrackerTable';
import type { UserRole } from '@/types';

type Props = {
  rows: TrackerRow[];
  userRole: UserRole;
};

export default function StudentTrackerClient({ rows, userRole }: Props) {
  const router = useRouter();
  const canExtend = userRole === 'SUPERADMIN';

  const handleExtend = async (row: TrackerRow, days: number, reason: string) => {
    const res = await fetch('/api/student-tracker/extend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: row.student_id, days, reason }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || 'Failed to extend deadline');
    }
    router.refresh();
  };

  return (
    <div className="lg:ml-72 min-h-screen bg-[#fcfdfd] font-sans text-slate-800 overflow-x-hidden">
      <div className="p-4 lg:p-6 flex flex-col gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-900 uppercase tracking-tighter">Student Tracker</h1>
          <p className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            SK + EG workflow · 10d HQ Prep → 8d BM Pickup → 6d BM Handover
          </p>
        </div>

        <StudentTrackerTable
          rows={rows}
          canExtend={canExtend}
          onExtend={handleExtend}
          showBranchFilter={true}
          showSummaryCards={true}
        />
      </div>
    </div>
  );
}
