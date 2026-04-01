"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const COLORS = { prepared: '#10b981', unprepared: '#ef4444' };

type InventoryItem = {
  branch: string;
  itemType: string;
  total: number;
  prepared: number;
  unprepared: number;
  date: string;
  studentType: string; 
};

export default function DashboardClient({ dbData }: { dbData: InventoryItem[] }) {
  const [hasMounted, setHasMounted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();
  
  const formatDateForInput = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // --- NEW: Week Date Logic ---
  const getThisWeekRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Start on Monday
    const monday = new Date(today.getTime());
    monday.setDate(diff);
    
    return {
      start: formatDateForInput(monday),
      end: formatDateForInput(today) // Up to today
    };
  };

  const getThisMonthRange = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      start: formatDateForInput(start),
      end: formatDateForInput(today)
    };
  };

  // Set default range to THIS WEEK
  const weekRange = getThisWeekRange();

  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  const [selectedType, setSelectedType] = useState('NEW'); 
  
  // DEFAULT SETTINGS UPDATED
  const [quickDate, setQuickDate] = useState('thisWeek');
  const [startDate, setStartDate] = useState(weekRange.start);
  const [endDate, setEndDate] = useState(weekRange.end);

  const handleInstantSync = () => {
    setIsSyncing(true);
    router.refresh();
    setTimeout(() => setIsSyncing(false), 1000);
  };

  const BRANCHES = useMemo(() => {
    const expectedBranches = [
      'ST', 'SA', 'PJY', 'AMP', 'CJY', 'KLG', 'BBB', 'SHA', 'RBY', 'KTG', 
      'ONL', 'SP', 'KD', 'DA', 'DK', 'BTHO', 'EGR', 'BSP', 'KW', 'TSG', 'HQ'
    ]; 
    const rawDbBranches = Array.from(new Set(dbData.map(d => d.branch)));
    const allUnique = Array.from(new Set([...expectedBranches, ...rawDbBranches]));
    return ['All Branches', ...allUnique.sort()];
  }, [dbData]);

  useEffect(() => { setHasMounted(true); }, []);

  // --- UPDATED: Date Switch Logic ---
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
      case 'lastWeek': {
        const end = new Date(today.getTime());
        end.setDate(today.getDate() - today.getDay()); // Previous Sunday
        const start = new Date(end.getTime());
        start.setDate(end.getDate() - 6); // Previous Monday
        setStartDate(formatDateForInput(start));
        setEndDate(formatDateForInput(end));
        break;
      }
      case 'thisMonth': {
        const range = getThisMonthRange();
        setStartDate(range.start);
        setEndDate(range.end);
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
    let data = [...dbData]; 
    
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
  }, [selectedBranch, selectedType, startDate, endDate, dbData]);

  const totalItems = filteredData.reduce((sum, item) => sum + item.total, 0);
  const totalPrepared = filteredData.reduce((sum, item) => sum + item.prepared, 0);
  const totalUnprepared = totalItems - totalPrepared;
  const completionRate = totalItems > 0 ? Math.round((totalPrepared / totalItems) * 100) : 0;

  const chartData = useMemo(() => {
    const grouped: Record<string, any> = {};
    filteredData.forEach((item) => {
      const typeKey = item.itemType.toUpperCase().includes('KIT') ? 'Starter Kit (SK)' : 'Enrollment Gift (EG)';
      if (!grouped[typeKey]) grouped[typeKey] = { name: typeKey, prepared: 0, unprepared: 0 };
      grouped[typeKey].prepared += item.prepared;
      grouped[typeKey].unprepared += item.unprepared;
    });
    return Object.values(grouped);
  }, [filteredData]);

  if (!hasMounted) return null;

  return (
    <div className="p-6 font-sans text-slate-800 flex gap-6 bg-[#fcfdfd] min-h-screen">
      
      {/* 1. BRANCH SELECTOR */}
      <div className="w-56 flex-shrink-0">
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-5 sticky top-6 max-h-[90vh] overflow-y-auto no-scrollbar">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 px-2 text-center">Branch Selector</h3>
          <div className="flex flex-col gap-2">
            {BRANCHES.map((branch) => (
              <button
                key={branch}
                onClick={() => setSelectedBranch(branch)}
                className={`w-full text-left px-5 py-3 rounded-xl text-xs transition-all duration-300 ${
                  selectedBranch === branch
                    ? 'bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-100'
                    : 'text-slate-500 hover:bg-slate-50 font-semibold'
                }`}
              >
                {branch}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. MAIN CONTENT */}
      <div className="flex-1 flex flex-col gap-6">
        
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Distribution Progress</h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest">REAL-TIME TRACKING / SYNCED LOGIC</p>
          </div>

          <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm scale-95 origin-right">
             <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-emerald-50 border-none rounded-lg px-4 py-2 text-xs font-black text-emerald-700 outline-none cursor-pointer"
              >
                <option value="NEW">New Students</option>
                <option value="RENEWAL">Renewals</option>
                <option value="TRIAL">Trials</option>
                <option value="All">All Types</option>
              </select>

              <div className="h-5 w-px bg-slate-200 mx-1"></div>

             {/* UPDATED: Dropdown Options */}
             <select
                value={quickDate}
                onChange={(e) => handleDropdownChange(e.target.value)}
                className="bg-slate-100 border-none rounded-lg px-4 py-2 text-xs font-black text-slate-700 outline-none cursor-pointer"
              >
                <option value="thisWeek">This Week</option>
                <option value="lastWeek">Last Week</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="all">All Time</option>
              </select>
              <div className="flex items-center gap-3 px-4 border-l border-slate-100">
                <input type="date" value={startDate} onChange={e => {setStartDate(e.target.value); setQuickDate('custom');}} className="text-[10px] font-bold text-slate-500 bg-transparent outline-none" />
                <span className="text-slate-300 text-[10px] font-black">TO</span>
                <input type="date" value={endDate} onChange={e => {setEndDate(e.target.value); setQuickDate('custom');}} className="text-[10px] font-bold text-slate-500 bg-transparent outline-none" />
              </div>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Master Target (Units)</p>
            <p className="text-4xl font-black text-slate-900 tracking-tighter">{totalItems}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border-b-4 border-emerald-500 shadow-sm">
            <p className="text-[9px] font-black text-emerald-500 uppercase mb-2 tracking-widest">Total Prepared</p>
            <p className="text-4xl font-black text-slate-900 tracking-tighter">{totalPrepared}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border-b-4 border-rose-500 shadow-sm">
            <p className="text-[9px] font-black text-rose-500 uppercase mb-2 tracking-widest">Total Pending</p>
            <p className="text-4xl font-black text-slate-900 tracking-tighter">{totalUnprepared}</p>
          </div>
        </div>

        {/* CHARTS */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[350px]">
            <h3 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-tight">Stock Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', fontWeight: 'bold'}} />
                  <Bar dataKey="prepared" stackId="a" fill={COLORS.prepared} barSize={40} />
                  <Bar dataKey="unprepared" stackId="a" fill={COLORS.unprepared} radius={[8, 8, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center relative">
            <h3 className="text-sm font-black text-slate-800 mb-2 w-full text-left absolute top-8 left-8 uppercase">Success Rate</h3>
            <div className="h-56 w-full relative flex items-center justify-center mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{v: totalPrepared}, {v: totalUnprepared}]} innerRadius={65} outerRadius={85} paddingAngle={8} dataKey="v" stroke="none">
                    <Cell fill={COLORS.prepared} /><Cell fill={COLORS.unprepared} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <p className="text-4xl font-black text-slate-900 tracking-tighter">{completionRate}%</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ready</p>
              </div>
            </div>
          </div>
        </div>

        {/* DYNAMIC SUMMARY TABLE */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden mb-8">
          <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">
                {selectedBranch === 'All Branches' ? 'Global Status Summary' : `${selectedBranch} Progress`}
              </h3>
            </div>
            
            <div className="flex items-center gap-4">
              <button onClick={handleInstantSync} disabled={isSyncing} className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all group">
                <span className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`}>🔄</span>
                <span className="text-[10px] font-black text-slate-600 uppercase">Sync DB</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-black text-emerald-600 uppercase">Live</span>
              </div>
            </div>
          </div>

          <table className="w-full text-left">
            <thead className="bg-white border-b">
              <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <th className="py-4 px-8">Item Category</th>
                <th className="py-4 px-8 text-right">Preparation Status (Done/Total)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {chartData.map((item) => {
                const percent = item.prepared + item.unprepared > 0 ? (item.prepared / (item.prepared + item.unprepared)) * 100 : 0;
                const isComplete = item.unprepared === 0 && (item.prepared > 0);

                return (
                  <tr key={item.name} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-6 px-8 font-black text-slate-800 uppercase text-sm">{item.name}</td>
                    <td className="py-6 px-8 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-slate-900">{item.prepared}</span>
                          <span className="text-slate-300 font-bold">/</span>
                          <span className="text-slate-400 font-bold text-lg">{item.prepared + item.unprepared}</span>
                        </div>
                        <div className="w-40 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                          <div className={`h-full ${isComplete ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}