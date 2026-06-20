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

export interface RegisteredCounts {
  total: number;
  byGrade: Record<number, number>;   // keyed by target_grade INT (1-16)
  byBranch: Record<string, number>;  // keyed by branch code (e.g. "ST", "AMP")
}

/**
 * Fetch the count of CONFIRMED invitations for an event, bucketed by
 * (branch, target_grade). Used to populate the live "Registered" column
 * in the Marketing Inventory table.
 */
export async function fetchRegisteredCounts(eventId: string): Promise<RegisteredCounts> {
  const pool = getLeadsPool();
  // Students with status 'attended' confirmed first (it's a normal progression
  // confirmed → attended), so we count both as "registered" for inventory planning.
  const result = await pool.query<{ branch: string | null; target_grade: number | null; cnt: string }>(
    `SELECT branch, target_grade, COUNT(*) AS cnt
       FROM public.fa_invitations
      WHERE event_id = $1 AND status IN ('confirmed', 'attended')
   GROUP BY branch, target_grade`,
    [eventId]
  );

  let total = 0;
  const byGrade: Record<number, number> = {};
  const byBranch: Record<string, number> = {};

  for (const r of result.rows) {
    const cnt = parseInt(r.cnt, 10) || 0;
    total += cnt;
    if (r.branch) byBranch[r.branch] = (byBranch[r.branch] ?? 0) + cnt;
    if (r.target_grade !== null) byGrade[r.target_grade] = (byGrade[r.target_grade] ?? 0) + cnt;
  }

  return { total, byGrade, byBranch };
}
