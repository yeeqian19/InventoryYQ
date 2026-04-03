'use client';

import React, { useId, useState } from 'react';

interface PhotoCapturePanelProps {
  /** Displayed as the large heading (e.g. student name or item barcode) */
  title: string;
  /** Displayed as a small sub-line (e.g. "Barcode: ST-SK-000123") */
  subtitle: string;
  capturedPhoto: string | null;
  isProcessing: boolean;
  /** Called with base64 data-URL string when user selects/captures a photo */
  onPhotoCapture: (base64: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
  accentColor?: 'emerald' | 'blue' | 'amber'; // 👈 Added 'amber' to match new BM Pickup theme
}

export default function PhotoCapturePanel({
  title,
  subtitle,
  capturedPhoto,
  isProcessing,
  onPhotoCapture,
  onSubmit,
  onCancel,
  submitLabel = 'Submit',
  accentColor = 'emerald',
}: PhotoCapturePanelProps) {
  const uid = useId();
  const cameraId = `camera-${uid}`;
  const uploadId = `upload-${uid}`;
  
  const [isCompressing, setIsCompressing] = useState(false);

  // ⚡ THE MAGIC: Lightning Fast Image Compression Logic
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; 
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedDataUrl);
        };
        img.onerror = (error) => reject(error); // Prevents infinite loading if image fails
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    
    try {
      // Compress the file before sending it to the parent state
      const compressedBase64 = await compressImage(file);
      onPhotoCapture(compressedBase64);
    } catch (error) {
      console.error("Compression failed, using original", error);
      // Fallback just in case compression fails
      const reader = new FileReader();
      reader.onload = () => onPhotoCapture(reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  // 👈 NEW: Color mapping to support Amber, Blue, and Emerald perfectly
  let accent = { border: 'border-emerald-500', bar: 'bg-emerald-500', btn: 'bg-emerald-500 shadow-emerald-500/30' };
  if (accentColor === 'blue') {
    accent = { border: 'border-blue-500', bar: 'bg-blue-500', btn: 'bg-blue-600 shadow-blue-600/30' };
  } else if (accentColor === 'amber') {
    accent = { border: 'border-amber-400', bar: 'bg-amber-500', btn: 'bg-amber-500 shadow-amber-500/30' };
  }

  return (
    <div className="flex flex-col items-center w-full p-8 mt-6">
      <h3 className="text-2xl font-black text-slate-900 tracking-tight text-center">{title}</h3>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">{subtitle}</p>

      {capturedPhoto ? (
        <div className={`relative w-48 h-48 rounded-2xl overflow-hidden shadow-lg border-4 ${accent.border} mb-6`}>
          <img src={capturedPhoto} alt="Proof" className="w-full h-full object-cover" />
          <div className={`absolute bottom-0 w-full ${accent.bar} text-white text-[9px] font-black uppercase tracking-widest text-center py-1`}>
            Photo Attached
          </div>
        </div>
      ) : (
        <div className="w-48 h-48 rounded-2xl border-4 border-dashed border-slate-200 flex flex-col items-center justify-center bg-slate-50 mb-6 text-slate-400 relative">
          {isCompressing ? (
             <span className="text-[10px] font-black uppercase tracking-widest animate-pulse text-blue-500">Compressing...</span>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[9px] font-black uppercase tracking-widest">No Photo Yet</span>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col w-full max-w-xs gap-3">
        <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" id={cameraId} disabled={isProcessing || isCompressing} />
        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id={uploadId} disabled={isProcessing || isCompressing} />

        <div className="flex gap-2 w-full">
          <label htmlFor={cameraId} className={`flex-1 text-center py-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 transition-colors ${isProcessing || isCompressing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}`}>
            📸 Take Photo
          </label>
          <label htmlFor={uploadId} className={`flex-1 text-center py-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 transition-colors ${isProcessing || isCompressing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}`}>
            📁 Upload
          </label>
        </div>

        <button
          onClick={onSubmit}
          disabled={!capturedPhoto || isProcessing || isCompressing}
          className={`w-full py-3 ${accent.btn} rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-lg disabled:opacity-50 disabled:shadow-none transition-all mt-2`}
        >
          {isProcessing ? 'Saving...' : submitLabel}
        </button>

        <button onClick={onCancel} disabled={isProcessing} className="text-[10px] font-bold text-slate-400 uppercase mt-1 hover:text-slate-600 disabled:opacity-50">
          Cancel
        </button>
      </div>
    </div>
  );
}