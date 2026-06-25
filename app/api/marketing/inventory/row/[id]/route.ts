import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const NUMERIC_FIELDS = [
  'in_stock', 'registered', 'buffer',
  'in_cart', 'ordered',
  'no_show', 'walk_in',
] as const;

type NumericField = typeof NUMERIC_FIELDS[number];

// Nullable override fields — for returnable items only. Pass an integer to set,
// or null to clear (revert to derived value).
const NULLABLE_FIELDS = ['total_to_bring_set', 'closing_stock_set'] as const;
type NullableField = typeof NULLABLE_FIELDS[number];

// PATCH — update one or more numeric fields on a single inventory row.
// Optional `source: 'manual' | 'auto'` controls the in_stock_manual flag
// when in_stock is being changed:
//   - source='auto'    → in_stock_manual = false  (system-set, eligible for re-sync)
//   - source='manual'  → in_stock_manual = true   (user-set, never auto-touched)
//   - source omitted   → defaults to 'manual' (safer)
// The flag is only updated when in_stock's value actually changes.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = (await req.json()) as
      Partial<Record<NumericField, number>>
      & Partial<Record<NullableField, number | null>>
      & { source?: 'manual' | 'auto' };
    const data: Partial<Record<NumericField, number>>
      & Partial<Record<NullableField, number | null>>
      & { in_stock_manual?: boolean; total_to_bring_set_manual?: boolean } = {};
    for (const field of NUMERIC_FIELDS) {
      const v = body[field];
      if (v === undefined) continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: `${field} must be a non-negative number` }, { status: 400 });
      }
      data[field] = Math.floor(n);
    }
    for (const field of NULLABLE_FIELDS) {
      if (!(field in body)) continue;
      const v = body[field];
      if (v === null) {
        data[field] = null;
      } else {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: `${field} must be a non-negative number or null` }, { status: 400 });
        }
        data[field] = Math.floor(n);
      }
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // If in_stock or total_to_bring_set is in the payload, decide whether to
    // flip the matching `_manual` flag. Only fires when the value actually changes.
    if (data.in_stock !== undefined || data.total_to_bring_set !== undefined) {
      const existing = await db.fa_marketing_inventory.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: 'Row not found' }, { status: 404 });
      }
      if (data.in_stock !== undefined && data.in_stock !== existing.in_stock) {
        data.in_stock_manual = body.source !== 'auto';
      }
      if (data.total_to_bring_set !== undefined && data.total_to_bring_set !== existing.total_to_bring_set) {
        data.total_to_bring_set_manual = body.source !== 'auto';
      }
    }

    const row = await db.fa_marketing_inventory.update({ where: { id }, data });
    return NextResponse.json({ row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[/api/marketing/inventory/row/:id PATCH] error:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
