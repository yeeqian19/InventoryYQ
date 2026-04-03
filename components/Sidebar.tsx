'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react'; // 👈 Added for mobile menu state

const allNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: '📦', roles: ['SUPERADMIN', 'ADMIN'] },
  { name: 'Student Manager', href: '/student-manager', icon: '👥', roles: ['SUPERADMIN', 'ADMIN'] },
  { name: 'Scan & Approve', href: '/scan-approve', icon: '📷', roles: ['SUPERADMIN', 'ADMIN', 'BRANCH'] },
  { name: 'Scan Log', href: '/scan-log', icon: '📋', roles: ['SUPERADMIN', 'ADMIN', 'BRANCH'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const lowerPath = pathname.toLowerCase();
  
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || 'BRANCH';
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'User';

  // 👈 Mobile Menu State
  const [isOpen, setIsOpen] = useState(false);

  const visibleItems = allNavItems.filter(item => 
    item.roles.includes(userRole)
  );

  // 🛑 HIDE LOGIC
  const shouldHide = 
    pathname === '/' || 
    lowerPath === '/login' || 
    lowerPath.includes('rm_dashboard') || 
    lowerPath.includes('inventory-branch');

  if (shouldHide) return null;

  return (
    <>
      {/* 📱 1. MOBILE TOP BAR (Hidden on Desktops) */}
      <div className="lg:hidden fixed top-0 left-0 w-full bg-[#7cb342] text-white p-4 flex justify-between items-center z-[90] shadow-md print:hidden">
        <h1 className="text-xl font-black tracking-tighter uppercase leading-none">
          My Inventory
        </h1>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 bg-black/10 rounded-lg hover:bg-black/20 transition-colors"
        >
          {/* Hamburger / Close Icon */}
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* 🌑 2. MOBILE OVERLAY (Darkens background when menu is open) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[95] lg:hidden" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      {/* 💻 3. THE SIDEBAR ITSELF */}
      <aside className={`
        fixed left-0 top-0 h-screen w-64 bg-[#7cb342] text-white shadow-2xl z-[100] print:hidden
        flex flex-col transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        
        {/* BRANDING */}
        <div className="p-8 hidden lg:block">
          {/* Hidden on mobile because it's already in the top bar */}
          <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">
            My Inventory
          </h1>
          <p className="text-[10px] font-bold opacity-50 tracking-[0.2em] mt-2 border-t border-white/20 pt-2 uppercase">
            {userRole === 'BRANCH' ? 'BRANCH TERMINAL' : 'CENTRAL ADMINISTRATION'}
          </p>
        </div>

        {/* MOBILE BRANDING (Slightly different padding for mobile sliding menu) */}
        <div className="p-6 lg:hidden border-b border-white/10 mb-2">
           <p className="text-[10px] font-bold opacity-70 tracking-[0.2em] uppercase">
            {userRole === 'BRANCH' ? 'BRANCH TERMINAL' : 'CENTRAL ADMINISTRATION'}
          </p>
        </div>

        {/* EXIT TO CONTROL PANEL */}
        <div className="px-4 mb-4">
          <Link 
            href="/" 
            onClick={() => setIsOpen(false)} // 👈 Closes menu when clicked
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all group no-underline text-white"
          >
            <span className="text-lg group-hover:-translate-x-1 transition-transform">⬅️</span>
            <span className="text-[10px] font-black uppercase tracking-[0.15em]">Control Panel</span>
          </Link>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 py-4 space-y-2">
          {visibleItems.map((item) => {
            const isActive = lowerPath.startsWith(item.href.toLowerCase());
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)} // 👈 Closes menu when clicked
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

        {/* USER PROFILE */}
        <div className="p-6 border-t border-white/10 bg-black/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white text-[#7cb342] flex items-center justify-center font-black shadow-inner shrink-0 uppercase">
              {userRole.substring(0, 2)}
            </div>
            <div className="overflow-hidden text-white text-left">
              <p className="text-sm font-black truncate leading-none capitalize">{userName}</p>
              <p className="text-[9px] text-white/50 uppercase tracking-widest mt-1 font-bold">
                {userRole === 'SUPERADMIN' ? 'System Admin' : userRole}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}