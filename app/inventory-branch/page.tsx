import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import BranchDashboardClient from './BranchDashboardClient';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function InventoryBranchPage() {
  const session = await getServerSession(authOptions);

  // Not logged in → back to home (login)
  if (!session?.user) redirect('/');

  const role       = session.user.role;
  const branchCode = session.user.branchCode || '';

  // Build the Prisma where clause based on role
  const roleFilter =
    role === 'SUPERADMIN' || role === 'ADMIN'
      ? { OR: [{ sk_prep: true }, { eg_prep: true }] }          // All branches
      : { AND: [
          { OR: [{ sk_prep: true }, { eg_prep: true }] },
          { branch_code: branchCode },                           // Their branch only
        ]};

  const rawData = await db.inventory_distribution.findMany({
    select: {
      student_id:       true,
      student_name:     true,
      branch_code:      true,
      barcode_sk:       true,
      barcode_eg:       true,
      sk_prep:          true,
      eg_prep:          true,
      bm_pickup:        true,
      student_received: true,
      type:             true,
      package:          true,
      doc_date:         true,
    },
    where: roleFilter,
    orderBy: { doc_date: 'desc' },
  });

  const formattedData = rawData.map(item => ({
    student_id:      String(item.student_id),
    name:            item.student_name || 'Unknown',
    branch:          item.branch_code || 'N/A',
    skBarcode:       item.barcode_sk || null,
    egBarcode:       item.barcode_eg || null,
    skPrep:          item.sk_prep || false,
    egPrep:          item.eg_prep || false,
    bmPickup:        item.bm_pickup || false,
    studentReceived: item.student_received || false,
    studentType:     item.type || 'Unknown',
    package:         item.package || 'N/A',
  }));

  return (
    <BranchDashboardClient
      initialData={formattedData}
      userRole={role}
      userBranchCode={branchCode}
    />
  );
}
