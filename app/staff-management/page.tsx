import StaffClient from './StaffClient';
import { db } from '@/lib/db';

export const metadata = {
  title: 'Staff Management | Superadmin',
};

export default async function StaffManagementPage() {
  const allStaff = await db.users.findMany({
    select: { id: true, name: true, email: true, role: true, branch_name: true, created_at: true },
    orderBy: { role: 'asc' },
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <StaffClient initialData={allStaff} />
    </main>
  );
}
