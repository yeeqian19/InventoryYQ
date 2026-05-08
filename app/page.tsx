import React from 'react';
import Link from 'next/link';
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import LoginClient from "./login/LoginClient";
import LogoutButton from "@/components/LogoutButton";

export default async function RootPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return <LoginClient />;
  }

  const role = session?.user?.role || "USER_RM";
  const userName = session?.user?.name || "User";

  const allMenuItems = [
    { name: 'MY INVENTORY (HQ)',     icon: '🏢', color: 'bg-[#418bca]', href: '/dashboard',        roles: ['SUPERADMIN', 'ADMIN_HQ', 'USER_RM'] },
    { name: 'RM DASHBOARD',         icon: '📊', color: 'bg-[#00c0ef]', href: '/RM_Dashboard',      roles: ['SUPERADMIN', 'USER_RM'] },
    { name: 'MY INVENTORY (BRANCH)', icon: '📍', color: 'bg-[#00a65a]', href: '/inventory-branch',  roles: ['SUPERADMIN', 'ADMIN_HQ', 'USER_RM', 'USER_BM'] },
    { name: 'STOCK MANAGEMENT',    icon: '📦', color: 'bg-[#605ca8]', href: '/stock-management',  roles: ['SUPERADMIN', 'ADMIN_HQ'] },
    { name: 'STAFF MANAGEMENT',    icon: '👥', color: 'bg-[#1e293b]', href: '/staff-management',  roles: ['SUPERADMIN'] },
  ];

  const visibleItems = allMenuItems.filter(item => item.roles.includes(role));

  return (
    <div className="min-h-screen bg-[#f3f7f9] flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-[40px] shadow-[0_15px_40px_rgba(0,0,0,0.08)] px-6 py-10 sm:px-10 sm:py-14 w-full max-w-3xl flex flex-col items-center">

        {/* ROLE BADGE */}
        <div className="border-2 border-blue-600 text-blue-600 rounded-full px-5 py-1 text-[11px] font-black tracking-[2px] uppercase mb-6">
          {role} PORTAL
        </div>

        <h1 className="text-2xl sm:text-4xl font-bold text-slate-800 mb-2 text-center tracking-tight">
          Inventory Management
        </h1>
        <p className="text-base sm:text-lg text-slate-400 mb-10 text-center">
          Welcome back, {userName}
        </p>

        {/* RESPONSIVE GRID — 2 cols on phone, 3 on tablet+ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full mb-8">
          {visibleItems.map((item) => (
            <Link href={item.href} key={item.href} className="no-underline">
              <div className={`${item.color} rounded-3xl flex flex-col items-center justify-center text-white shadow-md cursor-pointer transition-transform active:scale-95 hover:scale-105 min-h-[140px] sm:min-h-[180px] p-4`}>
                <span className="text-5xl sm:text-6xl mb-3">{item.icon}</span>
                <span className="text-[10px] sm:text-[11px] font-black text-center uppercase tracking-wide leading-tight px-1">
                  {item.name}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <a
            href={process.env.PORTAL_URL || 'https://portal.ebright.my/home'}
            className="px-7 py-2.5 min-h-[44px] text-[11px] font-black tracking-[2px] uppercase bg-transparent border-2 border-slate-200 rounded-full text-slate-400 cursor-pointer transition-all duration-200 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 hover:scale-105 no-underline inline-flex items-center"
          >
            ⬅️ Back to Portal
          </a>
          <LogoutButton />
        </div>

      </div>
    </div>
  );
}
