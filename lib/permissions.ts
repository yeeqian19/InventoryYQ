import type { UserRole } from '@/types';

// ─── Role Hierarchy ───────────────────────────────────────────────────────────
// SUPERADMIN  → Full CRUD everywhere
// ADMIN_HQ    → Edit HQ inventory, View-only branch inventory
// USER_RM     → View-only everywhere, no edit rights
// USER_BM     → Edit + View ONLY their own assigned branch
// ─────────────────────────────────────────────────────────────────────────────

/** Base predicate: SUPERADMIN or ADMIN_HQ */
function isHQEditor(role: UserRole): boolean {
  return role === 'SUPERADMIN' || role === 'ADMIN_HQ';
}

/** Returns true if the role can edit HQ inventory / run HQ scan stations */
export function canEditHQ(role: UserRole): boolean {
  return isHQEditor(role);
}

/** Returns true if the role can view HQ inventory */
export function canViewHQ(role: UserRole): boolean {
  return isHQEditor(role) || role === 'USER_RM';
}

/**
 * Returns true if the role can edit a specific branch's inventory.
 * SUPERADMIN can edit any branch.
 * USER_BM can only edit their own branch.
 */
export function canEditBranch(
  role: UserRole,
  userBranchCode: string,
  targetBranchCode: string
): boolean {
  if (role === 'SUPERADMIN') return true;
  if (role === 'USER_BM') return userBranchCode === targetBranchCode;
  return false;
}

/** Returns true if the role can view branch inventory */
export function canViewBranch(role: UserRole): boolean {
  return role === 'SUPERADMIN' || role === 'ADMIN_HQ' || role === 'USER_RM' || role === 'USER_BM';
}

/** Returns true if the role can manage users (create/edit/delete) */
export function canManageUsers(role: UserRole): boolean {
  return isHQEditor(role);
}

/** Returns true if the role has full admin access */
export function isSuperAdmin(role: UserRole): boolean {
  return role === 'SUPERADMIN';
}

/** Returns true if the role can access the stock management page */
export function canManageStock(role: UserRole): boolean {
  return isHQEditor(role);
}

/** Returns true if the role can undo a scan stage (sk_prep, eg_prep, bm_pickup, student_received) */
export function canUndoScans(role: UserRole): boolean {
  return role === 'SUPERADMIN';
}
