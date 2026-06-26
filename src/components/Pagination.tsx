import { Pressable, Text, View } from 'react-native';

// Numbered page navigation: ‹ 1 2 … 7 8 9 … 42 ›. Windowed with ellipsis so it
// stays compact even with thousands of pages. Renders nothing for a single page.
function buildItems(page: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | 'gap')[] = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(total - 1, page + 1);
  if (left > 2) items.push('gap');
  for (let i = left; i <= right; i++) items.push(i);
  if (right < total - 1) items.push('gap');
  items.push(total);
  return items;
}

export default function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const items = buildItems(page, totalPages);

  return (
    <View className="flex-row flex-wrap items-center justify-center gap-1.5 py-1">
      <Arrow label="‹" disabled={page <= 1} onPress={() => onChange(page - 1)} />
      {items.map((it, i) =>
        it === 'gap' ? (
          <Text key={`gap-${i}`} className="px-1 text-slate-400 font-black">…</Text>
        ) : (
          <Pressable
            key={it}
            onPress={() => onChange(it)}
            className={`min-w-[42px] h-11 px-2.5 rounded-xl items-center justify-center border ${
              it === page ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'
            }`}
          >
            <Text className={`text-xs font-black ${it === page ? 'text-white' : 'text-slate-600'}`}>{it}</Text>
          </Pressable>
        ),
      )}
      <Arrow label="›" disabled={page >= totalPages} onPress={() => onChange(page + 1)} />
    </View>
  );
}

function Arrow({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className={`w-11 h-11 rounded-xl items-center justify-center border ${
        disabled ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200'
      }`}
    >
      <Text className={`text-base font-black ${disabled ? 'text-slate-300' : 'text-slate-700'}`}>{label}</Text>
    </Pressable>
  );
}
