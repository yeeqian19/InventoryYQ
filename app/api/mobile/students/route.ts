import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMobileSession } from '@/lib/mobileAuth';
import { resolveBranchCode } from '@/lib/branchUtils';
import { resolveStudentType, hasEnrollmentGift } from '@/lib/studentUtils';
import { rangeForPreset, type DatePreset } from '@/lib/trackerUtils';

export const dynamic = 'force-dynamic';

// Build a Prisma doc_date filter from a date preset (same ranges the web uses).
// Returns {} for 'all' so the caller can spread it into the where clause.
function docDateWhere(preset: string): { doc_date?: { gte: Date; lte: Date } } {
  const { start, end } = rangeForPreset((preset || 'all') as DatePreset);
  if (!start || !end) return {};
  const gte = new Date(`${start}T00:00:00`);
  const lte = new Date(`${end}T23:59:59.999`);
  return { doc_date: { gte, lte } };
}

// Read endpoint for the mobile Student Manager screen.
// Mirrors app/student-manager/page.tsx's tableData, plus pre-formats the stage
// dates into the short {sk_prep, eg_prep, bm_pickup, received} display strings
// the mobile cards render.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortDate(d: Date | null): string {
  if (!d) return '✓';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export async function GET(request: NextRequest) {
  const session = await getMobileSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Default to 'thisWeek' to mirror the web Student Manager's default view
  // (and to avoid shipping the entire table to the phone).
  const preset = request.nextUrl.searchParams.get('preset') ?? 'thisWeek';

  const rawStudents = await db.inventory_distribution_new.findMany({
    where: { is_active: true, ...docDateWhere(preset) },
    select: {
      student_id: true,
      student_name: true,
      branch_code: true,
      barcode_sk: true,
      barcode_eg: true,
      doc_date: true,
      doc_no: true,
      type: true,
      package: true,
      sk_prep: true,
      sk_prep_date: true,
      eg_prep: true,
      eg_prep_date: true,
      bm_pickup: true,
      bm_pickup_date: true,
      student_received: true,
      student_received_date: true,
    },
    orderBy: { doc_date: 'desc' },
  });

  const students = rawStudents.map((s) => {
    const finalBranch = resolveBranchCode(s.branch_code, s.doc_no);
    const sType = resolveStudentType(s.type, s.package);
    const hasEG = hasEnrollmentGift(s.package, s.student_name);

    const skBarcode = s.barcode_sk || `${finalBranch}-SK-${s.student_id}`;
    const egBarcode = hasEG ? s.barcode_eg || `${finalBranch}-EG-${s.student_id}` : 'N/A';

    let date = '';
    if (s.doc_date) {
      try {
        date = new Date(s.doc_date).toISOString().split('T')[0];
      } catch {
        date = '';
      }
    }

    const stages: { sk_prep?: string; eg_prep?: string; bm_pickup?: string; received?: string } = {};
    if (s.sk_prep) stages.sk_prep = shortDate(s.sk_prep_date);
    if (s.eg_prep) stages.eg_prep = shortDate(s.eg_prep_date);
    if (s.bm_pickup) stages.bm_pickup = shortDate(s.bm_pickup_date);
    if (s.student_received) stages.received = shortDate(s.student_received_date);

    return {
      id: String(s.student_id),
      name: s.student_name || 'Unknown',
      doc_no: s.doc_no || '',
      branch: finalBranch,
      date,
      // resolveStudentType can return 'OTHER'; the mobile UI treats anything
      // that isn't NEW/RENEWAL as a trial, so fold OTHER into TRIAL here.
      type: sType === 'OTHER' ? 'TRIAL' : sType,
      package: s.package || '',
      skBarcode,
      egBarcode,
      stages,
    };
  });

  return NextResponse.json({ students });
}
