"use client";

import React from 'react';
import Link from 'next/link';

export default function ControlPanel() {
  // All paths are now mapped to their correct, separate folders
  const menuItems = [
    // 1. THIS GOES TO THE GREEN HQ LAYOUT
    { name: 'MY INVENTORY HQ', icon: '🏢', color: '#418bca', href: '/dashboard' }, 
    
    // 2. THIS GOES TO YOUR NEW WHITE BAR CHART PAGE
    { name: 'RM DASHBOARD', icon: '📊', color: '#00c0ef', href: '/RM_Dashboard' }, 
    
    { name: 'MY INVENTORY BRANCH', icon: '📍', color: '#00a65a', href: '/inventory-branch' },
    { name: 'STOCK MANAGEMENT', icon: '📦', color: '#605ca8', href: '/stock-management' },
  ];

  return (
    <div style={{ backgroundColor: '#f3f7f9', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      
      <div style={{ backgroundColor: 'white', borderRadius: '50px', boxShadow: '0 15px 40px rgba(0,0,0,0.08)', padding: '60px 40px', maxWidth: '900px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        <div style={{ border: '2px solid #2563eb', color: '#2563eb', borderRadius: '50px', padding: '4px 20px', fontSize: '11px', fontWeight: '900', letterSpacing: '2px', marginBottom: '25px' }}>
          GENERAL
        </div>

        <h1 style={{ fontSize: '36px', fontWeight: '700', color: '#1e293b', marginBottom: '8px', textAlign: 'center', letterSpacing: '-0.02em' }}>
          Inventory Control Panel
        </h1>
        <p style={{ fontSize: '18px', color: '#94a3b8', marginBottom: '50px', textAlign: 'center' }}>
          Welcome back, Ashwin
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px' }}>
          {menuItems.map((item, index) => (
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
                  transition: 'transform 0.2s ease-in-out',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
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