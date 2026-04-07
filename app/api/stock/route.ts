import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { canManageStock } from '@/lib/permissions';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageStock(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { name, threshold, neededCount, link, category } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const cat: string = category ?? 'SK_ITEM';
    const item = await db.inventory.create({
      data: {
        name:         name.trim(),
        threshold:    threshold ?? 0,
        neededCount:  neededCount ?? 0,
        link:         link || null,
        isSkPart:     cat === 'SK_ITEM',
        category:     cat,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err: unknown) {
    // Prisma unique constraint: P2002
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'An item with that name already exists.' }, { status: 409 });
    }
    console.error('[POST /api/stock]', err);
    return NextResponse.json({ error: 'Failed to create item.' }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [items, starterKit] = await Promise.all([
      db.inventory.findMany({ orderBy: { name: 'asc' } }),
      db.starterKit.findUnique({ where: { id: 'default' } }),
    ]);
    return NextResponse.json({ 
      items, 
      packedCount: starterKit?.packedCount ?? 0, 
      namedCount: starterKit?.namedCount ?? 0,
      unnamedCount: starterKit?.unnamedCount ?? 0,
    });
  } catch (err) {
    console.error('[GET /api/stock]', err);
    return NextResponse.json({ error: 'Failed to fetch items.' }, { status: 500 });
  }
}
