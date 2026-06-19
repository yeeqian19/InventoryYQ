import { ActivityIndicator, Pressable, Text, View } from 'react-native';

// Renders loading / error / empty UI; otherwise returns null so the screen shows data.
export default function ScreenState({
  loading,
  error,
  empty,
  onRetry,
  emptyText = 'No data found.',
}: {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  onRetry?: () => void;
  emptyText?: string;
}) {
  if (loading) {
    return (
      <View className="items-center justify-center py-20">
        <ActivityIndicator size="large" color="#10b981" />
        <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-3">Loading…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="items-center justify-center py-16 px-8">
        <Text className="text-4xl mb-3">⚠️</Text>
        <Text className="text-sm font-black text-slate-700 uppercase tracking-widest text-center">Couldn’t load</Text>
        <Text className="text-xs font-bold text-slate-400 text-center mt-1">{error}</Text>
        {onRetry && (
          <Pressable onPress={onRetry} className="mt-5 bg-emerald-500 px-6 py-3 rounded-xl active:scale-95">
            <Text className="text-white text-[11px] font-black uppercase tracking-widest">Retry</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (empty) {
    return (
      <View className="items-center justify-center py-16">
        <Text className="text-4xl mb-3">📭</Text>
        <Text className="text-sm font-black text-slate-400 uppercase tracking-widest">{emptyText}</Text>
      </View>
    );
  }

  return null;
}
