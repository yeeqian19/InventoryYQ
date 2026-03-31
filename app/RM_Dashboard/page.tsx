// app/RM_Dashboard/page.tsx

import prisma from '@/lib/db'; 
import RM_DashboardClient from './RM_DashboardClient';

// 1. FORCE FRESH DATA
export const revalidate = 0; 

export default async function RMDashboardPage() {
  try {
    // 2. FETCH DATA FROM DATABASE
    const data = await prisma.inventory_distribution.findMany({
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
      orderBy: {
        doc_date: 'desc',
      },
    });

    // 3. MAPPING & SYNCHRONIZATION LOGIC
    const serializedData = data.map((item) => {
      // Standardize Student Type
      const studentType = item.type?.toUpperCase() || 'NEW';
      
      // Clean Package String (Trim spaces, make uppercase for consistency)
      const pkg = item.package ? item.package.toString().trim().toUpperCase() : "";
      
      // Clean Student Name
      const cleanName = item.student_name && item.student_name.trim() !== "" 
        ? item.student_name.trim() 
        : "NAME MISSING";

      // --- SYNC LOGIC UPDATED FOR "12M" / "9M" ---
      const isEligibleType = studentType === "NEW" || studentType === "RENEWAL";
      
      // Use startsWith to catch "12M", "12 Months", "9M" or just "9"/"12"
      const isDoublePackage = pkg.startsWith("9") || pkg.startsWith("12");
      
      const hasEG = isEligibleType && isDoublePackage;

      return {
        student_id: item.student_id.toString(),
        name: cleanName, 
        branch: item.branch_code || 'Unknown',
        sk_prep: !!item.sk_prep,
        eg_prep: !!item.eg_prep,
        bm_pickup: !!item.bm_pickup,
        student_received: !!item.student_received,
        type: studentType, 
        package: pkg,
        hasEG: hasEG, 
        created_at: item.doc_date ? item.doc_date.toISOString() : undefined,
      };
    });

    return (
      <div className="fixed inset-0 z-[9999] bg-[#f8fafc] overflow-y-auto">
        <RM_DashboardClient initialData={serializedData} />
      </div>
    );
  } catch (error) {
    console.error("Database Error:", error);
    return (
      <div className="p-20 text-center">
        <h1 className="text-red-500 font-black text-2xl uppercase italic underline decoration-wavy">
          System Sync Error
        </h1>
        <p className="text-slate-500 mt-4 font-bold max-w-md mx-auto">
          RM Dashboard could not connect to the Inventory database.
        </p>
      </div>
    );
  }
}