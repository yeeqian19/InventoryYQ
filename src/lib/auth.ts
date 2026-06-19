import * as SecureStore from 'expo-secure-store';

// Secure storage for the NextAuth session token + cached user.
const TOKEN_KEY = 'session_token';
const USER_KEY = 'session_user';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'SUPERADMIN' | 'ADMIN_HQ' | 'USER_RM' | 'USER_BM';
  branchCode: string;
};

export async function saveSession(token: string, user: AuthUser) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
