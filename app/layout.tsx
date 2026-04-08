'use client';

import '@/app/globals.css';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Providers } from '@/components/Providers'; // 🟢 Import the new Session Provider

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const lowerPath = pathname?.toLowerCase() || '';

  // 1. If the path contains these words, we want NO SIDEBAR and NO HQ LAYOUT
  const isSpecialPage =
    lowerPath === '/' ||
    lowerPath === '/login' ||
    lowerPath.includes('rm_dashboard') ||
    lowerPath.includes('inventory-branch') ||
    lowerPath.includes('bm-pickup') ||
    lowerPath.includes('dashboard') ||
    lowerPath.includes('stock-management');

  // 🚨 FIXED ERROR: We now use ONE <html> tag to prevent Next.js hydration crashes
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </head>
      <body className={isSpecialPage ? "bg-white min-h-screen overflow-x-hidden" : "bg-[#f8fafc] min-h-screen overflow-x-hidden"}>
        <Providers> 
          
          {isSpecialPage ? (
            // --- OPTION A: THE CLEAN RESET (For Login, RM Dashboard, Branch, etc.) ---
            children
          ) : (
            // --- OPTION B: THE HQ VIEW (For Scan Approve, Scan Log, etc.) ---
            <div className="flex min-h-screen"> {/* 👈 FIXED: Removed overflow-x-hidden from here */}
              
              <Sidebar /> 
              
              {/* 👈 FIXED: Added min-w-0 to prevent flexbox from stretching and locking the screen */}
              <main className="flex-1 min-w-0 ml-0 lg:ml-72 p-4 pt-20 lg:pt-8 lg:p-8 w-full">
                <div className="max-w-[1600px] mx-auto w-full">
                  {children}
                </div>
              </main>

            </div>
          )}

        </Providers>
      </body>
    </html>
  );
}