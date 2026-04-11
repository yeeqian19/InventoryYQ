"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import BranchMultiSelect from '@/components/BranchMultiSelect';

const COLORS = { prepared: '#10b981', unprepared: '#ef4444' };

// --- MASTER BRANCH CONFIGURATION ---
type Region = 'A' | 'B' | 'C' | 'HQ' | 'ALL';
type Branch = { code: string; name: string; region: Region };

const BRANCH_MASTER_LIST: Branch[] = [
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
  // HQ records (e.g. internal / unassigned branch)
  { code: 'HQ', name: 'HQ', region: 'HQ' },
];

type InventoryItem = {
  branch: string;
  itemType: string;
  total: number;
  prepared: number;
  unprepared: number;
  date: string;
  studentType: string;
};

type DashboardUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
  branch_name?: string | null;
};

type MobileTab = 'overview' | 'charts' | 'branches';

export default function DashboardClient({
  dbData,
  user
}: {
  dbData: InventoryItem[],
  user?: DashboardUser
}) {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard',       href: '/dashboard',       icon: '📦', roles: ['SUPERADMIN', 'ADMIN_HQ', 'USER_RM'] },
    { name: 'Student Manager', href: '/student-manager', icon: '👥', roles: ['SUPERADMIN', 'ADMIN_HQ'] },
    { name: 'Scan & Approve',  href: '/scan-approve',    icon: '📷', roles: ['SUPERADMIN', 'ADMIN_HQ'] },
    { name: 'Scan Log',        href: '/scan-log',        icon: '📋', roles: ['SUPERADMIN', 'ADMIN_HQ', 'USER_RM'] },
  ].filter(item => item.roles.includes(user?.role || ''));
  const [hasMounted, setHasMounted] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('overview');

  const [selectedBranches, setSelectedBranches] = useState<string[]>([]); // [] = All Branches
  const [activeRegion, setActiveRegion] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');

  const BRANCHES_TO_SHOW = useMemo(() => {
    if (activeRegion === 'ALL') return BRANCH_MASTER_LIST.map(b => b.code);
    return BRANCH_MASTER_LIST.filter(b => b.region === activeRegion).map(b => b.code);
  }, [activeRegion]);

  const [selectedType, setSelectedType] = useState('NEW');
  const [quickDate, setQuickDate] = useState('all');

  const formatDateForInput = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getThisWeekRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.getTime());
    monday.setDate(diff);
    return { start: formatDateForInput(monday), end: formatDateForInput(today) };
  };

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional SSR hydration guard
  useEffect(() => { setHasMounted(true); }, []);

  const handleDropdownChange = (val: string) => {
    setQuickDate(val);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (val) {
      case 'thisWeek': {
        const range = getThisWeekRange();
        setStartDate(range.start);
        setEndDate(range.end);
        break;
      }
      case 'thisMonth': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(formatDateForInput(start));
        setEndDate(formatDateForInput(today));
        break;
      }
      case 'lastWeek': {
        const currentDay = today.getDay();
        const daysToCurrentMonday = currentDay === 0 ? 6 : currentDay - 1;
        const currentMonday = new Date(today);
        currentMonday.setDate(today.getDate() - daysToCurrentMonday);
        const lastMonday = new Date(currentMonday);
        lastMonday.setDate(currentMonday.getDate() - 7);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        setStartDate(formatDateForInput(lastMonday));
        setEndDate(formatDateForInput(lastSunday));
        break;
      }
      case 'lastMonth': {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        setStartDate(formatDateForInput(start));
        setEndDate(formatDateForInput(end));
        break;
      }
      case 'all':
        setStartDate('');
        setEndDate('');
        break;
    }
  };

  const filteredData = useMemo(() => {
    const validBranchCodes = BRANCH_MASTER_LIST.map(b => b.code);
    let data = dbData.filter(item => validBranchCodes.includes(item.branch));

    // Filter by branch(es) - empty array means all branches
    if (selectedBranches.length > 0) {
      data = data.filter((item) => selectedBranches.includes(item.branch));
    }

    if (selectedType !== 'All') {
      data = data.filter((item) => item.studentType.toUpperCase() === selectedType.toUpperCase());
    }

    return data.filter((item) => {
      if (startDate && endDate) return item.date >= startDate && item.date <= endDate;
      return true;
    });
  }, [selectedBranches, selectedType, startDate, endDate, dbData]);

  const totalItems = filteredData.reduce((sum, item) => sum + item.total, 0);
  const totalPrepared = filteredData.reduce((sum, item) => sum + item.prepared, 0);
  const totalUnprepared = Math.max(0, totalItems - totalPrepared);
  const completionRate = totalItems > 0 ? Math.round((totalPrepared / totalItems) * 100) : 0;

  const chartData = useMemo(() => {
    const grouped: Record<string, { name: string; prepared: number; unprepared: number }> = {};
    filteredData.forEach((item) => {
      const typeKey = item.itemType;
      if (!grouped[typeKey]) grouped[typeKey] = { name: typeKey, prepared: 0, unprepared: 0 };
      grouped[typeKey].prepared += item.prepared;
      grouped[typeKey].unprepared += (item.total - item.prepared);
    });
    return Object.values(grouped);
  }, [filteredData]);

  // Per-branch summary for the branches tab
  const branchSummary = useMemo(() => {
    const grouped: Record<string, { total: number; prepared: number }> = {};
    filteredData.forEach((item) => {
      if (!grouped[item.branch]) grouped[item.branch] = { total: 0, prepared: 0 };
      grouped[item.branch].total += item.total;
      grouped[item.branch].prepared += item.prepared;
    });
    return Object.entries(grouped)
      .map(([code, v]) => ({ code, ...v, rate: v.total > 0 ? Math.round((v.prepared / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredData]);

  if (!hasMounted) return null;

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  const MobileView = (
    <div className="flex flex-col h-screen bg-[#f3f7f9] font-sans text-slate-800 overflow-hidden pb-16">
      {/* STICKY HEADER */}
      <div className="px-6 py-5 flex flex-col gap-3 bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
            Distribution Dashboard
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Real-time inventory tracking
          </p>
        </div>
        {/* Filters row */}
        <div className="flex gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-black text-slate-700 outline-none shadow-sm cursor-pointer"
          >
            <option value="NEW">New Students</option>
            <option value="RENEWAL">Renewals</option>
            <option value="TRIAL">Trials</option>
            <option value="All">All Types</option>
          </select>
          <select
            value={quickDate}
            onChange={(e) => handleDropdownChange(e.target.value)}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-black text-slate-700 outline-none shadow-sm cursor-pointer"
          >
            <option value="all">All Time</option>
            <option value="thisWeek">This Week</option>
            <option value="lastWeek">Last Week</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
          </select>
        </div>
        {/* Branch Selection */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Branch</label>
          <BranchMultiSelect selected={selectedBranches} onChange={setSelectedBranches} />
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* STAT CARDS — always visible */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-400"></div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Target</p>
            <p className="text-2xl font-black text-slate-900 tracking-tighter">{totalItems}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-emerald-400 ring-2 ring-emerald-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Prepared</p>
            <p className="text-2xl font-black text-slate-900 tracking-tighter">{totalPrepared}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-rose-300 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
            <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Pending</p>
            <p className="text-2xl font-black text-slate-900 tracking-tighter">{totalUnprepared}</p>
          </div>
        </div>

        {/* TAB CONTENT */}
        {mobileTab === 'overview' && (
          <div className="bg-white rounded-[2rem] border-2 border-emerald-200 shadow-sm relative overflow-hidden flex flex-col min-h-[300px]">
            <div className="w-full py-2.5 text-center text-[10px] font-black uppercase tracking-[0.3em] text-white bg-emerald-500">
              HQ Overview Mode
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              {/* Pie chart */}
              <div className="w-full max-w-[220px] aspect-square relative flex items-center justify-center mx-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[{v: totalPrepared}, {v: totalUnprepared}]}
                      innerRadius="60%"
                      outerRadius="80%"
                      paddingAngle={10}
                      dataKey="v"
                      stroke="none"
                    >
                      <Cell fill={COLORS.prepared} /><Cell fill={COLORS.unprepared} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center pointer-events-none">
                  <p className="text-4xl font-black text-slate-900 tracking-tighter italic">{completionRate}%</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ready</p>
                </div>
              </div>
              <div className="flex gap-4 mt-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                  <span className="text-[10px] font-black text-slate-500 uppercase">Prepared</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
                  <span className="text-[10px] font-black text-slate-500 uppercase">Pending</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {mobileTab === 'charts' && (
          <div className="bg-white rounded-[2rem] border-2 border-blue-200 shadow-sm relative overflow-hidden flex flex-col min-h-[300px]">
            <div className="w-full py-2.5 text-center text-[10px] font-black uppercase tracking-[0.3em] text-white bg-blue-500">
              Stock Distribution
            </div>
            <div className="p-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold', fill: '#94a3b8'}} dy={8} />
                  <YAxis hide />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', fontWeight: 'bold', fontSize: 11}} />
                  <Bar dataKey="prepared" stackId="a" fill={COLORS.prepared} barSize={36} />
                  <Bar dataKey="unprepared" stackId="a" fill={COLORS.unprepared} radius={[8, 8, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {mobileTab === 'branches' && (
          <div className="bg-white rounded-[2rem] border-2 border-amber-200 shadow-sm overflow-hidden flex flex-col">
            <div className="w-full py-2.5 text-center text-[10px] font-black uppercase tracking-[0.3em] text-white bg-amber-500">
              Branch Breakdown
            </div>
            <div className="divide-y divide-slate-50">
              {branchSummary.length === 0 && (
                <p className="text-center text-slate-400 text-xs font-bold py-10 uppercase tracking-widest">No data</p>
              )}
              {branchSummary.map(b => (
                <div key={b.code} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-black text-slate-900 text-sm">{b.code}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{b.prepared} / {b.total} prepared</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{width: `${b.rate}%`}}></div>
                    </div>
                    <span className="text-xs font-black text-slate-700 w-10 text-right">{b.rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MOBILE BOTTOM NAV */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-2xl flex">
        <button
          onClick={() => router.push('/')}
          className="flex-1 flex flex-col items-center justify-center py-3 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <span className="text-lg">🏠</span>
          <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Home</span>
        </button>
        <button
          onClick={() => setMobileTab('overview')}
          className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${mobileTab === 'overview' ? 'text-emerald-500' : 'text-slate-400'}`}
        >
          <span className="text-lg">📊</span>
          <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Overview</span>
        </button>
        <button
          onClick={() => setMobileTab('charts')}
          className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${mobileTab === 'charts' ? 'text-blue-500' : 'text-slate-400'}`}
        >
          <span className="text-lg">📈</span>
          <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Charts</span>
        </button>
        <button
          onClick={() => setMobileTab('branches')}
          className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${mobileTab === 'branches' ? 'text-amber-500' : 'text-slate-400'}`}
        >
          <span className="text-lg">📍</span>
          <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Branches</span>
        </button>
      </div>
    </div>
  );

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  const DesktopView = (
    <div className="flex min-h-screen font-sans text-slate-800 bg-[#f8fafc]">

      {/* GREEN GLOBAL SIDEBAR */}
      <aside className="fixed left-0 top-0 h-screen w-72 bg-[#7cb342] text-white flex flex-col shadow-2xl z-20">
        <div className="p-8">
          <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">My Inventory</h1>
          <p className="text-[10px] font-bold opacity-50 tracking-[0.2em] mt-2 border-t border-white/20 pt-2 uppercase">
            Central Administration
          </p>
        </div>

        <div className="px-4 mb-4">
          <Link href="/" className="w-full flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border border-white/10 no-underline text-white">
            <span>⬅️</span> Control Panel
          </Link>
        </div>

        <nav className="flex-1 py-2 space-y-1">
          {navItems.map(item => {
            const isActive = pathname?.toLowerCase().startsWith(item.href.toLowerCase());
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-6 py-4 text-xs font-black uppercase tracking-wide transition-all no-underline ${
                  isActive
                    ? 'bg-[#f8fafc] text-[#7cb342] rounded-l-full ml-4 shadow-md'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-white/10 bg-black/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white text-[#7cb342] flex items-center justify-center font-black shadow-inner shrink-0 uppercase text-sm">
              {(user?.name || user?.role || 'U').substring(0, 2)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-black truncate leading-none">{user?.name || 'Staff'}</p>
              <p className="text-[9px] text-white/50 uppercase tracking-widest mt-1 font-bold">
                {user?.role === 'SUPERADMIN' ? 'System Admin' : user?.role || 'User'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* CONTENT AREA (offset by sidebar width) */}
      <div className="ml-72 flex-1 grid grid-cols-[320px_1fr] gap-8 p-6 bg-[#fcfdfd]">

        {/* WHITE FILTER PANEL — inline multi-select, no dropdown */}
        <div className="row-start-1 row-end-3">
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-5 h-full flex flex-col overflow-hidden">
            {/* Auth info */}
            <div className="mb-6 px-2 pb-6 border-b border-slate-50 shrink-0">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Authenticated as</p>
              <p className="text-sm font-black text-slate-900 truncate">{user?.name || 'Staff'}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase">{user?.role || 'User'}</p>
            </div>

            {/* Region tabs */}
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2 text-center shrink-0">Region Filter</h3>
            <div className="grid grid-cols-4 gap-1 mb-4 bg-slate-100 p-1 rounded-xl shrink-0">
              {(['ALL', 'A', 'B', 'C'] as const).map((r) => (
                <button key={r} onClick={() => { setActiveRegion(r); setSelectedBranches([]); }}
                  className={`py-1.5 rounded-lg text-[10px] font-black transition-all ${activeRegion === r ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>
                  {r}
                </button>
              ))}
            </div>

            {/* Branch list — scrollable, multi-select with checkboxes */}
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2 text-center shrink-0">Branches</h3>
            <div className="flex-1 overflow-y-auto flex flex-col gap-1 no-scrollbar">
              {/* All Branches button */}
              <button
                onClick={() => setSelectedBranches([])}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${selectedBranches.length === 0 ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selectedBranches.length === 0 ? 'border-white bg-white/30' : 'border-slate-300'}`}>
                  {selectedBranches.length === 0 && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                </span>
                All Branches
              </button>

              {BRANCHES_TO_SHOW.filter(b => b !== 'All Branches').map((branch) => {
                const isSelected = selectedBranches.includes(branch);
                const toggle = () => {
                  setSelectedBranches(prev =>
                    prev.includes(branch) ? prev.filter(b => b !== branch) : [...prev, branch]
                  );
                };
                return (
                  <button key={branch} onClick={toggle}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs transition-all ${isSelected ? 'bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-100' : 'text-slate-500 hover:bg-slate-50 font-semibold'}`}
                  >
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-white bg-white/30' : 'border-slate-300'}`}>
                      {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                    </span>
                    {branch}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Distribution Progress</h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] mt-1">REAL-TIME TRACKING / SYNCED LOGIC</p>
          </div>
          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="bg-emerald-50 border-none rounded-xl px-4 py-2.5 text-[10px] font-black text-emerald-700 outline-none cursor-pointer uppercase">
              <option value="NEW">New Students</option>
              <option value="RENEWAL">Renewals</option>
              <option value="TRIAL">Trials</option>
              <option value="All">All Types</option>
            </select>
            <div className="h-5 w-px bg-slate-200 mx-1"></div>
            <select value={quickDate} onChange={(e) => handleDropdownChange(e.target.value)} className="bg-slate-100 border-none rounded-xl px-4 py-2.5 text-[10px] font-black text-slate-700 outline-none cursor-pointer uppercase">
              <option value="all">All Time</option>
              <option value="thisWeek">This Week</option>
              <option value="lastWeek">Last Week</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
            </select>
            <div className="flex items-center gap-3 px-4 border-l border-slate-100">
              <input type="date" value={startDate} onChange={e => {setStartDate(e.target.value); setQuickDate('custom');}} className="text-[10px] font-bold text-slate-500 bg-transparent outline-none" />
              <span className="text-slate-300 text-[10px] font-black">TO</span>
              <input type="date" value={endDate} onChange={e => {setEndDate(e.target.value); setQuickDate('custom');}} className="text-[10px] font-bold text-slate-500 bg-transparent outline-none" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Master Target (Units)</p>
            <p className="text-5xl font-black text-slate-900 tracking-tighter italic">{totalItems}</p>
          </div>
          <div className="bg-white p-8 rounded-3xl border-b-8 border-emerald-500 shadow-sm">
            <p className="text-[10px] font-black text-emerald-500 uppercase mb-2 tracking-widest">Total Prepared</p>
            <p className="text-5xl font-black text-slate-900 tracking-tighter italic">{totalPrepared}</p>
          </div>
          <div className="bg-white p-8 rounded-3xl border-b-8 border-rose-500 shadow-sm">
            <p className="text-[10px] font-black text-rose-500 uppercase mb-2 tracking-widest">Total Pending</p>
            <p className="text-5xl font-black text-slate-900 tracking-tighter italic">{totalUnprepared}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm min-h-[400px]">
            <h3 className="text-sm font-black text-slate-800 mb-8 uppercase tracking-widest">Stock Distribution</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} dy={10} />
                  <YAxis hide />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', fontWeight: 'bold'}} />
                  <Bar dataKey="prepared" stackId="a" fill={COLORS.prepared} barSize={50} />
                  <Bar dataKey="unprepared" stackId="a" fill={COLORS.unprepared} radius={[12, 12, 0, 0]} barSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center relative">
            <h3 className="text-sm font-black text-slate-800 w-full text-left uppercase tracking-widest mb-4">Success Rate</h3>
            <div className="w-full aspect-square max-w-[220px] relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[{v: totalPrepared}, {v: totalUnprepared}]}
                    innerRadius="60%"
                    outerRadius="80%"
                    paddingAngle={10}
                    dataKey="v"
                    stroke="none"
                  >
                    <Cell fill={COLORS.prepared} /><Cell fill={COLORS.unprepared} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center pointer-events-none">
                <p className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter italic">{completionRate}%</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ready</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden">{MobileView}</div>
      <div className="hidden lg:block">{DesktopView}</div>
    </>
  );
}

