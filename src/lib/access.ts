// Single source of truth for role-based page access. Mirrors the web's route guards
// (app/*/page.tsx redirects + lib/permissions.ts) so the mobile app gates the same way.
export type Role = 'SUPERADMIN' | 'ADMIN_HQ' | 'USER_RM' | 'USER_BM';

// Which roles may open each route. Routes not listed here are open to any signed-in user.
export const PAGE_ROLES: Record<string, Role[]> = {
  '/dashboard': ['SUPERADMIN', 'ADMIN_HQ', 'USER_RM'],
  '/RM_Dashboard': ['SUPERADMIN', 'USER_RM'],
  '/inventory-branch': ['SUPERADMIN', 'ADMIN_HQ', 'USER_RM', 'USER_BM'],
  '/stock-management': ['SUPERADMIN', 'ADMIN_HQ'],
  '/staff-management': ['SUPERADMIN'],
  '/student-manager': ['SUPERADMIN', 'ADMIN_HQ'],
  '/student-tracker': ['SUPERADMIN', 'ADMIN_HQ'],
  '/scan-approve': ['SUPERADMIN', 'ADMIN_HQ'],
  '/scan-log': ['SUPERADMIN', 'ADMIN_HQ', 'USER_RM'],
};

// True if the role may open the route. Unlisted routes are allowed (open by default);
// an unknown/empty role is denied for any listed (restricted) route.
export function canAccess(role: Role | '' | undefined, path: string): boolean {
  const allowed = PAGE_ROLES[path];
  if (!allowed) return true;
  return !!role && allowed.includes(role as Role);
}
