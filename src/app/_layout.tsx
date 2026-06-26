import '../global.css';

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Keep the native splash up until the session restore finishes, then hide it
// ourselves. Relying on auto-hide is unreliable on some devices (e.g. Huawei/EMUI),
// which can leave the app stuck on the blue splash. preventAutoHideAsync is wrapped
// in catch so it can never throw at startup.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Absolute safety net: hide the splash after 8s no matter what — even if React
// never mounts or the auth provider fails — so the app can never be permanently
// stuck on the splash screen on any device.
setTimeout(() => {
  SplashScreen.hideAsync().catch(() => {});
}, 8000);

// Hides the splash as soon as auth has finished loading (loading is guaranteed to
// flip to false within a few seconds by AuthProvider's timeout), so the app can
// never be trapped on the splash screen.
function SplashGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SplashGate>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaProvider>
      </SplashGate>
    </AuthProvider>
  );
}
