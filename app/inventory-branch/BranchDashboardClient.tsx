'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Scanner } from '@yudiel/react-qr-scanner';
import PhotoCapturePanel from '@/components/PhotoCapturePanel';

// --- NEW MASTER BRANCH CONFIGURATION ---
type Region = 'A' | 'B' | 'C' | 'HQ';
type Branch = { code: string; name: string; region: Region };

const BRANCH_MASTER_LIST: Branch[] = [
  // Region A
  { code: 'RBY', name: 'Rimbayu', region: 'A' },
  { code: 'KLG', name: 'Klang', region: 'A' },
  { code: 'SHA', name: 'Shah Alam', region: 'A' },
  { code: 'SA',  name: 'Setia Alam', region: 'A' },
  { code: 'DA',  name: 'Denai Alam', region: 'A' },
  { code: 'EGR', name: 'Eco Grandeur', region: 'A' },
  { code: 'ST',  name: 'Subang Taipan', region: 'A' },
  { code: 'AC',  name: 'Anggun City Rawang', region: 'A' },
  { code: 'SBY', name: 'Sungai Buloh', region: 'A' },
  // Region B
  { code: 'SLY',  name: 'Selayang', region: 'B' },
  { code: 'DK',   name: 'Danau Kota', region: 'B' },
  { code: 'KD',   name: 'Kota Damansara', region: 'B' },
  { code: 'AMP',  name: 'Ampang', region: 'B' },
  { code: 'SP',   name: 'Sri Petaling', region: 'B' },
  { code: 'BTHO', name: 'Bandar Tun Hussein Onn', region: 'B' },
  { code: 'KTG',  name: 'Kajang TTDI Groove', region: 'B' },
  { code: 'DSH',  name: 'Desa Sri Hartamas', region: 'B' },
  { code: 'TSG',  name: 'Taman Sri Gombak', region: 'B' },
  // Region C
  { code: 'PJY', name: 'Putrajaya', region: 'C' },
  { code: 'KW',  name: 'Kota Warisan', region: 'C' },
  { code: 'BBB', name: 'Bandar Baru Bangi', region: 'C' },
  { code: 'CJY', name: 'Cyberjaya', region: 'C' },
  { code: 'BSP', name: 'Bandar Seri Putra', region: 'C' },
  { code: 'SNT', name: 'Senawang Taipan', region: 'C' },
  { code: 'SBN', name: 'Seremban', region: 'C' },
  { code: 'DP',  name: 'Dataran Puchong Utama', region: 'C' },
  { code: 'ONL', name: 'Online / Others', region: 'C' },
  { code: 'HQ',  name: 'Headquarters', region: 'HQ' }
];

type InventoryItem = {
  student_id: string;
  name: string;
  branch: string;
  skBarcode: string | null;
  egBarcode: string | null;
  skPrep: boolean;
  egPrep: boolean;
  bmPickup: boolean;
  studentReceived: boolean;
  studentType: string;
  package: string;
  date?: string;
};

type Props = {
  initialData: InventoryItem[];
  userRole: string;
  userBranchCode: string;
};

export default function BranchDashboardClient({ initialData, userRole, userBranchCode }: Props) {
  const router = useRouter();
  const isBranchManager = userRole === 'USER_BM';
  const isViewOnly = userRole === 'ADMIN_HQ' || userRole === 'USER_RM';

  // Sort branches alphabetically for the dropdown
  const SORTED_BRANCHES = useMemo(() => {
    return [...BRANCH_MASTER_LIST].sort((a, b) => a.code.localeCompare(b.code));
  }, []);

  // Branch managers are locked to their own branch; admins can switch freely
  const defaultBranch = isBranchManager && userBranchCode
    ? userBranchCode
    : SORTED_BRANCHES[0].code;

  const [activeBranch, setActiveBranch] = useState(defaultBranch);
  const [activeMode, setActiveMode] = useState<'PICKUP' | 'HANDOVER' | 'HISTORY'>('PICKUP');

  // Scanner starts closed — user must press the button to grant camera permission
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanMessage, setScanMessage] = useState({ text: '', type: '' });

  // Proof of Handover/Pickup State
  const [pendingHandoverBarcode, setPendingHandoverBarcode] = useState('');
  const [pendingPickupBarcode, setPendingPickupBarcode] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Success screen after each completed scan
  const [successInfo, setSuccessInfo] = useState<{ name: string; mode: 'PICKUP' | 'HANDOVER' } | null>(null);

  // Form Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [quickDate, setQuickDate] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Applied Filter State (triggers on button click)
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  // Date Helpers
  const formatDateForInput = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleDropdownChange = (val: string) => {
    setQuickDate(val);
    const today = new Date();

    if (val === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (val === 'thisWeek') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(today);
      start.setDate(diff);
      setStartDate(formatDateForInput(start));
      setEndDate(formatDateForInput(new Date()));
    } else if (val === 'lastWeek') {
      const end = new Date();
      end.setDate(end.getDate() - end.getDay());
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      setStartDate(formatDateForInput(start));
      setEndDate(formatDateForInput(end));
    } else if (val === 'thisMonth') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDateForInput(start));
      setEndDate(formatDateForInput(new Date()));
    } else if (val === 'lastMonth') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(formatDateForInput(start));
      setEndDate(formatDateForInput(end));
    }
  };

  const handleApplyFilters = () => {
    setAppliedSearchTerm(searchTerm);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
  };

  // --- LIVE DATA LOGIC ---
  const branchData = useMemo(() => initialData?.filter(item => item.branch === activeBranch) || [], [initialData, activeBranch]);

  const expectedFromHQ = branchData.filter(item => ((item.skPrep && item.skBarcode) || (item.egPrep && item.egBarcode)) && !item.bmPickup && !item.studentReceived).length;
  const readyAtBranch = branchData.filter(item => item.bmPickup && !item.studentReceived).length;
  const completed = branchData.filter(item => item.studentReceived).length;

  const displayQueue = useMemo(() => {
    let queue: InventoryItem[] = [];

    if (activeMode === 'PICKUP') {
      queue = branchData.filter(item => ((item.skPrep && item.skBarcode) || (item.egPrep && item.egBarcode)) && !item.bmPickup && !item.studentReceived);
    } else if (activeMode === 'HANDOVER') {
      queue = branchData.filter(item => item.bmPickup && !item.studentReceived);
    } else if (activeMode === 'HISTORY') {
      queue = branchData.filter(item => item.studentReceived);
    }

    if (appliedSearchTerm.trim() !== '') {
      queue = queue.filter(item => item.name.toLowerCase().includes(appliedSearchTerm.toLowerCase()));
    }

    if (appliedStartDate && appliedEndDate) {
      queue = queue.filter(item => {
        if (!item.date) return true;
        return item.date >= appliedStartDate && item.date <= appliedEndDate;
      });
    }

    return queue.map(item => ({
      student_id: item.student_id,
      name: item.name,
      pkg: item.package,
      type: item.skBarcode ? 'SK' : 'EG',
    }));
  }, [branchData, activeMode, appliedSearchTerm, appliedStartDate, appliedEndDate]);

  const pendingStudentName = useMemo(() => {
    const currentPending = pendingHandoverBarcode || pendingPickupBarcode;
    if (!currentPending) return '';
    const student = branchData.find(s => s.skBarcode === currentPending || s.egBarcode === currentPending);
    return student ? student.name : 'Unknown Student';
  }, [pendingHandoverBarcode, pendingPickupBarcode, branchData]);

  // --- FAST SYNC WITH OPTIMISTIC UI ---
  const handleFastSync = async (endpoint: string, payload: Record<string, unknown>, studentName?: string) => {
    // OPTIMISTIC UI UPDATE - Apply FIRST before network request
    const completedMode = activeMode as 'PICKUP' | 'HANDOVER';
    const completedName = studentName || pendingStudentName;
    setPendingHandoverBarcode('');
    setPendingPickupBarcode('');
    setCapturedPhoto(null);
    setSuccessInfo({ name: completedName, mode: completedMode });
    setScanMessage({ text: '', type: '' });

    // Background network request
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        setScanMessage({ text: `❌ ${data.error}`, type: 'error' });
        setTimeout(() => setScanMessage({ text: '', type: '' }), 3000);
      }
    } catch {
      setScanMessage({ text: '❌ Network Error.', type: 'error' });
      setTimeout(() => setScanMessage({ text: '', type: '' }), 3000);
    }
  };

  const processScan = async (barcodeText: string) => {
    if (!barcodeText.trim() || isProcessing || activeMode === 'HISTORY') return;

    if (activeMode === 'HANDOVER') setPendingHandoverBarcode(barcodeText);
    if (activeMode === 'PICKUP') setPendingPickupBarcode(barcodeText);
    
    // Only close camera when valid barcode is scanned (to reveal photo panel)
    setIsCameraOpen(false);
  };

  // --- SUBMIT PICKUP (High-Speed Mode) ---
  const submitPickupToDatabase = async (barcode: string, photoBase64: string | null) => {
    if (!photoBase64) return;
    setIsProcessing(true);
    
    // Use handleFastSync for instant optimistic UI update
    await handleFastSync('/api/bm-pickup', {
      base64Data: photoBase64,
      barcode,
      branchCode: activeBranch,
    }, pendingStudentName);
    
    setIsProcessing(false);
  };

  // --- SUBMIT HANDOVER (High-Speed Mode) ---
  const submitHandoverToDatabase = async (barcode: string, photoBase64: string | null) => {
    if (!photoBase64) return;
    setIsProcessing(true);
    
    const student = branchData.find(s => s.skBarcode === barcode || s.egBarcode === barcode);
    
    // Use handleFastSync for instant optimistic UI update
    await handleFastSync('/api/handover', {
      base64Data: photoBase64,
      barcode,
      studentName: student?.name || barcode,
      branchCode: activeBranch,
    }, student?.name || barcode);
    
    setIsProcessing(false);
  };

  const modeColor = activeMode === 'PICKUP' ? 'amber' : activeMode === 'HANDOVER' ? 'blue' : 'emerald';

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#f3f7f9] font-sans text-slate-800 overflow-hidden pb-16 lg:pb-0">
      
      {/* DESKTOP SIDEBAR */}
      <div className="hidden lg:flex w-72 bg-[#7cb342] text-white flex-col shadow-2xl z-20 relative">
        <div className="p-8">
          <h1 className="text-2xl font-black tracking-tighter uppercase mb-1">My Inventory</h1>
          <p className="text-[10px] font-bold opacity-50 tracking-[0.2em] mt-2 border-t border-white/20 pt-2 uppercase">Branch Terminal</p>
        </div>

        <div className="px-4 mb-4">
          <button onClick={() => router.push('/')} className="w-full flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-white/10">
            <span>⬅️</span> Inventory Management
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          <p className="text-[10px] font-black opacity-40 uppercase tracking-widest px-4 pb-2">Scanner Modes</p>
          <button onClick={() => { setActiveMode('PICKUP'); setIsCameraOpen(false); setPendingHandoverBarcode(''); setPendingPickupBarcode(''); setCapturedPhoto(null); }}
            className={`w-full flex items-center gap-4 px-6 py-4 text-xs font-black uppercase tracking-wide transition-all rounded-l-full ml-2 ${activeMode === 'PICKUP' ? 'bg-white text-[#7cb342] shadow-md' : 'text-white/80 hover:bg-white/10'}`}>
            <span className="text-xl">🚚</span> 1. BM Pickup
          </button>
          <button onClick={() => { setActiveMode('HANDOVER'); setIsCameraOpen(false); setPendingHandoverBarcode(''); setPendingPickupBarcode(''); setCapturedPhoto(null); }}
            className={`w-full flex items-center gap-4 px-6 py-4 text-xs font-black uppercase tracking-wide transition-all rounded-l-full ml-2 ${activeMode === 'HANDOVER' ? 'bg-white text-[#7cb342] shadow-md' : 'text-white/80 hover:bg-white/10'}`}>
            <span className="text-xl">📸</span> 2. Handover
          </button>
          <button onClick={() => { setActiveMode('HISTORY'); setIsCameraOpen(false); setPendingHandoverBarcode(''); setPendingPickupBarcode(''); setCapturedPhoto(null); }}
            className={`w-full flex items-center gap-4 px-6 py-4 text-xs font-black uppercase tracking-wide transition-all rounded-l-full ml-2 ${activeMode === 'HISTORY' ? 'bg-white text-[#7cb342] shadow-md' : 'text-white/80 hover:bg-white/10'}`}>
            <span className="text-xl">✅</span> 3. History
          </button>
        </nav>

        <div className="p-6 border-t border-white/10 bg-black/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white text-[#7cb342] flex items-center justify-center font-black shadow-inner">
              {activeBranch.substring(0, 2)}
            </div>
            <div>
              <p className="text-sm font-black uppercase">{activeBranch} Branch</p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                <p className="text-[9px] opacity-50 font-bold uppercase tracking-widest">Terminal Online</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        <div className="px-6 lg:px-10 py-6 flex flex-col lg:flex-row justify-between lg:items-end gap-4 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10">
          <div>
            <h2 className="text-2xl lg:text-3xl font-black text-slate-900 uppercase tracking-tighter">
              {activeMode === 'PICKUP' ? 'Receiving Terminal' : activeMode === 'HANDOVER' ? 'Handover Terminal' : 'History Terminal'}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
               {activeMode === 'PICKUP' ? 'Scan items arriving from HQ Lorry' : activeMode === 'HANDOVER' ? 'Scan items given to students' : 'View history'}
            </p>
          </div>
          <div className="flex items-end gap-3 w-full lg:w-auto">
            <button
              onClick={() => router.refresh()}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors"
              title="Reload student data (use after renaming a student)"
            >
              ↻ Refresh
            </button>
          <div className="flex flex-col gap-1.5 flex-1 lg:flex-none">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest lg:text-right">Terminal Location</label>
            {isBranchManager ? (
              // Branch managers are locked to their own branch
              <div className="bg-slate-100 border border-slate-200 rounded-xl px-6 py-2.5 text-sm font-black text-slate-700 shadow-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                {activeBranch} Branch — Locked
              </div>
            ) : (
              <select value={activeBranch} onChange={(e) => setActiveBranch(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-6 py-2.5 text-sm font-black text-slate-700 outline-none shadow-sm cursor-pointer">
                {SORTED_BRANCHES.map(b => (
                  <option key={b.code} value={b.code}>{b.code} - {b.name}</option>
                ))}
              </select>
            )}
          </div>
          </div>
        </div>

        <div className="p-6 lg:p-10 flex flex-col lg:flex-row gap-8">
          <div className="flex-1 flex flex-col gap-6">
            <div className="grid grid-cols-3 gap-2 lg:gap-4">
              <div className={`bg-white p-4 lg:p-6 rounded-2xl border shadow-sm relative overflow-hidden ${activeMode === 'PICKUP' ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'}`}>
                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
                <p className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest">Expected</p>
                <p className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tighter">{expectedFromHQ}</p>
              </div>
              <div className={`bg-white p-4 lg:p-6 rounded-2xl border shadow-sm relative overflow-hidden ${activeMode === 'HANDOVER' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}>
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                <p className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest">Ready</p>
                <p className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tighter">{readyAtBranch}</p>
              </div>
              <div className={`bg-white p-4 lg:p-6 rounded-2xl border shadow-sm relative overflow-hidden ${activeMode === 'HISTORY' ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                <p className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest">Done</p>
                <p className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tighter">{completed}</p>
              </div>
            </div>

            <div className={`bg-white rounded-[2rem] border-2 shadow-sm relative overflow-hidden flex flex-col items-center justify-center min-h-[450px] border-${modeColor}-200`}>
              <div className={`absolute top-0 w-full py-2.5 text-center text-[10px] font-black uppercase tracking-[0.3em] text-white z-20 bg-${modeColor}-500`}>
                {activeMode === 'PICKUP' ? 'BM Receiving Mode' : activeMode === 'HANDOVER' ? 'Student Handover Mode' : 'History List Mode'}
              </div>

              {scanMessage.text && (
                <div className={`absolute top-14 px-6 py-3 rounded-xl shadow-xl z-30 text-xs font-black uppercase tracking-widest animate-in fade-in slide-in-from-top-4 ${scanMessage.type === 'error' ? 'bg-rose-500 text-white' : scanMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white'}`}>
                  {scanMessage.text}
                </div>
              )}

              {successInfo ? (
                <div className="flex flex-col items-center p-8 text-center mt-6 w-full">
                  <div className="w-28 h-28 rounded-full flex items-center justify-center mb-6 bg-emerald-50">
                    <span className="text-6xl">✅</span>
                  </div>
                  <h3 className="text-xl font-black text-emerald-600 uppercase tracking-widest mb-1">Done!</h3>
                  <p className="text-sm font-black text-slate-800 uppercase tracking-wider mb-1">{successInfo.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">
                    {successInfo.mode === 'HANDOVER' ? 'Handover recorded successfully' : 'BM Pickup recorded successfully'}
                  </p>
                  <button
                    onClick={() => { setSuccessInfo(null); setIsCameraOpen(true); }}
                    className="px-10 py-4 rounded-xl text-sm font-black uppercase text-white bg-emerald-500 shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform"
                  >
                    Scan Next Student
                  </button>
                </div>
              ) : isViewOnly ? (
                <div className="flex flex-col items-center p-8 text-center mt-6">
                  <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 bg-slate-100 text-slate-400">
                    <span className="text-4xl">🔒</span>
                  </div>
                  <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-2">View Only</h3>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">No actions available for your role</p>
                </div>
              ) : isCameraOpen ? (
                <div className="w-full h-full absolute inset-0 pt-8 bg-black flex flex-col items-center justify-center z-10">
                  <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl relative">
                    <Scanner onScan={(r) => { if (r?.[0]) processScan(r[0].rawValue); }} components={{ finder: false }} />
                  </div>
                  <button onClick={() => setIsCameraOpen(false)} className="mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-black uppercase tracking-widest border border-white/20 backdrop-blur-md">Close QR Scanner</button>
                </div>
              ) : pendingHandoverBarcode || pendingPickupBarcode ? (
                <PhotoCapturePanel
                  title={pendingStudentName}
                  subtitle={`Barcode: ${pendingHandoverBarcode || pendingPickupBarcode}`}
                  capturedPhoto={capturedPhoto}
                  isProcessing={isProcessing}
                  onPhotoCapture={setCapturedPhoto}
                  onSubmit={() => activeMode === 'HANDOVER' ? submitHandoverToDatabase(pendingHandoverBarcode, capturedPhoto) : submitPickupToDatabase(pendingPickupBarcode, capturedPhoto)}
                  onCancel={() => {setPendingHandoverBarcode(''); setPendingPickupBarcode(''); setCapturedPhoto(null);}}
                  submitLabel={activeMode === 'HANDOVER' ? "Complete Handover" : "Confirm Pick Up"}
                  accentColor={modeColor}
                  exampleImage={activeMode === 'HANDOVER' ? '/example-handover.jpg' : '/example-pickup.jpg'}
                  exampleCaption={activeMode === 'HANDOVER' ? 'Example: Student holding items, face clearly visible' : 'Example: Person & items visible — only ONE person in photo'}
                />
              ) : (
                <div className="flex flex-col items-center p-8 text-center mt-6">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 bg-${modeColor}-50 text-${modeColor}-500`}>
                    <span className="text-4xl">{activeMode === 'HISTORY' ? '📋' : '🔍'}</span>
                  </div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2">{activeMode === 'HISTORY' ? 'Viewing History' : 'Scanner Disabled'}</h3>
                  {activeMode !== 'HISTORY' && (
                    <button onClick={() => setIsCameraOpen(true)} className={`px-8 py-4 rounded-xl text-sm font-black uppercase text-white bg-${modeColor}-500 shadow-lg shadow-${modeColor}-500/30`}>Open QR Scanner</button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="w-full lg:w-[500px] flex flex-col bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden h-[500px] lg:h-[630px]">
            <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{activeMode === 'HISTORY' ? 'History Log' : 'Branch Queue'}</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{activeMode === 'HISTORY' ? 'Completed Handovers' : 'Pending Actions'}</p>
              </div>
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black bg-${modeColor}-100 text-${modeColor}-700`}>{displayQueue.length} Items</span>
            </div>

            <div className="p-4 border-b border-slate-100 bg-white flex flex-col gap-3">
              <input type="text" placeholder="Search student..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold outline-none focus:border-blue-500 transition-colors" />
              <div className="flex gap-2">
                <select value={quickDate} onChange={(e) => handleDropdownChange(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[10px] font-black text-slate-600 outline-none w-1/3 cursor-pointer">
                  <option value="all">All Time</option>
                  <option value="thisWeek">This Week</option>
                  <option value="lastWeek">Last Week</option>
                  <option value="thisMonth">This Month</option>
                  <option value="lastMonth">Last Month</option>
                </select>
                <div className="flex items-center gap-1 w-2/3 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                  <input type="date" value={startDate} onChange={(e) => {setStartDate(e.target.value); setQuickDate('custom');}} className="text-[9px] font-bold text-slate-500 bg-transparent outline-none w-full" />
                  <span className="text-[8px] text-slate-300">TO</span>
                  <input type="date" value={endDate} onChange={(e) => {setEndDate(e.target.value); setQuickDate('custom');}} className="text-[9px] font-bold text-slate-500 bg-transparent outline-none w-full" />
                </div>
              </div>
              <button onClick={handleApplyFilters} className={`w-full py-2.5 rounded-lg text-[10px] font-black uppercase text-white shadow-sm transition-transform active:scale-95 bg-${modeColor}-500 hover:bg-${modeColor}-600`}>Find Students</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <ul className="divide-y divide-slate-50">
                {displayQueue.map((item) => (
                  <li key={item.student_id} className="p-5 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">{item.name}</h4>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${item.type === 'SK' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>{item.type}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.pkg}</span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border bg-${modeColor}-50 text-${modeColor}-600 border-${modeColor}-100`}>
                      {activeMode === 'PICKUP' ? 'Expected' : activeMode === 'HANDOVER' ? 'Ready' : 'Done'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM NAV — only visible on mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-2xl flex">
        <button
          onClick={() => router.push('/')}
          className="flex-1 flex flex-col items-center justify-center py-3 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <span className="text-lg">🏠</span>
          <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Home</span>
        </button>
        <button
          onClick={() => { setActiveMode('PICKUP'); setIsCameraOpen(false); setPendingHandoverBarcode(''); setPendingPickupBarcode(''); setCapturedPhoto(null); }}
          className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${activeMode === 'PICKUP' ? 'text-amber-500' : 'text-slate-400'}`}
        >
          <span className="text-lg">🚚</span>
          <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Pickup</span>
        </button>
        <button
          onClick={() => { setActiveMode('HANDOVER'); setIsCameraOpen(false); setPendingHandoverBarcode(''); setPendingPickupBarcode(''); setCapturedPhoto(null); }}
          className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${activeMode === 'HANDOVER' ? 'text-blue-500' : 'text-slate-400'}`}
        >
          <span className="text-lg">📸</span>
          <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Handover</span>
        </button>
        <button
          onClick={() => { setActiveMode('HISTORY'); setIsCameraOpen(false); setPendingHandoverBarcode(''); setPendingPickupBarcode(''); setCapturedPhoto(null); }}
          className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${activeMode === 'HISTORY' ? 'text-emerald-500' : 'text-slate-400'}`}
        >
          <span className="text-lg">✅</span>
          <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">History</span>
        </button>
      </div>

    </div>
  );
}