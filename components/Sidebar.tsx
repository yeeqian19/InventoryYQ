'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

// 1. UPDATED NAVIGATION ITEMS
const allNavItems = [
  // ✅ CHANGED: Name is now 'Dashboard' to match your green HQ page
  { name: 'Dashboard', href: '/dashboard', icon: '📦', adminOnly: true },
  
  { name: 'Student Manager', href: '/student-manager', icon: '👥', adminOnly: true },
  { name: 'Scan & Approve', href: '/scan-approve', icon: '📷', adminOnly: false },
  { name: 'Scan Log', href: '/scan-log', icon: '📋', adminOnly: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const lowerPath = pathname.toLowerCase();

  const [userRole] = useState<'HQ' | 'BRANCH'>('HQ');

  const visibleItems = allNavItems.filter(item => {
    if (userRole === 'BRANCH' && item.adminOnly) return false;
    return true;
  });

  // ✅ HIDE LOGIC
  // Sidebar stays visible for /dashboard (HQ), Scan Approve, etc.
  // Sidebar hides completely for RM_Dashboard (White Bar Chart page)
  const shouldHide = 
    pathname === '/' || 
    lowerPath.includes('rm_dashboard') || 
    lowerPath.includes('inventory-branch') ||
    lowerPath.includes('stock-management');

  if (shouldHide) return null;

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-[#7cb342] text-white shadow-2xl z-[100] print:hidden">
      <div className="flex flex-col h-full">
        
        {/* BRANDING SECTION */}
        <div className="p-8">
          <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">
            My Inventory
          </h1>
          <p className="text-[10px] font-bold opacity-50 tracking-[0.2em] mt-2 border-t border-white/20 pt-2">
            {userRole === 'HQ' ? 'CENTRAL ADMINISTRATION' : 'BRANCH TERMINAL'}
          </p>
        </div>

        {/* CONTROL PANEL BUTTON */}
        <div className="px-4 mb-4">
          <Link 
            href="/" 
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all group no-underline"
          >
            <span className="text-lg group-hover:-translate-x-1 transition-transform">⬅️</span>
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white">Control Panel</span>
          </Link>
        </div>

        {/* DYNAMIC NAVIGATION LINKS */}
        <nav className="flex-1 py-4 space-y-2">
          {visibleItems.map((item) => {
            const isActive = lowerPath === item.href.toLowerCase();
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-6 py-4 transition-all duration-300 relative group no-underline ${
                  isActive
                    ? 'bg-[#f8fafc] text-[#7cb342] font-bold rounded-l-full ml-4 shadow-[-10px_0_15px_rgba(0,0,0,0.1)]'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                {isActive && (
                  <div className="absolute right-0 w-2 h-full bg-[#f8fafc]"></div>
                )}
                
                <span className={`text-xl transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>
                
                <span className={`tracking-wide text-sm font-bold uppercase ${isActive ? 'text-[#7cb342]' : 'text-white'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* USER PROFILE FOOTER */}
        <div className="p-6 border-t border-white/10 bg-black/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white text-[#7cb342] flex items-center justify-center font-black shadow-inner shrink-0">
              {userRole === 'HQ' ? 'HQ' : 'BR'}
            </div>
            <div className="overflow-hidden text-white">
              <p className="text-sm font-black truncate leading-none">Ashwin</p>
              <p className="text-[9px] text-white/50 uppercase tracking-widest mt-1 font-bold">System Admin</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}