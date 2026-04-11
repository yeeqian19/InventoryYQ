'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@/types';
import { canManageStock } from '@/lib/permissions';

type Category = 'SK_ITEM' | 'INDIVIDUAL' | 'MARKETING';

interface StockItem {
  id: number;
  name: string;
  currentCount: number;
  inCartCount: number;
  orderedCount: number;
  threshold: number;
  neededCount: number;
  link: string | null;
  isSkPart: boolean;
  category: string;
}

interface StockClientProps {
  userRole: UserRole;
  initialItems: StockItem[];
  initialPackedCount: number;
  initialNamedCount: number;
  initialUnnamedCount: number;
}

const COL = {
  inventory: '#d9ead3',
  need:      '#f4cccc',
  inCart:    '#fff2cc',
  ordered:   '#fce5cd',
  named:     '#d9ead3',
  unnamed:   '#fff2cc',
  total:     '#cfe2f3',
};

const SECTIONS: { category: Category; label: string; subtitle: string }[] = [
  { category: 'SK_ITEM',    label: 'Section 1 — SK Items',        subtitle: 'Bottle · Notebook · Timer · Stress Ball · Bag' },
  { category: 'INDIVIDUAL', label: 'Section 3 — Individual Items', subtitle: 'Enrollment gifts — Lego · Smartwatch' },
  { category: 'MARKETING',  label: 'Section 4 — Marketing',       subtitle: 'Flyers and marketing materials' },
];

export default function StockClient({ userRole, initialItems, initialPackedCount, initialNamedCount, initialUnnamedCount }: StockClientProps) {
  const canEdit = canManageStock(userRole);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [items, setItems]             = useState<StockItem[]>(initialItems);
  const [packedCount, setPackedCount] = useState(initialPackedCount);
  const [namedCount, setNamedCount]   = useState(initialNamedCount);
  const [unnamedCount, setUnnamedCount] = useState(initialUnnamedCount);

  const [rowQty, setRowQty] = useState<Record<string, Record<number, string>>>({
    adjust: {}, checkout: {}, receive: {},
  });

  const [packQty, setPackQty]       = useState('');
  const [packError, setPackError]   = useState('');
  const [namedInput, setNamedInput] = useState('');
  const [unnamedInput, setUnnamedInput] = useState('');
  const [totalInput, setTotalInput] = useState('');

  const [editItem, setEditItem]         = useState<StockItem | null>(null);
  const [editForm, setEditForm]         = useState({ threshold: 0, neededCount: 0, link: '', currentCount: 0, category: 'SK_ITEM' as Category });
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', threshold: 0, neededCount: 0, link: '', category: 'SK_ITEM' as Category });

  // ── helpers ──────────────────────────────────────────────────────────────

  function refresh() { startTransition(() => router.refresh()); }

  async function callApi<T = StockItem>(url: string, method: string, body?: object): Promise<T | null> {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) { alert(data.error || 'An error occurred'); return null; }
      return data as T;
    } catch {
      alert('Network error or invalid server response');
      return null;
    }
  }

  function updateItem(updated: StockItem) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  }

  // ── actions ──────────────────────────────────────────────────────────────

  async function handleStockAction(action: 'adjust' | 'checkout' | 'receive', id: number) {
    const qty = parseInt(rowQty[action]?.[id] ?? '');
    if (isNaN(qty) || qty <= 0) return;
    const updated = await callApi(`/api/stock/${id}`, 'PATCH', { action, qty });
    if (updated) {
      updateItem(updated);
      setRowQty(prev => ({ ...prev, [action]: { ...prev[action], [id]: '' } }));
    }
  }

  async function handlePackKits() {
    setPackError('');
    const qty = parseInt(packQty);
    if (isNaN(qty) || qty <= 0) return;
    const res = await fetch('/api/stock/pack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPackError(data.shortfall
        ? data.shortfall.map((s: { name: string; have: number; need: number }) => `${s.name}: have ${s.have}, need ${s.need}`).join(' | ')
        : data.error || 'Failed');
      return;
    }
    setPackedCount(data.packedCount);
    setPackQty('');
    refresh();
  }

  async function handleSetTotal() {
    const val = parseInt(totalInput);
    if (isNaN(val) || val < 0) return;
    const result = await callApi<{ packedCount: number; namedCount: number; unnamedCount: number }>('/api/stock/pack', 'PATCH', { packedCount: val });
    if (result) { setPackedCount(result.packedCount); setNamedCount(result.namedCount); setUnnamedCount(result.unnamedCount); setTotalInput(''); }
  }

  async function handleSetNamed() {
    const val = parseInt(namedInput);
    if (isNaN(val) || val < 0) return;
    const result = await callApi<{ packedCount: number; namedCount: number; unnamedCount: number }>('/api/stock/pack', 'PATCH', { namedCount: val });
    if (result) { setNamedCount(result.namedCount); setPackedCount(result.packedCount); setUnnamedCount(result.unnamedCount); setNamedInput(''); }
  }

  async function handleSetUnnamed() {
    const val = parseInt(unnamedInput);
    if (isNaN(val) || val < 0) return;
    const result = await callApi<{ packedCount: number; namedCount: number; unnamedCount: number }>('/api/stock/pack', 'PATCH', { unnamedCount: val });
    if (result) { setUnnamedCount(result.unnamedCount); setPackedCount(result.packedCount); setNamedCount(result.namedCount); setUnnamedInput(''); }
  }

async function handleSaveEdit() {
    if (!editItem) return;
    const updated = await callApi(`/api/stock/${editItem.id}`, 'PATCH', {
      action: 'edit',
      threshold: editForm.threshold,
      neededCount: editForm.neededCount,
      link: editForm.link || null,
      currentCount: editForm.currentCount,
      category: editForm.category,
    });
    if (updated) { updateItem(updated); setSidebarOpen(false); }
  }

  async function handleAddItem() {
    if (!newItem.name.trim()) return;
    const created = await callApi<StockItem>('/api/stock', 'POST', newItem);
    if (!created) return;
    setItems(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setNewItem({ name: '', threshold: 0, neededCount: 0, link: '', category: 'SK_ITEM' });
    setShowAddForm(false);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this item?')) return;
    const result = await callApi<{ success: boolean }>(`/api/stock/${id}`, 'DELETE');
    if (result) setItems(prev => prev.filter(i => i.id !== id));
  }

  function openEdit(item: StockItem) {
    setEditItem(item);
    setEditForm({ threshold: item.threshold, neededCount: item.neededCount, link: item.link ?? '', currentCount: item.currentCount, category: (item.category as Category) || 'SK_ITEM' });
    setSidebarOpen(true);
  }

  // ── table helpers ─────────────────────────────────────────────────────────

  function tableHeaders() {
    const colCount = canEdit ? 8 : 4;
    return (
      <thead>
        <tr className="border-b-2 border-slate-200">
          <th className="pb-3 px-2 sm:px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left min-w-[130px] sticky left-0 z-20 bg-white">
            Item
          </th>
          <th className="pb-3 px-4 text-[10px] font-black uppercase tracking-widest text-center"
              style={{ backgroundColor: COL.inventory, color: '#2d6a27' }}>
            Inventory
          </th>
          <th className="pb-3 px-4 text-[10px] font-black uppercase tracking-widest text-center"
              style={{ backgroundColor: '#e8eaf6', color: '#3949ab' }}>
            Threshold
          </th>
          <th className="pb-3 px-4 text-[10px] font-black uppercase tracking-widest text-center"
              style={{ backgroundColor: COL.need, color: '#c0392b' }}>
            Need
          </th>
          {canEdit && (
            <th className="pb-3 px-4 text-[10px] font-black uppercase tracking-widest text-center"
                style={{ backgroundColor: COL.inCart, color: '#a07b00' }}>
              In Cart / Pending
            </th>
          )}
          {canEdit && (
            <th className="pb-3 px-4 text-[10px] font-black uppercase tracking-widest text-center"
                style={{ backgroundColor: COL.ordered, color: '#a04010' }}>
              Ordered
            </th>
          )}
          {canEdit && (
            <th className="pb-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
              Received
            </th>
          )}
          {canEdit && (
            <th className="pb-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
              Actions
            </th>
          )}
        </tr>
      </thead>
    );
  }

  function itemRow(item: StockItem) {
    const need = item.neededCount;
    const isLow = need > 0;
    return (
      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">

        {/* ITEM */}
        <td className="py-3 px-2 sm:px-4 sticky left-0 z-10 bg-white shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full shrink-0 ${isLow ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="text-xs sm:text-sm font-bold text-slate-700 leading-tight">{item.name}</span>
          </div>
        </td>

        {/* INVENTORY */}
        <td className="py-3 px-2 sm:px-4 text-center" style={{ backgroundColor: COL.inventory }}>
          <span className={`text-base font-black ${isLow ? 'text-rose-700' : 'text-emerald-700'}`}>
            {item.currentCount}
          </span>
          {item.link && (
            <div>
              <a href={item.link} target="_blank" rel="noreferrer"
                className="text-[9px] font-black uppercase tracking-wider underline underline-offset-2 text-emerald-600 hover:text-emerald-900">
                Link
              </a>
            </div>
          )}
        </td>

        {/* THRESHOLD */}
        <td className="py-3 px-2 sm:px-4 text-center" style={{ backgroundColor: '#e8eaf6' }}>
          <span className="text-sm font-black text-indigo-700">{item.threshold}</span>
        </td>

        {/* NEED */}
        <td className="py-3 px-2 sm:px-4 text-center" style={{ backgroundColor: COL.need }}>
          <span className={`text-sm font-black ${isLow ? 'text-rose-700' : 'text-slate-400'}`}>
            {need > 0 ? need : '—'}
          </span>
          {isLow && item.link && (
            <div>
              <a href={item.link} target="_blank" rel="noreferrer"
                className="text-[9px] font-black uppercase tracking-wider underline underline-offset-2 text-rose-500">
                Buy Now
              </a>
            </div>
          )}
        </td>

        {/* IN CART */}
        {canEdit && (
          <td className="py-3 px-4 text-center" style={{ backgroundColor: COL.inCart }}>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-base font-black text-amber-700">{item.inCartCount}</span>
              <div className="flex gap-1">
                <input type="number" placeholder="qty"
                  value={rowQty.adjust[item.id] || ''}
                  onChange={e => setRowQty(p => ({ ...p, adjust: { ...p.adjust, [item.id]: e.target.value } }))}
                  className="w-14 px-1 py-1 text-[10px] font-bold rounded-lg border border-amber-300 text-center focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                />
                <button onClick={() => handleStockAction('adjust', item.id)}
                  disabled={!rowQty.adjust[item.id]}
                  className="px-2 py-1 bg-amber-200 hover:bg-amber-300 text-amber-800 disabled:opacity-30 text-[9px] font-black uppercase rounded-lg transition-colors">
                  +Cart
                </button>
              </div>
            </div>
          </td>
        )}

        {/* ORDERED */}
        {canEdit && (
          <td className="py-3 px-4 text-center" style={{ backgroundColor: COL.ordered }}>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-base font-black text-orange-700">{item.orderedCount}</span>
              <div className="flex gap-1">
                <input type="number" placeholder="qty"
                  value={rowQty.checkout[item.id] || ''}
                  onChange={e => setRowQty(p => ({ ...p, checkout: { ...p.checkout, [item.id]: e.target.value } }))}
                  className="w-14 px-1 py-1 text-[10px] font-bold rounded-lg border border-orange-300 text-center focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
                />
                <button onClick={() => handleStockAction('checkout', item.id)}
                  disabled={!rowQty.checkout[item.id] || item.inCartCount === 0}
                  className="px-2 py-1 bg-orange-200 hover:bg-orange-300 text-orange-800 disabled:opacity-30 text-[9px] font-black uppercase rounded-lg transition-colors">
                  Pay
                </button>
              </div>
            </div>
          </td>
        )}

        {/* RECEIVED — receive from ordered */}
        {canEdit && (
          <td className="py-3 px-4 text-center">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[8px] text-slate-400 font-black uppercase">Ordered: {item.orderedCount}</span>
              <span className="text-[8px] text-emerald-600 font-black uppercase tracking-widest">Received Qty</span>
              <div className="flex gap-1">
                <input type="number" placeholder="qty"
                  value={rowQty.receive[item.id] || ''}
                  onChange={e => setRowQty(p => ({ ...p, receive: { ...p.receive, [item.id]: e.target.value } }))}
                  className="w-14 px-1 py-1 text-[10px] font-bold rounded-lg border border-emerald-200 text-center focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
                <button onClick={() => handleStockAction('receive', item.id)}
                  disabled={!rowQty.receive[item.id] || item.orderedCount === 0}
                  className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 disabled:opacity-30 text-[9px] font-black uppercase rounded-lg transition-colors">
                  Receive
                </button>
              </div>
            </div>
          </td>
        )}

        {/* ACTIONS */}
        {canEdit && (
          <td className="py-3 px-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <button onClick={() => openEdit(item)}
                className="px-3 py-1.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-600 text-[9px] font-black uppercase rounded-xl transition-colors">
                Edit
              </button>
              <button onClick={() => handleDelete(item.id)}
                className="px-3 py-1.5 min-h-[44px] bg-rose-50 hover:bg-rose-100 text-rose-500 text-[9px] font-black uppercase rounded-xl border border-rose-100 transition-colors">
                Del
              </button>
            </div>
          </td>
        )}
      </tr>
    );
  }

  function stockSection(category: Category, label: string, subtitle: string) {
    const sectionItems = items.filter(i => (i.category || 'SK_ITEM') === category);
    const colSpan = canEdit ? 8 : 4;
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest">{label}</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">{subtitle}</p>
          </div>
          <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-lg uppercase">
            {sectionItems.length} items
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ minWidth: canEdit ? 1000 : 520 }}>
              {tableHeaders()}
              <tbody>
                {sectionItems.length === 0
                  ? <tr><td colSpan={colSpan} className="py-8 text-center text-slate-400 font-bold text-xs">No items — add one with the + Add Item button above.</td></tr>
                  : sectionItems.map(item => itemRow(item))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto font-sans relative">

      {/* Back */}
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-500 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-all no-underline">
          ← Control Panel
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Stock Management</h1>
        <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">4-Stage Procurement Pipeline</p>
      </div>

      {/* Pack Kits card */}
      {canEdit && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Packed Starter Kits</p>
              <p className="text-5xl font-black">{packedCount}</p>
              <p className="text-xs text-slate-500 mt-1 font-bold">Ready to dispatch</p>
            </div>
            <div className="text-6xl opacity-20">📦</div>
          </div>
          <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pack New Starter Kits</p>
              <p className="text-xs text-slate-500 font-medium">Deducts 1 of each SK Item per kit packed</p>
            </div>
            {packError && (
              <p className="text-[10px] text-rose-600 font-bold mt-2 bg-rose-50 rounded-lg px-3 py-2">{packError}</p>
            )}
            <div className="flex gap-3 mt-4">
              <input type="number" placeholder="Qty to pack" value={packQty}
                onChange={e => setPackQty(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <button onClick={handlePackKits} disabled={!packQty || isPending}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all">
                Pack Kits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Color legend */}
      <div className="mb-5 flex flex-wrap gap-4">
        {[
          { label: 'Inventory',  color: COL.inventory },
          { label: 'Threshold',  color: '#e8eaf6' },
          { label: 'Need',       color: COL.need },
          { label: 'In Cart',    color: COL.inCart },
          { label: 'Ordered',    color: COL.ordered },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-black/10" style={{ backgroundColor: color }} />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
          </div>
        ))}
      </div>

      {/* Add Item button */}
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <button onClick={() => setShowAddForm(v => !v)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all">
            + Add Item
          </button>
        </div>
      )}

      {/* Add item form */}
      {showAddForm && canEdit && (
        <div className="mb-6 bg-white rounded-2xl border border-emerald-200 p-6 shadow-sm grid grid-cols-2 md:grid-cols-6 gap-4">
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Item Name</label>
            <input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="e.g. Bottle" />
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</label>
            <select value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value as Category }))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="SK_ITEM">SK Item</option>
              <option value="INDIVIDUAL">Individual Gift</option>
              <option value="MARKETING">Marketing</option>
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Threshold</label>
            <input type="number" value={newItem.threshold} onChange={e => setNewItem(p => ({ ...p, threshold: +e.target.value }))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Need</label>
            <input type="number" value={newItem.neededCount} onChange={e => setNewItem(p => ({ ...p, neededCount: +e.target.value }))}
              className="w-full px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-400" />
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Supplier Link</label>
            <input value={newItem.link} onChange={e => setNewItem(p => ({ ...p, link: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="https://..." />
          </div>
          <div className="flex flex-col justify-end">
            <button onClick={handleAddItem}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors">
              Save Item
            </button>
          </div>
        </div>
      )}

      {/* ── SECTION 1: SK ITEMS ── */}
      {stockSection('SK_ITEM', 'Section 1 — SK Items', 'Bottle · Notebook · Timer · Stress Ball · Bag')}

      {/* ── SECTION 2: PACKED SK ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest">Section 2 — Packed SK</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Assembled starter kits ready for dispatch</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ minWidth: canEdit ? 600 : 400 }}>
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="pb-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left min-w-[160px]">Item</th>
                  <th className="pb-3 px-4 text-[10px] font-black uppercase tracking-widest text-center"
                      style={{ backgroundColor: COL.named, color: '#2d6a27' }}>Named</th>
                  <th className="pb-3 px-4 text-[10px] font-black uppercase tracking-widest text-center"
                      style={{ backgroundColor: COL.unnamed, color: '#a07b00' }}>Unnamed</th>
                  <th className="pb-3 px-4 text-[10px] font-black uppercase tracking-widest text-center"
                      style={{ backgroundColor: COL.total, color: '#1a4a6e' }}>Total</th>
                  {canEdit && (
                    <th className="pb-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                      Adjust Named
                    </th>
                  )}
                  {canEdit && (
                    <th className="pb-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                      Adjust Unnamed
                    </th>
                  )}
                  {canEdit && (
                    <th className="pb-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                      Adjust Total
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-sm font-bold text-slate-700">Packed Starter Kits</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center" style={{ backgroundColor: COL.named }}>
                    <span className="text-base font-black text-emerald-700">{namedCount}</span>
                  </td>
                  <td className="py-4 px-4 text-center" style={{ backgroundColor: COL.unnamed }}>
                    <span className="text-base font-black text-amber-700">{unnamedCount}</span>
                  </td>
                  <td className="py-4 px-4 text-center" style={{ backgroundColor: COL.total }}>
                    <span className="text-base font-black text-blue-700">{packedCount}</span>
                  </td>
                  {canEdit && (
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex gap-1">
                          <input type="number" placeholder="set named"
                            value={namedInput}
                            onChange={e => setNamedInput(e.target.value)}
                            className="w-20 px-2 py-1 text-[10px] font-bold rounded-lg border border-emerald-200 text-center focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                          <button onClick={handleSetNamed} disabled={!namedInput}
                            className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 disabled:opacity-30 text-[9px] font-black uppercase rounded-lg transition-colors">
                            Set
                          </button>
                        </div>
                        <span className="text-[8px] text-slate-400 font-bold uppercase">sets named count</span>
                      </div>
                    </td>
                  )}
                  {canEdit && (
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex gap-1">
                          <input type="number" placeholder="set unnamed"
                            value={unnamedInput}
                            onChange={e => setUnnamedInput(e.target.value)}
                            className="w-20 px-2 py-1 text-[10px] font-bold rounded-lg border border-amber-200 text-center focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                          <button onClick={handleSetUnnamed} disabled={!unnamedInput}
                            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 disabled:opacity-30 text-[9px] font-black uppercase rounded-lg transition-colors">
                            Set
                          </button>
                        </div>
                        <span className="text-[8px] text-slate-400 font-bold uppercase">recalcs total</span>
                      </div>
                    </td>
                  )}
                  {canEdit && (
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex gap-1">
                          <input type="number" placeholder="set total"
                            value={totalInput}
                            onChange={e => setTotalInput(e.target.value)}
                            className="w-20 px-2 py-1 text-[10px] font-bold rounded-lg border border-blue-200 text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          <button onClick={handleSetTotal} disabled={!totalInput}
                            className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 disabled:opacity-30 text-[9px] font-black uppercase rounded-lg transition-colors">
                            Set
                          </button>
                        </div>
                        <span className="text-[8px] text-slate-400 font-bold uppercase">overrides total</span>
                      </div>
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: INDIVIDUAL ITEMS ── */}
      {stockSection('INDIVIDUAL', 'Section 3 — Individual Items', 'Enrollment gifts — Lego · Smartwatch')}

      {/* ── SECTION 4: MARKETING ── */}
      {stockSection('MARKETING', 'Section 4 — Marketing', 'Flyers and marketing materials')}

      {/* ── EDIT SIDEBAR ── */}
      {isSidebarOpen && editItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black text-slate-800">Edit Item</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{editItem.name}</p>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-800 text-2xl">&times;</button>
            </div>
            <div className="p-6 flex-1 space-y-5 overflow-y-auto">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Category</label>
                <select value={editForm.category}
                  onChange={e => setEditForm(p => ({ ...p, category: e.target.value as Category }))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-slate-400">
                  <option value="SK_ITEM">SK Item</option>
                  <option value="INDIVIDUAL">Individual Gift</option>
                  <option value="MARKETING">Marketing</option>
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Override Inventory Count</label>
                <input type="number" value={editForm.currentCount}
                  onChange={e => setEditForm(p => ({ ...p, currentCount: +e.target.value }))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Threshold (reorder point)</label>
                <input type="number" value={editForm.threshold}
                  onChange={e => setEditForm(p => ({ ...p, threshold: +e.target.value }))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>

              <div>
                <label className="block text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1.5">Need (branch demand)</label>
                <input type="number" value={editForm.neededCount}
                  onChange={e => setEditForm(p => ({ ...p, neededCount: +e.target.value }))}
                  className="w-full p-3 bg-rose-50 border border-rose-200 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-rose-400 text-rose-700" />
                <p className="text-[9px] text-slate-400 font-bold mt-1">Independent of threshold — set based on branch demand</p>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Supplier Link</label>
                <input type="text" value={editForm.link}
                  onChange={e => setEditForm(p => ({ ...p, link: e.target.value }))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button onClick={() => setSidebarOpen(false)}
                className="flex-1 py-3 text-[11px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-200 rounded-2xl">
                Cancel
              </button>
              <button onClick={handleSaveEdit}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
