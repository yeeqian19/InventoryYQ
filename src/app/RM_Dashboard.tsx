import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AccessGate from '@/components/AccessGate';
import Dropdown from '@/components/Dropdown';
import ScreenState from '@/components/ScreenState';
import { useApi } from '@/lib/useApi';
import DateFilter from '@/components/DateFilter';
import { rmRange, klDayStart, klDayEnd } from '@/lib/webDates';
import { BRANCHES_SORTED } from '@/constants/branches';

// Converted from app/RM_Dashboard/RM_DashboardClient.tsx — mobile adaptation.
// Desktop table -> expandable branch list. recharts -> View bars.
// Live data from GET /api/mobile/rm-dashboard (same query/logic as the web page).

type Student = {
  id: string;
  name: string;
  branch: string;
  pkg: string;
  type: 'NEW' | 'RENEWAL' | 'TRIAL';
  sk_prep: boolean;
  eg_prep: boolean;
  bm_pickup: boolean;
  student_received: boolean;
  hasSK: boolean;
  hasEG: boolean;
  created_at: string | null;
};

const ITEM_PILLS = ['ALL', 'SK', 'EG'];
const DATE_OPTIONS = [
  { label: 'This Month', value: 'this-month' },
  { label: 'Last Month', value: 'last-month' },
  { label: 'This Week', value: 'this-week' },
  { label: 'Last Week', value: 'last-week' },
  { label: 'All Time', value: 'all' },
  { label: 'Custom', value: 'custom' },
];

type Stage = 'not_prepared' | 'prepared' | 'bm_pickup' | 'received';
function stageOf(s: Student): Stage {
  return s.student_received ? 'received' : s.bm_pickup ? 'bm_pickup' : s.sk_prep ? 'prepared' : 'not_prepared';
}
const STAGE_COLOR: Record<Stage, string> = {
  not_prepared: '#fb7185',
  prepared: '#10b981',
  bm_pickup: '#3b82f6',
  received: '#a855f7',
};
const STAGE_LABEL: Record<Stage, string> = {
  not_prepared: 'Not Prepared',
  prepared: 'Prepared',
  bm_pickup: 'Picked Up',
  received: 'Received',
};

export default function RMDashboardScreen() {
  return (
    <AccessGate page="/RM_Dashboard">
      <RMDashboardScreenInner />
    </AccessGate>
  );
}

function RMDashboardScreenInner() {
  const router = useRouter();
  const [itemToggle, setItemToggle] = useState('ALL'); // ALL | SK | EG
  const [activeType, setActiveType] = useState('NEW'); // matches the web default
  const [range, setRange] = useState(() => rmRange('this-month'));
  const [studentSearch, setStudentSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, loading, error, reload } = useApi<{ students: Student[] }>('/api/mobile/rm-dashboard');

  // Replicates web RM_DashboardClient.tsx branchStats exactly (type/date/search filter,
  // then per-branch SK/EG-toggle displayedList + prepared/pickup/received counting).
  const branchStats = useMemo(() => {
    let filtered = data?.students ?? [];

    if (activeType !== 'ALL') {
      filtered = filtered.filter((s) => s.type?.toUpperCase() === activeType.toUpperCase());
    }

    // Date filter on created_at — KL day bounds so it matches the web regardless of device TZ.
    const { start, end } = range;
    if (start || end) {
      const dStart = start ? klDayStart(start) : null;
      const dEnd = end ? klDayEnd(end) : null;
      filtered = filtered.filter((s) => {
        const d = s.created_at ? new Date(s.created_at) : null;
        return !!d && (!dStart || d >= dStart) && (!dEnd || d <= dEnd);
      });
    }

    if (studentSearch) {
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(studentSearch.toLowerCase()));
    }

    return BRANCHES_SORTED.map((branch) => {
      const students = filtered.filter((s) => s.branch === branch.code);

      // SK/EG toggle decides which students count (ALL = has either).
      const displayedList = students.filter((s) => {
        if (itemToggle === 'SK') return s.hasSK;
        if (itemToggle === 'EG') return s.hasEG;
        return s.hasSK || s.hasEG;
      });

      const prep = displayedList.filter((s) => {
        const isPrepared =
          itemToggle === 'EG'
            ? s.eg_prep
            : itemToggle === 'SK'
              ? s.sk_prep
              : (s.hasSK ? s.sk_prep : true) && (s.hasEG ? s.eg_prep : true);
        return isPrepared && !s.bm_pickup;
      }).length;

      return {
        code: branch.code,
        name: branch.name,
        list: displayedList,
        total: displayedList.length,
        prep,
        pickup: displayedList.filter((s) => s.bm_pickup && !s.student_received).length,
        received: displayedList.filter((s) => s.student_received).length,
      };
    });
  }, [data, activeType, itemToggle, studentSearch, range]);

  const totalUnits = branchStats.reduce((a, b) => a + b.total, 0);
  const totalPrep = branchStats.reduce((a, b) => a + b.prep, 0);
  const totalPickup = branchStats.reduce((a, b) => a + b.pickup, 0);
  const totalReceived = branchStats.reduce((a, b) => a + b.received, 0);

  const bars = [
    { label: 'Prep', done: totalPrep },
    { label: 'Pickup', done: totalPickup },
    { label: 'Final', done: totalReceived },
  ];
  const maxBar = Math.max(1, totalUnits);

  return (
    <SafeAreaView className="flex-1 bg-surface-appBg" edges={['top']}>
      <ScrollView contentContainerClassName="p-4 gap-4 pb-10" showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">RM Dashboard</Text>
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-[3px] mt-1">Region A · B · C</Text>
          </View>
          <Pressable onPress={() => router.push('/home')} className="bg-white px-4 py-2 rounded-xl border border-slate-200">
            <Text className="text-[10px] font-black uppercase tracking-widest text-slate-600">← Home</Text>
          </Pressable>
        </View>

        {/* ITEM TOGGLE (dark) */}
        <View className="flex-row bg-slate-900 p-1 rounded-2xl self-start">
          {ITEM_PILLS.map((p) => (
            <Pressable key={p} onPress={() => setItemToggle(p)} className={`px-4 py-2 rounded-xl ${itemToggle === p ? 'bg-emerald-500' : ''}`}>
              <Text className={`text-[10px] font-black ${itemToggle === p ? 'text-white' : 'text-slate-500'}`}>{p}</Text>
            </Pressable>
          ))}
        </View>

        {/* TYPE PILLS + DATE */}
        <View className="flex-row gap-2">
          <View className="flex-row bg-slate-200 p-1 rounded-xl flex-1">
            {(['ALL', 'NEW', 'RENEWAL', 'TRIAL'] as const).map((t) => (
              <Pressable key={t} onPress={() => setActiveType(t)} className={`flex-1 py-2 rounded-lg ${activeType === t ? 'bg-blue-600' : ''}`}>
                <Text className={`text-[9px] font-black text-center ${activeType === t ? 'text-white' : 'text-slate-500'}`}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <DateFilter presets={DATE_OPTIONS} rangeFor={rmRange} initial="this-month" onChange={setRange} />

        {/* STAT CARDS — 2x2 */}
        <View className="flex-row flex-wrap -mx-1">
          <StatCard label="Total Units" value={totalUnits} color="text-slate-700" />
          <StatCard label="Prepared" value={totalPrep} color="text-emerald-600" />
          <StatCard label="BM Pickup" value={totalPickup} color="text-blue-600" />
          <StatCard label="Received" value={totalReceived} color="text-purple-600" />
        </View>

        {/* BAR CHART */}
        <View className="bg-white rounded-[32px] border border-slate-100 p-5 shadow-sm">
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Progress Funnel</Text>
          <View className="flex-row items-end justify-around" style={{ height: 180 }}>
            {bars.map((b) => {
              const h = 150;
              const doneH = (b.done / maxBar) * h;
              const remH = h - doneH;
              return (
                <View key={b.label} className="items-center" style={{ width: 70 }}>
                  <View className="w-12 rounded-t-xl overflow-hidden justify-end" style={{ height: h }}>
                    <View className="w-full" style={{ height: remH, backgroundColor: '#fb7185', opacity: 0.8 }} />
                    <View className="w-full" style={{ height: doneH, backgroundColor: '#10b981' }} />
                  </View>
                  <Text className="text-[11px] font-black text-slate-400 mt-2 uppercase">{b.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* STUDENT SEARCH */}
        <TextInput
          placeholder="Find student..."
          placeholderTextColor="#94a3b8"
          value={studentSearch}
          onChangeText={setStudentSearch}
          className="bg-white border-2 border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700"
        />

        {/* LOADING / ERROR */}
        <ScreenState
          loading={loading}
          error={error}
          empty={!loading && !error && (data?.students?.length ?? 0) === 0}
          onRetry={reload}
          emptyText="No student records"
        />

        {/* BRANCH LIST (expandable) */}
        {!loading && !error && (
        <View className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
          {branchStats.map((row) => (
            <View key={row.code} className="border-b border-slate-50">
              <Pressable onPress={() => setExpanded(expanded === row.code ? null : row.code)} className="px-5 py-4 flex-row items-center justify-between active:bg-slate-50">
                <View>
                  <Text className="text-xl font-black italic uppercase tracking-tighter text-slate-900">{row.code}</Text>
                  <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{row.name}</Text>
                </View>
                <View className="flex-row gap-3 items-center">
                  <Text className="text-emerald-600 font-black text-xs">{row.prep}/{row.total}</Text>
                  <Text className="text-blue-600 font-black text-xs">{row.pickup}/{row.total}</Text>
                  <Text className="text-purple-600 font-black text-xs">{row.received}/{row.total}</Text>
                  <Text className="text-slate-300 text-xs">{expanded === row.code ? '▲' : '▼'}</Text>
                </View>
              </Pressable>
              {expanded === row.code && (
                <View className="bg-slate-50 px-4 py-4 gap-2">
                  {row.list.length === 0 ? (
                    <Text className="text-center text-slate-400 font-bold text-sm italic py-4">No data.</Text>
                  ) : (
                    row.list.map((s) => {
                      const st = stageOf(s);
                      return (
                      <View key={s.id} className="bg-white p-4 rounded-2xl border-l-8 border border-slate-100" style={{ borderLeftColor: STAGE_COLOR[st] }}>
                        <Text className="text-[12px] font-black text-slate-700 uppercase tracking-tighter">{s.name}</Text>
                        <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">{s.pkg}</Text>
                        <Text className="text-[8px] font-black uppercase tracking-widest mt-1" style={{ color: STAGE_COLOR[st] }}>{STAGE_LABEL[st]}</Text>
                      </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          ))}
        </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View className="w-1/2 px-1 mb-2">
      <View className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm">
        <Text className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</Text>
        <Text className={`text-4xl font-black italic tracking-tighter ${color}`}>{value}</Text>
      </View>
    </View>
  );
}
