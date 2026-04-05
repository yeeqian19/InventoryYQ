"use client";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/", redirect: true })}
      className="mt-8 px-7 py-2.5 text-[11px] font-black tracking-[2px] uppercase bg-transparent border-2 border-slate-200 rounded-full text-slate-400 cursor-pointer transition-all duration-200 hover:border-red-500 hover:text-red-500 hover:bg-red-50 hover:scale-105"
    >
      🚪 Sign Out System
    </button>
  );
}
