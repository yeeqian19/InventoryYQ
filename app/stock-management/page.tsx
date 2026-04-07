import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { canManageStock } from '@/lib/permissions';
import { db } from '@/lib/db';
import StockClient from './StockClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Stock Management | Inventory Panel',
  description: 'Manage inventory and starter kit pipeline.',
};

export default async function StockManagementPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/');
  if (!canManageStock(session.user.role)) redirect('/');

  const [items, starterKit] = await Promise.all([
    db.inventory.findMany({ orderBy: { name: 'asc' } }),
    db.starterKit.findUnique({ where: { id: 'default' } }),
  ]);

  return (
    <main className="min-h-screen bg-slate-50">
      <StockClient
        userRole={session.user.role}
        initialItems={items}
        initialPackedCount={starterKit?.packedCount ?? 0}
        initialNamedCount={starterKit?.namedCount ?? 0}
        initialUnnamedCount={starterKit?.unnamedCount ?? 0}
      />
    </main>
  );
}
