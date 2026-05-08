"use client";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  async function handleSignOut() {
    // redirect: false prevents NextAuth from using NEXTAUTH_URL (localhost)
    // We manually redirect so the browser stays on whatever domain it's on (ngrok, localhost, etc.)
    await signOut({ redirect: false });
    window.location.href = '/';
  }

  return (
    <button
      onClick={handleSignOut}
      className="px-7 py-2.5 min-h-[44px] text-[11px] font-black tracking-[2px] uppercase bg-transparent border-2 border-slate-200 rounded-full text-slate-400 cursor-pointer transition-all duration-200 hover:border-red-500 hover:text-red-500 hover:bg-red-50 hover:scale-105"
    >
      🚪 Sign Out System
    </button>
  );
}
