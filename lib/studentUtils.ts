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

// Students who get an Enrollment Gift regardless of their package.
// Stored lowercase, trimmed; compared with the same normalization at lookup.
const FORCED_EG_STUDENT_NAMES = new Set<string>([
  'nik amal',
  'nik nayef',
]);

function isForcedEGStudent(studentName?: string | null): boolean {
  if (!studentName) return false;
  return FORCED_EG_STUDENT_NAMES.has(studentName.trim().toLowerCase());
}

/**
 * Returns true if the package qualifies for an Enrollment Gift (EG).
 * Only 12M packages get an EG (the LEGO) — plus any explicit student-name
 * overrides in FORCED_EG_STUDENT_NAMES.
 */
export function hasEnrollmentGift(pkg?: string | null, studentName?: string | null): boolean {
  if (isForcedEGStudent(studentName)) return true;
  const rawPkg = (pkg || '').trim().toUpperCase();
  return /\b12M?\b/.test(rawPkg) || rawPkg.includes('12M');
}

/**
 * Returns the gift name for a given package string.
 */
export function giftNameForPackage(pkg?: string | null, studentName?: string | null): string | null {
  if (isForcedEGStudent(studentName)) return 'LEGO';
  const rawPkg = (pkg || '').trim().toUpperCase();
  if (rawPkg.includes('12M') || /\b12\b/.test(rawPkg)) return 'LEGO';
  return null;
}
