'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type StaffMember = {
  id: number;
  name: string | null;
  email: string;
  role: string;
  branch_name: string | null;
  created_at: Date | string | null;
};

const ROLE_BADGE: Record<string, string> = {
  SUPERADMIN: 'bg-violet-100 text-violet-700 border border-violet-200',
  ADMIN_HQ:   'bg-emerald-100 text-emerald-700 border border-emerald-200',
  USER_RM:    'bg-amber-100 text-amber-700 border border-amber-200',
  USER_BM:    'bg-sky-100 text-sky-700 border border-sky-200',
};

const emptyForm = { name: '', email: '', password: '', role: 'USER_BM', branchCode: '' };

export default function StaffClient({ initialData }: { initialData: StaffMember[] }) {
  const router = useRouter();

  const [panelOpen, setPanelOpen]       = useState(false);
  const [editTarget, setEditTarget]     = useState<StaffMember | null>(null);
  const [formData, setFormData]         = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg]         = useState('');

  // ── helpers ───────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null);
    setFormData(emptyForm);
    setErrorMsg('');
    setPanelOpen(true);
  };

  const openEdit = (staff: StaffMember) => {
    setEditTarget(staff);
    setFormData({
      name:       staff.name ?? '',
      email:      staff.email,
      password:   '',
      role:       staff.role,
      branchCode: staff.branch_name ?? '',
    });
    setErrorMsg('');
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditTarget(null);
    setFormData(emptyForm);
    setErrorMsg('');
  };

  const field = (key: keyof typeof formData, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  // ── submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setErrorMsg('');
    if (!formData.name || !formData.email || !formData.role) {
      setErrorMsg('Name, email, and role are required.');
      return;
    }
    if (!editTarget && !formData.password) {
      setErrorMsg('Password is required for new accounts.');
      return;
    }

    setIsSubmitting(true);
    try {
      const url    = editTarget ? `/api/staff/${editTarget.id}` : '/api/staff';
      const method = editTarget ? 'PUT' : 'POST';

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (res.ok) {
        closePanel();
        router.refresh();
      } else {
        setErrorMsg(data.error || 'Something went wrong.');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (staff: StaffMember) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${staff.name ?? staff.email}"?\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/staff/${staff.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user.');
      }
    } catch {
      alert('Network error. Please try again.');
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 transition-colors"
          >
            ← Back to Central Panel
          </Link>
          <span className="text-[10px] font-black text-violet-600 uppercase tracking-[0.2em] border border-violet-200 bg-violet-50 px-3 py-1 rounded-full">
            Superadmin Access
          </span>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10">

        {/* Page heading */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Staff Management</h1>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
              User accounts &amp; access control
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-md shadow-violet-200 transition-all active:scale-95"
          >
            + Add Staff
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Accounts',    value: initialData.length,                                                       color: 'text-slate-800' },
            { label: 'Admins',            value: initialData.filter(s => s.role === 'ADMIN_HQ' || s.role === 'SUPERADMIN').length, color: 'text-violet-600' },
            { label: 'Branch Managers',   value: initialData.filter(s => s.role === 'USER_BM').length,                        color: 'text-sky-600'    },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Role</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Branch</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Created</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {initialData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <p className="text-4xl mb-3">👥</p>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No staff accounts yet</p>
                    </td>
                  </tr>
                )}
                {initialData.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{staff.name || '—'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-500">{staff.email}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${ROLE_BADGE[staff.role] ?? ROLE_BADGE.BRANCH}`}>
                        {staff.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-slate-600">{staff.branch_name || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {staff.created_at ? (
                        <div>
                          <p className="text-sm font-bold text-slate-700">
                            {new Date(staff.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {new Date(staff.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(staff)}
                          className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(staff)}
                          className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Slide-over panel ── */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
            onClick={closePanel}
          />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-white border-l border-slate-200 h-full shadow-2xl flex flex-col">

            {/* Panel header */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">
                  {editTarget ? 'Edit Staff' : 'Add New Staff'}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {editTarget ? `Editing: ${editTarget.email}` : 'Create System Account'}
                </p>
              </div>
              <button onClick={closePanel} className="text-slate-400 hover:text-slate-800 text-2xl leading-none mt-1">&times;</button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">

              {errorMsg && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => field('name', e.target.value)}
                  placeholder="e.g. Ashwin Kumar"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email Login</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => field('email', e.target.value)}
                  placeholder="user@ebright.my"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  {editTarget ? 'New Password' : 'Password'}
                  {editTarget && (
                    <span className="ml-2 text-slate-400 normal-case font-bold tracking-normal">
                      (leave blank to keep current)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => field('password', e.target.value)}
                  placeholder={editTarget ? 'Leave blank to keep unchanged' : 'Ebright2026!'}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">System Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => field('role', e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 transition-all"
                >
                  <option value="USER_BM">Branch Manager</option>
                  <option value="USER_RM">Regional Manager</option>
                  <option value="ADMIN_HQ">Admin HQ</option>
                  <option value="SUPERADMIN">Superadmin</option>
                </select>
              </div>

              {formData.role === 'USER_BM' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Branch Code</label>
                  <input
                    type="text"
                    value={formData.branchCode}
                    onChange={(e) => field('branchCode', e.target.value.toUpperCase())}
                    placeholder="e.g. RBY"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 transition-all uppercase"
                  />
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div className="px-8 py-6 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button
                onClick={closePanel}
                className="flex-1 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-200 rounded-2xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-md shadow-violet-200 transition-all active:scale-95"
              >
                {isSubmitting ? 'Saving...' : editTarget ? 'Update Staff' : 'Create Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
