'use client';

import { useState, useMemo } from 'react';

type ScanLog = {
  id: string;
  timestamp: string;
  doc_no: string | null;
  barcode: string;
  student_name: string;
  item_type: string;
  branch: string;
  action_type: string;
  processed_by: string;
};

export default function ScanLogClient({ initialLogs }: { initialLogs: ScanLog[] }) {
  // --- DATE HELPERS ---
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
    const monday = new Date(today);
    monday.setDate(diff);
    return { monday: formatDateForInput(monday), today: formatDateForInput(new Date()) };
  };

  const weekRange = getThisWeekRange();

  // --- STATE ---
  const [quickDate, setQuickDate] = useState('thisWeek');
  const [startDate, setStartDate] = useState(weekRange.monday);
  const [endDate, setEndDate] = useState(weekRange.today);
  const [branchFilter, setBranchFilter] = useState('All Branches');
  
  // This state holds the actively applied filters (updated when "Find Logs" is clicked)
  const [activeFilter, setActiveFilter] = useState({ 
    branch: 'All Branches', 
    start: weekRange.monday, 
    end: weekRange.today 
  });

  // --- HANDLERS ---
  const handleDropdownChange = (val: string) => {
    setQuickDate(val);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (val) {
      case 'thisWeek': 
        setStartDate(weekRange.monday); 
        setEndDate(weekRange.today); 
        break;
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
      case 'thisMonth': 
        setStartDate(formatDateForInput(new Date(today.getFullYear(), today.getMonth(), 1))); 
        setEndDate(formatDateForInput(new Date())); 
        break;
      case 'lastMonth': {
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        setStartDate(formatDateForInput(firstDayLastMonth)); 
        setEndDate(formatDateForInput(lastDayLastMonth));
        break;
      }
      case 'all': 
        setStartDate(''); 
        setEndDate(''); 
        break;
    }
  };

  // --- FILTERING LOGIC ---
  const filteredLogs = useMemo(() => {
    let data = initialLogs;

    // 1. Filter by Branch
    if (activeFilter.branch !== 'All Branches') {
      data = data.filter(log => log.branch === activeFilter.branch);
    }

    // 2. Filter by Date
    if (activeFilter.start && activeFilter.end) {
      data = data.filter(log => {
        if (!log.timestamp) return false;
        
        // Grab just the YYYY-MM-DD part of the date string
        const logDateOnly = log.timestamp.toString().substring(0, 10);
        return logDateOnly >= activeFilter.start && logDateOnly <= activeFilter.end;
      });
    }

    return data;
  }, [initialLogs, activeFilter]);

  // --- UI HELPERS ---
  const getActionColor = (action: string) => {
    switch (action.toUpperCase()) {
      case 'PREPARED':
        return 'bg-blue-100 text-blue-600';
      case 'PICKED UP':
        return 'bg-purple-100 text-purple-600';
      case 'RECEIVED':
        return 'bg-emerald-100 text-emerald-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="max-w-7xl mx-auto bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
      
      {/* --- UPGRADED HEADER & FILTERS --- */}
      <div className="px-8 lg:px-12 py-8 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 border-b border-slate-100 pb-8">
        
        {/* Titles */}
        <div>
          <h1 className="text-3xl font-black text-[#1e293b] tracking-tighter uppercase italic">Scan History Log</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Master Audit Trail</p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-4">
          
          {/* Branch Dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Branch Filter</label>
            <select 
              value={branchFilter} 
              onChange={(e) => setBranchFilter(e.target.value)} 
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none min-w-[160px] cursor-pointer focus:border-blue-500 transition-all"
            >
              <option value="All Branches">All Branches</option>
              <optgroup label="── Region A ──">
                <option value="RBY">RBY (Rimbayu)</option>
                <option value="KLG">KLG (Klang)</option>
                <option value="SHA">SHA (Shah Alam)</option>
                <option value="SA">SA (Setia Alam)</option>
                <option value="DA">DA (Denai Alam)</option>
                <option value="EGR">EGR (Eco Grandeur)</option>
                <option value="ST">ST (Subang Taipan)</option>
                <option value="AC">AC (Anggun City)</option>
                <option value="SBY">SBY (Sungai Buloh)</option>
              </optgroup>
              <optgroup label="── Region B ──">
                <option value="SLY">SLY (Selayang)</option>
                <option value="DK">DK (Danau Kota)</option>
                <option value="KD">KD (Kota Damansara)</option>
                <option value="AMP">AMP (Ampang)</option>
                <option value="SP">SP (Sri Petaling)</option>
                <option value="BTHO">BTHO (Bandar Tun Hussein Onn)</option>
                <option value="KTG">KTG (Kajang TTDI Groove)</option>
                <option value="DSH">DSH (Desa Sri Hartamas)</option>
                <option value="TSG">TSG (Taman Sri Gombak)</option>
              </optgroup>
              <optgroup label="── Region C ──">
                <option value="PJY">PJY (Putrajaya)</option>
                <option value="KW">KW (Kota Warisan)</option>
                <option value="BBB">BBB (Bandar Baru Bangi)</option>
                <option value="CJY">CJY (Cyberjaya)</option>
                <option value="BSP">BSP (Bandar Seri Putra)</option>
                <option value="SNT">SNT (Senawang Taipan)</option>
                <option value="SBN">SBN (Seremban)</option>
                <option value="DP">DP (Dataran Puchong Utama)</option>
              </optgroup>
              <option value="HQ">HQ - Headquarters</option>
            </select>
          </div>

          {/* Date Range Controls */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Date Range</label>
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <select 
                value={quickDate} 
                onChange={(e) => handleDropdownChange(e.target.value)} 
                className="bg-white border-none rounded-lg px-3 py-1.5 text-[11px] font-black text-slate-700 outline-none cursor-pointer shadow-sm"
              >
                <option value="all">All Time</option>
                <option value="thisWeek">This Week</option>
                <option value="lastWeek">Last Week</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
              </select>
              <div className="flex items-center gap-2 px-3 border-l border-slate-200">
                <input type="date" value={startDate} onChange={(e) => {setStartDate(e.target.value); setQuickDate('custom');}} className="text-[10px] font-bold text-slate-500 bg-transparent outline-none focus:text-blue-500" />
                <span className="text-slate-300 font-black text-[8px]">TO</span>
                <input type="date" value={endDate} onChange={(e) => {setEndDate(e.target.value); setQuickDate('custom');}} className="text-[10px] font-bold text-slate-500 bg-transparent outline-none focus:text-blue-500" />
              </div>
            </div>
          </div>

          {/* Apply Filters Button */}
          <div className="flex flex-col gap-1.5 justify-end h-full">
             <label className="text-[9px] text-transparent hidden md:block">&nbsp;</label> 
             <button 
              onClick={() => setActiveFilter({ branch: branchFilter, start: startDate, end: endDate })} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-md transition-transform active:scale-95 h-[38px]"
            >
              Find Logs
            </button>
          </div>

        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-8 lg:px-12 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Timestamp</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Doc No / Barcode</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Student / Item</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Branch</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Action Type</th>
              <th className="px-8 lg:px-12 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Processed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-20 text-center">
                  <span className="text-4xl block mb-4">📭</span>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No logs found</p>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const dateObj = new Date(log.timestamp);
                return (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    {/* TIMESTAMP */}
                    <td className="px-8 lg:px-12 py-4">
                      <p className="text-sm font-black text-slate-800">{dateObj.toLocaleDateString('en-CA')}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>

                    {/* DOC NO / BARCODE */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-800">{log.doc_no || 'N/A'}</p>
                      <p className="text-xs font-bold text-blue-500 tracking-wide mt-0.5">{log.barcode}</p>
                    </td>

                    {/* STUDENT / ITEM */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-800">{log.student_name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        Type: {log.item_type}
                      </p>
                    </td>

                    {/* BRANCH */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
                        {log.branch}
                      </span>
                    </td>

                    {/* ACTION TYPE */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getActionColor(log.action_type)}`}>
                        {log.action_type}
                      </span>
                    </td>

                    {/* PROCESSED BY */}
                    <td className="px-8 lg:px-12 py-4">
                      <p className="text-xs font-bold text-slate-600">{log.processed_by}</p>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}