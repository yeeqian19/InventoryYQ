import { Pool } from 'pg';

/**
 * Read-only connection pool for ebrightleads_db (FA system database).
 * Separate from the main Prisma client (which targets inv_db) because the
 * two databases are isolated and Prisma supports only one datasource.
 */
declare global {
  // eslint-disable-next-line no-var
  var __leadsPool: Pool | undefined;
}

function getLeadsPool(): Pool {
  if (!process.env.LEADS_DATABASE_URL) {
    throw new Error('LEADS_DATABASE_URL is not set in environment');
  }
  if (!global.__leadsPool) {
    global.__leadsPool = new Pool({
      connectionString: process.env.LEADS_DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
    });
  }
  return global.__leadsPool;
}

export interface FaEventRow {
  id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date:   string;
  venue:      string | null;
  status:     string | null;
}

/**
 * Fetch events from fa_events that look like marketing showcases —
 * those whose name starts with "NN-NN " (e.g. "27-28 June Weekly Showcase").
 * Skips one-offs like "FA MAY", "test", "Historical FA (pre-portal records)".
 *
 * Sorted by start_date DESC (latest first).
 */
export async function fetchMarketingEvents(): Promise<FaEventRow[]> {
  const pool = getLeadsPool();
  const result = await pool.query<{
    id: string;
    name: string;
    start_date: Date;
    end_date:   Date;
    venue:      string | null;
    status:     string | null;
  }>(
    `SELECT id, name, start_date, end_date, venue, status
       FROM public.fa_events
      WHERE name ~ '^[0-9]+-[0-9]+ '
   ORDER BY start_date DESC`
  );

  return result.rows.map(r => ({
    id:         r.id,
    name:       r.name,
    start_date: r.start_date.toISOString().slice(0, 10),
    end_date:   r.end_date.toISOString().slice(0, 10),
    venue:      r.venue,
    status:     r.status,
  }));
}

export interface BucketedCount {
  total: number;
  byGrade: Record<number, number>;   // keyed by target_grade INT (1-16)
  byBranch: Record<string, number>;  // keyed by branch code (e.g. "ST", "AMP")
}

export interface RegisteredCounts {
  registered: BucketedCount;  // confirmed + attended (committed to attend)
  absent: BucketedCount;      // no_show — confirmed but didn't attend
  walk_in: BucketedCount;     // walk_in — showed up without confirming (FA team will add this status later)
}

function emptyBucket(): BucketedCount {
  return { total: 0, byGrade: {}, byBranch: {} };
}

/**
 * Fetch invitation counts for an event, bucketed by (branch, target_grade)
 * and split across the three statuses that map onto our table columns:
 *   - "Registered" ← confirmed + attended
 *   - "Absent"     ← no_show
 *   - "Walk-in"    ← walk_in (status doesn't exist yet; will auto-populate when added)
 * Single query for efficiency.
 */
export async function fetchRegisteredCounts(eventId: string): Promise<RegisteredCounts> {
  const pool = getLeadsPool();
  const result = await pool.query<{ branch: string | null; target_grade: number | null; status: string; cnt: string }>(
    `SELECT branch, target_grade, status, COUNT(*) AS cnt
       FROM public.fa_invitations
      WHERE event_id = $1
        AND status IN ('confirmed', 'attended', 'no_show', 'walk_in')
   GROUP BY branch, target_grade, status`,
    [eventId]
  );

  const out: RegisteredCounts = {
    registered: emptyBucket(),
    absent:     emptyBucket(),
    walk_in:    emptyBucket(),
  };

  for (const r of result.rows) {
    const cnt = parseInt(r.cnt, 10) || 0;
    let target: BucketedCount;
    if (r.status === 'confirmed' || r.status === 'attended') target = out.registered;
    else if (r.status === 'no_show') target = out.absent;
    else if (r.status === 'walk_in') target = out.walk_in;
    else continue;

    target.total += cnt;
    if (r.branch) target.byBranch[r.branch] = (target.byBranch[r.branch] ?? 0) + cnt;
    if (r.target_grade !== null) target.byGrade[r.target_grade] = (target.byGrade[r.target_grade] ?? 0) + cnt;
  }

  return out;
}
