"use client";

import { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

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

export default function DashboardClient({ 
  dbData, 
  user 
}: { 
  dbData: InventoryItem[], 
  user?: DashboardUser 
}) {
  const [hasMounted, setHasMounted] = useState(false);
  
  const [activeRegion, setActiveRegion] = useState<Region>('ALL');
  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  const [selectedType, setSelectedType] = useState('NEW'); 
  const [quickDate, setQuickDate] = useState('all'); // Set default to 'all' to check tallying

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

  const BRANCHES_TO_SHOW = useMemo(() => {
    let list = BRANCH_MASTER_LIST;
    if (activeRegion !== 'ALL') {
      list = list.filter(b => b.region === activeRegion);
    }
    return ['All Branches', ...list.map(b => b.code).sort()];
  }, [activeRegion]);

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
    // 🟢 CRITICAL: Only count data belonging to our Region A, B, and C list
    const validBranchCodes = BRANCH_MASTER_LIST.map(b => b.code);
    let data = dbData.filter(item => validBranchCodes.includes(item.branch));
    
    // Filter by Region Sidebar
    if (activeRegion !== 'ALL' && selectedBranch === 'All Branches') {
      const regionCodes = BRANCH_MASTER_LIST.filter(b => b.region === activeRegion).map(b => b.code);
      data = data.filter(item => regionCodes.includes(item.branch));
    }

    if (selectedBranch !== 'All Branches') {
      data = data.filter((item) => item.branch === selectedBranch);
    }
    
    if (selectedType !== 'All') {
      data = data.filter((item) => item.studentType.toUpperCase() === selectedType.toUpperCase());
    }
    
    return data.filter((item) => {
      if (startDate && endDate) return item.date >= startDate && item.date <= endDate;
      return true; 
    });
  }, [selectedBranch, selectedType, startDate, endDate, dbData, activeRegion]);

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

  if (!hasMounted) return null;

  return (
    <div className="p-6 font-sans text-slate-800 flex gap-6 bg-[#fcfdfd] min-h-screen">
      <div className="w-64 flex-shrink-0">
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-5 sticky top-6 max-h-[90vh] overflow-y-auto no-scrollbar">
          <div className="mb-6 px-2 pb-6 border-b border-slate-50">
             <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Authenticated as</p>
             <p className="text-sm font-black text-slate-900 truncate">{user?.name || 'Staff'}</p>
             <p className="text-[9px] font-bold text-slate-400 uppercase">{user?.role || 'User'}</p>
          </div>

          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2 text-center">Region Filter</h3>
          <div className="grid grid-cols-4 gap-1 mb-6 bg-slate-100 p-1 rounded-xl">
            {(['ALL', 'A', 'B', 'C'] as const).map((r) => (
              <button
                key={r}
                onClick={() => { setActiveRegion(r); setSelectedBranch('All Branches'); }}
                className={`py-1.5 rounded-lg text-[10px] font-black transition-all ${activeRegion === r ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
              >
                {r}
              </button>
            ))}
          </div>

          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2 text-center">Branches</h3>
          <div className="flex flex-col gap-1.5">
            {BRANCHES_TO_SHOW.map((branch) => (
              <button
                key={branch}
                onClick={() => setSelectedBranch(branch)}
                className={`w-full text-left px-5 py-3 rounded-xl text-xs transition-all duration-300 ${selectedBranch === branch ? 'bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-100' : 'text-slate-500 hover:bg-slate-50 font-semibold'}`}
              >
                {branch}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6">
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
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center relative">
            <h3 className="text-sm font-black text-slate-800 mb-2 w-full text-left absolute top-10 left-10 uppercase tracking-widest">Success Rate</h3>
            <div className="h-64 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{v: totalPrepared}, {v: totalUnprepared}]} innerRadius={75} outerRadius={100} paddingAngle={10} dataKey="v" stroke="none">
                    <Cell fill={COLORS.prepared} /><Cell fill={COLORS.unprepared} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <p className="text-5xl font-black text-slate-900 tracking-tighter italic">{completionRate}%</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ready</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}