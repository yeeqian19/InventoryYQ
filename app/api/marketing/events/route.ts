import { NextResponse } from 'next/server';
import { fetchMarketingEvents } from '@/lib/leadsDb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketing/events
 *
 * Returns marketing events fetched from ebrightleads_db.fa_events,
 * filtered to those whose name starts with NN-NN (e.g. "27-28 June Weekly Showcase").
 * Authentication intentionally NOT required at this Phase 1 stage so we can
 * curl-test it directly; will lock it down once UI wiring is verified.
 */
export async function GET() {
  try {
    const events = await fetchMarketingEvents();
    return NextResponse.json({ events, count: events.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[/api/marketing/events] error:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
