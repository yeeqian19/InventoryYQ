import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

// Converted from app/page.tsx (Next.js) — role-based menu grid, mobile-native layout.
type Role = 'SUPERADMIN' | 'ADMIN_HQ' | 'USER_RM' | 'USER_BM';

const ALL_MENU_ITEMS: {
  name: string;
  icon: string;
  color: string;
  href: string;
  roles: Role[];
}[] = [
  { name: 'MY INVENTORY (HQ)',     icon: '🏢', color: 'bg-[#418bca]', href: '/dashboard',        roles: ['SUPERADMIN', 'ADMIN_HQ', 'USER_RM'] },
  { name: 'RM DASHBOARD',          icon: '📊', color: 'bg-[#00c0ef]', href: '/RM_Dashboard',      roles: ['SUPERADMIN', 'USER_RM'] },
  { name: 'MY INVENTORY (BRANCH)', icon: '📍', color: 'bg-[#00a65a]', href: '/inventory-branch',  roles: ['SUPERADMIN', 'ADMIN_HQ', 'USER_RM', 'USER_BM'] },
  { name: 'STOCK MANAGEMENT',      icon: '📦', color: 'bg-[#605ca8]', href: '/stock-management',  roles: ['SUPERADMIN', 'ADMIN_HQ'] },
  { name: 'STAFF MANAGEMENT',      icon: '👥', color: 'bg-[#1e293b]', href: '/staff-management',  roles: ['SUPERADMIN'] },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const role: Role = (user?.role as Role) ?? 'USER_RM';
  const userName = user?.name ?? 'User';

  const visibleItems = ALL_MENU_ITEMS.filter((item) => item.roles.includes(role));

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-appBgAlt">
      <ScrollView contentContainerClassName="px-5 pb-10" showsVerticalScrollIndicator={false}>
        {/* Role badge */}
        <View className="self-start border-2 border-blue-600 rounded-full px-4 py-1 mt-4 mb-4">
          <Text className="text-[11px] font-black tracking-[2px] uppercase text-blue-600">
            {role} PORTAL
          </Text>
        </View>

        <Text className="text-2xl font-black text-slate-800 tracking-tight">Inventory Management</Text>
        <Text className="text-base text-slate-400 mt-1 mb-6">Welcome back, {userName}</Text>

        {/* Tile grid — 2 columns */}
        <View className="flex-row flex-wrap -mx-2">
          {visibleItems.map((item) => (
            <View key={item.href} className="w-1/2 px-2 mb-4">
              <Pressable
                onPress={() => router.push(item.href as never)}
                className={`${item.color} rounded-3xl items-center justify-center shadow-md aspect-square p-4 active:opacity-90`}
              >
                <Text className="text-5xl mb-3">{item.icon}</Text>
                <Text className="text-[11px] font-black text-center uppercase tracking-wide text-white leading-tight">
                  {item.name}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* Footer actions */}
        <View className="items-center mt-6 gap-3">
          <Pressable
            onPress={handleLogout}
            className="px-7 py-2.5 min-h-[44px] border-2 border-slate-200 rounded-full items-center justify-center active:bg-slate-100"
          >
            <Text className="text-[11px] font-black tracking-[2px] uppercase text-slate-400">
              Log Out
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
