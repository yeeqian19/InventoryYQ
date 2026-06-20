import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AccessGate from '@/components/AccessGate';
import ScreenState from '@/components/ScreenState';
import { useApi } from '@/lib/useApi';

// Converted from app/stock-management/StockClient.tsx — mobile adaptation.
// Wide procurement table -> item cards. Pack Kits works locally. Inline per-row
// qty actions (adjust/checkout/receive) deferred — edit them later via a modal.
// Live data from GET /api/mobile/stock (inventory items + StarterKit counts).

type Category = 'SK_ITEM' | 'INDIVIDUAL' | 'MARKETING';
type StockItem = {
  id: number;
  name: string;
  currentCount: number;
  threshold: number;
  neededCount: number;
  inCartCount: number;
  orderedCount: number;
  link: string | null;
  category: Category;
};

const SECTIONS: { category: Category; label: string; subtitle: string }[] = [
  { category: 'SK_ITEM', label: 'Section 1 — SK Items', subtitle: 'Bottle · Notebook · Timer · Bag' },
  { category: 'INDIVIDUAL', label: 'Section 3 — Individual', subtitle: 'Gifts — Lego · Smartwatch' },
  { category: 'MARKETING', label: 'Section 4 — Marketing', subtitle: 'Flyers & materials' },
];

export default function StockManagementScreen() {
  return (
    <AccessGate page="/stock-management">
      <StockManagementScreenInner />
    </AccessGate>
  );
}

function StockManagementScreenInner() {
  const router = useRouter();
  const { data, loading, error, reload } = useApi<{
    items: StockItem[];
    packedCount: number;
    namedCount: number;
    unnamedCount: number;
  }>('/api/mobile/stock');
  const [items, setItems] = useState<StockItem[]>([]);
  const [packedCount, setPackedCount] = useState(0);
  const [namedCount, setNamedCount] = useState(0);
  const [unnamedCount, setUnnamedCount] = useState(0);
  const [packQty, setPackQty] = useState('');

  useEffect(() => {
    if (!data) return;
    setItems(data.items);
    setPackedCount(data.packedCount);
    setNamedCount(data.namedCount);
    setUnnamedCount(data.unnamedCount);
  }, [data]);

  const pack = () => {
    const q = parseInt(packQty, 10);
    if (isNaN(q) || q <= 0) return;
    setPackedCount((c) => c + q);
    setUnnamedCount((c) => c + q);
    setPackQty('');
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView contentContainerClassName="p-4 gap-5 pb-10" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.push('/home')} className="self-start bg-white border border-slate-200 px-4 py-2 rounded-xl">
          <Text className="text-[11px] font-black uppercase tracking-widest text-slate-500">← Inventory</Text>
        </Pressable>

        <View>
          <Text className="text-3xl font-black text-slate-800 tracking-tight">Stock Management</Text>
          <Text className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">4-Stage Procurement Pipeline</Text>
        </View>

        {/* LOADING / ERROR */}
        <ScreenState loading={loading} error={error} onRetry={reload} />

        {!loading && !error && (
        <>
        {/* PACK KITS */}
        <View className="bg-slate-900 rounded-3xl p-6">
          <Text className="text-[10px] font-black uppercase tracking-[2px] text-slate-400 mb-1">Packed Starter Kits</Text>
          <Text className="text-5xl font-black text-white">{packedCount}</Text>
          <Text className="text-xs text-slate-500 mt-1 font-bold">Ready to dispatch · 📦</Text>
          <View className="flex-row gap-3 mt-4">
            <TextInput
              placeholder="Qty to pack"
              placeholderTextColor="#64748b"
              keyboardType="number-pad"
              value={packQty}
              onChangeText={setPackQty}
              className="flex-1 px-4 py-3 bg-slate-800 rounded-2xl text-white font-bold text-sm"
            />
            <Pressable onPress={pack} className="px-6 py-3 bg-emerald-600 rounded-2xl justify-center active:scale-95">
              <Text className="text-white text-[11px] font-black uppercase tracking-widest">Pack</Text>
            </Pressable>
          </View>
        </View>

        {/* PACKED SK SUMMARY */}
        <View className="flex-row gap-3">
          <MiniStat label="Named" value={namedCount} color="text-emerald-700" bg="bg-emerald-50" />
          <MiniStat label="Unnamed" value={unnamedCount} color="text-amber-700" bg="bg-amber-50" />
          <MiniStat label="Total" value={packedCount} color="text-blue-700" bg="bg-blue-50" />
        </View>

        {/* SECTIONS */}
        {SECTIONS.map((sec) => (
          <StockSection key={sec.category} section={sec} items={items.filter((i) => i.category === sec.category)} />
        ))}
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StockSection({ section, items }: { section: { label: string; subtitle: string }; items: StockItem[] }) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-xs font-black text-slate-700 uppercase tracking-widest">{section.label}</Text>
          <Text className="text-[10px] text-slate-400 font-bold mt-0.5">{section.subtitle}</Text>
        </View>
        <View className="bg-slate-100 px-3 py-1 rounded-lg">
          <Text className="text-[10px] font-black text-slate-400 uppercase">{items.length} items</Text>
        </View>
      </View>
      {items.map((item) => <ItemCard key={item.id} item={item} />)}
    </View>
  );
}

function ItemCard({ item }: { item: StockItem }) {
  const isLow = item.neededCount > 0;
  const buyNow = () =>
    Alert.alert('Buy Now', item.link ? `Open supplier link and email order for "${item.name}"?` : `No supplier set for "${item.name}". Add one in Edit.`);

  return (
    <View className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <View className="flex-row items-center gap-2 mb-3">
        <View className={`w-2.5 h-2.5 rounded-full ${isLow ? 'bg-rose-500' : 'bg-emerald-400'}`} />
        <Text className="text-sm font-bold text-slate-700 flex-1">{item.name}</Text>
        {isLow && (
          <Pressable onPress={buyNow} className="bg-rose-50 border border-rose-200 px-3 py-1 rounded-lg">
            <Text className="text-[9px] font-black uppercase tracking-widest text-rose-500">Buy Now</Text>
          </Pressable>
        )}
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Chip label="Inventory" value={item.currentCount} bg="bg-emerald-50" color="text-emerald-700" />
        <Chip label="Threshold" value={item.threshold} bg="bg-indigo-50" color="text-indigo-700" />
        <Chip label="Need" value={item.neededCount || 0} bg="bg-rose-50" color={isLow ? 'text-rose-700' : 'text-slate-400'} />
        <Chip label="In Cart" value={item.inCartCount} bg="bg-amber-50" color="text-amber-700" />
        <Chip label="Ordered" value={item.orderedCount} bg="bg-orange-50" color="text-orange-700" />
      </View>
    </View>
  );
}

function Chip({ label, value, bg, color }: { label: string; value: number; bg: string; color: string }) {
  return (
    <View className={`${bg} rounded-xl px-3 py-2 items-center min-w-[64px]`}>
      <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</Text>
      <Text className={`text-base font-black ${color}`}>{value}</Text>
    </View>
  );
}

function MiniStat({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View className={`flex-1 ${bg} rounded-2xl px-4 py-4 items-center`}>
      <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</Text>
      <Text className={`text-2xl font-black ${color}`}>{value}</Text>
    </View>
  );
}
