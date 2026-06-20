import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AccessGate from '@/components/AccessGate';
import Dropdown from '@/components/Dropdown';
import DateFilter from '@/components/DateFilter';
import ScreenState from '@/components/ScreenState';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { BRANCH_OPTIONS } from '@/constants/branches';
import { stdRange } from '@/lib/webDates';

// Converted from app/inventory-branch/BranchDashboardClient.tsx — MOBILE view.
// Camera/QR scanner + photo capture are STUBBED (need expo-camera; emulator has no
// camera). Live data from GET /api/mobile/inventory-branch (same role-scoped query
// as the web page); state collapses the workflow flags into EXPECTED/READY/DONE.
// TRACKER mode renders the web StudentTrackerTable summary (Total Active / On-Track /
// Due Soon / Overdue / Done) + the tracked-student list, scoped to the active branch.

type Mode = 'TRACKER' | 'PICKUP' | 'HANDOVER' | 'HISTORY';

type InventoryItem = {
  student_id: string;
  name: string;
  branch: string;
  pkg: string;
  type: 'SK' | 'EG' | 'SK + EG';
  state: 'EXPECTED' | 'READY' | 'DONE' | 'NONE';
};

// Student Tracker row (same shape as /api/mobile/student-tracker, which pre-computes
// status/stage/deadline server-side with the same computeTracker() as the web).
type TrackerStatus = 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED';
type TrackerStage = 'HQ_PREP' | 'BM_PICKUP' | 'BM_HANDOVER' | 'COMPLETED';
type TrackerRow = {
  id: number;
  name: string;
  doc_no: string;
  branch: string;
  package: string;
  type: 'NEW' | 'RENEWAL' | 'TRIAL';
  hqDone: boolean;
  pickupDone: boolean;
  handoverDone: boolean;
  status: TrackerStatus;
  stage: TrackerStage;
  deadline: string;
  daysRemaining: number;
};

const STATUS_BADGE: Record<TrackerStatus, string> = {
  ON_TRACK: 'bg-emerald-100 text-emerald-700',
  DUE_SOON: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
};
const STATUS_LABEL: Record<TrackerStatus, string> = {
  ON_TRACK: 'On-Track',
  DUE_SOON: 'Due Soon',
  OVERDUE: 'Overdue',
  COMPLETED: 'Done',
};

// Filter dropdown options — same set as the web StudentTrackerTable.
const TYPE_OPTIONS = [
  { label: 'All Types', value: 'ALL' },
  { label: 'New Students', value: 'NEW' },
  { label: 'Renewal', value: 'RENEWAL' },
  { label: 'Trial', value: 'TRIAL' },
];
const STAGE_OPTIONS = [
  { label: 'All Stages', value: 'ALL' },
  { label: 'HQ Prep', value: 'HQ_PREP' },
  { label: 'BM Pickup', value: 'BM_PICKUP' },
  { label: 'BM Handover', value: 'BM_HANDOVER' },
  { label: 'Completed', value: 'COMPLETED' },
];
const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'On-Track', value: 'ON_TRACK' },
  { label: 'Due Soon', value: 'DUE_SOON' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Completed', value: 'COMPLETED' },
];

const DATE_OPTIONS = [
  { label: 'All Time', value: 'all' },
  { label: 'This Week', value: 'thisWeek' },
  { label: 'Last Week', value: 'lastWeek' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
];

// Matches the web StudentTrackerTable default preset ('lastWeek').
const TRACKER_DATE_OPTIONS = [
  { label: 'This Week', value: 'thisWeek' },
  { label: 'Last Week', value: 'lastWeek' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'All Time', value: 'all' },
  { label: 'Custom', value: 'custom' },
];

const MODE_ACCENT: Record<Mode, { text: string; bg: string; border: string }> = {
  TRACKER:  { text: 'text-brand-green',  bg: 'bg-brand-green',  border: 'border-brand-green' },
  PICKUP:   { text: 'text-amber-500',    bg: 'bg-amber-500',    border: 'border-amber-200' },
  HANDOVER: { text: 'text-blue-500',     bg: 'bg-blue-500',     border: 'border-blue-200' },
  HISTORY:  { text: 'text-emerald-500',  bg: 'bg-emerald-500',  border: 'border-emerald-200' },
};

export default function InventoryBranchScreen() {
  return (
    <AccessGate page="/inventory-branch">
      <InventoryBranchScreenInner />
    </AccessGate>
  );
}

function InventoryBranchScreenInner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  // A branch manager is pinned to their own branch (like the web); HQ/RM pick any.
  const isBM = user?.role === 'USER_BM';
  const [pickedBranch, setPickedBranch] = useState('RBY');
  const activeBranch = isBM && user?.branchCode ? user.branchCode : pickedBranch;
  const setActiveBranch = setPickedBranch;
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

  // ── Student Tracker (TRACKER mode) ──────────────────────────────────────
  // Same data + KPI summary as the web StudentTrackerTable, scoped to the branch.
  const [trackerRange, setTrackerRange] = useState(() => stdRange('lastWeek')); // web default
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus | 'ALL'>('ALL');
  const [trackerType, setTrackerType] = useState('ALL'); // 'include all types' by default
  const [trackerStage, setTrackerStage] = useState('ALL');
  const [trackerSearch, setTrackerSearch] = useState('');

  const tracker = useApi<{ rows: TrackerRow[] }>(
    `/api/mobile/student-tracker?branch=${activeBranch}&start=${trackerRange.start}&end=${trackerRange.end}`,
  );
  const trackerRows = useMemo(() => tracker.data?.rows ?? [], [tracker.data]);

  // Scope to the active branch on-device too — the web filters branchTrackerRows the same
  // way, and it keeps counts/list correct even if the server returns extra branches (the
  // un-deployed endpoint ignores ?branch). KPI counts honor search but NOT status, so the
  // numbers stay meaningful when a status card is tapped — exactly like the web's scopedRows.
  const trackerScoped = useMemo(
    () => trackerRows
      .filter((r) => r.branch === activeBranch)
      .filter((r) => trackerType === 'ALL' || r.type === trackerType)
      .filter((r) => !trackerSearch || r.name.toLowerCase().includes(trackerSearch.toLowerCase())),
    [trackerRows, activeBranch, trackerType, trackerSearch],
  );
  const trackerCounts = useMemo(() => ({
    total: trackerScoped.length,
    on_track: trackerScoped.filter((r) => r.status === 'ON_TRACK').length,
    due_soon: trackerScoped.filter((r) => r.status === 'DUE_SOON').length,
    overdue: trackerScoped.filter((r) => r.status === 'OVERDUE').length,
    completed: trackerScoped.filter((r) => r.status === 'COMPLETED').length,
  }), [trackerScoped]);
  const trackerFiltered = useMemo(
    () => trackerScoped
      .filter((r) => trackerStage === 'ALL' || r.stage === trackerStage)
      .filter((r) => trackerStatus === 'ALL' || r.status === trackerStatus),
    [trackerScoped, trackerStage, trackerStatus],
  );

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

      <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {activeMode === 'TRACKER' ? (
          <>
            {/* SUMMARY CARDS (tap to filter by status) — matches the web StudentTrackerTable */}
            <View className="flex-row flex-wrap -mx-1">
              <TrackerSummary label="Total Active" value={trackerCounts.total} accent="bg-slate-400" active={trackerStatus === 'ALL'} onPress={() => setTrackerStatus('ALL')} />
              <TrackerSummary label="On-Track" value={trackerCounts.on_track} accent="bg-emerald-500" active={trackerStatus === 'ON_TRACK'} onPress={() => setTrackerStatus(trackerStatus === 'ON_TRACK' ? 'ALL' : 'ON_TRACK')} />
              <TrackerSummary label="Due Soon" value={trackerCounts.due_soon} accent="bg-amber-500" active={trackerStatus === 'DUE_SOON'} onPress={() => setTrackerStatus(trackerStatus === 'DUE_SOON' ? 'ALL' : 'DUE_SOON')} />
              <TrackerSummary label="Overdue" value={trackerCounts.overdue} accent="bg-red-500" active={trackerStatus === 'OVERDUE'} onPress={() => setTrackerStatus(trackerStatus === 'OVERDUE' ? 'ALL' : 'OVERDUE')} />
              <TrackerSummary label="Done" value={trackerCounts.completed} accent="bg-blue-500" active={trackerStatus === 'COMPLETED'} onPress={() => setTrackerStatus(trackerStatus === 'COMPLETED' ? 'ALL' : 'COMPLETED')} />
            </View>

            {/* FILTERS */}
            <View className="bg-white rounded-2xl border border-slate-200 p-3 gap-3">
              <TextInput
                placeholder="Search student name..."
                placeholderTextColor="#94a3b8"
                value={trackerSearch}
                onChangeText={setTrackerSearch}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-700"
              />
              <View className="flex-row gap-2">
                <Dropdown value={trackerType} options={TYPE_OPTIONS} onChange={setTrackerType} />
                <Dropdown value={trackerStage} options={STAGE_OPTIONS} onChange={setTrackerStage} />
              </View>
              <View className="flex-row">
                <Dropdown value={trackerStatus} options={STATUS_OPTIONS} onChange={(v) => setTrackerStatus(v as TrackerStatus | 'ALL')} />
              </View>
              <DateFilter presets={TRACKER_DATE_OPTIONS} rangeFor={stdRange} initial="lastWeek" onChange={setTrackerRange} />
            </View>

            <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
              {trackerFiltered.length} of {trackerCounts.total} · {activeBranch}
            </Text>

            <ScreenState
              loading={tracker.loading}
              error={tracker.error}
              empty={!tracker.loading && !tracker.error && trackerScoped.length === 0}
              onRetry={tracker.reload}
              emptyText="No students to track"
            />

            {!tracker.loading && !tracker.error && trackerScoped.length > 0 && trackerFiltered.length === 0 && (
              <Text className="text-center text-slate-400 text-xs font-bold py-8 uppercase tracking-widest">No students match this filter</Text>
            )}

            {!tracker.loading && !tracker.error && trackerFiltered.map((r) => <TrackerCard key={r.id} r={r} />)}
          </>
        ) : (
          <>
            {/* STAT CARDS (tap to switch mode) */}
            <View className="flex-row gap-2">
              <StatCard label="Expected" value={expected} bar="bg-amber-400" active={activeMode === 'PICKUP'} activeBorder="border-amber-400" onPress={() => setActiveMode('PICKUP')} />
              <StatCard label="Ready" value={ready} bar="bg-blue-500" active={activeMode === 'HANDOVER'} activeBorder="border-blue-500" onPress={() => setActiveMode('HANDOVER')} />
              <StatCard label="Done" value={done} bar="bg-emerald-500" active={activeMode === 'HISTORY'} activeBorder="border-emerald-500" onPress={() => setActiveMode('HISTORY')} />
            </View>

            {/* LOADING / ERROR */}
            <ScreenState loading={loading} error={error} onRetry={reload} />

            {!loading && !error && (
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
            )}
          </>
        )}
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

function TrackerSummary({ label, value, accent, active, onPress }: { label: string; value: number; accent: string; active: boolean; onPress: () => void }) {
  return (
    <View className="w-1/3 px-1 mb-2">
      <Pressable onPress={onPress} className={`bg-white px-3 py-2.5 rounded-xl border overflow-hidden ${active ? 'border-slate-900' : 'border-slate-200'}`}>
        <View className={`absolute top-0 left-0 w-1 h-full ${accent}`} />
        <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</Text>
        <Text className="text-2xl font-black text-slate-900 tracking-tighter mt-1">{value}</Text>
      </Pressable>
    </View>
  );
}

function TrackerCard({ r }: { r: TrackerRow }) {
  return (
    <View className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-3">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 pr-2">
          <Text className="text-sm font-black text-slate-900">{r.name}</Text>
          <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{r.doc_no} · {r.branch} · {r.package}</Text>
        </View>
        <View className={`px-2.5 py-1 rounded-full ${STATUS_BADGE[r.status]}`}>
          <Text className={`text-[9px] font-black uppercase tracking-widest ${STATUS_BADGE[r.status].split(' ')[1]}`}>{STATUS_LABEL[r.status]}</Text>
        </View>
      </View>

      {/* 3 STAGES */}
      <View className="flex-row gap-2 mt-3">
        <StageBox label="HQ Prep" done={r.hqDone} current={r.stage === 'HQ_PREP'} />
        <StageBox label="BM Pickup" done={r.pickupDone} current={r.stage === 'BM_PICKUP'} />
        <StageBox label="Handover" done={r.handoverDone} current={r.stage === 'BM_HANDOVER'} />
      </View>

      {/* DEADLINE */}
      <View className="mt-3 pt-3 border-t border-slate-50">
        <Text className="text-xs font-black text-slate-800">{r.deadline}</Text>
        {r.stage !== 'COMPLETED' && (
          <Text className={`text-[9px] font-bold uppercase tracking-widest ${r.status === 'OVERDUE' ? 'text-red-500' : r.status === 'DUE_SOON' ? 'text-amber-500' : 'text-slate-400'}`}>
            {r.daysRemaining < 0 ? `${Math.abs(r.daysRemaining)}d late` : r.daysRemaining === 0 ? 'Due today' : `${r.daysRemaining}d left`}
          </Text>
        )}
      </View>
    </View>
  );
}

function StageBox({ label, done, current }: { label: string; done: boolean; current: boolean }) {
  return (
    <View className={`flex-1 rounded-xl px-2 py-2 items-center ${done ? 'bg-emerald-50' : current ? 'bg-slate-100' : 'bg-slate-50'}`}>
      <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</Text>
      <Text className={`text-[11px] font-black uppercase mt-0.5 ${done ? 'text-emerald-600' : current ? 'text-slate-700' : 'text-slate-300'}`}>
        {done ? '✓ Done' : current ? 'Pending' : '—'}
      </Text>
    </View>
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
