import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import Barcode from '@kichiyaki/react-native-barcode-generator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AccessGate from '@/components/AccessGate';
import Pagination from '@/components/Pagination';
import QrCode from '@/components/QrCode';
import Dropdown from '@/components/Dropdown';
import DateFilter from '@/components/DateFilter';
import ScreenState from '@/components/ScreenState';
import { useApi } from '@/lib/useApi';
import { usePagedList, PAGE_SIZE_OPTIONS } from '@/lib/usePagedList';
import { stdRange } from '@/lib/webDates';
import { BRANCH_OPTIONS } from '@/constants/branches';

// Branch filter options ('' = All Branches), same set as the web BranchMultiSelect.
const BRANCH_FILTER_OPTIONS = [{ label: 'All Branches', value: '' }, ...BRANCH_OPTIONS];

// Converted from app/student-manager/StudentManagerClient.tsx — mobile adaptation.
// Table -> student cards. Each card renders a real Code128 barcode + scannable QR of
// the active SK/EG code (matches the web react-barcode + QRCodeSVG). Live data from
// GET /api/mobile/students (same query as the web page).

type Stage = { sk_prep?: string; eg_prep?: string; bm_pickup?: string; received?: string };
type Student = {
  id: string;
  name: string;
  doc_no: string;
  branch: string;
  date: string;
  type: 'NEW' | 'RENEWAL' | 'TRIAL';
  package: string;
  skBarcode: string;
  egBarcode: string;
  stages: Stage;
};

const TYPE_OPTIONS = [
  { label: 'New Students', value: 'New' },
  { label: 'All Types', value: 'All' },
  { label: 'Renewals', value: 'Renewal' },
  { label: 'Trials', value: 'Trial' },
];
const DATE_OPTIONS = [
  { label: 'All Time', value: 'all' },
  { label: 'This Week', value: 'thisWeek' },
  { label: 'Last Week', value: 'lastWeek' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'Custom', value: 'custom' },
];

// Mirror the web getSafeBarcodeValue: normalize quotes, strip non-printable ASCII,
// cap at 25 chars, fall back to a placeholder so CODE128 never fails to encode.
function getSafeBarcodeValue(code: string | undefined) {
  if (!code || code === 'N/A' || code.trim() === '') return '000000';
  let s = code.replace(/['`’]/g, "'").replace(/[“”]/g, '');
  s = s.replace(/[^\x20-\x7E]/g, '');
  return s.length > 25 ? s.substring(0, 25).trim() : s;
}

function packageColor(pkg: string) {
  if (pkg.includes('12M')) return 'bg-purple-100 text-purple-700';
  if (pkg.includes('9M')) return 'bg-blue-100 text-blue-700';
  if (pkg.includes('6M')) return 'bg-emerald-100 text-emerald-700';
  if (pkg.includes('3M')) return 'bg-orange-100 text-orange-700';
  return 'bg-slate-100 text-slate-600';
}

const PILL_TONE: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function StudentManagerScreen() {
  return (
    <AccessGate page="/student-manager">
      <StudentManagerScreenInner />
    </AccessGate>
  );
}

function StudentManagerScreenInner() {
  const router = useRouter();
  const [activeSystem, setActiveSystem] = useState<'SK' | 'EG'>('SK');
  const [search, setSearch] = useState('');
  // Defaults mirror the web Student Manager (New students, This Week) so the
  // mobile view matches the site and only fetches that window server-side.
  const [typeFilter, setTypeFilter] = useState('New');
  const [branch, setBranch] = useState(''); // '' = All Branches (same as web default)
  const [range, setRange] = useState(() => stdRange('thisWeek'));
  const [selected, setSelected] = useState<string[]>([]);

  // Date window (preset or custom) computed on-device, applied server-side.
  const { data, loading, error, reload } = useApi<{ students: Student[] }>(`/api/mobile/students?start=${range.start}&end=${range.end}`);

  const students = useMemo(() => {
    let list = data?.students ?? [];
    // Sibling-split, same as web processedInitialData: "Ali & Sara" -> two rows.
    list = list.flatMap((s) => {
      const siblings = s.name.split(/&|,|\band\b/i).map((x) => x.trim()).filter((x) => x.length > 0);
      if (siblings.length > 1) {
        return siblings.map((nm, i) => ({ ...s, id: `${s.id}-${i}`, name: nm }));
      }
      return [s];
    });
    // Active-system barcode filter, same as web: drop rows whose SK/EG barcode is missing/N/A.
    list = list.filter((s) => {
      const code = activeSystem === 'SK' ? s.skBarcode : s.egBarcode;
      return !!code && code !== 'N/A' && code.trim() !== '';
    });
    if (branch) list = list.filter((s) => s.branch === branch);
    if (search) list = list.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
    if (typeFilter !== 'All') list = list.filter((s) => s.type.toLowerCase() === typeFilter.toLowerCase());
    return list;
  }, [data, search, typeFilter, activeSystem, branch]);

  // Display pagination (default 50 + dropdown + load-more), reset when filters change.
  const { shown, page, setPage, totalPages, pageSize, setPageSize, total, rangeStart, rangeEnd } = usePagedList(
    students,
    `${search}|${typeFilter}|${branch}|${range.start}|${range.end}|${activeSystem}`,
  );
  const listRef = useRef<FlatList<Student>>(null);
  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages));
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const renderStudent = ({ item: s }: { item: Student }) => {
    const code = activeSystem === 'SK' ? s.skBarcode : s.egBarcode;
    const isSel = selected.includes(s.id);
    return (
      <Pressable onPress={() => toggle(s.id)} className={`bg-white rounded-[28px] border-2 p-5 mb-4 ${isSel ? 'border-blue-400' : 'border-slate-100'}`}>
        <View className="flex-row justify-between items-start">
          <View className="flex-1 pr-3">
            <Text className="font-black text-slate-900 text-base leading-tight">{s.name}</Text>
            <Text className="text-[10px] text-slate-400 font-bold mt-0.5">{s.doc_no} · {s.date}</Text>
            <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
              {s.type === 'NEW' ? 'New' : s.type === 'RENEWAL' ? 'Renewal' : 'Trial'}
            </Text>
          </View>
          <View className="items-end gap-2">
            <View className={`px-3 py-1 rounded-full ${packageColor(s.package)}`}>
              <Text className={`text-[10px] font-black uppercase tracking-widest ${packageColor(s.package).split(' ')[1]}`}>{s.package}</Text>
            </View>
            <Text className="text-xs font-black text-emerald-600">{s.branch}</Text>
          </View>
        </View>

        {/* STAGE PILLS */}
        {(s.stages.sk_prep || s.stages.eg_prep || s.stages.bm_pickup || s.stages.received) && (
          <View className="flex-row flex-wrap gap-1.5 mt-3">
            {s.stages.sk_prep && <StagePill label={`SK Prep ${s.stages.sk_prep}`} tone="blue" />}
            {s.stages.eg_prep && <StagePill label={`EG Prep ${s.stages.eg_prep}`} tone="purple" />}
            {s.stages.bm_pickup && <StagePill label={`Pickup ${s.stages.bm_pickup}`} tone="amber" />}
            {s.stages.received && <StagePill label={`Received ${s.stages.received}`} tone="emerald" />}
          </View>
        )}

        {/* CODE + QR placeholder */}
        <View className="flex-row items-center justify-between mt-4 pt-3 border-t border-slate-50">
          <View className="flex-1">
            <Barcode
              value={getSafeBarcodeValue(code)}
              format="CODE128"
              maxWidth={220}
              height={36}
              lineColor="#0f172a"
              background="#ffffff"
            />
            <Text className="text-[9px] font-mono font-bold text-slate-500 uppercase mt-1">{code}</Text>
          </View>
          {code ? (
            <View className="ml-3 bg-white border border-slate-200 rounded-lg p-1.5">
              {/* Byte-identical to the web QRCodeSVG (vendored qrcode.react encoder) */}
              <QrCode value={code} size={44} />
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-appBg" edges={['top']}>
      <FlatList
        ref={listRef}
        data={!loading && !error ? shown : []}
        keyExtractor={(s) => s.id}
        renderItem={renderStudent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="p-4 pb-10"
        removeClippedSubviews
        initialNumToRender={10}
        windowSize={11}
        ListHeaderComponent={
          <View className="gap-4 mb-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">Student Manager</Text>
              <Pressable onPress={() => (router.canGoBack() ? router.back() : router.push('/dashboard'))} className="bg-white px-4 py-2 rounded-xl border border-slate-200">
                <Text className="text-[10px] font-black uppercase tracking-widest text-slate-600">← Back</Text>
              </Pressable>
            </View>

            {/* FILTERS */}
            <View className="bg-white rounded-[28px] border border-slate-100 p-4 gap-3 shadow-sm">
              <TextInput
                placeholder="Search name..."
                placeholderTextColor="#94a3b8"
                value={search}
                onChangeText={setSearch}
                className="bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700"
              />
              <View className="flex-row">
                <Dropdown value={typeFilter} options={TYPE_OPTIONS} onChange={setTypeFilter} />
              </View>
              <View className="flex-row">
                <Dropdown value={branch} options={BRANCH_FILTER_OPTIONS} onChange={setBranch} />
              </View>
              <DateFilter presets={DATE_OPTIONS} rangeFor={stdRange} initial="thisWeek" onChange={setRange} />
              <View className="flex-row">
                <Dropdown value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={setPageSize} />
              </View>
              {/* SK/EG system toggle */}
              <View className="flex-row bg-slate-200/60 p-1.5 rounded-2xl self-start">
                <Pressable onPress={() => { setActiveSystem('SK'); setSelected([]); }} className={`px-6 py-2 rounded-xl ${activeSystem === 'SK' ? 'bg-white' : ''}`}>
                  <Text className={`text-[10px] font-black ${activeSystem === 'SK' ? 'text-blue-600' : 'text-slate-400'}`}>SK SYSTEM</Text>
                </Pressable>
                <Pressable onPress={() => { setActiveSystem('EG'); setSelected([]); }} className={`px-6 py-2 rounded-xl ${activeSystem === 'EG' ? 'bg-white' : ''}`}>
                  <Text className={`text-[10px] font-black ${activeSystem === 'EG' ? 'text-purple-600' : 'text-slate-400'}`}>EG SYSTEM</Text>
                </Pressable>
              </View>
            </View>

            {/* SELECTION BAR */}
            <View className="flex-row items-center justify-between px-1">
              <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{rangeStart}–{rangeEnd} of {total} Students</Text>
              {selected.length > 0 && (
                <Text className="text-[11px] font-black text-blue-600 uppercase tracking-widest">{selected.length} selected</Text>
              )}
            </View>

            {/* LOADING / ERROR / EMPTY */}
            <ScreenState
              loading={loading}
              error={error}
              empty={!loading && !error && students.length === 0}
              onRetry={reload}
              emptyText="No students found"
            />
          </View>
        }
        ListFooterComponent={
          !loading && !error && students.length > 0 ? (
            <View className="gap-3">
              <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
              <View className="bg-emerald-50 rounded-2xl p-3">
                <Text className="text-[10px] font-bold text-emerald-700 text-center">
                  Each card shows the {activeSystem} barcode + a scannable QR. Bulk Print Labels remains a desktop feature.
                </Text>
              </View>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function StagePill({ label, tone }: { label: string; tone: 'blue' | 'purple' | 'amber' | 'emerald' }) {
  return (
    <View className={`px-2 py-0.5 rounded-md border ${PILL_TONE[tone]}`}>
      <Text className={`text-[9px] font-black uppercase tracking-widest ${PILL_TONE[tone].split(' ')[1]}`}>✓ {label}</Text>
    </View>
  );
}
