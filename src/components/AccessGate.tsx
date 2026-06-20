import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { canAccess, type Role } from '@/lib/access';

// Role gate for a screen. Wrap a screen's content in <AccessGate page="/route">…</AccessGate>;
// children (and their data hooks) only mount when the signed-in role is allowed, so a
// blocked role sees a clean "no access" state instead of a failed/forbidden API call.
export default function AccessGate({ page, children }: { page: string; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-appBgAlt items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const role = (user?.role ?? '') as Role | '';
  if (!canAccess(role, page)) {
    return (
      <SafeAreaView className="flex-1 bg-surface-appBgAlt">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-5xl mb-4">🔒</Text>
          <Text className="text-[11px] font-black uppercase tracking-widest text-brand-emeraldDark mb-2">No Access</Text>
          <Text className="text-2xl font-black text-slate-800 tracking-tight text-center">Restricted page</Text>
          <Text className="text-slate-400 mt-2 text-center">
            Your role ({role || 'unknown'}) can’t open this screen.
          </Text>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
            className="mt-8 px-7 py-2.5 min-h-[44px] border-2 border-slate-200 rounded-full active:bg-slate-100"
          >
            <Text className="text-[11px] font-black tracking-[2px] uppercase text-slate-400">← Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}
