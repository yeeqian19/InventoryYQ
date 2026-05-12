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

  // Trust the explicit type field first
  if (rawType.includes('RENEWAL')) return 'RENEWAL';
  if (rawType.includes('TRIAL'))   return 'TRIAL';
  if (rawType === 'NEW')           return 'NEW';

  // Fallback: infer from package when type is missing/dirty
  // Trial students have package = "Trial" (the literal word)
  if (rawPkg === 'TRIAL') return 'TRIAL';
  // Real package (3M/6M/9M/12M) = enrolled student → New
  if (['3M', '6M', '9M', '12M'].includes(rawPkg)) return 'NEW';

  return 'TRIAL'; // no type, no real package = unconfirmed trial
}

/**
 * Returns true if the package qualifies for an Enrollment Gift (EG).
 * Only 12M packages get an EG (the LEGO).
 */
export function hasEnrollmentGift(pkg?: string | null): boolean {
  const rawPkg = (pkg || '').trim().toUpperCase();
  return /\b12M?\b/.test(rawPkg) || rawPkg.includes('12M');
}

/**
 * Returns the gift name for a given package string.
 */
export function giftNameForPackage(pkg?: string | null): string | null {
  const rawPkg = (pkg || '').trim().toUpperCase();
  if (rawPkg.includes('12M') || /\b12\b/.test(rawPkg)) return 'LEGO';
  return null;
}
