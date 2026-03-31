import BranchDashboardClient from './BranchDashboardClient';
import { db } from '@/lib/db'; // Adjust path if your db.ts is elsewhere

export const dynamic = 'force-dynamic';

export default async function InventoryBranchPage() {
  // Fetch only items that have been prepared by HQ
  const rawData = await db.inventory_distribution.findMany({
    select: {
      student_id: true, // <--- Explicitly selecting the new column!
      student_name: true,
      branch_code: true,
      barcode_sk: true,
      barcode_eg: true,
      sk_prep: true,
      eg_prep: true,
      bm_pickup: true,
      student_received: true,
      type: true,
      package: true,
      doc_date: true,
    },
    where: {
      OR: [
        { sk_prep: true },
        { eg_prep: true }
      ]
    },
    orderBy: { doc_date: 'desc' }
  });

  // Format data for the client component
  const formattedData = rawData.map(item => ({
    student_id: String(item.student_id), // <--- THE MAGIC FIX
    name: item.student_name || 'Unknown',
    branch: item.branch_code || 'N/A',
    skBarcode: item.barcode_sk || null,
    egBarcode: item.barcode_eg || null,
    skPrep: item.sk_prep || false,
    egPrep: item.eg_prep || false,
    bmPickup: item.bm_pickup || false,
    studentReceived: item.student_received || false,
    studentType: item.type || 'Unknown',
    package: item.package || 'N/A',
  }));

  return <BranchDashboardClient initialData={formattedData} />;
}