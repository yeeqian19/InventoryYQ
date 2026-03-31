'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';

type Student = {
  student_id: string; 
  name: string;
  branch: string;
  skBarcode: string;
  egBarcode: string;
  date: string;
  studentType: string; 
  package: string | null; 
};

export default function StudentManagerClient({ initialData }: { initialData: Student[] }) {
  const [hasMounted, setHasMounted] = useState(false);

  // --- STATE ---
  const [activeSystem, setActiveSystem] = useState<'SK' | 'EG'>('SK');
  const [searchTerm, setSearchTerm] = useState(''); 
  const [branchFilter, setBranchFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('New'); 
  const [quickDate, setQuickDate] = useState('thisWeek');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Date Helpers
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
    const monday = new Date(new Date().setDate(diff));
    return { monday: formatDateForInput(monday), today: formatDateForInput(new Date()) };
  };

  const weekRange = getThisWeekRange();
  const [startDate, setStartDate] = useState(weekRange.monday);
  const [endDate, setEndDate] = useState(weekRange.today);
  
  const [activeFilter, setActiveFilter] = useState({ 
    branch: 'all', type: 'New', start: weekRange.monday, end: weekRange.today 
  });

  const getSafeBarcodeValue = (code: string | undefined) => {
    if (!code || code === 'N/A' || code.trim() === '') return "000000";
    let sanitized = code.replace(/['`']/g, "'").replace(/[""]/g, '');
    sanitized = sanitized.replace(/[^\x20-\x7E]/g, '');
    return sanitized.length > 25 ? sanitized.substring(0, 25).trim() : sanitized;
  };

  const BRANCHES = useMemo(() => {
    const expectedBranches = ['ST', 'SA', 'PJY', 'AMP', 'CJY', 'KLG', 'BBB', 'SHA', 'RBY', 'KTG', 'ONL', 'SP', 'KD', 'DA', 'DK', 'BTHO', 'EGR', 'BSP', 'KW', 'TSG']; 
    return ['All Branches', ...expectedBranches.sort()];
  }, []);

  useEffect(() => { setHasMounted(true); }, []);

  // --- HANDLERS ---
  const handleDropdownChange = (val: string) => {
    setQuickDate(val);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (val) {
      case 'thisWeek': setStartDate(weekRange.monday); setEndDate(weekRange.today); break;
      case 'lastWeek': {
        const end = new Date(today); end.setDate(today.getDate() - today.getDay());
        const start = new Date(end); start.setDate(end.getDate() - 6);
        setStartDate(formatDateForInput(start)); setEndDate(formatDateForInput(end));
        break;
      }
      case 'thisMonth': setStartDate(formatDateForInput(new Date(today.getFullYear(), today.getMonth(), 1))); setEndDate(formatDateForInput(new Date())); break;
      case 'lastMonth': {
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        setStartDate(formatDateForInput(firstDayLastMonth)); setEndDate(formatDateForInput(lastDayLastMonth));
        break;
      }
      case 'all': setStartDate(''); setEndDate(''); break;
    }
  };

  const processedInitialData = useMemo(() => {
    return initialData.flatMap((student) => {
      if (student.name.includes(' & ')) {
        const siblings = student.name.split(' & ').map((s) => s.trim());
        return siblings.map((siblingName, index) => ({
          ...student,
          student_id: `${student.student_id}-${index}`, 
          name: siblingName,
          skBarcode: student.skBarcode?.replace(student.name, siblingName) || '',
          egBarcode: student.egBarcode?.replace(student.name, siblingName) || '',
        }));
      }
      return student;
    });
  }, [initialData]);

  const filteredStudents = useMemo(() => {
    let data = processedInitialData; 
    data = data.filter(s => { const code = activeSystem === 'SK' ? s.skBarcode : s.egBarcode; return code && code !== 'N/A' && code.trim() !== ''; });
    if (searchTerm) data = data.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (activeFilter.branch !== 'all') data = data.filter(s => s.branch === activeFilter.branch);
    if (activeFilter.type !== 'All') data = data.filter(s => s.studentType === activeFilter.type);
    if (activeFilter.start && activeFilter.end) data = data.filter(s => s.date >= activeFilter.start && s.date <= activeFilter.end);
    return data;
  }, [activeFilter, processedInitialData, searchTerm, activeSystem]);

  const selectedStudentsForPrint = useMemo(() => filteredStudents.filter(s => selectedIds.includes(s.student_id)), [selectedIds, filteredStudents]);

  const toggleStudent = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  const toggleAll = () => setSelectedIds(selectedIds.length === filteredStudents.length && filteredStudents.length > 0 ? [] : filteredStudents.map(s => s.student_id));

  const handleClearSelection = () => setSelectedIds([]);

  const getPackageColor = (pkg: string | null) => {
    if (!pkg) return 'bg-slate-100 text-slate-500';
    if (pkg.includes('12M')) return 'bg-purple-100 text-purple-700';
    if (pkg.includes('9M')) return 'bg-blue-100 text-blue-700';
    if (pkg.includes('6M')) return 'bg-emerald-100 text-emerald-700';
    if (pkg.includes('3M')) return 'bg-orange-100 text-orange-700';
    return 'bg-slate-100 text-slate-600'; 
  };

  if (!hasMounted) return null;

  return (
    <div className="p-8 font-sans text-slate-800">
      
      {/* --- CSS FOR PERFECT A4 PRINT ALIGNMENT --- */}
      <style jsx global>{`
        @media print {
          @page { 
            size: A4 portrait; 
            margin: 10mm; /* Strict browser margin */
          }
          body { 
            background: white !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
          
          .print-label-container { 
            display: grid !important; 
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 1fr 1fr;
            
            /* THE FIX: Lock the exact width to ensure it doesn't push off the page */
            width: 190mm; /* A4 width (210) minus 10mm margins on both sides */
            height: 275mm; /* A4 height (297) minus margins */
            
            /* THE FIX: Force absolute center */
            margin: 0 auto; 
            
            /* THE FIX: Smaller gap ensures both columns fit safely inside the 190mm width */
            gap: 10mm; 
            padding: 0;
            box-sizing: border-box;
            
            justify-items: center; /* Center cards in their columns */
            align-items: center; /* Center cards in their rows */
          }
          
          .page-break { 
            display: block;
            break-after: page; 
            grid-column: 1 / -1; 
          }
        }
      `}</style>

      {/* --- DASHBOARD VIEW --- */}
      <div className="no-print">
        <h1 className="text-3xl font-black text-slate-900 mb-8 tracking-tighter uppercase italic">Inventory Student Manager</h1>

        {/* --- FILTERS --- */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8 mb-8">
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Live Search</label>
              <input type="text" placeholder="Search name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-50 border-2 border-slate-100 rounded-xl px-5 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-all" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Branch</label>
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="bg-emerald-50 border-none rounded-xl px-5 py-3 text-sm font-black text-emerald-700 outline-none min-w-[140px] cursor-pointer">
                {BRANCHES.map((branch) => <option key={branch} value={branch === 'All Branches' ? 'all' : branch}>{branch}</option> )}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Student Type</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-blue-50 border-none rounded-xl px-5 py-3 text-sm font-black text-blue-700 outline-none min-w-[140px] cursor-pointer">
                <option value="New">New Students</option>
                <option value="All">All Types</option>
                <option value="Renewal">Renewals</option>
                <option value="Trial">Trials</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quick Range</label>
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-sm">
                <select value={quickDate} onChange={(e) => handleDropdownChange(e.target.value)} className="bg-white border-none rounded-lg px-4 py-2 text-xs font-black text-slate-700 outline-none cursor-pointer">
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

            <div className="flex flex-col items-center gap-3 ml-auto w-full lg:w-auto mt-4 lg:mt-0">
              <div className="flex gap-3 w-full">
                {selectedIds.length > 0 && (
                  <button 
                    onClick={handleClearSelection}
                    className="px-6 py-3 bg-white border border-rose-200 text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center gap-2 shadow-sm"
                  >
                    Clear ({selectedIds.length})
                  </button>
                )}
                <button onClick={() => { setActiveFilter({ branch: branchFilter, type: typeFilter, start: startDate, end: endDate }); setSelectedIds([]); }} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-blue-700 transition-all uppercase tracking-tight flex-1 lg:flex-none">
                  Find Students
                </button>
                <button onClick={() => window.print()} disabled={selectedIds.length === 0} className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-emerald-600 transition-all disabled:opacity-50 uppercase tracking-tight flex-1 lg:flex-none">
                  Print Labels
                </button>
              </div>
              <p className="text-[9px] font-bold text-rose-500 no-print uppercase tracking-tighter">⚠️ Use "Actual Size" & "A4" in Printer Settings</p>
            </div>
          </div>
        </div>

        {/* --- DATA TABLE --- */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 w-16 text-center">
                  <input type="checkbox" checked={selectedIds.length === filteredStudents.length && filteredStudents.length > 0} onChange={toggleAll} className="w-4 h-4 cursor-pointer" />
                </th>
                <th className="px-6 py-4 w-1/4">Student Name</th>
                <th className="px-6 py-4 w-32 text-center">Package</th>
                <th className="px-6 py-4 w-24">Branch</th>
                <th className="px-6 py-4 w-[420px]">
                  <div className="flex items-center bg-slate-200/50 p-1.5 rounded-2xl w-fit border border-slate-200">
                    <button onClick={() => { setActiveSystem('SK'); setSelectedIds([]); }} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${activeSystem === 'SK' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>SK SYSTEM</button>
                    <button onClick={() => { setActiveSystem('EG'); setSelectedIds([]); }} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${activeSystem === 'EG' ? 'bg-white text-purple-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>EG SYSTEM</button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredStudents.map((student) => {
                const currentCode = activeSystem === 'SK' ? student.skBarcode : student.egBarcode;
                const isSelected = selectedIds.includes(student.student_id);

                return (
                  <tr key={student.student_id} className={`${isSelected ? 'bg-blue-50/20' : ''} hover:bg-slate-50/30 transition-colors`}>
                    <td className="px-6 py-6 text-center"><input type="checkbox" checked={isSelected} onChange={() => toggleStudent(student.student_id)} className="w-4 h-4 rounded" /></td>
                    <td className="px-6 py-6 font-bold text-slate-900 leading-tight">
                      {student.name}
                      <p className="text-[9px] font-normal text-slate-400 uppercase tracking-widest mt-1.5">{student.studentType}</p>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getPackageColor(student.package)}`}>{student.package || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-6 font-bold text-emerald-600">{student.branch}</td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-6 animate-in fade-in duration-300">
                          <div className="flex flex-col items-center min-w-[200px]">
                            <Barcode value={getSafeBarcodeValue(currentCode)} width={1.1} height={40} displayValue={false} />
                            <span className="text-[9px] font-mono mt-1.5 text-slate-500 font-bold uppercase tracking-tighter">{currentCode}</span>
                          </div>
                          <div className="p-2 bg-white border border-slate-200 rounded-xl shadow-sm">
                            <QRCodeSVG value={currentCode || ''} size={45} />
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

      {/* --- PRINT VIEW (OPTIMIZED FOR EXACT A4 CENTERING) --- */}
      <div className="hidden print-label-container">
        {selectedStudentsForPrint.map((student, index) => {
           const currentCode = activeSystem === 'SK' ? student.skBarcode : student.egBarcode;
           
           let fontSize = 'text-5xl';
           if (student.name.length > 25) fontSize = 'text-2xl';
           else if (student.name.length > 20) fontSize = 'text-3xl';
           else if (student.name.length > 15) fontSize = 'text-4xl';
           
           return (
            <React.Fragment key={student.student_id}>
              {/* THE FIX: Lock the max-width and max-height of the card so it never overflows */}
              <div className="flex flex-col items-center justify-center w-full h-full max-w-[90mm] max-h-[130mm]">
                
                <div className="border-[3px] border-[#0f172a] rounded-[3rem] w-full h-full flex flex-col items-center justify-between py-10 px-6 bg-white shadow-none" style={{ pageBreakInside: 'avoid' }}>
                  
                  {/* Top: Barcode Section */}
                  <div className="flex flex-col items-center justify-start w-full">
                    <div className="bg-white w-full flex justify-center items-center mb-2">
                      <Barcode value={getSafeBarcodeValue(currentCode)} width={2} height={60} displayValue={false} margin={0} />
                    </div>
                    <p className="text-[12px] font-black text-blue-600 uppercase tracking-widest">{activeSystem} BARCODE</p>
                    <p className="text-[10px] font-black text-slate-800 tracking-wider mt-1">{currentCode}</p>
                  </div>

                  {/* Middle: Name Section */}
                  <div className="flex flex-col items-center justify-center flex-1 w-full px-2 text-center">
                    <p className="text-[14px] font-black text-blue-600 uppercase tracking-[0.3em] mb-4">
                      {student.branch} BRANCH
                    </p>
                    <h2 className={`${fontSize} font-black text-slate-900 uppercase leading-none tracking-tight break-words line-clamp-3 w-full`}>
                      {student.name}
                    </h2>
                  </div>

                  {/* Bottom: QR Section */}
                  <div className="flex flex-col items-center justify-end">
                    <div className="p-3 bg-white border-[2px] border-slate-100 rounded-2xl mb-3">
                      <QRCodeSVG value={currentCode || ''} size={110} level="H" />
                    </div>
                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest text-center leading-tight">
                      SCAN TO<br/>HANDOVER
                    </p>
                  </div>

                </div>
              </div>
              
              {/* Page break logic: triggers after every 4th item */}
              {(index + 1) % 4 === 0 && <div className="page-break" />}
            </React.Fragment>
           );
        })}
      </div>
    </div>
  );
}