import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api';

// Converted from app/login/LoginClient.tsx (Next.js).
// Real auth: POST /api/mobile/login via AuthContext, stores the session token.
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      if (!email || !password) {
        setError('Invalid Email or Password.');
        setLoading(false);
        return;
      }
      await login(email.trim(), password);
      router.replace('/home');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Invalid Email or Password.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-darkBg">
      <View className="flex-1 items-center justify-center p-4">
        <View className="w-full max-w-md rounded-2xl bg-surface-darkCard p-8 border border-slate-800">
          <View className="items-center mb-8">
            <Text className="text-3xl font-extrabold text-white tracking-tight">MY INVENTORY</Text>
            <Text className="mt-2 text-sm text-slate-400">Sign in to your account</Text>
          </View>

          {error ? (
            <View className="mb-4 rounded-lg bg-red-500/10 p-3 border border-red-500/20">
              <Text className="text-center text-sm text-red-400">{error}</Text>
            </View>
          ) : null}

          <View className="gap-3">
            <TextInput
              placeholder="Email"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              className="w-full h-12 rounded-xl border border-slate-700 bg-surface-darkBg px-4 text-[16px] text-white"
            />

            <View className="relative justify-center">
              <TextInput
                placeholder="Password"
                placeholderTextColor="#64748b"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                className="w-full h-12 rounded-xl border border-slate-700 bg-surface-darkBg px-4 pr-20 text-[16px] text-white"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                className="absolute right-3 px-1 min-h-[44px] justify-center"
              >
                <Text className="text-sm font-bold uppercase text-slate-400">
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            className={`w-full h-12 mt-4 rounded-xl bg-emerald-600 items-center justify-center ${loading ? 'opacity-50' : ''}`}
          >
            <Text className="font-bold text-white text-[16px]">
              {loading ? 'AUTHENTICATING...' : 'SIGN IN'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
