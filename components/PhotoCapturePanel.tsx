'use client';

import React, { useId, useState } from 'react';

interface PhotoCapturePanelProps {
  title: string;
  subtitle: string;
  capturedPhoto: string | null;
  isProcessing: boolean;
  onPhotoCapture: (base64: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
  accentColor?: 'emerald' | 'blue' | 'amber';
  /** Path to an example photo shown between the buttons (e.g. "/example-handover.jpg") */
  exampleImage?: string;
  /** Caption shown under the example image */
  exampleCaption?: string;
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
  exampleImage,
  exampleCaption = 'Example photo',
}: PhotoCapturePanelProps) {
  const uid = useId();
  const cameraId = `camera-${uid}`;
  const uploadId  = `upload-${uid}`;

  const [isCompressing, setIsCompressing]   = useState(false);
  const [lightboxOpen,  setLightboxOpen]    = useState(false);

  // ── Image compression ──────────────────────────────────────────────────────
  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const MAX_WIDTH = 1280, MAX_HEIGHT = 720;
          let { width, height } = img;
          if (width > height) { if (width > MAX_WIDTH)  { height *= MAX_WIDTH / width;  width = MAX_WIDTH;  } }
          else                { if (height > MAX_HEIGHT){ width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.80));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    try {
      onPhotoCapture(await compressImage(file));
    } catch {
      const reader = new FileReader();
      reader.onload = () => onPhotoCapture(reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  // ── Accent colours ─────────────────────────────────────────────────────────
  let accent = { border: 'border-emerald-500', bar: 'bg-emerald-500', btn: 'bg-emerald-500 shadow-emerald-500/30' };
  if (accentColor === 'blue')  accent = { border: 'border-blue-500',  bar: 'bg-blue-500',  btn: 'bg-blue-600 shadow-blue-600/30'   };
  if (accentColor === 'amber') accent = { border: 'border-amber-400', bar: 'bg-amber-500', btn: 'bg-amber-500 shadow-amber-500/30' };

  return (
    <>
      {/* ── Lightbox overlay ─────────────────────────────────────────────── */}
      {lightboxOpen && exampleImage && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={exampleImage}
              alt={exampleCaption}
              className="w-full rounded-2xl shadow-2xl object-contain max-h-[80vh]"
            />
            <p className="text-center text-white/70 text-xs font-bold uppercase tracking-widest mt-3">
              {exampleCaption}
            </p>
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-800 font-black text-sm flex items-center justify-center shadow-lg hover:bg-slate-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Main panel ───────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center w-full p-8 mt-6">
        <h3 className="text-2xl font-black text-slate-900 tracking-tight text-center">{title}</h3>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">{subtitle}</p>

        {/* Captured / placeholder photo */}
        {capturedPhoto ? (
          <div className={`relative w-48 h-48 rounded-2xl overflow-hidden shadow-lg border-4 ${accent.border} mb-6`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
          <input type="file" accept="image/*"                        onChange={handleFileChange} className="hidden" id={uploadId}  disabled={isProcessing || isCompressing} />

          {/* Take Photo button */}
          <label
            htmlFor={cameraId}
            className={`text-center py-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 transition-colors ${isProcessing || isCompressing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}`}
          >
            📸 Take Photo
          </label>

          {/* ── Example photo (between Take Photo and Upload) ── */}
          {exampleImage && (
            <div className="w-full rounded-xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center pt-2 pb-1">
                Example Photo Guide
              </p>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="w-full focus:outline-none group"
                title="Click to view full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={exampleImage}
                  alt={exampleCaption}
                  className="w-full object-cover max-h-40 group-hover:opacity-90 transition-opacity"
                />
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center py-1.5 group-hover:text-blue-500 transition-colors">
                  🔍 Tap to view full size
                </p>
              </button>
            </div>
          )}

          {/* Upload button */}
          <label
            htmlFor={uploadId}
            className={`text-center py-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 transition-colors ${isProcessing || isCompressing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}`}
          >
            📁 Upload
          </label>

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
    </>
  );
}
