'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Scanner } from '@yudiel/react-qr-scanner';
import PhotoCapturePanel from '@/components/PhotoCapturePanel';

export default function BmPickupClient() {
  const router = useRouter();
  
  // Scanner starts closed — user must press the button to grant camera permission
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanMessage, setScanMessage] = useState({ text: '', type: '' });
  
  // Photo capture state
  const [pendingBarcode, setPendingBarcode] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // --- FAST SYNC WITH OPTIMISTIC UI ---
  const handleFastSync = async (endpoint: string, payload: Record<string, unknown>) => {
    // OPTIMISTIC UI UPDATE - Apply FIRST before network request
    setPendingBarcode('');
    setCapturedPhoto(null);
    setIsCameraOpen(true); // Re-open scanner for next item immediately
    setScanMessage({ text: '🚀 Processing in background...', type: 'success' });
    
    // Clear message after 1500ms
    setTimeout(() => {
      setScanMessage({ text: '', type: '' });
    }, 1500);

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

  // --- SCAN HANDLER ---
  const processScan = async (barcodeText: string) => {
    if (!barcodeText.trim() || isProcessing || pendingBarcode) return;

    // Set pending barcode FIRST (triggers early return to show PhotoCapturePanel)
    setPendingBarcode(barcodeText);
    // Only close camera when valid barcode is scanned (to reveal photo panel)
    setIsCameraOpen(false);
  };

  // --- SUBMIT TO DATABASE (High-Speed Mode) ---
  const submitToDatabase = async () => {
    if (!pendingBarcode || !capturedPhoto) return;
    setIsProcessing(true);
    
    // Use handleFastSync for instant optimistic UI update
    await handleFastSync('/api/bm-pickup', {
      base64Data: capturedPhoto,
      barcode: pendingBarcode,
      branchCode: 'HQ', // BM Pickup is from HQ
    });
    
    setIsProcessing(false);
  };

  // --- CANCEL HANDLER ---
  const handleCancel = () => {
    setPendingBarcode('');
    setCapturedPhoto(null);
    setIsCameraOpen(true);
  };

  // If we have a pending barcode, show the photo capture panel
  if (pendingBarcode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f3f7f9] p-4">
        <PhotoCapturePanel
          title={pendingBarcode}
          subtitle={`Barcode: ${pendingBarcode}`}
          capturedPhoto={capturedPhoto}
          isProcessing={isProcessing}
          onPhotoCapture={setCapturedPhoto}
          onSubmit={submitToDatabase}
          onCancel={handleCancel}
          submitLabel="Confirm BM Pickup"
          accentColor="blue"
        />
        {scanMessage.text && (
          <div className={`mt-4 px-6 py-3 rounded-xl text-sm font-bold ${
            scanMessage.type === 'success' ? 'bg-emerald-100 text-emerald-700' :
            scanMessage.type === 'error' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {scanMessage.text}
          </div>
        )}
      </div>
    );
  }

  // Default: Show scanner
  return (
    <div className="flex flex-col h-screen bg-[#f3f7f9] font-sans text-slate-800">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/inventory-branch')} className="text-white/70 hover:text-white text-xl">
            ←
          </button>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">BM Pick Up</h1>
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Scan from HQ Warehouse</p>
          </div>
        </div>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {isCameraOpen ? (
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <Scanner
                onScan={(results) => {
                  if (results?.[0]?.rawValue) {
                    processScan(results[0].rawValue);
                  }
                }}
                allowMultiple={true}
                scanDelay={2000}
                constraints={{ facingMode: 'environment' }}
              />
            </div>
            <p className="text-center text-xs text-slate-500 mt-4 font-medium">
              Point camera at barcode to scan
            </p>
          </div>
        ) : (
          <button
            onClick={() => setIsCameraOpen(true)}
            className="w-64 h-64 rounded-3xl bg-blue-600 text-white flex flex-col items-center justify-center shadow-2xl shadow-blue-900/30 hover:bg-blue-700 transition-all"
          >
            <span className="text-5xl mb-2">📷</span>
            <span className="text-xs font-black uppercase tracking-widest">Open Scanner</span>
          </button>
        )}
      </div>

      {/* Message Toast */}
      {scanMessage.text && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 rounded-2xl text-sm font-bold shadow-2xl ${
          scanMessage.type === 'success' ? 'bg-emerald-500 text-white' :
          scanMessage.type === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          {scanMessage.text}
        </div>
      )}
    </div>
  );
}