'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type ScanRecord = {
  barcode: string;
  status: 'success' | 'error';
  message: string;
  time: string;
  details: string;
  studentName: string;
  station: string;
};

export default function ScanApproveClient() {
  const [barcode, setBarcode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const [activeStation, setActiveStation] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Keep focus on the input field for high-speed scanning
  useEffect(() => {
    inputRef.current?.focus();
    const handleGlobalClick = () => {
      if (window.getSelection()?.toString() === '') {
        inputRef.current?.focus();
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim() || isProcessing) return;

    setIsProcessing(true);
    const currentBarcode = barcode.trim();
    setBarcode('');

    try {
      // Connect to your Prisma API with station information
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: currentBarcode, station: activeStation }),
      });

      const data = await response.json();
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (response.ok) {
        // SUCCESS: Use real database name and branch details
        setScanHistory(prev => [{
          barcode: currentBarcode,
          status: 'success' as const,
          message: data.message || 'Approved',
          time: timestamp,
          details: `${data.itemType} • ${data.branch}`,
          studentName: data.student_name, // Real name from DB
          station: data.station || `${activeStation}. PACKING (HQ)`
        }, ...prev].slice(0, 50)); 
        
        // Force Dashboard to update its numbers
        router.refresh();

      } else {
        // ERROR: Handle different error types
        const isAlreadyScanned = data.error === 'ALREADY_SCANNED' || data.error === 'ALREADY SCANNED';
        const originalTimestamp = isAlreadyScanned && data.timestamp 
          ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : timestamp;

        setScanHistory(prev => [{
          barcode: currentBarcode,
          status: 'error' as const,
          message: isAlreadyScanned ? `Already scanned at ${originalTimestamp}` : data.error || 'Scan Failed',
          time: isAlreadyScanned ? originalTimestamp : timestamp,
          details: isAlreadyScanned ? 'DUPLICATE SCAN' : 'DATABASE REJECTED',
          studentName: data.student_name || 'Invalid Scan',
          station: data.station || `${activeStation}. PACKING (HQ)`
        }, ...prev].slice(0, 50));
      }
    } catch {
      setScanHistory(prev => [{
        barcode: currentBarcode,
        status: 'error' as const,
        message: 'Network connection lost.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        details: 'SYSTEM ERROR',
        studentName: 'Network Error',
        station: `${activeStation}. PACKING (HQ)`
      }, ...prev].slice(0, 50));
    } finally {
      setIsProcessing(false);
      // Brief timeout to ensure the DOM is ready for refocus
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div className="p-8 font-sans text-slate-800 max-w-6xl mx-auto">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Scanning Terminal</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Centralized Distribution Control</p>
        </div>
        
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-full shadow-inner">
          <button
            onClick={() => setActiveStation(1)}
            className={`px-6 py-2.5 rounded-full text-[10px] font-black tracking-widest uppercase transition-all ${
              activeStation === 1
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 opacity-50 hover:opacity-75'
            }`}
          >
            1. Packing (HQ)
          </button>
        </div>
      </div>

      {/* SCANNER INPUT BOX */}
      <div 
        className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-12 mb-8 relative overflow-hidden flex flex-col items-center justify-center min-h-[320px] cursor-text group"
        onClick={() => inputRef.current?.focus()}
      >
        <form onSubmit={handleScan} className="absolute inset-0 opacity-0 cursor-text z-10">
          <input
            ref={inputRef}
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className="w-full h-full cursor-text"
            autoFocus
            disabled={isProcessing}
            autoComplete="off"
          />
        </form>

        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 transition-colors group-hover:text-blue-400">
          {barcode ? 'Processing...' : 'Awaiting Barcode Input'}
        </h3>

        {barcode ? (
          <p className="text-4xl font-mono text-slate-800 tracking-widest mb-12 h-16 flex items-center">{barcode}</p>
        ) : (
          <div className="flex gap-2 mb-12 opacity-10 h-16 items-center">
            {[2,4,1,3,5,2,1,4,3,2,5,1,3,2,4,1].map((h, i) => (
              <div key={i} className="w-2 bg-slate-800 rounded-sm" style={{ height: `${h * 12}px` }}></div>
            ))}
          </div>
        )}

        <div className={`flex items-center gap-3 text-[10px] font-black tracking-widest px-5 py-2.5 rounded-full transition-colors ${isProcessing ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50/50 text-emerald-500'}`}>
          <span className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-blue-500 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></span>
          {isProcessing ? 'SEARCHING DATABASE...' : 'SCANNER READY: 1. PACKING (HQ)'}
        </div>
      </div>

      {/* LIVE FEED FEED */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Live Scan Feed</h3>
          <div className="bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
            {scanHistory.length} Sessions
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-slate-50/50">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                <th className="px-8 py-5">Student</th>
                <th className="px-8 py-5">Barcode ID</th>
                <th className="px-8 py-5">Station</th>
                <th className="px-8 py-5 text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {scanHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-16 text-center">
                    <p className="text-slate-400 font-bold text-sm">System armed. Scan a barcode to start.</p>
                  </td>
                </tr>
              ) : (
                scanHistory.map((scan, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-all animate-in fade-in slide-in-from-top-1 duration-300">
                    <td className="px-8 py-6">
                      <p className={`text-base font-black ${scan.status === 'error' ? 'text-rose-600' : 'text-slate-900'}`}>
                        {scan.studentName}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {scan.details}
                      </p>
                    </td>
                    <td className="px-8 py-6 font-mono text-slate-500 text-xs tracking-wider">
                      {scan.barcode}
                    </td>
                    <td className="px-8 py-6 uppercase text-[9px] font-black text-slate-300">
                      {scan.station}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                        scan.status === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                      }`}>
                        {scan.status === 'success' ? `SUCCESS • ${scan.time}` : scan.message}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}