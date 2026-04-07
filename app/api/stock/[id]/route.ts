import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { canManageStock } from '@/lib/permissions';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageStock(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const itemId = parseInt(id, 10);
  if (isNaN(itemId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    const body = await req.json();
    const { action, qty, threshold, neededCount, link, currentCount, category } = body;

    if (action === 'checkout' || action === 'receive') {
      const item = await db.inventory.findUnique({ where: { id: itemId } });
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

      if (action === 'checkout') {
        const amount = Math.min(qty, item.inCartCount);
        const updated = await db.inventory.update({
          where: { id: itemId },
          data: { inCartCount: { decrement: amount }, orderedCount: { increment: amount } },
        });
        return NextResponse.json(updated);
      }

      const amount = Math.min(qty, item.orderedCount);
      const updated = await db.inventory.update({
        where: { id: itemId },
        data: { orderedCount: { decrement: amount }, currentCount: { increment: amount } },
      });
      return NextResponse.json(updated);
    }

    if (action === 'adjust') {
      const updated = await db.inventory.update({
        where: { id: itemId },
        data: { inCartCount: { increment: qty } },
      });
      return NextResponse.json(updated);
    }

    if (action === 'edit') {
      const updated = await db.inventory.update({
        where: { id: itemId },
        data: {
          ...(threshold    !== undefined && { threshold }),
          ...(neededCount  !== undefined && { neededCount }),
          ...(link         !== undefined && { link }),
          ...(currentCount !== undefined && { currentCount }),
          ...(category     !== undefined && { category, isSkPart: category === 'SK_ITEM' }),
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error(`[PATCH /api/stock/${itemId}]`, err);
    return NextResponse.json({ error: 'Failed to update item.' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageStock(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const itemId = parseInt(id, 10);
  if (isNaN(itemId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    await db.inventory.delete({ where: { id: itemId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`[DELETE /api/stock/${itemId}]`, err);
    return NextResponse.json({ error: 'Failed to delete item.' }, { status: 500 });
  }
}
