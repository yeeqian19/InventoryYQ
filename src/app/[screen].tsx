import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

// Temporary catch-all destination for menu tiles whose screens aren't converted yet.
// e.g. /dashboard, /RM_Dashboard, /stock-management ... each lands here for now.
export default function ScreenPlaceholder() {
  const { screen } = useLocalSearchParams<{ screen: string }>();
  const router = useRouter();
  const title = (screen ?? '').replace(/[-_]/g, ' ');

  return (
    <SafeAreaView className="flex-1 bg-surface-appBgAlt">
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-[11px] font-black uppercase tracking-widest text-brand-emeraldDark mb-2">
          Coming soon
        </Text>
        <Text className="text-2xl font-black text-slate-800 tracking-tight capitalize text-center">
          {title}
        </Text>
        <Text className="text-slate-400 mt-2 text-center">This screen isn’t converted yet.</Text>

        <Pressable
          onPress={() => router.back()}
          className="mt-8 px-7 py-2.5 min-h-[44px] border-2 border-slate-200 rounded-full active:bg-slate-100"
        >
          <Text className="text-[11px] font-black tracking-[2px] uppercase text-slate-400">
            ← Back
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
