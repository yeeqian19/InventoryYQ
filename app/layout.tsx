'use client';

import './globals.css';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const lowerPath = pathname.toLowerCase();

  // 1. If the path contains these words, we want NO SIDEBAR and NO HQ LAYOUT
  const isSpecialPage = 
    lowerPath === '/' || 
    lowerPath.includes('rm_dashboard') || 
    lowerPath.includes('stock-management') || 
    lowerPath.includes('inventory-branch');

  // --- OPTION A: THE CLEAN RESET (For RM Dashboard) ---
  if (isSpecialPage) {
    return (
      <html lang="en">
        <body className="bg-white min-h-screen">
          {/* We return ONLY the children. No Sidebar, No Main, No Margins */}
          {children}
        </body>
      </html>
    );
  }

  // --- OPTION B: THE HQ VIEW (For Scan Approve, Scan Log, etc.) ---
  return (
    <html lang="en">
      <body className="bg-[#f8fafc]">
        <div className="flex">
          {/* This is what shows 'Dashboard, Scan Approve, Scan Log' */}
          <Sidebar /> 
          <main className="flex-1 ml-64 min-h-screen p-8">
            <div className="max-w-[1600px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}