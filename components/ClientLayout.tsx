"use client";

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar'; // Make sure this path points to your Sidebar

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Requirement 1: State Management for mobile menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // This tells the app: "Are we on the Front Door?"
  const isLandingPage = pathname === '/';

  // If we are on the Front Door, show NO sidebar. Just full screen.
  if (isLandingPage) {
    return <main className="w-full min-h-screen bg-slate-50">{children}</main>;
  }

  // If we are "Inside" (Dashboard, Scan, etc), SHOW the green sidebar!
  return (
    <div className="flex bg-[#f8fafc] min-h-screen w-full">
      
      {/* Requirement 2: Mobile Top Bar (visible only on mobile) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#7cb342] text-white flex items-center justify-between px-4 z-[110] shadow-lg">
        <h1 className="text-lg font-black uppercase tracking-tight">My Inventory</h1>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Requirement 3: Responsive Sidebar */}
      {/* 
        - lg: relative (desktop - sidebar flows normally with ml-64 on main)
        - Mobile: fixed, -translate-x-full by default, translate-0 when open
      */}
      <div 
        className={`
          left-0 top-0 h-screen z-[100]
          transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          fixed lg:relative
        `}
      >
        <Sidebar />
      </div>

      {/* Mobile overlay backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-[90]"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ml-64 pushes the dashboard over so the sidebar doesn't cover it (desktop only) */}
      <main className="flex-1 lg:ml-64 min-h-screen overflow-x-hidden pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  );
}