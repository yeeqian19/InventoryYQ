'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  DATE_PRESET_OPTIONS,
  rangeForPreset,
  type DatePreset,
} from '@/lib/trackerUtils';

export type TrackerStats = {
  total: number;
  onTrack: number;
  dueSoon: number;
  overdue: number;
  completed: number;
};

type Props = {
  initialStats: TrackerStats;
  initialPreset?: DatePreset;
};

export default function TrackerStrip({ initialStats, initialPreset = 'lastWeek' }: Props) {
  const initialRange = rangeForPreset(initialPreset);
  const [datePreset, setDatePreset] = useState<DatePreset>(initialPreset);
  const [startDate, setStartDate] = useState<string>(initialRange.start);
  const [endDate, setEndDate] = useState<string>(initialRange.end);
  const [stats, setStats] = useState<TrackerStats>(initialStats);
  const skipFirstFetchRef = useRef(true);

  useEffect(() => {
    if (skipFirstFetchRef.current) {
      skipFirstFetchRef.current = false;
      return;
    }
    const ctrl = new AbortController();
    const params = new URLSearchParams();
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    fetch(`/api/student-tracker/stats?${params.toString()}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStats(data as TrackerStats);
      })
      .catch(() => { /* aborted or network error — keep previous stats */ });
    return () => ctrl.abort();
  }, [startDate, endDate]);

  const handlePresetChange = (val: DatePreset) => {
    setDatePreset(val);
    if (val === 'custom') return;
    const { start, end } = rangeForPreset(val);
    setStartDate(start);
    setEndDate(end);
  };

  const presetLabel = DATE_PRESET_OPTIONS.find((o) => o.value === datePreset)?.label ?? 'Custom';

  return (
    <div className="lg:ml-72 px-4 lg:px-6 pt-4 lg:pt-6 bg-[#f8fafc]">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <Link
            href="/student-tracker"
            className="no-underline text-slate-700 hover:text-emerald-600 transition-colors"
          >
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Student Tracker</p>
            <p className="text-xs font-black uppercase tracking-wide mt-0.5">
              SK + EG workflow timeline
              <span className="ml-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">{presetLabel}</span>
            </p>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={datePreset}
              onChange={(e) => handlePresetChange(e.target.value as DatePreset)}
              className="bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer focus:border-emerald-500"
            >
              {DATE_PRESET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1">
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
            <Link
              href="/student-tracker"
              className="text-[10px] font-black text-emerald-600 uppercase tracking-widest no-underline hover:text-emerald-700"
            >
              Open →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest">Active</p>
            <p className="text-xl lg:text-3xl font-black text-slate-900 tracking-tighter">{stats.total}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
            <p className="text-[8px] lg:text-[9px] font-black text-emerald-600 uppercase tracking-widest">On-Track</p>
            <p className="text-xl lg:text-3xl font-black text-emerald-700 tracking-tighter">{stats.onTrack}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
            <p className="text-[8px] lg:text-[9px] font-black text-amber-600 uppercase tracking-widest">Due Soon</p>
            <p className="text-xl lg:text-3xl font-black text-amber-700 tracking-tighter">{stats.dueSoon}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 border border-red-100">
            <p className="text-[8px] lg:text-[9px] font-black text-red-600 uppercase tracking-widest">Overdue</p>
            <p className="text-xl lg:text-3xl font-black text-red-700 tracking-tighter">{stats.overdue}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
