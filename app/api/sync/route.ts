import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface SyncRecord {
  student_name: string;
  package: string;
  type: string;
  branch_code: string;
  doc_no: string;
  doc_date: string;
}

/**
 * Split a raw student_name like "Ayra & Lisa" or "Ayra, Lisa" into
 * individual names. Returns a single-element array if no separator found.
 */
function splitSiblings(raw: string): string[] {
  const parts = raw
    .split(/\s*[&,]\s*|\s+and\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : [raw.trim()];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SyncRecord | SyncRecord[];
    const records = Array.isArray(body) ? body : [body];

    if (records.length === 0) {
      return NextResponse.json({ error: 'No records provided' }, { status: 400 });
    }

    // Expand sibling records — "Ayra & Lisa" becomes two separate rows
    const data = records.flatMap((r) => {
      const names = splitSiblings(r.student_name ?? '');
      return names.map((name) => ({
        student_name: name,
        package:      r.package     ?? null,
        type:         r.type        ?? null,
        branch_code:  r.branch_code ?? null,
        doc_no:       r.doc_no      ?? null,
        doc_date:     r.doc_date ? new Date(r.doc_date) : null,
      }));
    });

    const result = await db.inventory_distribution_new.createMany({
      data,
      skipDuplicates: true,
    });

    return NextResponse.json(
      { success: true, inserted: result.count, expanded: data.length },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[sync] Error:', error);
    return NextResponse.json({ error: 'Sync failed: ' + message }, { status: 500 });
  }
}
