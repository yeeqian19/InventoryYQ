"use client";

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar'; // Make sure this path points to your Sidebar

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // This tells the app: "Are we on the Front Door?"
  const isLandingPage = pathname === '/';

  // If we are on the Front Door, show NO sidebar. Just full screen.
  if (isLandingPage) {
    return <main className="w-full min-h-screen bg-slate-50">{children}</main>;
  }

  // If we are "Inside" (Dashboard, Scan, etc), SHOW the green sidebar!
  return (
    <div className="flex bg-[#f8fafc] min-h-screen w-full">
      <Sidebar />
      {/* ml-64 pushes the dashboard over so the sidebar doesn't cover it */}
      <main className="flex-1 ml-64 min-h-screen overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}