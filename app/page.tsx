import React from 'react';
import Link from 'next/link';
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function ControlPanel() {
  const session = await getServerSession(authOptions);

  // 1. Protection: If not logged in, go to login
  if (!session) {
    redirect("/login");
  }

  const role = (session?.user as any)?.role || "BRANCH";
  const userName = session?.user?.name || "Ashwin";

  // 2. Define Menu Items with Role Requirements
  const allMenuItems = [
    { 
      name: 'MY INVENTORY HQ', 
      icon: '🏢', 
      color: '#418bca', 
      href: '/dashboard', 
      roles: ['SUPERADMIN', 'ADMIN'] 
    },
    { 
      name: 'RM DASHBOARD', 
      icon: '📊', 
      color: '#00c0ef', 
      href: '/RM_Dashboard', 
      roles: ['SUPERADMIN', 'ADMIN'] 
    },
    { 
      name: 'MY INVENTORY BRANCH', 
      icon: '📍', 
      color: '#00a65a', 
      href: '/inventory-branch', 
      roles: ['SUPERADMIN', 'BRANCH'] // Hidden for ADMIN
    },
    { 
      name: 'STOCK MANAGEMENT', 
      icon: '📦', 
      color: '#605ca8', 
      href: '/stock-management', 
      roles: ['SUPERADMIN', 'ADMIN'] 
    },
  ];

  // 3. Filter items: Only show icons if user's role is in the allowed list
  const visibleItems = allMenuItems.filter(item => item.roles.includes(role));

  return (
    <div style={{ backgroundColor: '#f3f7f9', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
      
      <div style={{ backgroundColor: 'white', borderRadius: '50px', boxShadow: '0 15px 40px rgba(0,0,0,0.08)', padding: '60px 40px', maxWidth: '900px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        <div style={{ border: '2px solid #2563eb', color: '#2563eb', borderRadius: '50px', padding: '4px 20px', fontSize: '11px', fontWeight: '900', letterSpacing: '2px', marginBottom: '25px' }}>
          {role} PORTAL
        </div>

        <h1 style={{ fontSize: '36px', fontWeight: '700', color: '#1e293b', marginBottom: '8px', textAlign: 'center', letterSpacing: '-0.02em' }}>
          Inventory Control Panel
        </h1>
        <p style={{ fontSize: '18px', color: '#94a3b8', marginBottom: '50px', textAlign: 'center' }}>
          Welcome back, {userName}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px' }}>
          {visibleItems.map((item, index) => (
            <Link href={item.href} key={index} style={{ textDecoration: 'none' }}>
              <div 
                style={{ 
                  backgroundColor: item.color, 
                  width: '200px', 
                  height: '200px', 
                  borderRadius: '35px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: 'white',
                  boxShadow: '0 8px 15px rgba(0,0,0,0.1)',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '65px', marginBottom: '15px' }}>{item.icon}</span>
                <span style={{ fontSize: '10px', fontWeight: '900', textAlign: 'center', padding: '0 15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {item.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}