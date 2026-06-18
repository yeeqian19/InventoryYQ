import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import type { UserRole } from '@/types';
import { DEMO_ACCOUNTS, DEMO_TOKEN_PREFIX } from './mobileDemo';

export type MobileSession = {
  user: { id: string; email: string; name: string; role: UserRole; branchCode: string };
};

// Resolve the caller's session for mobile API routes.
// 1) Real NextAuth session (works for the web AND for mobile's real login, since the
//    app sends the encoded token as the next-auth.session-token cookie).
// 2) Dev fallback: a `demo.<email>` token from the demo login → synthetic session.
//    Disabled in production.
export async function getMobileSession(): Promise<MobileSession | null> {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const u = session.user as { email?: string | null; name?: string | null; role?: UserRole; branchCode?: string };
    return {
      user: {
        id: '',
        email: u.email ?? '',
        name: u.name ?? 'User',
        role: (u.role ?? 'USER_RM') as UserRole,
        branchCode: u.branchCode ?? '',
      },
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    const store = await cookies();
    const token = store.get('next-auth.session-token')?.value ?? '';
    if (token.startsWith(DEMO_TOKEN_PREFIX)) {
      const email = token.slice(DEMO_TOKEN_PREFIX.length).toLowerCase();
      const demo = DEMO_ACCOUNTS[email];
      if (demo) {
        return { user: { id: 'demo', email, name: demo.name, role: demo.role, branchCode: demo.branchCode } };
      }
    }
  }

  return null;
}
