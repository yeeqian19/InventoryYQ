import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Dropdown from '@/components/Dropdown';
import ScreenState from '@/components/ScreenState';
import { useApi } from '@/lib/useApi';
import { stdRange } from '@/lib/webDates';

// Converted from app/scan-log/ScanLogClient.tsx — mobile. Audit-log table -> log cards.
// Live data from GET /api/mobile/scan-log (all scan_log rows, newest first).

type Log = {
  id: string;
  date: string;
  time: string;
  doc_no: string;
  barcode: string;
  student: string;
  item_type: string;
  branch: string;
  action: string; // real DB action_type values vary; rendered defensively below
  by: string;
};

const DATE_OPTIONS = [
  { label: 'All Time', value: 'all' },
  { label: 'This Week', value: 'thisWeek' },
  { label: 'Last Week', value: 'lastWeek' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
];

const ACTION_COLOR: Record<string, string> = {
  PREPARED: 'bg-blue-100 text-blue-600',
  'PICKED UP': 'bg-purple-100 text-purple-600',
  RECEIVED: 'bg-emerald-100 text-emerald-600',
};
// Real DB action_type values vary in case/wording — match the web's getActionColor:
// uppercase + fall back to slate so an unknown value never crashes the card.
function actionClasses(action: string): string {
  return ACTION_COLOR[(action ?? '').toUpperCase()] ?? 'bg-slate-100 text-slate-600';
}

export default function ScanLogScreen() {
  const [quickDate, setQuickDate] = useState('thisWeek'); // matches the web default
  const [search, setSearch] = useState('');

  // Date window computed on-device (same math as the web), applied server-side.
  const { start, end } = stdRange(quickDate);
  const { data, loading, error, reload } = useApi<{ logs: Log[] }>(`/api/mobile/scan-log?start=${start}&end=${end}`);

  const logs = useMemo(
    () => (data?.logs ?? []).filter((l) => !search || l.student.toLowerCase().includes(search.toLowerCase()) || l.branch.toLowerCase().includes(search.toLowerCase())),
    [data, search],
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView contentContainerClassName="p-4 gap-4 pb-10" showsVerticalScrollIndicator={false}>
        <View>
          <Text className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Scan History Log</Text>
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Master Audit Trail</Text>
        </View>

        {/* FILTERS */}
        <View className="bg-white rounded-2xl border border-slate-200 p-3 gap-3">
          <TextInput
            placeholder="Search student or branch..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-700"
          />
          <Dropdown value={quickDate} options={DATE_OPTIONS} onChange={setQuickDate} />
        </View>

        <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">{logs.length} logs</Text>

        {/* LOADING / ERROR */}
        <ScreenState loading={loading} error={error} onRetry={reload} />

        {/* LOG CARDS */}
        {!loading && !error && (logs.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-4xl mb-3">📭</Text>
            <Text className="text-sm font-black text-slate-400 uppercase tracking-widest">No logs found</Text>
          </View>
        ) : (
          logs.map((l) => (
            <View key={l.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-black text-slate-800">{l.student}</Text>
                  <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{l.doc_no} · Type {l.item_type}</Text>
                  <Text className="text-xs font-bold text-blue-500 mt-1">{l.barcode}</Text>
                </View>
                <View className="items-end gap-1.5">
                  <View className={`px-3 py-1 rounded-full ${actionClasses(l.action)}`}>
                    <Text className={`text-[9px] font-black uppercase tracking-widest ${actionClasses(l.action).split(' ')[1]}`}>{l.action}</Text>
                  </View>
                  <View className="bg-emerald-50 border border-emerald-100 px-3 py-0.5 rounded-full">
                    <Text className="text-[9px] font-black uppercase tracking-widest text-emerald-600">{l.branch}</Text>
                  </View>
                </View>
              </View>
              <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-slate-50">
                <Text className="text-[11px] font-bold text-slate-500">{l.date} · {l.time}</Text>
                <Text className="text-[10px] font-bold text-slate-400">{l.by}</Text>
              </View>
            </View>
          ))
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
