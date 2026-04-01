'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

const allNavItems = [
  // 🟢 FIXED: Changed href to '/dashboard' to match your folder name
  { name: 'Dashboard', href: '/dashboard', icon: '📦', roles: ['SUPERADMIN', 'ADMIN'] },
  
  // 🟢 Student Manager
  { name: 'Student Manager', href: '/student-manager', icon: '👥', roles: ['SUPERADMIN', 'ADMIN'] },
  
  // 🔴 REMOVED: Stock Management was here
  
  // 🟢 Scan Tools (Visible to everyone)
  { name: 'Scan & Approve', href: '/scan-approve', icon: '📷', roles: ['SUPERADMIN', 'ADMIN', 'BRANCH'] },
  { name: 'Scan Log', href: '/scan-log', icon: '📋', roles: ['SUPERADMIN', 'ADMIN', 'BRANCH'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const lowerPath = pathname.toLowerCase();
  
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || 'BRANCH';
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'User';

  const visibleItems = allNavItems.filter(item => 
    item.roles.includes(userRole)
  );

  // 🛑 HIDE LOGIC: Sidebar only shows inside actual tool pages
  const shouldHide = 
    pathname === '/' || 
    lowerPath === '/login' || 
    lowerPath.includes('rm_dashboard') || 
    lowerPath.includes('inventory-branch');

  if (shouldHide) return null;

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-[#7cb342] text-white shadow-2xl z-[100] print:hidden">
      <div className="flex flex-col h-full">
        
        {/* BRANDING */}
        <div className="p-8">
          <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">
            My Inventory
          </h1>
          <p className="text-[10px] font-bold opacity-50 tracking-[0.2em] mt-2 border-t border-white/20 pt-2 uppercase">
            {userRole === 'BRANCH' ? 'BRANCH TERMINAL' : 'CENTRAL ADMINISTRATION'}
          </p>
        </div>

        {/* EXIT TO CONTROL PANEL */}
        <div className="px-4 mb-4">
          <Link 
            href="/" 
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all group no-underline text-white"
          >
            <span className="text-lg group-hover:-translate-x-1 transition-transform">⬅️</span>
            <span className="text-[10px] font-black uppercase tracking-[0.15em]">Control Panel</span>
          </Link>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 py-4 space-y-2">
          {visibleItems.map((item) => {
            // Check if active based on new /dashboard path
            const isActive = lowerPath.startsWith(item.href.toLowerCase());
            
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
      </div>
    </aside>
  );
}