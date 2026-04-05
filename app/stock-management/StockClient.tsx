'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface InventoryRow {
  id: number;
  name: string;
  count: number;
  threshold: number;
  link: string;
  isKitItem: boolean;
}

const initialInventory = [
  { id: 1, name: 'Ball', count: 120, threshold: 10, link: 'https://supplier.com/ball', isKitItem: true },
  { id: 2, name: 'Stop Watch', count: 85, threshold: 5, link: 'https://supplier.com/stopwatch', isKitItem: true },
  { id: 3, name: 'Book', count: 45, threshold: 20, link: 'https://supplier.com/book', isKitItem: true },
  { id: 4, name: 'Bottle', count: 150, threshold: 15, link: 'https://supplier.com/bottle', isKitItem: true },
  { id: 5, name: 'Bag', count: 120, threshold: 10, link: 'https://supplier.com/bag', isKitItem: true },
  { id: 6, name: 'Smart Watch', count: 12, threshold: 5, link: 'https://supplier.com/smartwatch', isKitItem: false },
  { id: 7, name: 'Lego', count: 9, threshold: 8, link: 'https://supplier.com/lego', isKitItem: false },
];

export default function StockClient() {
  const [inventory, setInventory] = useState<InventoryRow[]>(initialInventory);
  
  // State for Quick Adjustments
  const [adjustments, setAdjustments] = useState<Record<number, string>>({});
  const [skPrepAmount, setSkPrepAmount] = useState<string>('');

  // Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryRow | null>(null);

  // --- 1. QUICK ADJUST LOGIC (For EG items like Lego/Smartwatch) ---
  const applyQuickAdjust = (id: number) => {
    const val = parseInt(adjustments[id]);
    if (!isNaN(val) && val !== 0) {
      setInventory(inventory.map(item => 
        item.id === id ? { ...item, count: item.count + val } : item
      ));
    }
    // Clear the input after applying
    setAdjustments({ ...adjustments, [id]: '' });
  };

  // --- 2. BATCH KITTING LOGIC (For SK items) ---
  const handlePackKit = () => {
    const amount = parseInt(skPrepAmount);
    if (isNaN(amount) || amount <= 0) return;

    // Check if we have enough of EVERY kit item
    const kitItems = inventory.filter(item => item.isKitItem);
    const canPack = kitItems.every(item => item.count >= amount);

    if (!canPack) {
      alert(`⚠️ Not enough raw materials to pack ${amount} Starter Kits!`);
      return;
    }

    // Deduct the amount from all SK kit items
    setInventory(inventory.map(item => {
      if (item.isKitItem) {
        return { ...item, count: item.count - amount };
      }
      return item;
    }));

    setSkPrepAmount(''); // Reset input
    alert(`✅ Successfully deducted raw materials for ${amount} Starter Kits.`);
  };

  // --- 3. SIDEBAR LOGIC (For Thresholds/Links) ---
  const openEditSidebar = (item: InventoryRow) => {
    setEditingItem({ ...item });
    setIsSidebarOpen(true);
  };

  const handleSaveUpdate = () => {
    if (!editingItem) return;
    setInventory(inventory.map(item =>
      item.id === editingItem.id ? editingItem : item
    ));
    setIsSidebarOpen(false);
    setEditingItem(null);
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto font-sans relative">
      
      {/* Back Button */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-500 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 hover:text-slate-800 transition-all no-underline"
        >
          ← Control Panel
        </Link>
      </div>

      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Stock Management</h1>
          <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Quick Adjust Mode</p>
        </div>

        {/* 📦 BATCH PREP CONTROLLER (For SK) */}
        <div className="bg-white px-6 py-4 rounded-3xl border-2 border-blue-500 shadow-md flex items-center gap-4">
          <div>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Deduct Starter Kits (SK)</p>
            <div className="flex gap-2 mt-1">
              <input 
                type="number" 
                placeholder="Qty"
                value={skPrepAmount}
                onChange={(e) => setSkPrepAmount(e.target.value)}
                className="w-20 px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 text-center"
              />
              <button 
                onClick={handlePackKit}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-transform active:scale-95"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar p-6">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <th className="pb-4 px-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Item / Name</th>
                <th className="pb-4 px-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Current Count</th>
                <th className="pb-4 px-4 text-[11px] font-black text-blue-500 uppercase tracking-widest text-center bg-blue-50/50 rounded-t-xl">Quick Adjust</th>
                <th className="pb-4 px-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Threshold</th>
                <th className="pb-4 px-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Supplier</th>
                <th className="pb-4 px-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">More</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {inventory.map((item) => {
                const isLowStock = item.count <= item.threshold;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    
                    {/* ITEM NAME */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isLowStock ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                        <span className="text-sm font-bold text-slate-700 capitalize">{item.name}</span>
                        {item.isKitItem && <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[9px] font-black rounded uppercase">SK Part</span>}
                      </div>
                    </td>

                    {/* CURRENT COUNT */}
                    <td className="py-4 px-4 text-center">
                      <span className={`text-lg font-black ${isLowStock ? 'text-rose-600' : 'text-slate-700'}`}>
                        {item.count}
                      </span>
                    </td>

                    {/* ⚡ QUICK ADJUST COLUMN ⚡ */}
                    <td className="py-4 px-4 text-center bg-blue-50/20">
                      <div className="flex items-center justify-center gap-2">
                        <input 
                          type="number" 
                          placeholder="-1, +5"
                          value={adjustments[item.id] || ''}
                          onChange={(e) => setAdjustments({ ...adjustments, [item.id]: e.target.value })}
                          className="w-16 px-2 py-1.5 text-xs font-bold rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                        />
                        <button 
                          onClick={() => applyQuickAdjust(item.id)}
                          disabled={!adjustments[item.id]}
                          className="bg-blue-100 hover:bg-blue-200 text-blue-700 disabled:opacity-30 disabled:hover:bg-blue-100 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
                        >
                          Go
                        </button>
                      </div>
                    </td>

                    {/* THRESHOLD */}
                    <td className="py-4 px-4 text-center">
                      <span className="text-sm font-bold text-slate-400">{item.threshold}</span>
                    </td>

                    {/* REORDER LINK */}
                    <td className="py-4 px-4 text-center">
                      <a href={item.link} target="_blank" className={`text-[10px] font-black uppercase tracking-wider underline underline-offset-4 ${isLowStock ? 'text-rose-500' : 'text-slate-400 hover:text-blue-500'}`}>
                        {isLowStock ? '⚠️ Buy Now' : 'Link'}
                      </a>
                    </td>

                    {/* FULL EDIT BUTTON */}
                    <td className="py-4 px-4 text-right">
                      <button 
                        onClick={() => openEditSidebar(item)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors"
                      >
                        Edit
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🟢 SLIDE-OVER SIDEBAR MODAL 🟢 */}
      {isSidebarOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
          
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Advanced Settings</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{editingItem?.name}</p>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-slate-800 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-8 flex-1 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Override Total Count</label>
                <input 
                  type="number" 
                  value={editingItem?.count}
                  onChange={(e) => setEditingItem({...editingItem, count: parseInt(e.target.value) || 0})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Warning Threshold</label>
                <input 
                  type="number" 
                  value={editingItem?.threshold}
                  onChange={(e) => setEditingItem({...editingItem, threshold: parseInt(e.target.value) || 0})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Supplier Link</label>
                <input 
                  type="text" 
                  value={editingItem?.link}
                  onChange={(e) => setEditingItem({...editingItem, link: e.target.value})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50 flex gap-4">
              <button onClick={() => setIsSidebarOpen(false)} className="flex-1 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-200 rounded-2xl transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveUpdate} className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-lg transition-transform active:scale-95">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}