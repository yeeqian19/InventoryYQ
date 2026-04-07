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
    const { qty } = await req.json();
    if (!qty || qty <= 0) return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });

    const skParts = await db.inventory.findMany({
      where: { category: 'SK_ITEM' },
      select: { id: true, name: true, currentCount: true },
    });
    const insufficient = skParts.filter(p => p.currentCount < qty);

    if (insufficient.length > 0) {
      return NextResponse.json({
        error: `Not enough stock to pack ${qty} kits`,
        shortfall: insufficient.map(p => ({ name: p.name, have: p.currentCount, need: qty })),
      }, { status: 400 });
    }

    const txResults = await db.$transaction([
      ...skParts.map(part =>
        db.inventory.update({
          where: { id: part.id },
          data: { currentCount: { decrement: qty } },
        })
      ),
      db.starterKit.upsert({
        where: { id: 'default' },
        create: { id: 'default', packedCount: qty, namedCount: 0 },
        update: { packedCount: { increment: qty } },
      }),
    ]);

    const newKit = txResults[txResults.length - 1] as { packedCount: number; namedCount: number };
    return NextResponse.json({ success: true, packedCount: newKit.packedCount, namedCount: newKit.namedCount });
  } catch (err) {
    console.error('[POST /api/stock/pack]', err);
    return NextResponse.json({ error: 'Failed to pack kits.' }, { status: 500 });
  }
}

// Set the named count, unnamed count, and/or packedCount for the default starter kit
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageStock(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    const { namedCount, unnamedCount, packedCount } = body;

    if (namedCount === undefined && unnamedCount === undefined && packedCount === undefined)
      return NextResponse.json({ error: 'Provide namedCount, unnamedCount, or packedCount' }, { status: 400 });
    if (namedCount !== undefined && namedCount < 0)
      return NextResponse.json({ error: 'Invalid namedCount' }, { status: 400 });
    if (unnamedCount !== undefined && unnamedCount < 0)
      return NextResponse.json({ error: 'Invalid unnamedCount' }, { status: 400 });
    if (packedCount !== undefined && packedCount < 0)
      return NextResponse.json({ error: 'Invalid packedCount' }, { status: 400 });

    // Fetch current kit to use as base for calculations
    const currentKit = await db.starterKit.findUnique({
      where: { id: 'default' },
    });

    const currentNamed = currentKit?.namedCount ?? 0;
    const currentUnnamed = currentKit?.unnamedCount ?? 0;
    const currentPacked = currentKit?.packedCount ?? 0;

    // Determine final values
    const finalNamedCount = namedCount !== undefined ? namedCount : currentNamed;
    const finalUnnamedCount = unnamedCount !== undefined ? unnamedCount : currentUnnamed;
    
    // Calculate final packed count
    // Priority: explicit packedCount > auto-calculate from named + unnamed
    let finalPackedCount: number;
    if (packedCount !== undefined) {
      finalPackedCount = packedCount;
    } else if (unnamedCount !== undefined) {
      // When setting unnamed, auto-calculate total
      finalPackedCount = finalNamedCount + finalUnnamedCount;
    } else if (namedCount !== undefined) {
      // When setting named only, re-calculate total
      finalPackedCount = finalNamedCount + currentUnnamed;
    } else {
      finalPackedCount = currentPacked;
    }

    const kit = await db.starterKit.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        namedCount: finalNamedCount,
        unnamedCount: finalUnnamedCount,
        packedCount: finalPackedCount,
      },
      update: {
        namedCount: finalNamedCount,
        unnamedCount: finalUnnamedCount,
        packedCount: finalPackedCount,
      },
    });

    return NextResponse.json({ 
      packedCount: kit.packedCount, 
      namedCount: kit.namedCount,
      unnamedCount: kit.unnamedCount,
    });
  } catch (err) {
    console.error('[PATCH /api/stock/pack]', err);
    return NextResponse.json({ error: 'Failed to update kit counts.' }, { status: 500 });
  }
}
