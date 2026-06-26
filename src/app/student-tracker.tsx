import { useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AccessGate from '@/components/AccessGate';
import Pagination from '@/components/Pagination';
import Dropdown from '@/components/Dropdown';
import DateFilter from '@/components/DateFilter';
import ScreenState from '@/components/ScreenState';
import { useApi } from '@/lib/useApi';
import { usePagedList, PAGE_SIZE_OPTIONS } from '@/lib/usePagedList';
import { stdRange } from '@/lib/webDates';

// Converted from components/StudentTrackerTable.tsx — mobile adaptation.
// Table -> student cards. computeTracker() status/deadline is computed server-side in
// GET /api/mobile/student-tracker (same logic as the web page). Extend = local modal.

type Status = 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED';
type Stage = 'HQ_PREP' | 'BM_PICKUP' | 'BM_HANDOVER' | 'COMPLETED';
type Row = {
  id: number;
  name: string;
  doc_no: string;
  branch: string;
  package: string;
  type: 'NEW' | 'RENEWAL' | 'TRIAL';
  hqDone: boolean;
  pickupDone: boolean;
  handoverDone: boolean;
  status: Status;
  stage: Stage;
  deadline: string;
  daysRemaining: number;
};

const STATUS_BADGE: Record<Status, string> = {
  ON_TRACK: 'bg-emerald-100 text-emerald-700',
  DUE_SOON: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
};
const STATUS_LABEL: Record<Status, string> = { ON_TRACK: 'On-Track', DUE_SOON: 'Due Soon', OVERDUE: 'Overdue', COMPLETED: 'Done' };
const STAGE_LABEL: Record<Stage, string> = { HQ_PREP: 'HQ Prep', BM_PICKUP: 'BM Pickup', BM_HANDOVER: 'BM Handover', COMPLETED: 'Completed' };

const TYPE_OPTIONS = [
  { label: 'All Types', value: 'ALL' },
  { label: 'New Students', value: 'NEW' },
  { label: 'Renewal', value: 'RENEWAL' },
  { label: 'Trial', value: 'TRIAL' },
];
const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'On-Track', value: 'ON_TRACK' },
  { label: 'Due Soon', value: 'DUE_SOON' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Completed', value: 'COMPLETED' },
];
const REASONS = [
  { label: 'B&W needed, sent to HQ', value: 'B&W needed, sent to HQ' },
  { label: 'Stock unavailable at HQ', value: 'Stock unavailable at HQ' },
  { label: 'Branch closed/unavailable', value: 'Branch closed/unavailable' },
  { label: 'Student requested delay', value: 'Student requested delay' },
];
const DATE_OPTIONS = [
  { label: 'This Week', value: 'thisWeek' },
  { label: 'Last Week', value: 'lastWeek' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'All Time', value: 'all' },
  { label: 'Custom', value: 'custom' },
];

export default function StudentTrackerScreen() {
  return (
    <AccessGate page="/student-tracker">
      <StudentTrackerScreenInner />
    </AccessGate>
  );
}

function StudentTrackerScreenInner() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<Status | 'ALL'>('ALL');
  const router = useRouter();
  const [range, setRange] = useState(() => stdRange('lastWeek')); // matches the web tracker default
  const [extendRow, setExtendRow] = useState<Row | null>(null);
  const [extendDays, setExtendDays] = useState('7');
  const [reason, setReason] = useState('');

  const { data, loading, error, reload } = useApi<{ rows: Row[] }>(`/api/mobile/student-tracker?start=${range.start}&end=${range.end}`);
  const rows = useMemo(() => data?.rows ?? [], [data]);

  // KPI cards are scoped to search + type (NOT status), exactly like the web's
  // scopedRows — so the counts move with search/type but stay stable when you tap a card.
  const scopedRows = useMemo(() => rows.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
    return true;
  }), [rows, search, typeFilter]);

  const counts = useMemo(() => ({
    total: scopedRows.length,
    on_track: scopedRows.filter((r) => r.status === 'ON_TRACK').length,
    due_soon: scopedRows.filter((r) => r.status === 'DUE_SOON').length,
    overdue: scopedRows.filter((r) => r.status === 'OVERDUE').length,
    completed: scopedRows.filter((r) => r.status === 'COMPLETED').length,
  }), [scopedRows]);

  const filtered = useMemo(
    () => scopedRows.filter((r) => statusFilter === 'ALL' || r.status === statusFilter),
    [scopedRows, statusFilter],
  );

  // Display pagination (default 50 + dropdown + load-more), reset when filters change.
  const { shown, page, setPage, totalPages, pageSize, setPageSize, total, rangeStart, rangeEnd } = usePagedList(
    filtered,
    `${search}|${typeFilter}|${statusFilter}|${range.start}|${range.end}`,
  );
  const listRef = useRef<FlatList<Row>>(null);
  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages));
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const renderRow = ({ item: r }: { item: Row }) => (
    <View className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-4">
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

      {/* DEADLINE + EXTEND */}
      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-slate-50">
        <View>
          <Text className="text-xs font-black text-slate-800">{r.deadline}</Text>
          {r.stage !== 'COMPLETED' && (
            <Text className={`text-[9px] font-bold uppercase tracking-widest ${r.status === 'OVERDUE' ? 'text-red-500' : r.status === 'DUE_SOON' ? 'text-amber-500' : 'text-slate-400'}`}>
              {r.daysRemaining < 0 ? `${Math.abs(r.daysRemaining)}d late` : r.daysRemaining === 0 ? 'Due today' : `${r.daysRemaining}d left`}
            </Text>
          )}
        </View>
        {r.stage !== 'COMPLETED' && (
          <Pressable onPress={() => { setExtendRow(r); setExtendDays('7'); setReason(''); }} className="bg-emerald-500 px-4 py-2 rounded-lg active:scale-95">
            <Text className="text-white text-[10px] font-black uppercase tracking-widest">Extend</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <FlatList
        ref={listRef}
        data={!loading && !error ? shown : []}
        keyExtractor={(r) => String(r.id)}
        renderItem={renderRow}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="p-4 pb-10"
        removeClippedSubviews
        initialNumToRender={10}
        windowSize={11}
        ListHeaderComponent={
          <View className="gap-4 mb-4">
            <View className="flex-row items-start justify-between">
              <View>
                <Text className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Student Tracker</Text>
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">10d HQ Prep → 8d Pickup → 6d Handover</Text>
              </View>
              <Pressable onPress={() => (router.canGoBack() ? router.back() : router.push('/dashboard'))} className="bg-white px-4 py-2 rounded-xl border border-slate-200">
                <Text className="text-[10px] font-black uppercase tracking-widest text-slate-600">← Back</Text>
              </Pressable>
            </View>

            {/* SUMMARY CARDS (tap to filter) */}
            <View className="flex-row flex-wrap -mx-1">
              <Summary label="Total" value={counts.total} accent="bg-slate-400" active={statusFilter === 'ALL'} onPress={() => setStatusFilter('ALL')} />
              <Summary label="On-Track" value={counts.on_track} accent="bg-emerald-500" active={statusFilter === 'ON_TRACK'} onPress={() => setStatusFilter(statusFilter === 'ON_TRACK' ? 'ALL' : 'ON_TRACK')} />
              <Summary label="Due Soon" value={counts.due_soon} accent="bg-amber-500" active={statusFilter === 'DUE_SOON'} onPress={() => setStatusFilter(statusFilter === 'DUE_SOON' ? 'ALL' : 'DUE_SOON')} />
              <Summary label="Overdue" value={counts.overdue} accent="bg-red-500" active={statusFilter === 'OVERDUE'} onPress={() => setStatusFilter(statusFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE')} />
              <Summary label="Done" value={counts.completed} accent="bg-blue-500" active={statusFilter === 'COMPLETED'} onPress={() => setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')} />
            </View>

            {/* FILTERS */}
            <View className="bg-white rounded-2xl border border-slate-200 p-3 gap-3">
              <TextInput
                placeholder="Search student name..."
                placeholderTextColor="#94a3b8"
                value={search}
                onChangeText={setSearch}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-700"
              />
              <View className="flex-row gap-2">
                <Dropdown value={typeFilter} options={TYPE_OPTIONS} onChange={setTypeFilter} />
                <Dropdown value={statusFilter} options={STATUS_OPTIONS} onChange={(v) => setStatusFilter(v as Status | 'ALL')} />
              </View>
              <DateFilter presets={DATE_OPTIONS} rangeFor={stdRange} initial="lastWeek" onChange={setRange} />
              <View className="flex-row">
                <Dropdown value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={setPageSize} />
              </View>
            </View>

            <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">{rangeStart}–{rangeEnd} of {total} (filtered from {counts.total})</Text>

            {/* LOADING / ERROR / EMPTY */}
            <ScreenState
              loading={loading}
              error={error}
              empty={!loading && !error && rows.length === 0}
              onRetry={reload}
              emptyText="No students to track"
            />
          </View>
        }
        ListFooterComponent={<Pagination page={page} totalPages={totalPages} onChange={goToPage} />}
      />

      {/* EXTEND MODAL */}
      <Modal visible={!!extendRow} transparent animationType="fade" onRequestClose={() => setExtendRow(null)}>
        <Pressable className="flex-1 bg-black/50 justify-center px-6" onPress={() => setExtendRow(null)}>
          <Pressable className="bg-white rounded-2xl p-6" onPress={() => {}}>
            <Text className="text-lg font-black text-slate-900 uppercase tracking-tighter">Extend Deadline</Text>
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{extendRow?.name} · {extendRow?.branch}</Text>
            <View className="mt-5 gap-3">
              <View>
                <Text className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Days to add</Text>
                <TextInput value={extendDays} onChangeText={setExtendDays} keyboardType="number-pad" className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-black text-slate-800" />
              </View>
              <View>
                <Text className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Reason</Text>
                <Dropdown value={reason} options={[{ label: '— Select a reason —', value: '' }, ...REASONS]} onChange={setReason} />
              </View>
            </View>
            <View className="flex-row gap-2 justify-end mt-6">
              <Pressable onPress={() => setExtendRow(null)} className="px-4 py-2.5 rounded-lg bg-slate-100">
                <Text className="text-[10px] font-black uppercase tracking-widest text-slate-700">Cancel</Text>
              </Pressable>
              <Pressable onPress={() => setExtendRow(null)} className="px-4 py-2.5 rounded-lg bg-emerald-500">
                <Text className="text-[10px] font-black uppercase tracking-widest text-white">Extend +{extendDays || 0}d</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Summary({ label, value, accent, active, onPress }: { label: string; value: number; accent: string; active: boolean; onPress: () => void }) {
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
