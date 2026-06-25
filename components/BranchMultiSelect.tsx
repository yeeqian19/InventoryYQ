'use client';

import { useState, useRef, useEffect } from 'react';

// Branches within each region are listed alphabetically by branch name.
export const BRANCH_REGIONS = [
  {
    label: 'Region A',
    branches: [
      { code: 'AC',  name: 'Anggun City Rawang' },
      { code: 'RBY', name: 'Bandar Rimbayu' },
      { code: 'DA',  name: 'Denai Alam' },
      { code: 'EGR', name: 'Eco Grandeur' },
      { code: 'KLG', name: 'Klang' },
      { code: 'SA',  name: 'Setia Alam' },
      { code: 'SHA', name: 'Shah Alam' },
      { code: 'ST',  name: 'Subang Taipan' },
      { code: 'TSB', name: 'Tropicana Sungai Buloh' },
    ],
  },
  {
    label: 'Region B',
    branches: [
      { code: 'AMP',  name: 'Ampang' },
      { code: 'BTHO', name: 'Bandar Tun Hussein Onn' },
      { code: 'DK',   name: 'Danau Kota' },
      { code: 'DSH',  name: 'Desa Sri Hartamas' },
      { code: 'KTG',  name: 'Kajang TTDI Groove' },
      { code: 'KD',   name: 'Kota Damansara' },
      { code: 'PJL',  name: 'Puncak Jalil' },
      { code: 'SLY',  name: 'Selayang' },
      { code: 'SP',   name: 'Sri Petaling' },
      { code: 'TSG',  name: 'Taman Sri Gombak' },
    ],
  },
  {
    label: 'Region C',
    branches: [
      { code: 'BBB', name: 'Bandar Baru Bangi' },
      { code: 'BSP', name: 'Bandar Seri Putra' },
      { code: 'CJY', name: 'Cyberjaya' },
      { code: 'KW',  name: 'Kota Warisan' },
      { code: 'ONL', name: 'Online / Others' },
      { code: 'PU',  name: 'Puchong Utama' },
      { code: 'PJY', name: 'Putrajaya' },
      { code: 'SNT', name: 'Senawang Taipan' },
      { code: 'SBN', name: 'Seremban' },
    ],
  },
  {
    label: 'Other',
    branches: [
      { code: 'HQ', name: 'Headquarters' },
    ],
  },
];

export const ALL_BRANCH_CODES = BRANCH_REGIONS.flatMap(r => r.branches.map(b => b.code));

type Props = {
  selected: string[];           // [] means All Branches
  onChange: (codes: string[]) => void;
  className?: string;
};

export default function BranchMultiSelect({ selected, onChange, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isAll = selected.length === 0;

  const toggle = (code: string) => {
    if (selected.includes(code)) {
      const next = selected.filter(c => c !== code);
      onChange(next); // empty = All
    } else {
      onChange([...selected, code]);
    }
  };

  const toggleRegion = (codes: string[]) => {
    const allSelected = codes.every(c => selected.includes(c));
    if (allSelected) {
      onChange(selected.filter(c => !codes.includes(c)));
    } else {
      const merged = Array.from(new Set([...selected, ...codes]));
      onChange(merged);
    }
  };

  const label = isAll
    ? 'All Branches'
    : selected.length === 1
    ? selected[0]
    : `${selected.length} Branches`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-emerald-50 rounded-xl px-5 py-3 text-sm font-black text-emerald-700 w-full justify-between focus:outline-none"
      >
        <span className="truncate">{label}</span>
        <svg className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 w-96 max-h-[500px] overflow-y-auto py-2">
          {/* All Branches */}
          <button
            type="button"
            onClick={() => { onChange([]); setOpen(false); }}
            className={`w-full text-left px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${isAll ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            All Branches
          </button>

          <div className="border-t border-slate-100 my-1" />

          {BRANCH_REGIONS.map(region => {
            const regionCodes = region.branches.map(b => b.code);
            const allRegionSelected = regionCodes.every(c => selected.includes(c));
            const someRegionSelected = regionCodes.some(c => selected.includes(c));

            return (
              <div key={region.label}>
                {/* Region header — click to toggle whole region */}
                <button
                  type="button"
                  onClick={() => toggleRegion(regionCodes)}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors"
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    allRegionSelected ? 'bg-emerald-500 border-emerald-500' : someRegionSelected ? 'bg-emerald-200 border-emerald-400' : 'border-slate-300'
                  }`}>
                    {(allRegionSelected || someRegionSelected) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={allRegionSelected ? 'M5 13l4 4L19 7' : 'M5 12h14'} />
                      </svg>
                    )}
                  </span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{region.label}</span>
                </button>

                {/* Individual branches */}
                {region.branches.map(b => (
                  <button
                    key={b.code}
                    type="button"
                    onClick={() => toggle(b.code)}
                    className="w-full flex items-center gap-3 pl-8 pr-4 py-2 hover:bg-slate-50 transition-colors"
                  >
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      selected.includes(b.code) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
                    }`}>
                      {selected.includes(b.code) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      <span className="text-emerald-600 font-black">{b.code}</span>
                      <span className="text-slate-400 font-normal"> — {b.name}</span>
                    </span>
                  </button>
                ))}

                <div className="border-t border-slate-50 mx-4 my-1" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
