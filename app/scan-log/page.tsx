'use client';

import { useState, useMemo } from 'react';

// Mock Data representing your SQL table results
const mockScanLog = [
  { id: 1, doc_no: 'INV-1001', barcode: '8850123', name: 'Ahmad Yusof', branch: 'PJ', item: 'SK', stage: 'Prepared', date: '2026-03-24 10:15 AM', actor: 'Ashwin (HQ)' },
  { id: 2, doc_no: 'INV-1002', barcode: '8850567', name: 'Mei Ling', branch: 'KL', item: 'EG', stage: 'Picked Up', date: '2026-03-24 11:30 AM', actor: 'Siti (BM)' },
  { id: 3, doc_no: 'INV-1003', barcode: '8850910', name: 'Jason Lee', branch: 'PJ', item: 'SK', stage: 'Received', date: '2026-03-24 02:45 PM', actor: 'Jason (Student)' },
  { id: 4, doc_no: 'INV-1004', barcode: '8850112', name: 'Wei Chen', branch: 'Penang', item: 'SK', stage: 'Prepared', date: '2026-03-23 09:00 AM', actor: 'Ashwin (HQ)' },
];

export default function ScanLogPage() {
  const [userRole] = useState<'HQ' | 'PJ' | 'KL' | 'Penang'>('HQ'); 
  const [filterBranch, setFilterBranch] = useState('all');

  const filteredLogs = useMemo(() => {
    let data = mockScanLog;
    if (userRole !== 'HQ') {
      data = data.filter(log => log.branch === userRole);
    } 
    else if (filterBranch !== 'all') {
      data = data.filter(log => log.branch === filterBranch);
    }
    return data;
  }, [userRole, filterBranch]);

  return (
    <div className="p-8 font-sans max-w-7xl mx-auto space-y-6">
      
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Scan History Log</h1>
          <p className="text-slate-400 font-bold text-[10px] tracking-widest mt-1">
            {userRole === 'HQ' ? 'MASTER AUDIT TRAIL' : `LOCAL LOG: ${userRole} BRANCH`}
          </p>
        </div>

        {userRole === 'HQ' && (
          <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <span className="text-[9px] font-black text-slate-400 uppercase px-3">Filter Branch:</span>
            <select 
              value={filterBranch} 
              onChange={(e) => setFilterBranch(e.target.value)}
              className="bg-white border-none rounded-xl px-4 py-2 text-xs font-black text-slate-700 outline-none cursor-pointer shadow-sm"
            >
              <option value="all">All Branches</option>
              <option value="PJ">PJ</option>
              <option value="KL">KL</option>
              <option value="Penang">Penang</option>
            </select>
          </div>
        )}
      </div>

      {/* 2. THE LOG TABLE */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <th className="px-10 py-5">Timestamp</th>
              <th className="px-10 py-5">Doc No / Barcode</th>
              <th className="px-10 py-5">Student / Item</th>
              <th className="px-10 py-5">Branch</th>
              <th className="px-10 py-5">Action Type</th>
              <th className="px-10 py-5 text-right">Processed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 font-bold text-sm">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-10 py-6">
                  <p className="text-slate-900">{log.date.split(' ')[0]}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{log.date.split(' ').slice(1).join(' ')}</p>
                </td>
                <td className="px-10 py-6">
                  <p className="text-slate-900 leading-none">{log.doc_no}</p>
                  <code className="text-[10px] text-blue-500 font-mono mt-1 block tracking-wider">
                    {log.barcode}
                  </code>
                </td>
                <td className="px-10 py-6">
                  <p className="text-slate-900 leading-none">{log.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase mt-1 font-medium">Type: {log.item}</p>
                </td>
                <td className="px-10 py-6">
                  <span className={`px-3 py-1 rounded-lg text-[10px] uppercase font-black ${
                    log.branch === 'PJ' ? 'bg-emerald-100 text-emerald-700' : 
                    log.branch === 'KL' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {log.branch}
                  </span>
                </td>
                <td className="px-10 py-6">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] uppercase tracking-tighter ${
                    log.stage === 'Prepared' ? 'bg-blue-50 text-blue-600' :
                    log.stage === 'Picked Up' ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {log.stage}
                  </span>
                </td>
                <td className="px-10 py-6 text-right">
                  <p className="text-slate-600 text-xs">{log.actor}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredLogs.length === 0 && (
          <div className="py-20 text-center flex flex-col items-center">
            <span className="text-4xl mb-4">📂</span>
            <p className="text-slate-300 font-black uppercase tracking-widest text-xs">No records found for this branch</p>
          </div>
        )}
      </div>
    </div>
  );
}