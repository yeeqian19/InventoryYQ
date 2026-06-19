import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Dropdown from '@/components/Dropdown';
import Donut from '@/components/Donut';
import ScreenState from '@/components/ScreenState';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/contexts/AuthContext';
import DateFilter from '@/components/DateFilter';
import { stdRange } from '@/lib/webDates';
import { BRANCHES_SORTED } from '@/constants/branches';

// In-dashboard navigation, same set + roles as the web HQ Dashboard nav.
const HQ_LINKS: { name: string; icon: string; href: string; roles: string[] }[] = [
  { name: 'Student Manager', icon: '🎓', href: '/student-manager', roles: ['SUPERADMIN', 'ADMIN_HQ'] },
  { name: 'Student Tracker', icon: '⏱️', href: '/student-tracker', roles: ['SUPERADMIN', 'ADMIN_HQ'] },
  { name: 'Scan & Approve', icon: '📷', href: '/scan-approve', roles: ['SUPERADMIN', 'ADMIN_HQ'] },
  { name: 'Scan Log', icon: '📋', href: '/scan-log', roles: ['SUPERADMIN', 'ADMIN_HQ', 'USER_RM'] },
];

// Only count rows whose branch is in the master list — same as the web dashboard
// (DashboardClient filters to valid BRANCH_MASTER_LIST codes before summing).
const VALID_BRANCH_CODES = new Set(BRANCHES_SORTED.map((b) => b.code));

// Converted from app/dashboard/DashboardClient.tsx — MOBILE view only.
// recharts -> Donut (react-native-svg) + View-based bars; <select> -> Dropdown.
// Live data from GET /api/mobile/dashboard (same query/business logic as the web page).

type InventoryItem = {
  branch: string;
  itemType: string;
  total: number;
  prepared: number;
  date: string; // YYYY-MM-DD
  studentType: string;
};

const TYPE_OPTIONS = [
  { label: 'New Students', value: 'NEW' },
  { label: 'Renewals', value: 'RENEWAL' },
  { label: 'Trials', value: 'TRIAL' },
  { label: 'All Types', value: 'All' },
];

const DATE_OPTIONS = [
  { label: 'All Time', value: 'all' },
  { label: 'This Week', value: 'thisWeek' },
  { label: 'Last Week', value: 'lastWeek' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'Custom', value: 'custom' },
];

type MobileTab = 'overview' | 'charts' | 'branches';

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const hqLinks = HQ_LINKS.filter((l) => l.roles.includes(user?.role ?? ''));
  const [mobileTab, setMobileTab] = useState<MobileTab>('overview');
  const [selectedType, setSelectedType] = useState('NEW');
  const [range, setRange] = useState(() => stdRange('lastWeek')); // matches the web Dashboard default

  const { data, loading, error, reload } = useApi<{ items: InventoryItem[] }>('/api/mobile/dashboard');
  const items = data?.items ?? [];

  const filteredData = useMemo(() => {
    let rows = items.filter((i) => VALID_BRANCH_CODES.has(i.branch));
    if (selectedType !== 'All') {
      rows = rows.filter((i) => i.studentType.toUpperCase() === selectedType.toUpperCase());
    }
    // Same client-side date filter as the web (item.date is the UTC date-part string).
    const { start, end } = range;
    if (start && end) {
      rows = rows.filter((i) => i.date >= start && i.date <= end);
    }
    return rows;
  }, [items, selectedType, range]);

  const totalItems = filteredData.reduce((s, i) => s + i.total, 0);
  const totalPrepared = filteredData.reduce((s, i) => s + i.prepared, 0);
  const totalUnprepared = Math.max(0, totalItems - totalPrepared);
  const completionRate = totalItems > 0 ? Math.round((totalPrepared / totalItems) * 100) : 0;

  const chartData = useMemo(() => {
    const grouped: Record<string, { name: string; prepared: number; unprepared: number }> = {};
    filteredData.forEach((item) => {
      if (!grouped[item.itemType]) grouped[item.itemType] = { name: item.itemType, prepared: 0, unprepared: 0 };
      grouped[item.itemType].prepared += item.prepared;
      grouped[item.itemType].unprepared += item.total - item.prepared;
    });
    return Object.values(grouped);
  }, [filteredData]);

  const branchSummary = useMemo(() => {
    const grouped: Record<string, { total: number; prepared: number }> = {};
    filteredData.forEach((item) => {
      if (!grouped[item.branch]) grouped[item.branch] = { total: 0, prepared: 0 };
      grouped[item.branch].total += item.total;
      grouped[item.branch].prepared += item.prepared;
    });
    return Object.entries(grouped)
      .map(([code, v]) => ({ code, ...v, rate: v.total > 0 ? Math.round((v.prepared / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredData]);

  const maxBar = Math.max(1, ...chartData.map((c) => c.prepared + c.unprepared));

  return (
    <SafeAreaView className="flex-1 bg-surface-appBgAlt" edges={['top']}>
      {/* STICKY HEADER */}
      <View className="px-5 py-4 gap-3 bg-white border-b border-slate-200">
        <View>
          <Text className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
            Distribution Dashboard
          </Text>
          <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Real-time inventory tracking
          </Text>
        </View>
        <View className="flex-row">
          <Dropdown value={selectedType} options={TYPE_OPTIONS} onChange={setSelectedType} />
        </View>
        <DateFilter presets={DATE_OPTIONS} rangeFor={stdRange} initial="lastWeek" onChange={setRange} />
      </View>

      {/* SCROLLABLE CONTENT */}
      <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
        {/* HQ QUICK LINKS — same destinations as the web HQ Dashboard nav */}
        {hqLinks.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-0.5"
          >
            {hqLinks.map((l) => (
              <Pressable
                key={l.href}
                onPress={() => router.push(l.href as never)}
                className="flex-row items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 active:opacity-80"
              >
                <Text className="text-base">{l.icon}</Text>
                <Text className="text-[11px] font-black text-slate-700 uppercase tracking-wide">{l.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* STAT CARDS */}
        <View className="flex-row gap-2">
          <StatCard label="Target" value={totalItems} bar="bg-slate-400" labelColor="text-slate-400" />
          <StatCard label="Prepared" value={totalPrepared} bar="bg-emerald-500" labelColor="text-emerald-500" ring />
          <StatCard label="Pending" value={totalUnprepared} bar="bg-rose-500" labelColor="text-rose-500" />
        </View>

        {/* LOADING / ERROR / EMPTY */}
        <ScreenState
          loading={loading}
          error={error}
          empty={!loading && !error && items.length === 0}
          onRetry={reload}
          emptyText="No distribution data"
        />

        {/* OVERVIEW TAB */}
        {!loading && !error && mobileTab === 'overview' && (
          <View className="bg-white rounded-[32px] border-2 border-emerald-200 overflow-hidden">
            <View className="py-2.5 bg-emerald-500">
              <Text className="text-center text-[10px] font-black uppercase tracking-[3px] text-white">HQ Overview Mode</Text>
            </View>
            <View className="items-center justify-center p-6">
              <Donut percent={completionRate} size={200}>
                <Text className="text-4xl font-black text-slate-900 tracking-tighter">{completionRate}%</Text>
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ready</Text>
              </Donut>
              <View className="flex-row gap-4 mt-4">
                <Legend color="bg-emerald-500" label="Prepared" />
                <Legend color="bg-rose-500" label="Pending" />
              </View>
            </View>
          </View>
        )}

        {/* CHARTS TAB */}
        {mobileTab === 'charts' && (
          <View className="bg-white rounded-[32px] border-2 border-blue-200 overflow-hidden">
            <View className="py-2.5 bg-blue-500">
              <Text className="text-center text-[10px] font-black uppercase tracking-[3px] text-white">Stock Distribution</Text>
            </View>
            <View className="p-5 flex-row items-end justify-around" style={{ height: 280 }}>
              {chartData.map((c) => {
                const totalH = 200;
                const prepH = (c.prepared / maxBar) * totalH;
                const unprepH = (c.unprepared / maxBar) * totalH;
                return (
                  <View key={c.name} className="items-center" style={{ width: 56 }}>
                    <View className="w-9 rounded-t-lg overflow-hidden justify-end" style={{ height: totalH }}>
                      <View className="bg-rose-500 w-full" style={{ height: unprepH }} />
                      <View className="bg-emerald-500 w-full" style={{ height: prepH }} />
                    </View>
                    <Text className="text-[9px] font-bold text-slate-400 mt-2" numberOfLines={1}>{c.name}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* BRANCHES TAB */}
        {mobileTab === 'branches' && (
          <View className="bg-white rounded-[32px] border-2 border-amber-200 overflow-hidden">
            <View className="py-2.5 bg-amber-500">
              <Text className="text-center text-[10px] font-black uppercase tracking-[3px] text-white">Branch Breakdown</Text>
            </View>
            {branchSummary.length === 0 ? (
              <Text className="text-center text-slate-400 text-xs font-bold py-10 uppercase tracking-widest">No data</Text>
            ) : (
              branchSummary.map((b) => (
                <View key={b.code} className="px-5 py-4 flex-row items-center justify-between border-b border-slate-50">
                  <View>
                    <Text className="font-black text-slate-900 text-sm">{b.code}</Text>
                    <Text className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{b.prepared} / {b.total} prepared</Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <View className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <View className="h-full bg-emerald-500 rounded-full" style={{ width: `${b.rate}%` }} />
                    </View>
                    <Text className="text-xs font-black text-slate-700 w-10 text-right">{b.rate}%</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* BOTTOM NAV */}
      <View className="flex-row bg-white border-t border-slate-200" style={{ paddingBottom: insets.bottom }}>
        <TabButton icon="🏠" label="Home" active={false} onPress={() => router.push('/home')} color="text-slate-400" />
        <TabButton icon="📊" label="Overview" active={mobileTab === 'overview'} onPress={() => setMobileTab('overview')} color="text-emerald-500" />
        <TabButton icon="📈" label="Charts" active={mobileTab === 'charts'} onPress={() => setMobileTab('charts')} color="text-blue-500" />
        <TabButton icon="📍" label="Branches" active={mobileTab === 'branches'} onPress={() => setMobileTab('branches')} color="text-amber-500" />
      </View>
    </SafeAreaView>
  );
}

function StatCard({ label, value, bar, labelColor, ring }: { label: string; value: number; bar: string; labelColor: string; ring?: boolean }) {
  return (
    <View className={`flex-1 bg-white p-4 rounded-2xl border shadow-sm overflow-hidden ${ring ? 'border-emerald-400' : 'border-slate-200'}`}>
      <View className={`absolute top-0 left-0 w-1.5 h-full ${bar}`} />
      <Text className={`text-[8px] font-black uppercase tracking-widest ${labelColor}`}>{label}</Text>
      <Text className="text-2xl font-black text-slate-900 tracking-tighter">{value}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={`w-3 h-3 rounded-full ${color}`} />
      <Text className="text-[10px] font-black text-slate-500 uppercase">{label}</Text>
    </View>
  );
}

function TabButton({ icon, label, active, onPress, color }: { icon: string; label: string; active: boolean; onPress: () => void; color: string }) {
  return (
    <Pressable onPress={onPress} className="flex-1 items-center justify-center py-3">
      <Text className="text-lg">{icon}</Text>
      <Text className={`text-[9px] font-black uppercase tracking-wider mt-0.5 ${active ? color : 'text-slate-400'}`}>{label}</Text>
    </Pressable>
  );
}
