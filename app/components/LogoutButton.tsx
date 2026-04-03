"use client";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ 
        callbackUrl: "/", 
        redirect: true 
      })}
      style={{
        marginTop: "32px",
        padding: "10px 28px",
        fontSize: "11px",
        fontWeight: "900",
        letterSpacing: "2px",
        textTransform: "uppercase",
        backgroundColor: "transparent",
        border: "2px solid #e2e8f0",
        borderRadius: "50px",
        color: "#94a3b8",
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget;
        btn.style.borderColor = "#ef4444";
        btn.style.color = "#ef4444";
        btn.style.backgroundColor = "#fef2f2";
        btn.style.transform = "scale(1.05)";
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget;
        btn.style.borderColor = "#e2e8f0";
        btn.style.color = "#94a3b8";
        btn.style.backgroundColor = "transparent";
        btn.style.transform = "scale(1)";
      }}
    >
      🚪 Sign Out System
    </button>
  );
}