/**
 * Shared branch validation and resolution utilities.
 * Extracted from dashboard/page.tsx and student-manager/page.tsx.
 */

export const VALID_BRANCHES = [
  // Region A
  'AC', 'DA', 'EGR', 'KLG', 'RBY', 'SA', 'SHA', 'ST', 'TSB',
  // Region B
  'AMP', 'BTHO', 'DK', 'DSH', 'KD', 'KTG', 'PJL', 'SLY', 'SP', 'TSG',
  // Region C
  'BBB', 'BSP', 'CJY', 'KW', 'ONL', 'PJY', 'PU', 'SBN', 'SNT',
  // Other
  'HQ',
];

// Maps legacy / mistyped codes to the current canonical code.
// Old invoices may still use the previous code (e.g. SBY for the now-renamed
// Tropicana Sungai Buloh) — those should still resolve to the correct branch.
export const BRANCH_CORRECTION_MAP: Record<string, string> = {
  PJ: 'PJY',
  KL: 'KLG',
  'KUALA LUMPUR': 'KLG',
  SBY: 'TSB',  // legacy Sungai Buloh → Tropicana Sungai Buloh
  DP:  'PU',   // legacy Dataran Puchong Utama → Puchong Utama
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
