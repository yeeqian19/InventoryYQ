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
    <div className="lg:ml-72 min-h-screen bg-[#f3f7f9] font-sans text-slate-800 overflow-x-hidden">
      <div className="px-6 lg:px-10 py-6 lg:py-8 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10">
        <h1 className="text-2xl lg:text-3xl font-black text-slate-900 uppercase tracking-tighter">Student Tracker</h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
          SK + Enrollment Gift workflow timeline · 10d HQ Prep → 8d BM Pickup → 6d BM Handover
        </p>
      </div>

      <div className="p-6 lg:p-10">
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
