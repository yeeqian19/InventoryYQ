import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

// App entry → restore session, then route to Home (signed in) or Login.
export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <View className="flex-1 bg-surface-darkBg" />;
  return <Redirect href={user ? '/home' : '/login'} />;
}
