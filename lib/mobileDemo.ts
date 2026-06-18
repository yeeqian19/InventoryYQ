import type { UserRole } from '@/types';

// Dev-only demo accounts for the React Native app — let it sign in WITHOUT a database
// or NEXTAUTH_SECRET, purely for UI/testing. NEVER honored in production (callers gate
// on NODE_ENV). Shared by /api/mobile/login and the mobile read endpoints.
export const DEMO_PASSWORD = 'demo123';

export type DemoUser = { name: string; role: UserRole; branchCode: string };

export const DEMO_ACCOUNTS: Record<string, DemoUser> = {
  'super@demo': { name: 'Demo Superadmin', role: 'SUPERADMIN', branchCode: '' },
  'hq@demo': { name: 'Demo Admin HQ', role: 'ADMIN_HQ', branchCode: '' },
  'rm@demo': { name: 'Demo Regional', role: 'USER_RM', branchCode: '' },
  'bm@demo': { name: 'Demo Branch (RBY)', role: 'USER_BM', branchCode: 'RBY' },
};

export const DEMO_TOKEN_PREFIX = 'demo.';
