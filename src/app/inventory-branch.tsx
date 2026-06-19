import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Dropdown from '@/components/Dropdown';
import ScreenState from '@/components/ScreenState';
import { useApi } from '@/lib/useApi';
import { BRANCH_OPTIONS } from '@/constants/branches';

// Converted from app/inventory-branch/BranchDashboardClient.tsx — MOBILE view.
// Camera/QR scanner + photo capture are STUBBED (need expo-camera; emulator has no
// camera). Live data from GET /api/mobile/inventory-branch (same role-scoped query
// as the web page); state collapses the workflow flags into EXPECTED/READY/DONE.

type Mode = 'TRACKER' | 'PICKUP' | 'HANDOVER' | 'HISTORY';

type InventoryItem = {
  student_id: string;
  name: string;
  branch: string;
  pkg: string;
  type: 'SK' | 'EG' | 'SK + EG';
  state: 'EXPECTED' | 'READY' | 'DONE';
};

const DATE_OPTIONS = [
  { label: 'All Time', value: 'all' },
  { label: 'This Week', value: 'thisWeek' },
  { label: 'Last Week', value: 'lastWeek' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
];

const MODE_ACCENT: Record<Mode, { text: string; bg: string; border: string }> = {
  TRACKER:  { text: 'text-brand-green',  bg: 'bg-brand-green',  border: 'border-brand-green' },
  PICKUP:   { text: 'text-amber-500',    bg: 'bg-amber-500',    border: 'border-amber-200' },
  HANDOVER: { text: 'text-blue-500',     bg: 'bg-blue-500',     border: 'border-blue-200' },
  HISTORY:  { text: 'text-emerald-500',  bg: 'bg-emerald-500',  border: 'border-emerald-200' },
};

export default function InventoryBranchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeBranch, setActiveBranch] = useState('RBY');
  const [activeMode, setActiveMode] = useState<Mode>('TRACKER');
  const [quickDate, setQuickDate] = useState('all');
  const [search, setSearch] = useState('');

  // Fetch only the selected branch server-side (refetches when the branch changes).
  const { data, loading, error, reload } = useApi<{ items: InventoryItem[] }>(`/api/mobile/inventory-branch?branch=${activeBranch}`);
  // Scope to the selected branch (HQ/RM see all branches; this mirrors the web branch view).
  const branchItems = useMemo(
    () => (data?.items ?? []).filter((i) => i.branch === activeBranch),
    [data, activeBranch],
  );

  const expected = branchItems.filter((i) => i.state === 'EXPECTED').length;
  const ready = branchItems.filter((i) => i.state === 'READY').length;
  const done = branchItems.filter((i) => i.state === 'DONE').length;

  const queue = useMemo(() => {
    const wanted = activeMode === 'PICKUP' ? 'EXPECTED' : activeMode === 'HANDOVER' ? 'READY' : 'DONE';
    return branchItems.filter(
      (i) => i.state === wanted && i.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [branchItems, activeMode, search]);

  const title =
    activeMode === 'PICKUP' ? 'Receiving Terminal'
    : activeMode === 'HANDOVER' ? 'Handover Terminal'
    : activeMode === 'TRACKER' ? 'Student Tracker'
    : 'History Terminal';
  const subtitle =
    activeMode === 'PICKUP' ? 'Scan items arriving from HQ'
    : activeMode === 'HANDOVER' ? 'Scan items given to students'
    : activeMode === 'TRACKER' ? 'SK + EG workflow · view-only'
    : 'Completed handovers';

  const accent = MODE_ACCENT[activeMode];

  return (
    <SafeAreaView className="flex-1 bg-surface-appBgAlt" edges={['top']}>
      {/* HEADER */}
      <View className="px-5 py-4 gap-3 bg-white border-b border-slate-200">
        <View>
          <Text className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{title}</Text>
          <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{subtitle}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Branch</Text>
          <Dropdown value={activeBranch} options={BRANCH_OPTIONS} onChange={setActiveBranch} />
        </View>
      </View>

      <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
        {/* STAT CARDS (tap to switch mode) */}
        <View className="flex-row gap-2">
          <StatCard label="Expected" value={expected} bar="bg-amber-400" active={activeMode === 'PICKUP'} activeBorder="border-amber-400" onPress={() => setActiveMode('PICKUP')} />
          <StatCard label="Ready" value={ready} bar="bg-blue-500" active={activeMode === 'HANDOVER'} activeBorder="border-blue-500" onPress={() => setActiveMode('HANDOVER')} />
          <StatCard label="Done" value={done} bar="bg-emerald-500" active={activeMode === 'HISTORY'} activeBorder="border-emerald-500" onPress={() => setActiveMode('HISTORY')} />
        </View>

        {/* LOADING / ERROR */}
        <ScreenState loading={loading} error={error} onRetry={reload} />

        {!loading && !error && (activeMode === 'TRACKER' ? (
          <View className="bg-white rounded-[32px] border-2 border-brand-green/30 overflow-hidden">
            <View className="py-2.5 bg-brand-green">
              <Text className="text-center text-[10px] font-black uppercase tracking-[3px] text-white">Student Tracker</Text>
            </View>
            <View className="items-center justify-center p-10">
              <Text className="text-5xl mb-4">⏱️</Text>
              <Text className="text-sm font-black text-slate-800 uppercase tracking-widest mb-1">View-Only Timeline</Text>
              <Text className="text-[11px] text-slate-400 font-bold uppercase tracking-widest text-center">SK + EG workflow for {activeBranch}</Text>
            </View>
          </View>
        ) : (
          <>
            {/* SCANNER PANEL (stubbed) */}
            <View className={`bg-white rounded-[32px] border-2 ${accent.border} overflow-hidden`}>
              <View className={`py-2.5 ${accent.bg}`}>
                <Text className="text-center text-[10px] font-black uppercase tracking-[3px] text-white">
                  {activeMode === 'PICKUP' ? 'BM Receiving Mode' : activeMode === 'HANDOVER' ? 'Student Handover Mode' : 'History List Mode'}
                </Text>
              </View>
              <View className="items-center justify-center p-10">
                <Text className="text-5xl mb-4">{activeMode === 'HISTORY' ? '📋' : '🔍'}</Text>
                <Text className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">
                  {activeMode === 'HISTORY' ? 'Viewing History' : 'Scanner Disabled'}
                </Text>
                {activeMode !== 'HISTORY' && (
                  <Pressable
                    onPress={() => Alert.alert('Camera coming soon', 'QR scanning will use expo-camera — test on a real device.')}
                    className={`px-8 py-4 rounded-xl ${accent.bg}`}
                  >
                    <Text className="text-sm font-black uppercase text-white">Open QR Scanner</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* QUEUE */}
            <View className="bg-white rounded-[32px] border border-slate-200 overflow-hidden">
              <View className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex-row justify-between items-center">
                <View>
                  <Text className="text-xs font-black text-slate-800 uppercase tracking-widest">
                    {activeMode === 'HISTORY' ? 'History Log' : 'Branch Queue'}
                  </Text>
                  <Text className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                    {activeMode === 'HISTORY' ? 'Completed handovers' : 'Pending actions'}
                  </Text>
                </View>
                <View className={`px-4 py-1.5 rounded-full ${accent.bg}`}>
                  <Text className="text-[10px] font-black text-white">{queue.length} Items</Text>
                </View>
              </View>

              <View className="p-4 gap-3 border-b border-slate-100">
                <TextInput
                  placeholder="Search student..."
                  placeholderTextColor="#94a3b8"
                  value={search}
                  onChangeText={setSearch}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-xs font-bold text-slate-700"
                />
                <Dropdown value={quickDate} options={DATE_OPTIONS} onChange={setQuickDate} />
              </View>

              {queue.length === 0 ? (
                <Text className="text-center text-slate-400 text-xs font-bold py-10 uppercase tracking-widest">No students</Text>
              ) : (
                queue.map((item) => (
                  <View key={item.student_id} className="p-5 flex-row items-center justify-between border-b border-slate-50">
                    <View>
                      <Text className="font-black text-slate-900 text-sm">{item.name}</Text>
                      <View className="flex-row items-center gap-2 mt-2">
                        {item.type.includes('SK') && (
                          <View className="bg-blue-100 px-2 py-0.5 rounded"><Text className="text-[8px] font-black uppercase text-blue-600">SK</Text></View>
                        )}
                        {item.type.includes('EG') && (
                          <View className="bg-purple-100 px-2 py-0.5 rounded"><Text className="text-[8px] font-black uppercase text-purple-600">EG</Text></View>
                        )}
                        <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.pkg}</Text>
                      </View>
                    </View>
                    <View className={`px-3 py-1.5 rounded-md border ${accent.border}`}>
                      <Text className={`text-[9px] font-black uppercase tracking-widest ${accent.text}`}>
                        {activeMode === 'PICKUP' ? 'Expected' : activeMode === 'HANDOVER' ? 'Ready' : 'Done'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        ))}
      </ScrollView>

      {/* BOTTOM NAV — 5 items */}
      <View className="flex-row bg-white border-t border-slate-200" style={{ paddingBottom: insets.bottom }}>
        <TabButton icon="🏠" label="Home" active={false} color="text-slate-400" onPress={() => router.push('/home')} />
        <TabButton icon="⏱️" label="Tracker" active={activeMode === 'TRACKER'} color="text-brand-green" onPress={() => setActiveMode('TRACKER')} />
        <TabButton icon="🚚" label="Pickup" active={activeMode === 'PICKUP'} color="text-amber-500" onPress={() => setActiveMode('PICKUP')} />
        <TabButton icon="📸" label="Handover" active={activeMode === 'HANDOVER'} color="text-blue-500" onPress={() => setActiveMode('HANDOVER')} />
        <TabButton icon="✅" label="History" active={activeMode === 'HISTORY'} color="text-emerald-500" onPress={() => setActiveMode('HISTORY')} />
      </View>
    </SafeAreaView>
  );
}

function StatCard({ label, value, bar, active, activeBorder, onPress }: { label: string; value: number; bar: string; active: boolean; activeBorder: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`flex-1 bg-white p-4 rounded-2xl border shadow-sm overflow-hidden ${active ? activeBorder : 'border-slate-200'}`}>
      <View className={`absolute top-0 left-0 w-1.5 h-full ${bar}`} />
      <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</Text>
      <Text className="text-2xl font-black text-slate-900 tracking-tighter">{value}</Text>
    </Pressable>
  );
}

function TabButton({ icon, label, active, color, onPress }: { icon: string; label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 items-center justify-center py-3">
      <Text className="text-lg">{icon}</Text>
      <Text className={`text-[9px] font-black uppercase tracking-wider mt-0.5 ${active ? color : 'text-slate-400'}`}>{label}</Text>
    </Pressable>
  );
}
