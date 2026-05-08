'use client';

import { useMemo, useState } from 'react';
import {
  computeTracker,
  formatTrackerDate,
  statusBadgeClasses,
  statusLabel,
  stageLabel,
  DEFAULT_EXTENSION_DAYS,
  DATE_PRESET_OPTIONS,
  rangeForPreset,
  type DatePreset,
  type TrackerInput,
  type TrackerStage,
  type TrackerStatus,
} from '@/lib/trackerUtils';

export type TrackerRow = {
  student_id: number;
  student_name: string;
  branch_code: string;
  doc_no: string | null;
  doc_date: string | null;
  package: string | null;
  type: string | null;
  sk_prep: boolean;
  sk_prep_date: string | null;
  eg_prep: boolean;
  eg_prep_date: string | null;
  bm_pickup: boolean;
  bm_pickup_date: string | null;
  student_received: boolean;
  student_received_date: string | null;
  hq_prep_extension_days: number;
  bm_pickup_extension_days: number;
  bm_handover_extension_days: number;
};

type ComputedRow = TrackerRow & {
  computed: ReturnType<typeof computeTracker>;
};

type Props = {
  rows: TrackerRow[];
  canExtend: boolean;
  onExtend?: (row: TrackerRow, days: number, reason: string) => Promise<void> | void;
  showBranchFilter?: boolean;
  showSummaryCards?: boolean;
};

const STAGE_FILTER_OPTIONS: { value: TrackerStage | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Stages' },
  { value: 'HQ_PREP', label: 'HQ Prep' },
  { value: 'BM_PICKUP', label: 'BM Pickup' },
  { value: 'BM_HANDOVER', label: 'BM Handover' },
  { value: 'COMPLETED', label: 'Completed' },
];

const STATUS_FILTER_OPTIONS: { value: TrackerStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'ON_TRACK', label: 'On-Track' },
  { value: 'DUE_SOON', label: 'Due Soon' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'COMPLETED', label: 'Completed' },
];

type TypeFilter = 'ALL' | 'NEW' | 'RENEWAL' | 'TRIAL';
const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'ALL', label: 'All Types' },
  { value: 'NEW', label: 'New Students' },
  { value: 'RENEWAL', label: 'Renewal' },
  { value: 'TRIAL', label: 'Trial' },
];


export default function StudentTrackerTable({
  rows,
  canExtend,
  onExtend,
  showBranchFilter = true,
  showSummaryCards = true,
}: Props) {
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<TrackerStage | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<TrackerStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('NEW');
  const [datePreset, setDatePreset] = useState<DatePreset>('lastWeek');
  const [startDate, setStartDate] = useState<string>(() => rangeForPreset('lastWeek').start);
  const [endDate, setEndDate] = useState<string>(() => rangeForPreset('lastWeek').end);

  const [extendingFor, setExtendingFor] = useState<TrackerRow | null>(null);
  const [extendDays, setExtendDays] = useState<number>(DEFAULT_EXTENSION_DAYS);
  const [extendReason, setExtendReason] = useState<string>('');
  const [extendBusy, setExtendBusy] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  const computed: ComputedRow[] = useMemo(() => {
    return rows.map((r) => {
      const input: TrackerInput = {
        doc_date: r.doc_date,
        package: r.package,
        sk_prep: r.sk_prep,
        sk_prep_date: r.sk_prep_date,
        eg_prep: r.eg_prep,
        eg_prep_date: r.eg_prep_date,
        bm_pickup: r.bm_pickup,
        bm_pickup_date: r.bm_pickup_date,
        student_received: r.student_received,
        student_received_date: r.student_received_date,
        hq_prep_extension_days: r.hq_prep_extension_days,
        bm_pickup_extension_days: r.bm_pickup_extension_days,
        bm_handover_extension_days: r.bm_handover_extension_days,
      };
      return { ...r, computed: computeTracker(input) };
    });
  }, [rows]);

  const branches = useMemo(() => {
    const set = new Set(rows.map((r) => r.branch_code).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return computed.filter((r) => {
      if (search.trim() && !r.student_name.toLowerCase().includes(search.trim().toLowerCase())) {
        return false;
      }
      if (branchFilter !== 'ALL' && r.branch_code !== branchFilter) return false;
      if (stageFilter !== 'ALL' && r.computed.stage !== stageFilter) return false;
      if (statusFilter !== 'ALL' && r.computed.status !== statusFilter) return false;
      if (typeFilter !== 'ALL') {
        const t = (r.type ?? '').toUpperCase();
        if (t !== typeFilter) return false;
      }
      if (startDate || endDate) {
        const docDay = r.doc_date ? r.doc_date.slice(0, 10) : '';
        if (!docDay) return false;
        if (startDate && docDay < startDate) return false;
        if (endDate && docDay > endDate) return false;
      }
      return true;
    });
  }, [computed, search, branchFilter, stageFilter, statusFilter, typeFilter, startDate, endDate]);

  const handlePresetChange = (val: DatePreset) => {
    setDatePreset(val);
    if (val === 'custom') return;
    const { start, end } = rangeForPreset(val);
    setStartDate(start);
    setEndDate(end);
  };

  // KPI cards reflect what's currently filtered (date range, type, branch, stage, status, search).
  // Counts here ignore the stage/status filters so the four cards stay meaningful even when the
  // user narrows by stage or status — but they DO honor the date/type/branch/search scope.
  const scopedRows = useMemo(() => {
    return computed.filter((r) => {
      if (search.trim() && !r.student_name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (branchFilter !== 'ALL' && r.branch_code !== branchFilter) return false;
      if (typeFilter !== 'ALL') {
        const t = (r.type ?? '').toUpperCase();
        if (t !== typeFilter) return false;
      }
      if (startDate || endDate) {
        const docDay = r.doc_date ? r.doc_date.slice(0, 10) : '';
        if (!docDay) return false;
        if (startDate && docDay < startDate) return false;
        if (endDate && docDay > endDate) return false;
      }
      return true;
    });
  }, [computed, search, branchFilter, typeFilter, startDate, endDate]);

  const counts = useMemo(() => {
    const c = { total: 0, on_track: 0, due_soon: 0, overdue: 0, completed: 0 };
    for (const r of scopedRows) {
      c.total += 1;
      if (r.computed.status === 'ON_TRACK') c.on_track += 1;
      else if (r.computed.status === 'DUE_SOON') c.due_soon += 1;
      else if (r.computed.status === 'OVERDUE') c.overdue += 1;
      else if (r.computed.status === 'COMPLETED') c.completed += 1;
    }
    return c;
  }, [scopedRows]);

  const handleConfirmExtend = async () => {
    if (!extendingFor || !onExtend) return;
    if (!Number.isFinite(extendDays) || extendDays < 1 || extendDays > 90) {
      setExtendError('Days must be between 1 and 90.');
      return;
    }
    setExtendBusy(true);
    setExtendError(null);
    try {
      await onExtend(extendingFor, extendDays, extendReason.trim());
      setExtendingFor(null);
      setExtendDays(DEFAULT_EXTENSION_DAYS);
      setExtendReason('');
    } catch (err) {
      setExtendError(err instanceof Error ? err.message : 'Failed to extend.');
    } finally {
      setExtendBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {showSummaryCards && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <SummaryCard label="Total Active" value={counts.total} accent="slate" />
          <SummaryCard label="On-Track" value={counts.on_track} accent="emerald" />
          <SummaryCard label="Due Soon" value={counts.due_soon} accent="amber" />
          <SummaryCard label="Overdue" value={counts.overdue} accent="red" />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 lg:px-6 py-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3 lg:items-center bg-slate-50/40">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="bg-emerald-50 border border-emerald-100 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 outline-none cursor-pointer focus:border-emerald-500"
          >
            {TYPE_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={datePreset}
            onChange={(e) => handlePresetChange(e.target.value as DatePreset)}
            className="bg-white border border-slate-200 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer focus:border-emerald-500"
          >
            {DATE_PRESET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); }}
              className="text-[11px] font-bold text-slate-600 bg-transparent outline-none"
            />
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">TO</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); }}
              className="text-[11px] font-bold text-slate-600 bg-transparent outline-none"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setDatePreset('all'); }}
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <div className="px-4 lg:px-6 py-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3 lg:items-center">
          <input
            type="text"
            placeholder="Search student name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 transition-colors flex-1 min-w-0"
          />
          {showBranchFilter && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as TrackerStage | 'ALL')}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
          >
            {STAGE_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TrackerStatus | 'ALL')}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 lg:ml-2">
            {filtered.length} / {counts.total}
          </span>
        </div>

        <div className="w-full overflow-hidden">
          <table className="w-full text-left table-fixed">
            <colgroup>
              {canExtend ? (
                <>
                  <col className="w-[19%]" />{/* Student */}
                  <col className="w-[7%]" /> {/* Branch */}
                  <col className="w-[7%]" /> {/* Package */}
                  <col className="w-[13%]" />{/* HQ Prep */}
                  <col className="w-[11%]" />{/* BM Pickup */}
                  <col className="w-[11%]" />{/* BM Handover */}
                  <col className="w-[12%]" />{/* Status */}
                  <col className="w-[11%]" />{/* Deadline */}
                  <col className="w-[9%]" /> {/* Action */}
                </>
              ) : (
                <>
                  <col className="w-[22%]" />{/* Student */}
                  <col className="w-[8%]" /> {/* Branch */}
                  <col className="w-[8%]" /> {/* Package */}
                  <col className="w-[14%]" />{/* HQ Prep */}
                  <col className="w-[12%]" />{/* BM Pickup */}
                  <col className="w-[12%]" />{/* BM Handover */}
                  <col className="w-[13%]" />{/* Status */}
                  <col className="w-[11%]" />{/* Deadline */}
                </>
              )}
            </colgroup>
            <thead className="bg-slate-50">
              <tr className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                <th className="px-2 py-3">Student</th>
                <th className="px-2 py-3">Branch</th>
                <th className="px-2 py-3">Package</th>
                <th className="px-2 py-3">HQ Prep</th>
                <th className="px-2 py-3">BM Pickup</th>
                <th className="px-2 py-3">BM Handover</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Deadline</th>
                {canExtend && <th className="px-2 py-3">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.student_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-2 py-3 align-top">
                    <div className="text-xs font-black text-slate-900 truncate" title={r.student_name}>{r.student_name}</div>
                    {r.doc_no && (
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate" title={r.doc_no}>{r.doc_no}</div>
                    )}
                  </td>
                  <td className="px-2 py-3 align-top">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{r.branch_code || '—'}</span>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{r.package || '—'}</span>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <HqPrepCell row={r} />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <StageCell
                      done={r.bm_pickup}
                      doneDate={r.bm_pickup_date}
                      deadline={r.computed.bmPickupDeadline}
                      isCurrent={r.computed.stage === 'BM_PICKUP'}
                    />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <StageCell
                      done={r.student_received}
                      doneDate={r.student_received_date}
                      deadline={r.computed.bmHandoverDeadline}
                      isCurrent={r.computed.stage === 'BM_HANDOVER'}
                    />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${statusBadgeClasses(r.computed.status)}`}>
                      {statusLabel(r.computed.status)}
                    </span>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {stageLabel(r.computed.stage)}
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <div className="text-xs font-black text-slate-800 whitespace-nowrap">
                      {formatTrackerDate(r.computed.deadline)}
                    </div>
                    {r.computed.daysRemaining !== null && r.computed.stage !== 'COMPLETED' && (
                      <div className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 whitespace-nowrap ${
                        r.computed.status === 'OVERDUE'
                          ? 'text-red-500'
                          : r.computed.status === 'DUE_SOON'
                          ? 'text-amber-500'
                          : 'text-slate-400'
                      }`}>
                        {r.computed.daysRemaining < 0
                          ? `${Math.abs(r.computed.daysRemaining)}d late`
                          : r.computed.daysRemaining === 0
                          ? 'Due today'
                          : `${r.computed.daysRemaining}d left`}
                      </div>
                    )}
                  </td>
                  {canExtend && (
                    <td className="px-2 py-3 align-top">
                      {r.computed.stage === 'COMPLETED' ? (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">—</span>
                      ) : (
                        <button
                          onClick={() => setExtendingFor(r)}
                          className="px-2 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                        >
                          Extend
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canExtend ? 9 : 8} className="px-2 py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                    No students match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {extendingFor && canExtend && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          onClick={() => !extendBusy && setExtendingFor(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Extend Deadline</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {extendingFor.student_name} · {extendingFor.branch_code}
            </p>

            <div className="mt-5 flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Days to add</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={extendDays}
                  onChange={(e) => setExtendDays(parseInt(e.target.value, 10) || 0)}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-black text-slate-800 outline-none focus:border-emerald-500"
                />
                <p className="text-[9px] font-bold text-slate-400 mt-1">
                  Adds days to the current stage and every later stage.
                </p>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reason (optional)</label>
                <input
                  type="text"
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="e.g. B&W needed, sent to HQ"
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                />
              </div>
              {extendError && (
                <div className="text-[10px] font-black uppercase tracking-widest text-red-600">{extendError}</div>
              )}
            </div>

            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setExtendingFor(null)}
                disabled={extendBusy}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExtend}
                disabled={extendBusy}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                {extendBusy ? 'Saving…' : `Extend +${extendDays}d`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: 'slate' | 'emerald' | 'amber' | 'red' }) {
  const accentMap = {
    slate: 'bg-slate-400',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };
  return (
    <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-1.5 h-full ${accentMap[accent]}`}></div>
      <p className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tighter">{value}</p>
    </div>
  );
}

function HqPrepCell({ row }: { row: TrackerRow & { computed: ReturnType<typeof computeTracker> } }) {
  const c = row.computed;
  if (c.stage !== 'HQ_PREP' && (c.skDone && (!c.egRequired || c.egDone))) {
    const completedDate = c.egRequired
      ? (row.eg_prep_date && row.sk_prep_date ? (row.eg_prep_date > row.sk_prep_date ? row.eg_prep_date : row.sk_prep_date) : (row.eg_prep_date || row.sk_prep_date))
      : row.sk_prep_date;
    return (
      <div>
        <div className="text-xs font-black text-emerald-600">✓ Done</div>
        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
          {formatTrackerDate(completedDate)}
        </div>
      </div>
    );
  }
  const isCurrent = c.stage === 'HQ_PREP';
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest">
        <span className={c.skDone ? 'text-emerald-600' : 'text-slate-400'}>SK {c.skDone ? '✓' : '·'}</span>
        {c.egRequired && (
          <>
            <span className="text-slate-300">/</span>
            <span className={c.egDone ? 'text-emerald-600' : 'text-slate-400'}>EG {c.egDone ? '✓' : '·'}</span>
          </>
        )}
      </div>
      {isCurrent && (
        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
          due {formatTrackerDate(c.hqPrepDeadline)}
        </div>
      )}
    </div>
  );
}

function StageCell({
  done,
  doneDate,
  deadline,
  isCurrent,
}: {
  done: boolean;
  doneDate: string | null;
  deadline: Date | null;
  isCurrent: boolean;
}) {
  if (done) {
    return (
      <div>
        <div className="text-xs font-black text-emerald-600">✓ Done</div>
        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
          {formatTrackerDate(doneDate)}
        </div>
      </div>
    );
  }
  if (isCurrent && deadline) {
    return (
      <div>
        <div className="text-xs font-black text-slate-700">Pending</div>
        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
          due {formatTrackerDate(deadline)}
        </div>
      </div>
    );
  }
  return <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">—</span>;
}
