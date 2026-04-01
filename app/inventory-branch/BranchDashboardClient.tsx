'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Scanner } from '@yudiel/react-qr-scanner';

type InventoryItem = {
  student_id: string; // The updated schema ID!
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
};

export default function BranchDashboardClient({ initialData }: { initialData: InventoryItem[] }) {
  const router = useRouter();
  
  // Master list of all 21 branches (HQ Added)
  const BRANCHES = useMemo(() => {
    const expectedBranches = [
      'ST', 'SA', 'PJY', 'AMP', 'CJY', 
      'KLG', 'BBB', 'SHA', 'RBY', 'KTG', 
      'ONL', 'SP', 'KD', 'DA', 'DK', 
      'BTHO', 'EGR', 'BSP', 'KW', 'TSG', 'HQ' // <-- Added HQ here
    ]; 
    const rawDbBranches = Array.from(new Set(initialData?.map(d => d.branch) || []));
    const allUnique = Array.from(new Set([...expectedBranches, ...rawDbBranches]));
    return allUnique.sort();
  }, [initialData]);

  const [activeBranch, setActiveBranch] = useState(BRANCHES[0]);
  const [activeMode, setActiveMode] = useState<'PICKUP' | 'HANDOVER'>('PICKUP');
  
  // Camera & Scan State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanMessage, setScanMessage] = useState({ text: '', type: '' });
  const [lastScanned, setLastScanned] = useState('');

  // Proof of Handover (Photo) State
  const [pendingHandoverBarcode, setPendingHandoverBarcode] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // --- LIVE DATA LOGIC ---
  const branchData = useMemo(() => initialData?.filter(item => item.branch === activeBranch) || [], [initialData, activeBranch]);

  const expectedFromHQ = branchData.filter(item => ((item.skPrep && item.skBarcode) || (item.egPrep && item.egBarcode)) && !item.bmPickup).length;
  const readyAtBranch = branchData.filter(item => item.bmPickup && !item.studentReceived).length;
  const completed = branchData.filter(item => item.studentReceived).length;

  const displayQueue = useMemo(() => {
    const queue = activeMode === 'PICKUP' 
      ? branchData.filter(item => ((item.skPrep && item.skBarcode) || (item.egPrep && item.egBarcode)) && !item.bmPickup)
      : branchData.filter(item => item.bmPickup && !item.studentReceived);
    
    return queue.map(item => ({
      student_id: item.student_id, // <--- FIXED THIS!
      name: item.name,
      pkg: item.package,
      type: item.skBarcode ? 'SK' : 'EG',
    }));
  }, [branchData, activeMode]);

  // Find student name for the pending handover screen
  const pendingStudentName = useMemo(() => {
    if (!pendingHandoverBarcode) return '';
    const student = branchData.find(s => s.skBarcode === pendingHandoverBarcode || s.egBarcode === pendingHandoverBarcode);
    return student ? student.name : 'Unknown Student';
  }, [pendingHandoverBarcode, branchData]);

  // --- CAMERA SCAN HANDLER ---
  const processScan = async (barcodeText: string) => {
    if (!barcodeText.trim() || isProcessing) return;
    setLastScanned(barcodeText);

    // IF HANDOVER MODE: Stop and ask for a photo instead of instantly submitting
    if (activeMode === 'HANDOVER') {
      setIsCameraOpen(false); // Close QR scanner
      setPendingHandoverBarcode(barcodeText); // Trigger Photo UI
      return;
    }

    // IF PICKUP MODE: Submit instantly to database
    submitToDatabase(barcodeText, null);
  };

  // --- PHOTO CAPTURE HANDLER ---
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Convert image to Base64 string so we can send it in a JSON API request
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- SUBMIT TO DATABASE ---
  const submitToDatabase = async (barcode: string, photoBase64: string | null) => {
    setIsProcessing(true);
    setScanMessage({ text: 'Verifying with Database...', type: 'info' });

    try {
      const response = await fetch('/api/branch-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          barcode, 
          mode: activeMode, 
          branch: activeBranch,
          photoData: photoBase64 // Send photo to API
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setScanMessage({ text: `✓ ${data.student_name} updated!`, type: 'success' });
        // Reset handover states
        setPendingHandoverBarcode('');
        setCapturedPhoto(null);
        router.refresh(); 
      } else {
        setScanMessage({ text: `❌ ${data.error}`, type: 'error' });
      }
    } catch (err) {
      setScanMessage({ text: '❌ Network Error.', type: 'error' });
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setScanMessage({ text: '', type: '' });
      }, 3000); 
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#f3f7f9] font-sans text-slate-800 overflow-hidden">
      
      {/* SIDEBAR */}
      <div className="hidden lg:flex w-72 bg-slate-900 text-white flex-col shadow-2xl z-20 relative">
        <div className="p-8">
          <h1 className="text-2xl font-black tracking-tighter uppercase mb-1">My Inventory</h1>
          <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Branch Operations</p>
        </div>

        <div className="px-6 pb-6">
          <button onClick={() => router.push('/')} className="w-full flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors">
            <span className="text-lg">←</span> Control Panel
          </button>
        </div>

        <div className="flex-1 px-6 space-y-2 mt-4">
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4 ml-2">Scanner Modes</p>
          <button onClick={() => {setActiveMode('PICKUP'); setIsCameraOpen(false); setPendingHandoverBarcode(''); setCapturedPhoto(null);}} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-wide transition-all ${activeMode === 'PICKUP' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-white/5'}`}>
            <span className="text-xl">🚚</span> 1. BM Pickup
          </button>
          <button onClick={() => {setActiveMode('HANDOVER'); setIsCameraOpen(false); setPendingHandoverBarcode(''); setCapturedPhoto(null);}} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-wide transition-all ${activeMode === 'HANDOVER' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/50' : 'text-slate-400 hover:bg-white/5'}`}>
            <span className="text-xl">📸</span> 2. Student Received
          </button>
        </div>

        <div className="p-6 border-t border-white/10 flex items-center gap-4 bg-slate-950/50">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-black shadow-inner">
            {activeBranch.substring(0,2)}
          </div>
          <div>
            <p className="text-xs font-black uppercase">{activeBranch} Branch</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Terminal Online</p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        
        {/* MOBILE HEADER */}
        <div className="lg:hidden bg-slate-900 text-white p-6 flex justify-between items-center shadow-md z-20">
          <h1 className="text-xl font-black tracking-tighter uppercase">My Inventory</h1>
          <button onClick={() => router.push('/')} className="text-xs font-bold bg-white/10 px-3 py-1.5 rounded-lg">Back</button>
        </div>

        {/* HEADER */}
        <div className="px-6 lg:px-10 py-6 flex flex-col lg:flex-row justify-between lg:items-end gap-4 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10">
          <div>
            <h2 className="text-2xl lg:text-3xl font-black text-slate-900 uppercase tracking-tighter">
              {activeMode === 'PICKUP' ? 'Receiving Terminal' : 'Handover Terminal'}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {activeMode === 'PICKUP' ? 'Scan items arriving from HQ Lorry' : 'Scan items given to students'}
            </p>
          </div>
          
          <div className="flex flex-col gap-1.5 w-full lg:w-auto">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest lg:text-right">Terminal Location</label>
            <select value={activeBranch} onChange={(e) => setActiveBranch(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-6 py-2.5 text-sm font-black text-slate-700 outline-none shadow-sm cursor-pointer w-full lg:min-w-[180px]">
              {BRANCHES.map(b => <option key={b} value={b}>{b} Branch</option>)}
            </select>
          </div>
          
          {/* MOBILE TOGGLE */}
          <div className="lg:hidden flex gap-2 mt-2">
            <button onClick={() => {setActiveMode('PICKUP'); setIsCameraOpen(false); setPendingHandoverBarcode('');}} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase ${activeMode === 'PICKUP' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1. Pickup</button>
            <button onClick={() => {setActiveMode('HANDOVER'); setIsCameraOpen(false); setPendingHandoverBarcode('');}} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase ${activeMode === 'HANDOVER' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>2. Handover</button>
          </div>
        </div>

        <div className="p-6 lg:p-10 flex flex-col lg:flex-row gap-8">
          
          {/* LEFT COLUMN: SCANNER & KPIS */}
          <div className="flex-1 flex flex-col gap-6">
            
            {/* KPI CARDS */}
            <div className="grid grid-cols-3 gap-2 lg:gap-4">
              <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
                <p className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase mb-1 lg:mb-2 tracking-widest line-clamp-1">Expected</p>
                <p className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tighter">{expectedFromHQ}</p>
              </div>
              <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                <p className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase mb-1 lg:mb-2 tracking-widest line-clamp-1">Ready</p>
                <p className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tighter">{readyAtBranch}</p>
              </div>
              <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                <p className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase mb-1 lg:mb-2 tracking-widest line-clamp-1">Done</p>
                <p className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tighter">{completed}</p>
              </div>
            </div>

            {/* SCANNER UI / PHOTO CAPTURE UI */}
            <div className={`bg-white rounded-[2rem] border-2 shadow-sm relative overflow-hidden flex flex-col items-center justify-center min-h-[450px] transition-colors duration-500 ${activeMode === 'PICKUP' ? 'border-blue-200' : 'border-emerald-200'}`}>
              
              <div className={`absolute top-0 w-full py-2.5 text-center text-[10px] font-black uppercase tracking-[0.3em] text-white z-20 ${activeMode === 'PICKUP' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                {activeMode === 'PICKUP' ? 'BM Receiving Mode' : 'Student Handover Mode'}
              </div>

              {/* SYSTEM MESSAGES */}
              {scanMessage.text && (
                <div className={`absolute top-14 px-6 py-3 rounded-xl shadow-xl z-30 text-xs font-black uppercase tracking-widest animate-in fade-in slide-in-from-top-4 ${
                  scanMessage.type === 'error' ? 'bg-rose-500 text-white' : scanMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white'
                }`}>
                  {scanMessage.text}
                </div>
              )}

              {/* --- 1. PHOTO CAPTURE SCREEN (HANDOVER MODE ONLY) --- */}
              {pendingHandoverBarcode ? (
                <div className="flex flex-col items-center w-full p-8 mt-6">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight text-center">{pendingStudentName}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Barcode: {pendingHandoverBarcode}</p>
                  
                  {capturedPhoto ? (
                    <div className="relative w-48 h-48 rounded-2xl overflow-hidden shadow-lg border-4 border-emerald-500 mb-6">
                      <img src={capturedPhoto} alt="Proof of Delivery" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 w-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest text-center py-1">Photo Attached</div>
                    </div>
                  ) : (
                    <div className="w-48 h-48 rounded-2xl border-4 border-dashed border-slate-200 flex flex-col items-center justify-center bg-slate-50 mb-6 text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span className="text-[9px] font-black uppercase tracking-widest">No Photo Yet</span>
                    </div>
                  )}

                  <div className="flex flex-col w-full max-w-xs gap-3">
                    {/* DUAL BUTTON LAYOUT (CAMERA OR UPLOAD) */}
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      onChange={handlePhotoCapture} 
                      className="hidden" 
                      id="cameraInput"
                    />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoCapture} 
                      className="hidden" 
                      id="uploadInput"
                    />

                    <div className="flex gap-2 w-full">
                      <label 
                        htmlFor="cameraInput"
                        className="flex-1 text-center py-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        📸 Take Photo
                      </label>
                      <label 
                        htmlFor="uploadInput"
                        className="flex-1 text-center py-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        📁 Upload
                      </label>
                    </div>

                    <button 
                      onClick={() => submitToDatabase(pendingHandoverBarcode, capturedPhoto)}
                      disabled={!capturedPhoto || isProcessing}
                      className="w-full py-3 bg-emerald-500 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:shadow-none transition-all mt-2"
                    >
                      {isProcessing ? 'Saving...' : 'Complete Handover'}
                    </button>
                    
                    <button 
                      onClick={() => {setPendingHandoverBarcode(''); setCapturedPhoto(null);}}
                      className="text-[10px] font-bold text-slate-400 uppercase mt-1 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

              ) : 
              
              /* --- 2. LIVE CAMERA QR SCANNER SCREEN --- */
              isCameraOpen ? (
                <div className="w-full h-full absolute inset-0 pt-8 bg-black flex flex-col items-center justify-center">
                  <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl relative">
                    <Scanner 
                      onScan={(result) => {
                        if (result && result.length > 0) {
                          processScan(result[0].rawValue);
                        }
                      }} 
                      components={{ finder: false }}
                    />
                    <div className="absolute inset-0 border-[4px] border-white/30 rounded-2xl pointer-events-none"></div>
                  </div>
                  <button 
                    onClick={() => setIsCameraOpen(false)}
                    className="mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-black uppercase tracking-widest transition-all z-20 backdrop-blur-md border border-white/20"
                  >
                    Close QR Scanner
                  </button>
                </div>
              ) : (

                /* --- 3. IDLE SCANNER UI --- */
                <div className="flex flex-col items-center p-8 text-center mt-6">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-inner ${activeMode === 'PICKUP' ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50 text-emerald-500'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                  </div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2">Scanner Disabled</h3>
                  <p className="text-xs text-slate-500 font-medium mb-8 max-w-[250px]">Tap below to open your phone's camera and scan the QR code.</p>
                  
                  <button 
                    onClick={() => setIsCameraOpen(true)}
                    className={`px-8 py-4 rounded-xl text-sm font-black uppercase tracking-widest text-white shadow-lg transition-transform active:scale-95 ${activeMode === 'PICKUP' ? 'bg-blue-600 shadow-blue-600/30' : 'bg-emerald-500 shadow-emerald-500/30'}`}
                  >
                    Open QR Scanner
                  </button>

                  {lastScanned && (
                    <p className="mt-8 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Last Scanned: <span className="text-slate-700">{lastScanned}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: QUEUE/LIST */}
          <div className="w-full lg:w-[420px] flex flex-col bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden h-[500px] lg:h-[630px]">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Branch Queue</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Pending Student Actions</p>
              </div>
              <span className="bg-slate-200 text-slate-600 px-4 py-1.5 rounded-full text-[10px] font-black">{displayQueue.length} Items</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {displayQueue.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-10 text-center opacity-50">
                  <span className="text-4xl mb-4">✨</span>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">Queue is empty!</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-2">All students served.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {displayQueue.map((item) => (
                    <li key={item.student_id} className="p-6 hover:bg-slate-50/80 transition-colors flex items-center justify-between group">
                      <div>
                        <h4 className="font-black text-slate-900 text-sm lg:text-lg leading-none tracking-tight">{item.name}</h4>
                        <div className="flex items-center gap-2 mt-2 lg:mt-3">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${item.type === 'SK' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>{item.type}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.pkg}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md ${
                          activeMode === 'PICKUP' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}>
                          {activeMode === 'PICKUP' ? 'Expected' : 'Ready'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}