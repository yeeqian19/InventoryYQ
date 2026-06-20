import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchRegisteredCounts } from '@/lib/leadsDb';

export const dynamic = 'force-dynamic';

// Map text grade labels to the INTEGER values stored in fa_invitations.target_grade.
// Standard 1-8 stay numeric; A1-A4 → 9-12; B1-B4 → 13-16.
const GRADE_TO_TARGET_INT: Record<string, number> = {
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  'A1': 9, 'A2': 10, 'A3': 11, 'A4': 12,
  'B1': 13, 'B2': 14, 'B3': 15, 'B4': 16,
};

// Reverse map (used for auto-extending an item's grades when fa_invitations
// references a target_grade the item doesn't yet know about).
const TARGET_INT_TO_GRADE: Record<number, string> = {
  1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
  9: 'A1', 10: 'A2', 11: 'A3', 12: 'A4',
  13: 'B1', 14: 'B2', 15: 'B3', 16: 'B4',
};

// GET — list all inventory rows for an event.
// Auto-creates missing rows so the catalog is always complete:
//   - Item with no grades AND no branches      → 1 row (grade=NULL, branch=NULL)
//   - Item with grades [1..8]                   → 8 rows (grade=N, branch=NULL)
//   - Item with branches ['ST','BTHO',...]      → N rows (grade=NULL, branch=X)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  try {
    let items = await db.fa_marketing_items.findMany({
      orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
    });

    // Pull live confirmed-invitation counts first so we can both (a) auto-extend
    // an item's grades/branches when fa_invitations references a grade or branch
    // the item doesn't yet know about, and (b) override the row's `registered`.
    let counts: Awaited<ReturnType<typeof fetchRegisteredCounts>> | null = null;
    try {
      counts = await fetchRegisteredCounts(eventId);
    } catch (err) {
      console.error('[/api/marketing/inventory/:eventId GET] live counts failed:', err);
    }

    // ── AUTO-EXTEND ITEMS ──
    // Only items that already have a breakdown (grades.length>0 or branches.length>0)
    // are eligible. We don't auto-add grades/branches to items that intentionally
    // have none (e.g. Certificate, Banner).
    let itemsChanged = false;
    if (counts) {
      for (const it of items) {
        // Auto-add grades found in fa_invitations.target_grade but not in item.grades.
        if (it.grades.length > 0) {
          const knownTargetInts = new Set(
            it.grades.map(g => GRADE_TO_TARGET_INT[g]).filter((v): v is number => v !== undefined)
          );
          const newLabels: string[] = [];
          for (const k of Object.keys(counts.byGrade)) {
            const t = parseInt(k, 10);
            if (knownTargetInts.has(t)) continue;
            const label = TARGET_INT_TO_GRADE[t];
            if (!label || it.grades.includes(label)) continue;
            newLabels.push(label);
          }
          if (newLabels.length > 0) {
            const newGrades = [...it.grades, ...newLabels];
            await db.fa_marketing_items.update({ where: { id: it.id }, data: { grades: newGrades } });
            it.grades = newGrades;
            itemsChanged = true;
          }
        }
        // Auto-add branches found in fa_invitations.branch but not in item.branches.
        if (it.branches.length > 0) {
          const newBranches: string[] = [];
          for (const b of Object.keys(counts.byBranch)) {
            if (it.branches.includes(b)) continue;
            newBranches.push(b);
          }
          if (newBranches.length > 0) {
            const newList = [...it.branches, ...newBranches];
            await db.fa_marketing_items.update({ where: { id: it.id }, data: { branches: newList } });
            it.branches = newList;
            itemsChanged = true;
          }
        }
      }
    }

    if (itemsChanged) {
      // Re-fetch with the canonical sort order so the response is stable.
      items = await db.fa_marketing_items.findMany({
        orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
      });
    }

    // ── AUTO-CREATE MISSING INVENTORY ROWS ──
    const existing = await db.fa_marketing_inventory.findMany({
      where: { event_id: eventId },
    });
    const keyFor = (itemId: string, grade: string | null, branch: string | null) =>
      `${itemId}|${grade ?? 'NULL'}|${branch ?? 'NULL'}`;
    const existingKeys = new Set(existing.map(r => keyFor(r.item_id, r.grade, r.branch)));

    const toCreate: { event_id: string; item_id: string; grade: string | null; branch: string | null }[] = [];
    for (const it of items) {
      let combos: { grade: string | null; branch: string | null }[];
      if (it.grades.length > 0) {
        combos = it.grades.map(g => ({ grade: g, branch: null }));
      } else if (it.branches.length > 0) {
        combos = it.branches.map(b => ({ grade: null, branch: b }));
      } else {
        combos = [{ grade: null, branch: null }];
      }
      for (const c of combos) {
        if (!existingKeys.has(keyFor(it.id, c.grade, c.branch))) {
          toCreate.push({ event_id: eventId, item_id: it.id, grade: c.grade, branch: c.branch });
        }
      }
    }
    if (toCreate.length > 0) {
      await db.fa_marketing_inventory.createMany({ data: toCreate, skipDuplicates: true });
    }

    const rows = await db.fa_marketing_inventory.findMany({
      where: { event_id: eventId },
      orderBy: [{ item_id: 'asc' }, { grade: 'asc' }, { branch: 'asc' }],
    });

    // ── OVERRIDE registered WITH LIVE COUNTS ──
    // Bucketing rules:
    //   - row has grade  → count where target_grade matches (1-8 / A1-A4 / B1-B4)
    //   - row has branch → count where branch matches
    //   - otherwise      → total confirmed for the event
    let enrichedRows = rows;
    if (counts) {
      enrichedRows = rows.map(r => {
        let registered = counts!.total;
        if (r.grade !== null) {
          const targetInt = GRADE_TO_TARGET_INT[r.grade] ?? -1;
          registered = counts!.byGrade[targetInt] ?? 0;
        } else if (r.branch !== null) {
          registered = counts!.byBranch[r.branch] ?? 0;
        }
        return { ...r, registered };
      });
    }

    return NextResponse.json({ rows: enrichedRows, items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[/api/marketing/inventory/:eventId GET] error:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
