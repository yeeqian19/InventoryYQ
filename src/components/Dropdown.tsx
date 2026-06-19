import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

export type Option = { label: string; value: string };

// Lightweight RN replacement for <select> — works in Expo Go, no native module.
export default function Dropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <View className="flex-1">
      <Pressable
        onPress={() => setOpen(true)}
        className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex-row items-center justify-between active:bg-slate-50"
      >
        <Text className="text-[11px] font-black text-slate-700 uppercase" numberOfLines={1}>
          {current?.label ?? 'Select'}
        </Text>
        <Text className="text-slate-400 text-[10px] ml-1">▼</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/40 justify-center px-10" onPress={() => setOpen(false)}>
          <View className="bg-white rounded-2xl overflow-hidden">
            {options.map((opt) => {
              const selected = opt.value === value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`px-5 py-4 border-b border-slate-50 ${selected ? 'bg-emerald-50' : 'active:bg-slate-50'}`}
                >
                  <Text className={`text-sm font-black uppercase ${selected ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
