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
          // Union the three status buckets' grades so we auto-extend for any
          // target_grade that appears in confirmed/attended/no_show/walk_in.
          const allTargetInts = new Set<string>([
            ...Object.keys(counts.registered.byGrade),
            ...Object.keys(counts.absent.byGrade),
            ...Object.keys(counts.walk_in.byGrade),
          ]);
          for (const k of allTargetInts) {
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
          // Union branches across all three status buckets, same reason as grades.
          const allBranches = new Set<string>([
            ...Object.keys(counts.registered.byBranch),
            ...Object.keys(counts.absent.byBranch),
            ...Object.keys(counts.walk_in.byBranch),
          ]);
          for (const b of allBranches) {
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

    // ── OVERRIDE registered, no_show, walk_in WITH LIVE COUNTS ──
    // Each comes from fa_invitations grouped by branch/target_grade:
    //   - registered ← confirmed + attended
    //   - no_show    ← no_show (shown as "Absent")
    //   - walk_in    ← walk_in (status not added yet; will populate when FA team adds it)
    // Bucketing rules per row:
    //   - row has grade  → look up by target_grade
    //   - row has branch → look up by branch
    //   - otherwise      → use the bucket's overall total
    let enrichedRows = rows;
    if (counts) {
      const pick = (bucket: typeof counts.registered, grade: string | null, branch: string | null) => {
        if (grade !== null) {
          const t = GRADE_TO_TARGET_INT[grade] ?? -1;
          return bucket.byGrade[t] ?? 0;
        }
        if (branch !== null) return bucket.byBranch[branch] ?? 0;
        return bucket.total;
      };
      enrichedRows = rows.map(r => ({
        ...r,
        registered: pick(counts!.registered, r.grade, r.branch),
        no_show:    pick(counts!.absent,     r.grade, r.branch),
        walk_in:    pick(counts!.walk_in,    r.grade, r.branch),
      }));
    }

    return NextResponse.json({ rows: enrichedRows, items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[/api/marketing/inventory/:eventId GET] error:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
