import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMobileSession } from '@/lib/mobileAuth';
import { canManageStock } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// Read endpoint for the mobile Stock Management screen.
// Mirrors app/stock-management/page.tsx: inventory items + the default StarterKit counts.
export async function GET() {
  const session = await getMobileSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canManageStock(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [items, starterKit] = await Promise.all([
    db.inventory.findMany({ orderBy: { name: 'asc' } }),
    db.starterKit.findUnique({ where: { id: 'default' } }),
  ]);

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      currentCount: i.currentCount,
      threshold: i.threshold,
      neededCount: i.neededCount,
      inCartCount: i.inCartCount,
      orderedCount: i.orderedCount,
      link: i.link,
      category: i.category,
    })),
    packedCount: starterKit?.packedCount ?? 0,
    namedCount: starterKit?.namedCount ?? 0,
    unnamedCount: starterKit?.unnamedCount ?? 0,
  });
}
