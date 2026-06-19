import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Dropdown from './Dropdown';

// Date filter matching the web: a preset dropdown PLUS a Custom From/To range.
// Emits {start,end} as 'YYYY-MM-DD' strings (empty = All Time). rangeFor maps a
// preset to its range (stdRange for most screens, rmRange for RM dashboard).
export type Range = { start: string; end: string };

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DateFilter({
  presets,
  rangeFor,
  initial = 'thisWeek',
  onChange,
}: {
  presets: { label: string; value: string }[];
  rangeFor: (preset: string) => Range;
  initial?: string;
  onChange: (r: Range) => void;
}) {
  const init = rangeFor(initial);
  const today = fmt(new Date());
  const [preset, setPreset] = useState(initial);
  const [start, setStart] = useState(init.start || today);
  const [end, setEnd] = useState(init.end || today);
  const [picking, setPicking] = useState<null | 'start' | 'end'>(null);

  const choosePreset = (p: string) => {
    setPreset(p);
    if (p === 'custom') {
      onChange({ start, end });
      return;
    }
    const r = rangeFor(p);
    if (r.start) setStart(r.start);
    if (r.end) setEnd(r.end);
    onChange(r);
  };

  const onPick = (which: 'start' | 'end', d?: Date) => {
    setPicking(null);
    if (!d) return;
    const v = fmt(d);
    if (which === 'start') {
      setStart(v);
      onChange({ start: v, end });
    } else {
      setEnd(v);
      onChange({ start, end: v });
    }
  };

  return (
    <View className="gap-2">
      {/* flex-row wrapper: Dropdown uses flex-1, which only sizes correctly inside a row */}
      <View className="flex-row">
        <Dropdown value={preset} options={presets} onChange={choosePreset} />
      </View>
      {preset === 'custom' && (
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setPicking('start')}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5"
          >
            <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">From</Text>
            <Text className="text-xs font-bold text-slate-700 mt-0.5">{start || '—'}</Text>
          </Pressable>
          <Pressable
            onPress={() => setPicking('end')}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5"
          >
            <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">To</Text>
            <Text className="text-xs font-bold text-slate-700 mt-0.5">{end || '—'}</Text>
          </Pressable>
        </View>
      )}
      {picking && (
        <DateTimePicker
          value={new Date(`${(picking === 'start' ? start : end) || today}T00:00:00`)}
          mode="date"
          onChange={(_e, d) => onPick(picking, d)}
        />
      )}
    </View>
  );
}
