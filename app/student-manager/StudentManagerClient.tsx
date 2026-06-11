'use client';

import { useState, useMemo, useEffect } from 'react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import BranchMultiSelect from '@/components/BranchMultiSelect';


type Student = {
  student_id: string;
  name: string;
  doc_no: string;
  branch: string;
  skBarcode: string;
  egBarcode: string;
  date: string;
  studentType: string;
  package: string | null;
  sk_prep: boolean;
  sk_prep_date: string | null;
  eg_prep: boolean;
  eg_prep_date: string | null;
  bm_pickup: boolean;
  bm_pickup_date: string | null;
  student_received: boolean;
  student_received_date: string | null;
};

type UndoStage = 'sk_prep' | 'eg_prep' | 'bm_pickup' | 'student_received';

const STAGE_LABEL: Record<UndoStage, string> = {
  sk_prep: 'SK Prep',
  eg_prep: 'EG Prep',
  bm_pickup: 'Pickup',
  student_received: 'Received',
};

export default function StudentManagerClient({ initialData, canDelete = false, canUndo = false }: { initialData: Student[]; canDelete?: boolean; canUndo?: boolean }) {
  const [hasMounted, setHasMounted] = useState(false);

  // --- STATE ---
  const [activeSystem, setActiveSystem] = useState<'SK' | 'EG'>('SK');
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState<string[]>([]); // [] = All Branches
  const [typeFilter, setTypeFilter] = useState('New');
  const [quickDate, setQuickDate] = useState('thisWeek');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [renamingBarcode, setRenamingBarcode] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletedDbIds, setDeletedDbIds] = useState<Set<number>>(new Set());
  const [confirmUndo, setConfirmUndo] = useState<{ studentId: string; stage: UndoStage } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  
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
    const monday = new Date(today);
    monday.setDate(diff);
    return { monday: formatDateForInput(monday), today: formatDateForInput(new Date()) };
  };

  const weekRange = getThisWeekRange();
  const [startDate, setStartDate] = useState(weekRange.monday);
  const [endDate, setEndDate] = useState(weekRange.today);
  
  const [activeFilter, setActiveFilter] = useState<{ branches: string[]; type: string; start: string; end: string }>({
    branches: [], type: 'New', start: weekRange.monday, end: weekRange.today
  });

  const getSafeBarcodeValue = (code: string | undefined) => {
    if (!code || code === 'N/A' || code.trim() === '') return "000000";
    let sanitized = code.replace(/['`']/g, "'").replace(/[""]/g, '');
    sanitized = sanitized.replace(/[^\x20-\x7E]/g, '');
    return sanitized.length > 25 ? sanitized.substring(0, 25).trim() : sanitized;
  };


  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional SSR hydration guard
  useEffect(() => { setHasMounted(true); }, []);

  // --- UPDATED DATE HANDLERS ---
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

  const processedInitialData = useMemo(() => {
    return initialData.flatMap((student) => {
      const siblings = student.name
        .split(/&|,|\band\b/i)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (siblings.length > 1) {
        return siblings.map((siblingName, index) => ({
          ...student,
          student_id: `${student.student_id}-${index}`,
          name: siblingName,
          skBarcode: student.skBarcode,
          egBarcode: student.egBarcode,
        }));
      }
      return student;
    });
  }, [initialData]);

  // 🟢 THIS IS THE FIXED BLOCK 🟢
  const filteredStudents = useMemo(() => {
    let data = processedInitialData.filter(s => !deletedDbIds.has(parseInt(s.student_id.split('-')[0])));

    // 1. Filter out missing barcodes
    data = data.filter(s => {
      const code = activeSystem === 'SK' ? s.skBarcode : s.egBarcode; 
      return code && code !== 'N/A' && code.trim() !== ''; 
    });

    // 2. Live Search (Name)
    if (searchTerm) {
      data = data.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // 3. Branch Filter
    if (activeFilter.branches.length > 0) {
      data = data.filter(s => activeFilter.branches.includes(s.branch));
    }

    // 4. Type Filter (Safeguarded with toLowerCase to prevent exact-match bugs)
    if (activeFilter.type !== 'All') {
      data = data.filter(s => s.studentType?.toLowerCase() === activeFilter.type.toLowerCase());
    }
    
    // 5. Date Filter (FIXED TIMEZONE/TIMESTAMP BUG)
    if (activeFilter.start && activeFilter.end) {
      data = data.filter(s => {
        if (!s.date) return false;
        
        // Force the DB date to only look at YYYY-MM-DD so time stamps don't ruin the math
        const studentDateOnly = s.date.substring(0, 10);
        
        return studentDateOnly >= activeFilter.start && studentDateOnly <= activeFilter.end;
      });
    }
    
    return data;
  }, [activeFilter, processedInitialData, searchTerm, activeSystem, deletedDbIds]);
  // 🟢 END OF FIXED BLOCK 🟢

  const selectedStudentsForPrint = useMemo(() => filteredStudents.filter(s => selectedIds.includes(s.student_id)), [selectedIds, filteredStudents]);

  const toggleStudent = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  const toggleAll = () => setSelectedIds(selectedIds.length === filteredStudents.length && filteredStudents.length > 0 ? [] : filteredStudents.map(s => s.student_id));

  const handleClearSelection = () => setSelectedIds([]);

  const handleRename = async (studentId: string, skBarcode: string, newName: string) => {
    if (!newName.trim()) return;
    const res = await fetch('/api/students/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, newName: newName.trim() }),
    });
    if (res.ok) {
      setNameOverrides(prev => ({ ...prev, [skBarcode]: newName.trim() }));
      setRenamingBarcode(null);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to rename student');
    }
  };

  const handleDelete = async (studentId: string) => {
    const baseId = parseInt(studentId.split('-')[0]);
    const res = await fetch(`/api/students/${baseId}`, { method: 'DELETE' });
    if (res.ok) {
      setDeletedDbIds(prev => new Set([...prev, baseId]));
      setSelectedIds(prev => prev.filter(id => parseInt(id.split('-')[0]) !== baseId));
      setConfirmDeleteId(null);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete student');
    }
  };

  const handleUndo = async (studentId: string, stage: UndoStage) => {
    const baseId = parseInt(studentId.split('-')[0]);
    setUndoBusy(true);
    try {
      const res = await fetch('/api/scan/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: baseId, stage }),
      });
      if (res.ok) {
        setConfirmUndo(null);
        // Reload to refetch fresh stage state from the server.
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to undo scan.');
      }
    } catch {
      alert('Network error.');
    } finally {
      setUndoBusy(false);
    }
  };

  const fmtStageDate = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' });
  };

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
      
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-label-container { display: block !important; }
          .print-page { display: grid !important; grid-template-columns: 1fr 1fr; width: 190mm; height: 257mm; margin: 0 auto; gap: 3mm; padding: 0; box-sizing: border-box; break-after: page; page-break-after: always; overflow: hidden; }
          .print-label-item { height: 82mm; width: 90mm; break-inside: avoid; page-break-inside: avoid; box-sizing: border-box; overflow: hidden; }
        }
      `}</style>

      <div className="no-print">
        <h1 className="text-3xl font-black text-slate-900 mb-8 tracking-tighter uppercase italic">Inventory Student Manager</h1>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8 mb-8">
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Live Search</label>
              <input type="text" placeholder="Search name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-50 border-2 border-slate-100 rounded-xl px-5 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-all" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Branch</label>
              <BranchMultiSelect selected={branchFilter} onChange={setBranchFilter} />
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
                  <button onClick={handleClearSelection} className="px-6 py-3 bg-white border border-rose-200 text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center gap-2 shadow-sm">
                    Clear ({selectedIds.length})
                  </button>
                )}
                <button onClick={() => { setActiveFilter({ branches: branchFilter, type: typeFilter, start: startDate, end: endDate }); setSelectedIds([]); }} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-blue-700 transition-all uppercase tracking-tight flex-1 lg:flex-none">
                  Find Students
                </button>
                <button onClick={() => window.print()} disabled={selectedIds.length === 0} className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-emerald-600 transition-all disabled:opacity-50 uppercase tracking-tight flex-1 lg:flex-none">
                  Print Labels
                </button>
              </div>
              <p className="text-[9px] font-bold text-rose-500 no-print uppercase tracking-tighter">⚠️ Use &quot;Actual Size&quot; &amp; &quot;A4&quot; in Printer Settings</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 w-16 text-center">
                  <input type="checkbox" checked={selectedIds.length === filteredStudents.length && filteredStudents.length > 0} onChange={toggleAll} className="w-4 h-4 cursor-pointer" />
                </th>
                <th className="px-6 py-4 w-1/4">Student Name</th>
                <th className="px-6 py-4 w-32">Doc Date</th>
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
                      {renamingBarcode === student.skBarcode ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            type="text"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRename(student.student_id, student.skBarcode, renameValue); if (e.key === 'Escape') setRenamingBarcode(null); }}
                            className="border border-blue-400 rounded-lg px-2 py-1 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-300 w-40"
                          />
                          <button onClick={() => handleRename(student.student_id, student.skBarcode, renameValue)} className="px-2 py-1 bg-blue-500 text-white text-[9px] font-black rounded-lg uppercase">Save</button>
                          <button onClick={() => setRenamingBarcode(null)} className="px-2 py-1 bg-slate-100 text-slate-500 text-[9px] font-black rounded-lg uppercase">Cancel</button>
                        </div>
                      ) : confirmDeleteId === student.student_id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-rose-600">Delete this student?</span>
                          <button onClick={() => handleDelete(student.student_id)} className="px-2 py-1 bg-rose-500 text-white text-[9px] font-black rounded-lg uppercase">Yes, Delete</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 bg-slate-100 text-slate-500 text-[9px] font-black rounded-lg uppercase">Cancel</button>
                        </div>
                      ) : confirmUndo && confirmUndo.studentId === student.student_id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-600">Undo {STAGE_LABEL[confirmUndo.stage]}?</span>
                          <button
                            disabled={undoBusy}
                            onClick={() => handleUndo(student.student_id, confirmUndo.stage)}
                            className="px-2 py-1 bg-amber-500 text-white text-[9px] font-black rounded-lg uppercase disabled:opacity-50"
                          >
                            {undoBusy ? 'Working…' : 'Yes, Undo'}
                          </button>
                          <button onClick={() => setConfirmUndo(null)} className="px-2 py-1 bg-slate-100 text-slate-500 text-[9px] font-black rounded-lg uppercase">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 group">
                            <div className="flex flex-col">
                              <span>{nameOverrides[student.skBarcode] || student.name}</span>
                              {student.doc_no && <span className="text-[10px] text-slate-400 font-normal">{student.doc_no}</span>}
                            </div>
                            <button
                              onClick={() => { setRenamingBarcode(student.skBarcode); setRenameValue(nameOverrides[student.skBarcode] || student.name); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-500"
                              title="Rename student"
                            >
                              ✏️
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => setConfirmDeleteId(student.student_id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-500"
                                title="Delete student"
                              >
                                🗑️
                              </button>
                            )}
                          </div>

                          {(student.sk_prep || student.eg_prep || student.bm_pickup || student.student_received) && (
                            <div className="flex flex-wrap gap-1">
                              {student.sk_prep && (
                                <StagePill
                                  label={`SK Prep ${fmtStageDate(student.sk_prep_date)}`}
                                  tone="blue"
                                  onUndo={canUndo ? () => setConfirmUndo({ studentId: student.student_id, stage: 'sk_prep' }) : undefined}
                                />
                              )}
                              {student.eg_prep && (
                                <StagePill
                                  label={`EG Prep ${fmtStageDate(student.eg_prep_date)}`}
                                  tone="purple"
                                  onUndo={canUndo ? () => setConfirmUndo({ studentId: student.student_id, stage: 'eg_prep' }) : undefined}
                                />
                              )}
                              {student.bm_pickup && (
                                <StagePill
                                  label={`Pickup ${fmtStageDate(student.bm_pickup_date)}`}
                                  tone="amber"
                                  onUndo={canUndo ? () => setConfirmUndo({ studentId: student.student_id, stage: 'bm_pickup' }) : undefined}
                                />
                              )}
                              {student.student_received && (
                                <StagePill
                                  label={`Received ${fmtStageDate(student.student_received_date)}`}
                                  tone="emerald"
                                  onUndo={canUndo ? () => setConfirmUndo({ studentId: student.student_id, stage: 'student_received' }) : undefined}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-[9px] font-normal text-slate-400 uppercase tracking-widest mt-1.5">
                        {student.studentType === 'NEW' ? 'New' : student.studentType === 'RENEWAL' ? 'Renewal' : student.studentType === 'TRIAL' ? 'Trial' : student.studentType}
                      </p>
                    </td>
                    <td className="px-6 py-6 text-[11px] font-bold text-slate-600 tracking-tight">
                      {student.date || '—'}
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

      <div className="hidden print-label-container">
        {Array.from({ length: Math.ceil(selectedStudentsForPrint.length / 6) }).map((_, pageIndex) => {
          const pageStudents = selectedStudentsForPrint.slice(pageIndex * 6, pageIndex * 6 + 6);
          return (
            <div key={pageIndex} className="print-page">
              {pageStudents.map((student) => {
                const currentCode = activeSystem === 'SK' ? student.skBarcode : student.egBarcode;
                let fontSize = 'text-4xl';
                if (student.name.length > 25) fontSize = 'text-lg';
                else if (student.name.length > 20) fontSize = 'text-xl';
                else if (student.name.length > 15) fontSize = 'text-2xl';
                else if (student.name.length > 10) fontSize = 'text-3xl';

                return (
                  <div key={student.student_id} className="print-label-item flex flex-col items-center justify-center">
                    <div className="border-[3px] border-[#0f172a] rounded-[2.5rem] w-full h-full flex flex-col items-center justify-between py-6 px-4 bg-white">
                      <div className="flex flex-col items-center justify-start w-full">
                        <div className="bg-white w-full flex justify-center items-center mb-1">
                          <Barcode value={getSafeBarcodeValue(currentCode)} width={1.5} height={45} displayValue={false} margin={0} />
                        </div>
                        <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{activeSystem} BARCODE</p>
                        <p className="text-[9px] font-black text-slate-800 tracking-wider">{currentCode}</p>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1">{student.branch} BRANCH</p>
                      </div>
                      <div className="flex flex-col items-center justify-center flex-1 w-full px-1 text-center py-2">
                        <h2 className={`${fontSize} font-black text-slate-900 uppercase leading-tight tracking-tight break-words line-clamp-3 w-full`}>{student.name}</h2>
                      </div>
                      <div className="flex flex-col items-center justify-end">
                        <div className="p-2 bg-white border-[2px] border-slate-100 rounded-xl mb-1.5">
                          <QRCodeSVG value={currentCode || ''} size={70} level="H" />
                        </div>
                        <p className="text-[8px] font-black text-slate-800 uppercase tracking-widest text-center leading-tight">SCAN TO<br/>HANDOVER</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type StagePillTone = 'blue' | 'purple' | 'amber' | 'emerald';

const TONE_CLASSES: Record<StagePillTone, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function StagePill({ label, tone, onUndo }: { label: string; tone: StagePillTone; onUndo?: () => void }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-widest ${TONE_CLASSES[tone]}`}>
      <span>✓ {label}</span>
      {onUndo && (
        <button
          onClick={onUndo}
          title="Undo this stage (SUPERADMIN)"
          className="ml-0.5 px-1 rounded hover:bg-white/60 text-slate-500 hover:text-rose-600"
        >
          ↶
        </button>
      )}
    </span>
  );
}