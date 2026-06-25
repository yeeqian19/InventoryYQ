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

  return (
    <div className="min-h-screen bg-[#f3f7f9] flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-[40px] shadow-[0_15px_40px_rgba(0,0,0,0.08)] px-6 py-10 sm:px-10 sm:py-14 w-full max-w-3xl flex flex-col items-center">

        {/* ROLE BADGE */}
        <div className="border-2 border-blue-600 text-blue-600 rounded-full px-5 py-1 text-[11px] font-black tracking-[2px] uppercase mb-6">
          {role} PORTAL
        </div>

        <h1 className="text-2xl sm:text-4xl font-bold text-slate-800 mb-2 text-center tracking-tight">
          Inventory
        </h1>
        <p className="text-base sm:text-lg text-slate-400 mb-10 text-center">
          Welcome back, {userName}
        </p>

        {/* CHOOSER — 2 large buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full mb-8">
          <Link href="/operations" className="no-underline">
            <div className="bg-[#418bca] rounded-3xl flex flex-col items-center justify-center text-white shadow-md cursor-pointer transition-transform active:scale-95 hover:scale-105 min-h-[200px] sm:min-h-[240px] p-6">
              <span className="text-6xl sm:text-7xl mb-4">⚙️</span>
              <span className="text-sm sm:text-base font-black text-center uppercase tracking-widest">
                Operations
              </span>
            </div>
          </Link>

          <Link href="/marketing" className="no-underline">
            <div className="bg-[#e91e63] rounded-3xl flex flex-col items-center justify-center text-white shadow-md cursor-pointer transition-transform active:scale-95 hover:scale-105 min-h-[200px] sm:min-h-[240px] p-6">
              <span className="text-6xl sm:text-7xl mb-4">📣</span>
              <span className="text-sm sm:text-base font-black text-center uppercase tracking-widest">
                Marketing
              </span>
            </div>
          </Link>
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
