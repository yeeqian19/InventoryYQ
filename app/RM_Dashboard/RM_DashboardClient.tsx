'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, Search, UserSearch, Package, Gift, Layers, Globe } from 'lucide-react';

// --- NEW MASTER BRANCH CONFIGURATION ---
type Region = 'A' | 'B' | 'C' | 'HQ';
type Branch = { code: string; name: string; region: Region };

const BRANCH_LIST: Branch[] = [
  // REGION A
  { code: 'RBY', name: 'Rimbayu', region: 'A' },
  { code: 'KLG', name: 'Klang', region: 'A' },
  { code: 'SHA', name: 'Shah Alam', region: 'A' },
  { code: 'SA',  name: 'Setia Alam', region: 'A' },
  { code: 'DA',  name: 'Denai Alam', region: 'A' },
  { code: 'EGR', name: 'Eco Grandeur', region: 'A' },
  { code: 'ST',  name: 'Subang Taipan', region: 'A' },
  { code: 'AC',  name: 'Anggun City Rawang', region: 'A' },
  { code: 'SBY', name: 'Sungai Buloh', region: 'A' },
  // REGION B
  { code: 'SLY',  name: 'Selayang', region: 'B' },
  { code: 'DK',   name: 'Danau Kota', region: 'B' },
  { code: 'KD',   name: 'Kota Damansara', region: 'B' },
  { code: 'AMP',  name: 'Ampang', region: 'B' },
  { code: 'SP',   name: 'Sri Petaling', region: 'B' },
  { code: 'BTHO', name: 'Bandar Tun Hussein Onn', region: 'B' },
  { code: 'KTG',  name: 'Kajang TTDI Groove', region: 'B' },
  { code: 'DSH',  name: 'Desa Sri Hartamas', region: 'B' },
  { code: 'TSG',  name: 'Taman Sri Gombak', region: 'B' },
  // REGION C
  { code: 'PJY', name: 'Putrajaya', region: 'C' },
  { code: 'KW',  name: 'Kota Warisan', region: 'C' },
  { code: 'BBB', name: 'Bandar Baru Bangi', region: 'C' },
  { code: 'CJY', name: 'Cyberjaya', region: 'C' },
  { code: 'BSP', name: 'Bandar Seri Putra', region: 'C' },
  { code: 'SNT', name: 'Senawang Taipan', region: 'C' },
  { code: 'SBN', name: 'Seremban', region: 'C' },
  { code: 'DP',  name: 'Dataran Puchong Utama', region: 'C' },
  { code: 'ONL', name: 'Online / Others', region: 'C' },
];

type StudentData = {
  student_id: string;
  name: string;
  branch: string;
  sk_prep: boolean;
  eg_prep: boolean;
  bm_pickup: boolean;
  student_received: boolean;
  type: string;
  package: string;
  hasSK: boolean; 
  hasEG: boolean; 
  giftType?: string | null; 
  created_at?: string;
};

// Pure utility — defined outside component so it's stable across renders
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function RM_DashboardClient({ initialData }: { initialData: StudentData[] }) {
  const router = useRouter();
  const [activeRegion, setActiveRegion] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [activeType, setActiveType] = useState<'ALL' | 'NEW' | 'RENEWAL' | 'TRIAL'>('NEW');
  const [itemToggle, setItemToggle] = useState<'ALL' | 'SK' | 'EG'>('ALL');
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [branchSearch, setBranchSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [rangeSelect, setRangeSelect] = useState('this-month');

  const calculateDates = useCallback((range: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (range) {
      case 'this-week':
        const day = now.getDay();
        start.setDate(now.getDate() - day);
        end = new Date();
        break;
      case 'last-week':
        const currentDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const daysToCurrentMonday = currentDay === 0 ? 6 : currentDay - 1;
        const currentMonday = new Date(now);
        currentMonday.setDate(now.getDate() - daysToCurrentMonday);
        const lastMonday = new Date(currentMonday);
        lastMonday.setDate(currentMonday.getDate() - 7);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        start = lastMonday;
        end = lastSunday;
        break;
      case 'this-month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date();
        break;
      case 'last-month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'all':
        setFromDate('');
        setToDate('');
        return;
      default:
        return;
    }
    setFromDate(toDateString(start));
    setToDate(toDateString(end));
  }, [setFromDate, setToDate]);

  // Initialize date range to current month on mount
  useEffect(() => {
    calculateDates('this-month');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const branchStats = useMemo(() => {
    let filtered = [...initialData];

    if (activeType !== 'ALL') {
      filtered = filtered.filter(s => s.type?.toUpperCase() === activeType.toUpperCase());
    }
    
    // Filter by Region
    if (activeRegion !== 'ALL') {
      const regionCodes = BRANCH_LIST.filter(b => b.region === activeRegion).map(b => b.code);
      filtered = filtered.filter(s => regionCodes.includes(s.branch));
    }

    if (fromDate || toDate) {
      const dStart = fromDate ? new Date(fromDate) : null;
      const dEnd = toDate ? new Date(toDate) : null;
      if (dStart) dStart.setHours(0, 0, 0, 0);
      if (dEnd) dEnd.setHours(23, 59, 59, 999);
      filtered = filtered.filter(s => {
        const d = s.created_at ? new Date(s.created_at) : null;
        return d && (!dStart || d >= dStart) && (!dEnd || d <= dEnd);
      });
    }

    if (studentSearch) {
      filtered = filtered.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()));
    }

    // Always show branches based on the Region selection from the Master List
    const masterRegionList = activeRegion === 'ALL' 
      ? BRANCH_LIST 
      : BRANCH_LIST.filter(b => b.region === activeRegion);

    const finalBranches = masterRegionList
      .filter(b => b.code.toLowerCase().includes(branchSearch.toLowerCase()) || b.name.toLowerCase().includes(branchSearch.toLowerCase()))
      .sort((a, b) => a.code.localeCompare(b.code));

    return finalBranches.map(branch => {
      const students = filtered.filter(s => s.branch === branch.code);
      let bTarget = 0; let bPrep = 0; let bPickup = 0; let bReceived = 0;

      students.forEach(s => {
        if (s.hasSK && (itemToggle === 'ALL' || itemToggle === 'SK')) {
          bTarget += 1;
          if (s.sk_prep) bPrep += 1;
          if (s.bm_pickup) bPickup += 1;
          if (s.student_received) bReceived += 1;
        }
        if (s.hasEG && (itemToggle === 'ALL' || itemToggle === 'EG')) {
          bTarget += 1;
          if (s.eg_prep) bPrep += 1;
          if (s.bm_pickup) bPickup += 1;
          if (s.student_received) bReceived += 1;
        }
      });

      const displayedList = students.filter(s => {
        if (itemToggle === 'SK') return s.hasSK;
        if (itemToggle === 'EG') return s.hasEG;
        return s.hasSK || s.hasEG;
      });

      return { 
        name: branch.code, 
        fullName: branch.name, 
        total: bTarget, 
        prep: bPrep, 
        pickup: bPickup, 
        received: bReceived, 
        list: displayedList 
      };
    });
  }, [initialData, activeRegion, activeType, itemToggle, fromDate, toDate, branchSearch, studentSearch]);

  const totalUnits = branchStats.reduce((a, b) => a + b.total, 0);
  const totalPrep = branchStats.reduce((a, b) => a + b.prep, 0);
  const totalPickup = branchStats.reduce((a, b) => a + b.pickup, 0);
  const totalReceived = branchStats.reduce((a, b) => a + b.received, 0);

  return (
    <div className="w-full min-h-screen p-8 bg-[#f8fafc] font-sans text-slate-900 overflow-x-hidden">
      <div className="max-w-[1440px] mx-auto">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-12">
          <div className="flex flex-col gap-6">
            <button onClick={() => router.push('/')} className="group flex items-center gap-3 bg-white px-5 py-2.5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-900 transition-all w-fit no-underline">
              <ArrowLeft size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Control Panel</span>
            </button>

            <div>
              <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">RM Dashboard</h1>
              <p className="text-slate-400 font-bold tracking-[0.4em] text-[10px] mt-4 uppercase opacity-70">Region A, B, & C Logic Sync</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-5 w-full lg:w-auto">
            {/* ITEM TOGGLE */}
            <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 shadow-lg">
              {[
                {id: 'ALL', icon: <Layers size={14}/>, label: 'ALL'},
                {id: 'SK', icon: <Package size={14}/>, label: 'SK ONLY'},
                {id: 'EG', icon: <Gift size={14}/>, label: 'EG ONLY'}
              ].map(item => (
                <button 
                  key={item.id}
                  onClick={() => setItemToggle(item.id as 'ALL' | 'SK' | 'EG')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black transition-all ${itemToggle === item.id ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                  {item.icon} <span className="hidden sm:inline">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap justify-end items-center gap-3">
              {/* DATE RANGE */}
              <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                <select 
                  value={rangeSelect} 
                  onChange={(e) => { setRangeSelect(e.target.value); calculateDates(e.target.value); }} 
                  className="bg-transparent text-[10px] font-black uppercase outline-none px-2 cursor-pointer"
                >
                  <option value="this-month">This Month</option>
                  <option value="last-month">Last Month</option>
                  <option value="this-week">This Week</option>
                  <option value="last-week">Last Week</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom</option>
                </select>
                <div className="flex items-center gap-2 px-2 border-l border-slate-100">
                  <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setRangeSelect('custom'); }} className="text-[10px] font-bold outline-none bg-transparent" />
                  <span className="text-slate-300 font-black text-[9px]">TO</span>
                  <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setRangeSelect('custom'); }} className="text-[10px] font-bold outline-none bg-transparent" />
                </div>
              </div>

              {/* TYPE FILTER */}
              <div className="flex bg-slate-200 rounded-xl p-1">
                {['ALL', 'NEW', 'RENEWAL', 'TRIAL'].map(t => (
                  <button key={t} onClick={() => setActiveType(t as 'ALL' | 'NEW' | 'RENEWAL' | 'TRIAL')} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${activeType === t ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}>{t}</button>
                ))}
              </div>

              {/* REGION TOGGLE - UPDATED */}
              <div className="flex bg-slate-900 p-1 rounded-xl shadow-lg">
                {[
                  {id: 'ALL', icon: <Globe size={12}/>},
                  {id: 'A', icon: null},
                  {id: 'B', icon: null},
                  {id: 'C', icon: null}
                ].map(r => (
                  <button 
                    key={r.id} 
                    onClick={() => setActiveRegion(r.id as 'ALL' | 'A' | 'B' | 'C')} 
                    className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all flex items-center gap-2 ${activeRegion === r.id ? 'bg-emerald-500 text-white shadow-md scale-105' : 'text-slate-500 hover:text-white'}`}
                  >
                    {r.icon} {r.id === 'ALL' ? 'ALL' : `REG ${r.id}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
           {[
             { label: 'Total Units', val: totalUnits, color: 'slate' },
             { label: 'Prepared', val: totalPrep, color: 'emerald' },
             { label: 'BM Pickup', val: totalPickup, color: 'blue' },
             { label: 'Received', val: totalReceived, color: 'purple' },
           ].map(card => (
             <div key={card.label} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{card.label}</p>
                <p className={`text-5xl font-black italic text-${card.color}-600 tracking-tighter`}>{card.val}</p>
             </div>
           ))}
        </div>

        {/* CHART */}
        <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-white mb-10 h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[
                { label: 'Prep', done: totalPrep, remaining: Math.max(0, totalUnits - totalPrep) },
                { label: 'Pickup', done: totalPickup, remaining: Math.max(0, totalUnits - totalPickup) },
                { label: 'Final', done: totalReceived, remaining: Math.max(0, totalUnits - totalReceived) },
            ]} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 900, fontSize: 13}} dy={15} />
              <YAxis hide domain={[0, totalUnits]} />
              <Tooltip cursor={{fill: '#f8fafc', radius: 20}} contentStyle={{borderRadius: '24px', border: 'none', fontWeight: '900'}} />
              <Bar dataKey="done" stackId="a" fill="#10b981" barSize={85} />
              <Bar dataKey="remaining" stackId="a" fill="#fb7185" radius={[18, 18, 0, 0]} barSize={85} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* SEARCH AREA */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input type="text" placeholder="Search Branch..." value={branchSearch} onChange={(e) => setBranchSearch(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-[2rem] py-5 pl-14 pr-6 outline-none focus:border-emerald-500 shadow-sm transition-all font-bold text-sm" />
          </div>
          <div className="relative flex-1">
            <UserSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input type="text" placeholder="Find Student..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-[2rem] py-5 pl-14 pr-6 outline-none focus:border-blue-600 shadow-sm transition-all font-bold text-sm" />
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-[3rem] shadow-2xl border border-white overflow-hidden mb-24">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                  <th className="px-10 py-7">Branch</th>
                  <th className="px-8 py-7 text-slate-900">Target</th>
                  <th className="px-8 py-7 text-emerald-600">Prep</th>
                  <th className="px-8 py-7 text-blue-600">Pickup</th>
                  <th className="px-8 py-7 text-purple-600">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {branchStats.map((row) => (
                  <React.Fragment key={row.name}>
                    <tr onClick={() => setExpandedBranch(expandedBranch === row.name ? null : row.name)} className="hover:bg-emerald-50/40 cursor-pointer transition-all">
                      <td className="px-10 py-8">
                        <div className="flex flex-col">
                          <span className="font-black text-2xl tracking-tighter text-slate-900 italic uppercase">{row.name}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{row.fullName}</span>
                        </div>
                      </td>
                      <td className="px-8 py-8 font-black text-lg text-slate-300 italic">{row.total}</td>
                      <td className="px-8 py-8 font-black text-emerald-600">{row.prep} / {row.total}</td>
                      <td className="px-8 py-8 font-black text-blue-600 text-sm">{row.pickup} / {row.total}</td>
                      <td className="px-8 py-8 font-black text-purple-600 text-sm">{row.received} / {row.total}</td>
                    </tr>
                    {expandedBranch === row.name && (
                      <tr className="bg-slate-50/40 border-t border-slate-100">
                        <td colSpan={5} className="px-12 py-10">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {row.list.length > 0 ? (
                               row.list.map(s => {
                                 const isPrepared = itemToggle === 'EG' ? s.eg_prep : itemToggle === 'SK' ? s.sk_prep : (s.hasSK ? s.sk_prep : true) && (s.hasEG ? s.eg_prep : true);
                                 return (
                                  <div key={s.student_id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-2 border-l-8" style={{ borderLeftColor: isPrepared ? '#10b981' : '#fb7185' }}>
                                    <span className="text-[11px] font-black text-slate-700 truncate uppercase tracking-tighter">{s.name}</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">{s.package}</span>
                                  </div>
                                 );
                               })
                            ) : (
                              <div className="col-span-full py-6 text-center text-slate-400 font-bold text-sm italic">No data.</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}