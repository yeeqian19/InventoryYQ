'use client';

import { useState, useMemo } from 'react';

type ScanLog = {
  id: string;
  timestamp: string;
  doc_no: string | null;
  barcode: string;
  student_name: string;
  item_type: string;
  branch: string;
  action_type: string;
  processed_by: string;
};

export default function ScanLogClient({ initialLogs }: { initialLogs: ScanLog[] }) {
  const [filterBranch, setFilterBranch] = useState('All Branches');

  // Automatically figure out what branches exist in the logs to populate the dropdown
  const uniqueBranches = useMemo(() => {
    const branches = Array.from(new Set(initialLogs.map((log) => log.branch)));
    return ['All Branches', ...branches].sort();
  }, [initialLogs]);

  // Filter the table based on the selected dropdown value
  const displayedLogs = useMemo(() => {
    if (filterBranch === 'All Branches') return initialLogs;
    return initialLogs.filter((log) => log.branch === filterBranch);
  }, [initialLogs, filterBranch]);

  // Helper to color-code the action pills based on your design
  const getActionColor = (action: string) => {
    switch (action.toUpperCase()) {
      case 'PREPARED':
        return 'bg-blue-100 text-blue-600';
      case 'PICKED UP':
        return 'bg-purple-100 text-purple-600';
      case 'RECEIVED':
        return 'bg-emerald-100 text-emerald-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="max-w-7xl mx-auto bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
      
      {/* HEADER SECTION */}
      <div className="px-8 lg:px-12 py-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Scan History Log</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Master Audit Trail</p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-full px-4 py-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter Branch:</label>
          <select 
            value={filterBranch} 
            onChange={(e) => setFilterBranch(e.target.value)}
            className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
          >
            {uniqueBranches.map((branch) => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-8 lg:px-12 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Timestamp</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Doc No / Barcode</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Student / Item</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Branch</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Action Type</th>
              <th className="px-8 lg:px-12 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Processed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {displayedLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-20 text-center">
                  <span className="text-4xl block mb-4">📭</span>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No logs found</p>
                </td>
              </tr>
            ) : (
              displayedLogs.map((log) => {
                const dateObj = new Date(log.timestamp);
                return (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    {/* TIMESTAMP */}
                    <td className="px-8 lg:px-12 py-4">
                      <p className="text-sm font-black text-slate-800">{dateObj.toLocaleDateString('en-CA')}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>

                    {/* DOC NO / BARCODE */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-800">{log.doc_no || 'N/A'}</p>
                      <p className="text-xs font-bold text-blue-500 tracking-wide mt-0.5">{log.barcode}</p>
                    </td>

                    {/* STUDENT / ITEM */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-800">{log.student_name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        Type: {log.item_type}
                      </p>
                    </td>

                    {/* BRANCH */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
                        {log.branch}
                      </span>
                    </td>

                    {/* ACTION TYPE */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getActionColor(log.action_type)}`}>
                        {log.action_type}
                      </span>
                    </td>

                    {/* PROCESSED BY */}
                    <td className="px-8 lg:px-12 py-4">
                      <p className="text-xs font-bold text-slate-600">{log.processed_by}</p>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}