/**
 * Shared branch validation and resolution utilities.
 * Extracted from dashboard/page.tsx and student-manager/page.tsx.
 */

export const VALID_BRANCHES = [
  'ST', 'SA', 'PJY', 'AMP', 'CJY', 'KLG', 'BBB', 'SHA', 'RBY', 'KTG',
  'ONL', 'SP', 'KD', 'DA', 'DK', 'BTHO', 'EGR', 'BSP', 'KW', 'TSG', 'HQ',
];

export const BRANCH_CORRECTION_MAP: Record<string, string> = {
  PJ: 'PJY',
  KL: 'KLG',
  'KUALA LUMPUR': 'KLG',
};

/**
 * Resolve the canonical branch code from raw DB fields.
 * Priority: branch_code field → doc_no parsing → 'UNKNOWN'
 */
export function resolveBranchCode(
  branchCode?: string | null,
  docNo?: string | null,
): string {
  // 1. Try branch_code field directly
  if (branchCode) {
    const raw = branchCode.toUpperCase().trim();
    if (VALID_BRANCHES.includes(raw)) return raw;
    if (BRANCH_CORRECTION_MAP[raw]) return BRANCH_CORRECTION_MAP[raw];
  }

  // 2. Parse out of the doc_no (e.g. "PJY-2024-001")
  if (docNo) {
    const parts = docNo.toUpperCase().split(/[-_ ]+/);
    for (const part of parts) {
      if (VALID_BRANCHES.includes(part)) return part;
      if (BRANCH_CORRECTION_MAP[part]) return BRANCH_CORRECTION_MAP[part];
    }
  }

  return 'UNKNOWN';
}
