import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Dropdown from '@/components/Dropdown';
import ScreenState from '@/components/ScreenState';
import { useApi } from '@/lib/useApi';
import { stdRange } from '@/lib/webDates';

// Converted from app/student-manager/StudentManagerClient.tsx — mobile adaptation.
// Table -> student cards. Barcode/QR are placeholders (real codes are for the web-only
// Print Labels flow). Live data from GET /api/mobile/students (same query as the web page).

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
];

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
  const [activeSystem, setActiveSystem] = useState<'SK' | 'EG'>('SK');
  const [search, setSearch] = useState('');
  // Defaults mirror the web Student Manager (New students, This Week) so the
  // mobile view matches the site and only fetches that window server-side.
  const [typeFilter, setTypeFilter] = useState('New');
  const [quickDate, setQuickDate] = useState('thisWeek');
  const [selected, setSelected] = useState<string[]>([]);

  // Date window computed on-device (same math as the web), applied server-side.
  const { start, end } = stdRange(quickDate);
  const { data, loading, error, reload } = useApi<{ students: Student[] }>(`/api/mobile/students?start=${start}&end=${end}`);

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
    if (search) list = list.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
    if (typeFilter !== 'All') list = list.filter((s) => s.type.toLowerCase() === typeFilter.toLowerCase());
    return list;
  }, [data, search, typeFilter, activeSystem]);

  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <SafeAreaView className="flex-1 bg-surface-appBg" edges={['top']}>
      <ScrollView contentContainerClassName="p-4 gap-4 pb-10" showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">Student Manager</Text>

        {/* FILTERS */}
        <View className="bg-white rounded-[28px] border border-slate-100 p-4 gap-3 shadow-sm">
          <TextInput
            placeholder="Search name..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            className="bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700"
          />
          <View className="flex-row gap-2">
            <Dropdown value={typeFilter} options={TYPE_OPTIONS} onChange={setTypeFilter} />
            <Dropdown value={quickDate} options={DATE_OPTIONS} onChange={setQuickDate} />
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
          <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{students.length} Students</Text>
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

        {/* STUDENT CARDS */}
        {!loading && !error && students.map((s) => {
          const code = activeSystem === 'SK' ? s.skBarcode : s.egBarcode;
          const isSel = selected.includes(s.id);
          return (
            <Pressable key={s.id} onPress={() => toggle(s.id)} className={`bg-white rounded-[28px] border-2 p-5 ${isSel ? 'border-blue-400' : 'border-slate-100'}`}>
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
                  {/* Decorative barcode stripes */}
                  <View className="flex-row h-8 items-stretch gap-px">
                    {Array.from({ length: 28 }).map((_, i) => (
                      <View key={i} className="bg-slate-800" style={{ width: i % 3 === 0 ? 3 : 1 }} />
                    ))}
                  </View>
                  <Text className="text-[9px] font-mono font-bold text-slate-500 uppercase mt-1">{code}</Text>
                </View>
                <View className="w-12 h-12 ml-3 border border-slate-200 rounded-lg items-center justify-center">
                  <Text className="text-[7px] font-black text-slate-300">QR</Text>
                </View>
              </View>
            </Pressable>
          );
        })}

        <View className="bg-emerald-50 rounded-2xl p-3">
          <Text className="text-[10px] font-bold text-emerald-700 text-center">
            Print Labels is a desktop feature — barcode/QR generation comes later (react-native-qrcode-svg).
          </Text>
        </View>
      </ScrollView>
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
