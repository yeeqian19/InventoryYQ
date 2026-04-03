'use client';

import './globals.css';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Providers } from '@/components/Providers'; // 🟢 Import the new Session Provider

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
    lowerPath === '/login' || 
    lowerPath.includes('rm_dashboard') || 
    lowerPath.includes('stock-management') || 
    lowerPath.includes('inventory-branch');

  // --- OPTION A: THE CLEAN RESET (For Login, RM Dashboard, etc.) ---
  if (isSpecialPage) {
    return (
      <html lang="en">
        <body className="bg-white min-h-screen">
          <Providers> {/* 🟢 Wrap with Providers */}
            {children}
          </Providers>
        </body>
      </html>
    );
  }

  // --- OPTION B: THE HQ VIEW (For Scan Approve, Scan Log, etc.) ---
  return (
    <html lang="en">
      <body className="bg-[#f8fafc]">
        <Providers> {/* 🟢 Wrap with Providers */}
          <div className="flex">
            {/* This is what shows 'Dashboard, Scan Approve, Scan Log' */}
            <Sidebar /> 
            
            {/* 🟢 FIXED: ml-0 on mobile, ml-64 on desktop. Added pt-24 for mobile top bar padding! */}
            <main className="flex-1 min-h-screen ml-0 lg:ml-64 p-4 pt-24 lg:p-8">
              <div className="max-w-[1600px] mx-auto">
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}