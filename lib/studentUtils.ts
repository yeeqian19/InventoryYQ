/**
 * Shared student classification utilities.
 * Extracted from dashboard/page.tsx, student-manager/page.tsx, and RM_Dashboard/page.tsx.
 */

export type StudentType = 'NEW' | 'RENEWAL' | 'TRIAL' | 'OTHER';

/**
 * Derive the student type label from the raw `type` and `package` DB fields.
 */
export function resolveStudentType(type?: string | null, pkg?: string | null): StudentType {
  const rawType = (type || '').trim().toUpperCase();
  const rawPkg  = (pkg  || '').trim().toUpperCase();

  if (rawType.includes('RENEWAL')) return 'RENEWAL';
  if (rawType.includes('TRIAL'))   return 'TRIAL';
  if (rawType === 'NEW' || rawPkg === 'NEW') return 'NEW';
  // Default: treat unknown records as NEW so they go through the distribution flow
  return 'NEW';
}

/**
 * Returns true if the package qualifies for an Enrollment Gift (EG).
 * 9M → LEGO, 12M → SMARTWATCH
 */
export function hasEnrollmentGift(pkg?: string | null): boolean {
  const rawPkg = (pkg || '').trim().toUpperCase();
  return /\b9M?\b/.test(rawPkg) || /\b12M?\b/.test(rawPkg) ||
         rawPkg.includes('9M') || rawPkg.includes('12M');
}

/**
 * Returns the gift name for a given package string.
 */
export function giftNameForPackage(pkg?: string | null): string | null {
  const rawPkg = (pkg || '').trim().toUpperCase();
  if (rawPkg.includes('12M') || /\b12\b/.test(rawPkg)) return 'SMARTWATCH';
  if (rawPkg.includes('9M')  || /\b9\b/.test(rawPkg))  return 'LEGO';
  return null;
}
