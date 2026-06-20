import * as SecureStore from 'expo-secure-store';

// Secure storage for the NextAuth session token + cached user.
const TOKEN_KEY = 'session_token';
const USER_KEY = 'session_user';
const EXPIRES_KEY = 'session_expires';

// Keep the device signed in for 1 month, matching the server token's maxAge
// (app/api/mobile/login/route.ts encodes the JWT with maxAge: 30 days). After
// this window the cached session is dropped on launch and the user must log in
// again — and the server would reject the stored token anyway (it's the hard cap).
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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
  await SecureStore.setItemAsync(EXPIRES_KEY, String(Date.now() + SESSION_MAX_AGE_MS));
}

// Stored 1-month deadline, or null if none was saved (legacy session predating
// expiry-tracking). We start the window for those on first read rather than
// dropping a still-valid session.
async function getExpiry(): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(EXPIRES_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

async function startWindow(): Promise<void> {
  await SecureStore.setItemAsync(EXPIRES_KEY, String(Date.now() + SESSION_MAX_AGE_MS));
}

export async function getToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return null;
  const expiresAt = await getExpiry();
  if (expiresAt !== null && Date.now() >= expiresAt) {
    await clearSession();
    return null;
  }
  return token;
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  const expiresAt = await getExpiry();
  if (expiresAt === null) {
    // Legacy session — start the 1-month window now instead of forcing a re-login.
    await startWindow();
  } else if (Date.now() >= expiresAt) {
    // Past the 1-month window: drop the session so the app returns to login.
    await clearSession();
    return null;
  }
  return JSON.parse(raw) as AuthUser;
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
  await SecureStore.deleteItemAsync(EXPIRES_KEY);
}
