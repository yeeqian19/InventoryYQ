import prisma from '@/lib/db'; 
import RM_DashboardClient from './RM_DashboardClient';

// 1. FORCE FRESH DATA
export const revalidate = 0; 

// Helper function to fetch and transform data
async function fetchDashboardData() {
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

  // 3. MAPPING & EXACT SYNCED LOGIC
  return data.map((item) => {
    
    const rawType = (item.type || '').trim().toUpperCase();
    const pkg = item.package ? item.package.toString().trim().toUpperCase() : "";
    
    // A. Strictly determine Student Type
    let studentType = 'NEW';
    if (rawType.includes('RENEWAL')) studentType = 'RENEWAL';
    else if (rawType.includes('TRIAL')) studentType = 'TRIAL';

    // Clean Student Name
    const cleanName = item.student_name && item.student_name.trim() !== "" 
      ? item.student_name.trim() 
      : "NAME MISSING";

    // B. SK & EG Eligibility Rules
    // Rule 1: SK is ONLY for NEW students
    const hasSK = studentType === "NEW";

    // Rule 2: EG is ONLY for NEW students with 9M or 12M
    const is9M = /\b9\b/.test(pkg) || pkg.includes('9M');
    const is12M = /\b12\b/.test(pkg) || pkg.includes('12M');
    const hasEG = studentType === "NEW" && (is9M || is12M);

    // Rule 3: Determine exact gift type for the UI
    const giftType = hasEG ? (is9M ? 'LEGO' : 'SMARTWATCH') : null;

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
      hasSK: hasSK,
      hasEG: hasEG, 
      giftType: giftType,
      created_at: item.doc_date ? item.doc_date.toISOString() : undefined,
    };
  });
}

export default async function RMDashboardPage() {
  let serializedData;
  let error: Error | null = null;
  
  try {
    serializedData = await fetchDashboardData();
  } catch (e) {
    error = e as Error;
    console.error("Database Error:", error);
  }

  if (error) {
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

  return (
    <div className="fixed inset-0 z-[9999] bg-[#f8fafc] overflow-y-auto">
      <RM_DashboardClient initialData={serializedData!} />
    </div>
  );
}