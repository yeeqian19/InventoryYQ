import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// "BANNER" → "Banner", "weekly stand" → "Weekly Stand"
function toTitleCase(s: string): string {
  return s.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// Validate a grades payload: array of non-empty strings (e.g. "1", "A1", "B2"),
// deduped, preserving input order.
function normalizeGrades(input: unknown): string[] | null {
  if (input === undefined || input === null) return [];
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

// Validate a branches payload: must be an array of non-empty strings, deduped, in given order.
function normalizeBranches(input: unknown): string[] | null {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of input) {
    if (typeof v !== 'string') return null;
    const trimmed = v.trim();
    if (!trimmed) return null;
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

// GET — list all items (defaults first, then alphabetical)
export async function GET() {
  try {
    const items = await db.fa_marketing_items.findMany({
      orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
    });
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[/api/marketing/items GET] error:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — create a custom item
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { name?: string; grades?: unknown; branches?: unknown; returnable?: unknown };
    const normalized = toTitleCase(body.name ?? '');
    if (!normalized) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    const grades = normalizeGrades(body.grades);
    if (grades === null) {
      return NextResponse.json({ error: 'grades must be an array of positive integers' }, { status: 400 });
    }
    const branches = normalizeBranches(body.branches);
    if (branches === null) {
      return NextResponse.json({ error: 'branches must be an array of non-empty strings' }, { status: 400 });
    }
    if (grades.length > 0 && branches.length > 0) {
      return NextResponse.json({ error: 'Item can use either grades or branches, not both' }, { status: 400 });
    }
    const returnable = body.returnable === true;
    const existing = await db.fa_marketing_items.findUnique({ where: { name: normalized } });
    if (existing) {
      return NextResponse.json({ error: `Item "${normalized}" already exists` }, { status: 409 });
    }
    const item = await db.fa_marketing_items.create({
      data: { name: normalized, is_default: false, grades, branches, returnable },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[/api/marketing/items POST] error:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
