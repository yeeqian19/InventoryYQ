import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getMobileSession } from '@/lib/mobileAuth';
import { resolveBranchCode } from '@/lib/branchUtils';

export const dynamic = 'force-dynamic';

// Read endpoint for the mobile RM Dashboard.
// Mirrors app/RM_Dashboard/page.tsx's fetchDashboardData(), reshaped into the
// per-student rows the mobile screen groups by branch.
export async function GET() {
  const session = await getMobileSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Web redirects ADMIN_HQ away from the RM dashboard — mirror that here.
  if (session.user.role === 'ADMIN_HQ') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = await prisma.inventory_distribution_new.findMany({
    where: { is_active: true },
    select: {
      student_id: true,
      student_name: true,
      branch_code: true,
      sk_prep: true,
      eg_prep: true,
      bm_pickup: true,
      student_received: true,
      doc_date: true,
      type: true,
      doc_no: true,
      package: true,
    },
    orderBy: { doc_date: 'desc' },
  });

  const students = data.map((item) => {
    const rawType = (item.type || '').trim().toUpperCase();
    const pkg = item.package ? item.package.toString().trim().toUpperCase() : '';

    let type: 'NEW' | 'RENEWAL' | 'TRIAL' = 'NEW';
    if (rawType.includes('RENEWAL')) type = 'RENEWAL';
    else if (rawType.includes('TRIAL')) type = 'TRIAL';

    const name =
      item.student_name && item.student_name.trim() !== ''
        ? item.student_name.trim()
        : 'NAME MISSING';

    // SK/EG eligibility — SAME inline rules as the web RM page (NOT the shared utils):
    // SK only for NEW; EG only for NEW + 12-month packages.
    const hasSK = type === 'NEW';
    const is12M = /\b12\b/.test(pkg) || pkg.includes('12M');
    const hasEG = type === 'NEW' && is12M;

    return {
      id: item.student_id.toString(),
      name,
      branch: resolveBranchCode(item.branch_code, item.doc_no),
      pkg,
      type,
      // Raw workflow flags so the mobile screen can replicate the web's exact
      // prepared/pickup/received + SK/EG-toggle counting.
      sk_prep: !!item.sk_prep,
      eg_prep: !!item.eg_prep,
      bm_pickup: !!item.bm_pickup,
      student_received: !!item.student_received,
      hasSK,
      hasEG,
      // Web RM dashboard filters by created_at (= doc_date) — expose it for parity.
      created_at: item.doc_date ? item.doc_date.toISOString() : null,
    };
  });

  return NextResponse.json({ students });
}
