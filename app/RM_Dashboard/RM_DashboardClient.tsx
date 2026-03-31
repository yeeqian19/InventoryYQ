'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, Calendar, ChevronDown, Search, Users, RotateCcw, UserSearch, Package, Gift, Layers } from 'lucide-react';

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
  created_at?: string;
};

export default function RM_DashboardClient({ initialData }: { initialData: StudentData[] }) {
  const router = useRouter();
  const [activeRegion, setActiveRegion] = useState<'ALL' | 'R2' | 'R3'>('ALL');
  const [activeType, setActiveType] = useState<'ALL' | 'NEW' | 'RENEWAL' | 'TRIAL'>('NEW'); 
  const [itemToggle, setItemToggle] = useState<'ALL' | 'SK' | 'EG'>('ALL');
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [branchSearch, setBranchSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState(''); 
  
  // DATE STATES
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [rangeSelect, setRangeSelect] = useState('this-month'); 

  const R2 = ['ST', 'SA', 'PJY', 'AMP', 'CJY', 'KLG', 'BBB', 'SHA', 'RBY', 'KTG'];
  const R3 = ['ONL', 'SP', 'KD', 'DA', 'DK', 'BTHO', 'EGR', 'BSP', 'TSG', 'KW'];

  // Helper to format Date to YYYY-MM-DD
  const toDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // --- LOGIC: UPDATE INPUTS BASED ON QUICK SELECT ---
  const calculateDates = (range: string) => {
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
        const prevDay = now.getDay();
        start.setDate(now.getDate() - prevDay - 7);
        end.setDate(now.getDate() - prevDay - 1);
        break;
      case 'this-month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date();
        break;
      case 'last-month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      default:
        return;
    }
    setFromDate(toDateString(start));
    setToDate(toDateString(end));
  };

  useEffect(() => {
    calculateDates('this-month');
  }, []);

  const handleReset = () => {
    setBranchSearch('');
    setStudentSearch('');
    setActiveRegion('ALL');
    setActiveType('NEW');
    setItemToggle('ALL');
    setRangeSelect('this-month');
    calculateDates('this-month');
  };

  const branchStats = useMemo(() => {
    let filtered = [...initialData];

    if (activeType !== 'ALL') {
      filtered = filtered.filter(s => s.type?.toUpperCase() === activeType.toUpperCase());
    }
    if (activeRegion === 'R2') filtered = filtered.filter(s => R2.includes(s.branch));
    if (activeRegion === 'R3') filtered = filtered.filter(s => R3.includes(s.branch));

    // DATE FILTERING
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

    const names = Array.from(new Set(filtered.map(s => s.branch))).sort();
    const finalNames = names.filter(n => n.toLowerCase().includes(branchSearch.toLowerCase()));

    return finalNames.map(name => {
      const students = filtered.filter(s => s.branch === name);
      let bTarget = 0; let bPrep = 0; let bPickup = 0; let bReceived = 0;

      students.forEach(s => {
        const pkgStr = s.package?.toString().toUpperCase().trim() || "";
        const isDoublePkg = pkgStr.startsWith("12") || pkgStr.startsWith("9");
        const isEligibleType = s.type?.toUpperCase() === "NEW" || s.type?.toUpperCase() === "RENEWAL";
        const hasEG = isEligibleType && isDoublePkg;

        if (itemToggle === 'ALL' || itemToggle === 'SK') {
          bTarget += 1;
          if (s.sk_prep) bPrep += 1;
          if (s.bm_pickup) bPickup += 1;
          if (s.student_received) bReceived += 1;
        }

        if (hasEG && (itemToggle === 'ALL' || itemToggle === 'EG')) {
          bTarget += 1;
          if (s.eg_prep) bPrep += 1;
          if (s.bm_pickup) bPickup += 1;
          if (s.student_received) bReceived += 1;
        }
      });

      const displayedList = students.filter(s => {
        const pkgStr = s.package?.toString().toUpperCase().trim() || "";
        const isDoublePkg = pkgStr.startsWith("12") || pkgStr.startsWith("9");
        const isEligibleType = s.type?.toUpperCase() === "NEW" || s.type?.toUpperCase() === "RENEWAL";
        const hasEG = isEligibleType && isDoublePkg;
        if (itemToggle === 'SK') return true;
        if (itemToggle === 'EG') return hasEG;
        return true; 
      }).map(st => {
        const p = st.package?.toString().toUpperCase().trim() || "";
        const isDbl = (p.startsWith("12") || p.startsWith("9")) && (st.type?.toUpperCase() !== "TRIAL");
        return { ...st, isDoubleEligible: isDbl };
      });

      return { name, total: bTarget, prep: bPrep, pickup: bPickup, received: bReceived, list: displayedList };
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

            <div className="flex flex-wrap items-center gap-8">
              <div>
                <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">RM Dashboard</h1>
                <p className="text-slate-400 font-bold tracking-[0.4em] text-[10px] mt-4 uppercase opacity-70">Strict Package 9 & 12 Logic Sync</p>
              </div>
              
              <div className="bg-slate-900 text-white p-5 rounded-[2rem] flex items-center gap-5 px-8 shadow-2xl border-b-8 border-emerald-500 min-w-[240px]">
                 <div className="bg-emerald-500/20 p-3 rounded-2xl"><Users size={28} className="text-emerald-400" /></div>
                 <div>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">{itemToggle} Target</p>
                    <p className="text-5xl font-black italic leading-none">{totalUnits}</p>
                 </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-5 w-full lg:w-auto">
             <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 shadow-lg">
                {[
                  {id: 'ALL', icon: <Layers size={14}/>, label: 'ALL'},
                  {id: 'SK', icon: <Package size={14}/>, label: 'SK ONLY'},
                  {id: 'EG', icon: <Gift size={14}/>, label: 'EG ONLY'}
                ].map(item => (
                  <button 
                    key={item.id}
                    onClick={() => setItemToggle(item.id as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black transition-all ${itemToggle === item.id ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                  >
                    {item.icon} <span className="hidden sm:inline">{item.label}</span>
                  </button>
                ))}
             </div>

            <div className="flex flex-wrap justify-end items-center gap-3">
              {/* DATE RANGE SYNC GROUP */}
              <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                <div className="relative flex items-center gap-2 px-3 border-r border-slate-100">
                  <select 
                    value={rangeSelect} 
                    onChange={(e) => { setRangeSelect(e.target.value); calculateDates(e.target.value); }} 
                    className="appearance-none bg-transparent text-[10px] font-black uppercase outline-none pr-6 cursor-pointer"
                  >
                    <option value="this-month">This Month</option>
                    <option value="last-month">Last Month</option>
                    <option value="this-week">This Week</option>
                    <option value="last-week">Last Week</option>
                    <option value="custom">Custom Range</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-2 pointer-events-none text-slate-300" />
                </div>
                
                <div className="flex items-center gap-3 px-2">
                  <Calendar size={14} className="text-blue-500" />
                  <input 
                    type="date" 
                    value={fromDate} 
                    onChange={(e) => { setFromDate(e.target.value); setRangeSelect('custom'); }} 
                    className="text-[10px] font-bold outline-none bg-transparent"
                  />
                  <span className="text-slate-300 font-black text-[9px]">TO</span>
                  <input 
                    type="date" 
                    value={toDate} 
                    onChange={(e) => { setToDate(e.target.value); setRangeSelect('custom'); }} 
                    className="text-[10px] font-bold outline-none bg-transparent"
                  />
                </div>
              </div>

              <div className="flex bg-slate-200 rounded-xl p-1 shadow-inner">
                {['ALL', 'NEW', 'RENEWAL', 'TRIAL'].map(t => (
                  <button key={t} onClick={() => setActiveType(t as any)} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${activeType === t ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}>{t}</button>
                ))}
              </div>
              <div className="flex bg-slate-200 rounded-xl p-1 shadow-inner">
                {['ALL', 'R2', 'R3'].map(r => (
                  <button key={r} onClick={() => setActiveRegion(r as any)} className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${activeRegion === r ? 'bg-white text-slate-900 shadow-md scale-105' : 'text-slate-400'}`}>{r}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CHART */}
        <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-white mb-10 h-96 transition-all">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[
                { label: 'Prep', done: totalPrep, remaining: Math.max(0, totalUnits - totalPrep) },
                { label: 'BM Pickup', done: totalPickup, remaining: Math.max(0, totalUnits - totalPickup) },
                { label: 'Received', done: totalReceived, remaining: Math.max(0, totalUnits - totalReceived) },
            ]} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 900, fontSize: 13}} dy={15} />
              <YAxis hide domain={[0, totalUnits]} />
              <Tooltip cursor={{fill: '#f8fafc', radius: 20}} separator="" formatter={(v, n) => [v, n === 'done' ? 'Completed' : 'Remaining']} contentStyle={{borderRadius: '24px', border: 'none', fontWeight: '900'}} />
              <Bar dataKey="done" stackId="a" fill="#10b981" barSize={85} />
              <Bar dataKey="remaining" stackId="a" fill="#fb7185" radius={[18, 18, 0, 0]} barSize={85} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* SEARCH AREA */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input type="text" placeholder="Filter by Branch Name..." value={branchSearch} onChange={(e) => setBranchSearch(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-[2rem] py-5 pl-14 pr-6 outline-none focus:border-slate-900 shadow-sm transition-all font-bold text-sm" />
          </div>
          <div className="relative flex-1">
            <UserSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input type="text" placeholder="Find Student Across Regions..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-[2rem] py-5 pl-14 pr-6 outline-none focus:border-blue-600 shadow-sm transition-all font-bold text-sm" />
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-[3rem] shadow-2xl border border-white overflow-hidden mb-24">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                  <th className="px-10 py-7">Branch</th>
                  <th className="px-8 py-7 text-slate-900">Units Target</th>
                  <th className="px-8 py-7 text-emerald-600">Prepared</th>
                  <th className="px-8 py-7 text-blue-600">Pickup Units</th>
                  <th className="px-8 py-7 text-purple-600">Final Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {branchStats.map((row) => (
                  <React.Fragment key={row.name}>
                    <tr onClick={() => setExpandedBranch(expandedBranch === row.name ? null : row.name)} className="hover:bg-blue-50/40 cursor-pointer transition-all">
                      <td className="px-10 py-8 font-black text-2xl tracking-tighter text-slate-900 italic">{row.name}</td>
                      <td className="px-8 py-8 font-black text-lg text-slate-300 italic">{row.total}</td>
                      <td className="px-8 py-8 font-black text-emerald-600">{row.prep} / {row.total}</td>
                      <td className="px-8 py-8 font-black text-blue-600 text-sm">{row.pickup} / {row.total}</td>
                      <td className="px-8 py-8 font-black text-purple-600 text-sm">{row.received} / {row.total}</td>
                    </tr>
                    {expandedBranch === row.name && (
                      <tr className="bg-slate-50/40 border-t border-slate-100">
                        <td colSpan={5} className="px-12 py-10">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {row.list.map(s => {
                              let isPrepared = s.sk_prep;
                              if (itemToggle === 'EG') isPrepared = s.eg_prep;
                              if (itemToggle === 'ALL') isPrepared = s.sk_prep && (s.isDoubleEligible ? s.eg_prep : true);

                              return (
                                <div 
                                  key={s.student_id} 
                                  className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-2 hover:shadow-md transition-all border-l-8"
                                  style={{ borderLeftColor: isPrepared ? '#10b981' : '#fb7185' }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${s.student_received ? 'bg-purple-500' : s.bm_pickup ? 'bg-emerald-500' : isPrepared ? 'bg-blue-500' : 'bg-rose-300'}`} />
                                    <span className="text-[11px] font-black text-slate-700 truncate uppercase tracking-tighter">{s.name}</span>
                                  </div>
                                  <div className="flex flex-col pl-6">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                                      {itemToggle === 'EG' ? 'Enroll Gift Only' : itemToggle === 'SK' ? 'Starter Kit Only' : `${s.isDoubleEligible ? 2 : 1} Items Total`}
                                    </span>
                                    <span className="text-[8px] font-bold text-blue-500 uppercase mt-1">SK: {s.package || 'None'}</span>
                                  </div>
                                </div>
                              );
                            })}
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