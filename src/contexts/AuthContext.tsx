import { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AuthUser, clearSession, getStoredUser, saveSession } from '@/lib/auth';

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the cached session on launch. This MUST always resolve `loading` to
  // false — otherwise the app hangs on the splash screen. So we catch any error
  // (e.g. corrupted SecureStore data → JSON.parse throws) and add a hard timeout
  // so a slow/blocked SecureStore read can never trap the user on the splash.
  useEffect(() => {
    let settled = false;
    const finish = (u: AuthUser | null) => {
      if (settled) return;
      settled = true;
      setUser(u);
      setLoading(false);
    };
    getStoredUser()
      .then((u) => finish(u))
      .catch(() => finish(null));
    const timeout = setTimeout(() => finish(null), 6000);
    return () => clearTimeout(timeout);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ token: string; user: AuthUser }>('/api/mobile/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await saveSession(res.token, res.user);
    setUser(res.user);
  };

  const logout = async () => {
    await clearSession();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
