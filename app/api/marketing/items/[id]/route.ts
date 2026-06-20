import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// "BANNER" → "Banner", "weekly stand" → "Weekly Stand"
function toTitleCase(s: string): string {
  return s.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function normalizeGrades(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of input) {
    const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : null;
    if (!s) return null;
    if (!seen.has(s)) { seen.add(s); result.push(s); }
  }
  return result;
}

function normalizeBranches(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of input) {
    if (typeof v !== 'string') return null;
    const trimmed = v.trim();
    if (!trimmed) return null;
    if (!seen.has(trimmed)) { seen.add(trimmed); result.push(trimmed); }
  }
  return result;
}

// PATCH — rename an item and/or change its grades/branches/returnable.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = (await req.json()) as { name?: string; grades?: unknown; branches?: unknown; returnable?: unknown };
    const data: { name?: string; grades?: string[]; branches?: string[]; returnable?: boolean } = {};

    if (body.name !== undefined) {
      const normalized = toTitleCase(body.name);
      if (!normalized) {
        return NextResponse.json({ error: 'name is required' }, { status: 400 });
      }
      const dup = await db.fa_marketing_items.findFirst({
        where: { name: normalized, NOT: { id } },
      });
      if (dup) {
        return NextResponse.json({ error: `Item "${normalized}" already exists` }, { status: 409 });
      }
      data.name = normalized;
    }

    if (body.grades !== undefined) {
      const grades = normalizeGrades(body.grades);
      if (grades === null) {
        return NextResponse.json({ error: 'grades must be an array of positive integers' }, { status: 400 });
      }
      data.grades = grades;
    }

    if (body.branches !== undefined) {
      const branches = normalizeBranches(body.branches);
      if (branches === null) {
        return NextResponse.json({ error: 'branches must be an array of non-empty strings' }, { status: 400 });
      }
      data.branches = branches;
    }

    if (body.returnable !== undefined) {
      data.returnable = body.returnable === true;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Validate: can't have both grades and branches active
    if (data.grades && data.branches && data.grades.length > 0 && data.branches.length > 0) {
      return NextResponse.json({ error: 'Item can use either grades or branches, not both' }, { status: 400 });
    }
    // Also check against existing data if only one is being updated
    if ((data.grades && data.grades.length > 0) || (data.branches && data.branches.length > 0)) {
      const existing = await db.fa_marketing_items.findUnique({ where: { id } });
      if (existing) {
        const finalGrades   = data.grades   ?? existing.grades;
        const finalBranches = data.branches ?? existing.branches;
        if (finalGrades.length > 0 && finalBranches.length > 0) {
          return NextResponse.json({ error: 'Item can use either grades or branches, not both' }, { status: 400 });
        }
      }
    }

    const item = await db.fa_marketing_items.update({ where: { id }, data });
    return NextResponse.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[/api/marketing/items/:id PATCH] error:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — remove a custom item (default items are blocked)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const existing = await db.fa_marketing_items.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    if (existing.is_default) {
      return NextResponse.json({ error: 'Default items cannot be deleted' }, { status: 403 });
    }
    await db.fa_marketing_items.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[/api/marketing/items/:id DELETE] error:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
