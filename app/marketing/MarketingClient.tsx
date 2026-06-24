'use client';

import { useState, useMemo, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';

// ── TYPES ────────────────────────────────────────────────────────────────────

type EventStatus = 'draft' | 'open' | 'closed' | 'completed';
type StatusFilter = 'all' | EventStatus;

interface MarketingItem {
  id: string;
  name: string;
  is_default: boolean;
  grades: string[];   // empty = no grade breakdown (e.g. Medal: ['1'..'8','A1'..'B4'])
  branches: string[]; // empty = no branch breakdown (e.g. Sash: ['ST', 'BTHO', ...])
  returnable: boolean; // true = items come back after event (e.g. Sash). Skips consumption in closing_stock.
}

interface MarketingEvent {
  id: string;
  event_name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  venue: string;
  status: EventStatus;
}

interface InventoryRow {
  id: string;
  event_id: string;
  item_id: string;
  grade: string | null;
  branch: string | null;
  in_stock: number;
  in_stock_manual: boolean; // true = user-set (locked); false = auto-set (re-syncable)
  // Returnable items only: when set, override the derived value. Null = use derivation.
  total_to_bring_set: number | null;
  // True = user typed total_to_bring_set; false = auto-carried.
  total_to_bring_set_manual: boolean;
  closing_stock_set: number | null;
  registered: number;
  buffer: number;
  in_cart: number;
  ordered: number;
  no_show: number;
  walk_in: number;
}

// ── CONSTANTS ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_STYLES: Record<EventStatus, { bg: string; text: string; dot: string; label: string }> = {
  draft:     { bg: 'bg-slate-200',   text: 'text-slate-600',   dot: 'bg-slate-400',   label: 'Draft' },
  open:      { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Open' },
  closed:    { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'Closed' },
  completed: { bg: 'bg-rose-100',    text: 'text-rose-700',    dot: 'bg-rose-500',    label: 'Completed' },
};

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all',       label: 'All Statuses' },
  { value: 'draft',     label: 'Draft' },
  { value: 'open',      label: 'Open' },
  { value: 'closed',    label: 'Closed' },
  { value: 'completed', label: 'Completed' },
];

function normalizeStatus(raw: string | null | undefined): EventStatus {
  const v = (raw ?? '').toLowerCase().trim();
  if (v === 'draft')     return 'draft';
  if (v === 'closed')    return 'closed';
  if (v === 'completed') return 'completed';
  return 'open';
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function mkRow(id: string, event_id: string, item_id: string, overrides: Partial<InventoryRow> = {}): InventoryRow {
  return {
    id, event_id, item_id,
    grade: null, branch: null,
    in_stock: 0, in_stock_manual: false,
    total_to_bring_set: null, total_to_bring_set_manual: false, closing_stock_set: null,
    registered: 0, buffer: 0,
    in_cart: 0, ordered: 0,
    no_show: 0, walk_in: 0,
    ...overrides,
  } as InventoryRow;
}

// Parse a grades input string into a deduped, input-order string array.
// Accepts:
//   "1-8"            → ["1","2","3","4","5","6","7","8"]
//   "A1-A4"          → ["A1","A2","A3","A4"]            (prefix+number range)
//   "1,2,A1,A2"      → as listed
//   "1-8, A1-A4, B1-B4" → mixed
//   ""               → []
// Returns null on invalid input.
function parseGrades(input: string): string[] | null {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  const push = (v: string) => { if (!seen.has(v)) { seen.add(v); result.push(v); } };

  for (const part of trimmed.split(',')) {
    const p = part.trim();
    if (!p) continue;

    // Pure numeric range: "1-8"
    const numRange = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (numRange) {
      const a = parseInt(numRange[1], 10);
      const b = parseInt(numRange[2], 10);
      if (a < 1 || b < 1 || a > b) return null;
      for (let i = a; i <= b; i++) push(String(i));
      continue;
    }

    // Prefix+number range: "A1-A4" or "Lvl5-Lvl9" (same letter prefix required)
    const prefixRange = p.match(/^([A-Za-z]+)(\d+)\s*-\s*([A-Za-z]+)(\d+)$/);
    if (prefixRange && prefixRange[1] === prefixRange[3]) {
      const prefix = prefixRange[1];
      const a = parseInt(prefixRange[2], 10);
      const b = parseInt(prefixRange[4], 10);
      if (a < 1 || b < 1 || a > b) return null;
      for (let i = a; i <= b; i++) push(`${prefix}${i}`);
      continue;
    }

    // Single label (alphanumeric only)
    if (/^[A-Za-z0-9]+$/.test(p)) {
      push(p);
      continue;
    }

    return null;
  }

  return result;
}

function formatGrades(grades: string[]): string {
  return grades.join(', ');
}

// The event NAME is the source of truth for when the event happens
// (e.g. "30-31 May Weekly Showcase" → end_day=31, month=May), because
// the date columns in fa_events are sometimes set incorrectly.
// Returns a YYYY-MM-DD string keyed off the END day of the range,
// suitable for descending sort to find the latest event.
function eventEndDateFromName(name: string, fallbackYear: number): string {
  const match = name.match(/^(\d+)-(\d+)\s+(\w+)/);
  if (!match) return `${fallbackYear}-00-00`;
  const endDay = parseInt(match[2], 10);
  const monthIdx = MONTH_NAMES.findIndex(m => m.toLowerCase() === match[3].toLowerCase());
  if (monthIdx === -1) return `${fallbackYear}-00-00`;
  return `${fallbackYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
}

// `returnable` items (e.g. Sash) come back after the event. They don't consume
// stock and they use editable overrides:
//   - total_to_bring_set  → user-entered "how many to bring" (default = in_stock)
//   - closing_stock_set   → user-entered count after event (default = in_stock + ordered)
// For returnable items, `returned` mirrors `closing_stock` since "items returned
// from students" equals "items now in our store" for fully-returnable inventory.
function calcDerived(row: InventoryRow, returnable: boolean = false) {
  const total_to_bring = returnable
    ? (row.total_to_bring_set ?? row.in_stock)
    : (row.registered + row.buffer);
  const shortfall = total_to_bring - row.in_stock;
  const actual_attended = row.registered - row.no_show + row.walk_in;
  const closing_stock = returnable
    ? (row.closing_stock_set ?? (row.in_stock + row.ordered))
    : row.in_stock + row.ordered - actual_attended;
  // For consumables: returned = unused leftover from what we packed (total_to_bring − actual_attended)
  // For returnables:  returned = closing_stock (locked-mirror of what's now back in store)
  const returned = returnable ? closing_stock : (total_to_bring - actual_attended);
  return { total_to_bring, shortfall, actual_attended, returned, closing_stock };
}

function formatEventDateRange(e: MarketingEvent): string {
  // Source of truth: the event NAME. The fa_events table's start_date/end_date
  // columns are sometimes set incorrectly (e.g. an event named "30-31 May"
  // with database dates in June), so we parse the name first and only fall
  // back to the columns if the name doesn't match the expected pattern.
  const year = new Date(e.start_date).getFullYear();
  const match = e.event_name.match(/^(\d+)-(\d+)\s+(\w+)/);
  if (match) {
    const startDay = parseInt(match[1], 10);
    const endDay = parseInt(match[2], 10);
    const monthIdx = MONTH_NAMES.findIndex(m => m.toLowerCase() === match[3].toLowerCase());
    if (monthIdx !== -1) {
      return `${startDay}–${endDay} ${MONTH_NAMES[monthIdx]} ${year}`;
    }
  }
  // Fallback to column-based formatting if the name doesn't match.
  const s = new Date(e.start_date);
  const en = new Date(e.end_date);
  if (s.getMonth() === en.getMonth()) {
    return `${s.getDate()}–${en.getDate()} ${MONTH_NAMES[s.getMonth()]} ${year}`;
  }
  return `${s.getDate()} ${MONTH_NAMES[s.getMonth()]} – ${en.getDate()} ${MONTH_NAMES[en.getMonth()]} ${year}`;
}

/**
 * Post-event columns lock until the event's start date arrives.
 * Once today >= start_date, they unlock and stay unlocked forever (regardless of status).
 */
function isPostEventLocked(event: MarketingEvent): boolean {
  const todayYmd = new Date().toISOString().slice(0, 10);
  return todayYmd < event.start_date;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

export default function MarketingClient({ userName }: { userName: string; userRole: string }) {
  const [items, setItems]         = useState<MarketingItem[]>([]);
  const [events, setEvents]       = useState<MarketingEvent[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Fetch items list from inv_db on mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/marketing/items')
      .then(r => r.json())
      .then((data: { items?: MarketingItem[] }) => {
        if (!cancelled && data.items) setItems(data.items);
      })
      .catch(err => console.error('Failed to fetch items:', err));
    return () => { cancelled = true; };
  }, []);

  const today = new Date();
  const [year, setYear]   = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Fetch real events from FA system on mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/marketing/events')
      .then(r => r.json())
      .then((data: { events?: { id: string; name: string; start_date: string; end_date: string; venue: string | null; status: string | null }[] }) => {
        if (cancelled) return;
        const evs: MarketingEvent[] = (data.events ?? []).map(e => ({
          id:         e.id,
          event_name: e.name,
          start_date: e.start_date,
          end_date:   e.end_date,
          venue:      e.venue ?? '',
          status:     normalizeStatus(e.status),
        }));
        setEvents(evs);
      })
      .catch(err => console.error('Failed to fetch events:', err))
      .finally(() => { if (!cancelled) setLoadingEvents(false); });
    return () => { cancelled = true; };
  }, []);

  // ── derived filter scope ───────────────────────────────────────────────────
  const allYears = useMemo(() => {
    // Years are based on raw events list (so Year dropdown stays stable
    // regardless of which Status is selected).
    const set = new Set(events.map(e => new Date(e.start_date).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [events]);

  // Status filter narrows the entire scope — only show years/months that
  // actually have events matching the selected status.
  const eventsByStatus = useMemo(
    () => statusFilter === 'all' ? events : events.filter(e => e.status === statusFilter),
    [events, statusFilter]
  );

  const monthsInYear = useMemo(() => {
    const set = new Set(
      eventsByStatus
        .filter(e => new Date(e.start_date).getFullYear() === year)
        .map(e => new Date(e.start_date).getMonth())
    );
    return Array.from(set).sort((a, b) => b - a);
  }, [eventsByStatus, year]);

  const eventsInMonth = useMemo(() => {
    return eventsByStatus
      .filter(e => {
        const d = new Date(e.start_date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .sort((a, b) => {
        // Sort by the date encoded in the event NAME (e.g. "30-31 May" → day 31),
        // descending — most recent first. Falls back consistently because the
        // year is the same within a month filter.
        const aYear = new Date(a.start_date).getFullYear();
        const bYear = new Date(b.start_date).getFullYear();
        return eventEndDateFromName(b.event_name, bYear)
          .localeCompare(eventEndDateFromName(a.event_name, aYear));
      });
  }, [eventsByStatus, year, month]);

  useEffect(() => {
    if (eventsInMonth.length === 0) setSelectedEventId(null);
    else if (!selectedEventId || !eventsInMonth.find(e => e.id === selectedEventId)) {
      setSelectedEventId(eventsInMonth[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsInMonth]);

  // Track when the inventory was last successfully fetched (for the
  // "Updated X ago" indicator and auto-poll trigger).
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refreshSelectedInventory(): Promise<void> {
    if (!selectedEventId) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/marketing/inventory/${selectedEventId}`);
      const data = (await res.json()) as { rows?: InventoryRow[]; items?: MarketingItem[] };
      if (data.rows) {
        setInventory(prev => [
          ...prev.filter(r => r.event_id !== selectedEventId),
          ...data.rows!,
        ]);
        setLastFetchedAt(Date.now());
      }
      // Server may have auto-extended item.grades or item.branches when
      // fa_invitations referenced values not yet configured. Sync local state.
      if (data.items) {
        setItems(data.items);
      }
    } catch (err) {
      console.error('Failed to refresh inventory:', err);
    } finally {
      setIsRefreshing(false);
    }
  }

  // Initial + on-event-change fetch (keeps prior behaviour).
  useEffect(() => {
    if (!selectedEventId) return;
    let cancelled = false;
    fetch(`/api/marketing/inventory/${selectedEventId}`)
      .then(r => r.json())
      .then((data: { rows?: InventoryRow[]; items?: MarketingItem[] }) => {
        if (cancelled || !data.rows) return;
        setInventory(prev => [
          ...prev.filter(r => r.event_id !== selectedEventId),
          ...data.rows!,
        ]);
        setLastFetchedAt(Date.now());
        if (data.items) setItems(data.items);
      })
      .catch(err => console.error('Failed to fetch inventory:', err));
    return () => { cancelled = true; };
  }, [selectedEventId, items.length]);

  // Auto-poll every 30s so live `registered` counts stay fresh without a manual refresh.
  useEffect(() => {
    if (!selectedEventId) return;
    const id = setInterval(() => { void refreshSelectedInventory(); }, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  // "Updated Xs ago" ticker — re-renders once per second.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secondsSinceFetch = Math.floor((nowTick - lastFetchedAt) / 1000);
  const lastUpdatedLabel = secondsSinceFetch < 5
    ? 'just now'
    : secondsSinceFetch < 60
      ? `${secondsSinceFetch}s ago`
      : `${Math.floor(secondsSinceFetch / 60)}m ago`;

  useEffect(() => {
    if (monthsInYear.length > 0 && !monthsInYear.includes(month)) setMonth(monthsInYear[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsInYear]);

  const selectedEvent = events.find(e => e.id === selectedEventId) || null;

  // For each item, expand into one entry per grade OR branch (or single entry if neither).
  // `firstOfGroup` flags the first row of each item group so the UI can render
  // the item-name cell only once (visually merged across the sub-rows).
  // Filter the event-table to a single item (or All). Null = show all items.
  // Must be declared BEFORE selectedRows because the useMemo body references it.
  const [itemFilter, setItemFilter] = useState<string | null>(null);

  const selectedRows = useMemo(() => {
    if (!selectedEvent) return [];
    const result: { row: InventoryRow; item: MarketingItem; firstOfGroup: boolean; groupSize: number }[] = [];
    // Optional item filter — when set, only that item's rows are rendered.
    const filteredItems = itemFilter ? items.filter(it => it.id === itemFilter) : items;
    for (const it of filteredItems) {
      const grades = it.grades ?? [];
      const branches = it.branches ?? [];
      let combos: { grade: string | null; branch: string | null }[];
      if (grades.length > 0) {
        combos = grades.map(g => ({ grade: g, branch: null }));
      } else if (branches.length > 0) {
        combos = branches.map(b => ({ grade: null, branch: b }));
      } else {
        combos = [{ grade: null, branch: null }];
      }
      combos.forEach((c, i) => {
        const existing = inventory.find(r =>
          r.event_id === selectedEvent.id &&
          r.item_id === it.id &&
          r.grade === c.grade &&
          r.branch === c.branch
        );
        const row = existing ?? mkRow(
          `tmp-${selectedEvent.id}-${it.id}-${c.grade ?? 'null'}-${c.branch ?? 'null'}`,
          selectedEvent.id,
          it.id,
          { grade: c.grade, branch: c.branch }
        );
        result.push({ row, item: it, firstOfGroup: i === 0, groupSize: combos.length });
      });
    }
    return result;
  }, [inventory, selectedEvent, items, itemFilter]);

  // ── stock summary (latest completed event's closing stock per item) ────────
  // Sort by the date encoded in the event NAME (e.g. "30-31 May" → day 31),
  // since the start_date/end_date columns in fa_events are sometimes wrong.
  const latestCompletedEvent = useMemo(() => {
    const completed = events.filter(e => e.status === 'completed');
    completed.sort((a, b) => {
      const aYear = new Date(a.start_date).getFullYear();
      const bYear = new Date(b.start_date).getFullYear();
      return eventEndDateFromName(b.event_name, bYear)
        .localeCompare(eventEndDateFromName(a.event_name, aYear));
    });
    return completed[0] || null;
  }, [events]);

  // The event immediately BEFORE the selected one (by name-date) — used as
  // the source for the "Carry Forward Stock" button.
  const previousEvent = useMemo(() => {
    if (!selectedEvent) return null;
    const selYear = new Date(selectedEvent.start_date).getFullYear();
    const selKey = eventEndDateFromName(selectedEvent.event_name, selYear);
    const earlier = events.filter(e => {
      if (e.id === selectedEvent.id) return false;
      const y = new Date(e.start_date).getFullYear();
      return eventEndDateFromName(e.event_name, y) < selKey;
    });
    earlier.sort((a, b) => {
      const aYear = new Date(a.start_date).getFullYear();
      const bYear = new Date(b.start_date).getFullYear();
      return eventEndDateFromName(b.event_name, bYear)
        .localeCompare(eventEndDateFromName(a.event_name, aYear));
    });
    return earlier[0] || null;
  }, [events, selectedEvent]);

  // Latest event regardless of status — used as a live-count fallback for the
  // stock summary cards when there's no completed reconciliation yet, or when
  // the user has updated In Stock on a more recent in-progress event.
  const latestEvent = useMemo(() => {
    const sorted = [...events].sort((a, b) => {
      const aYear = new Date(a.start_date).getFullYear();
      const bYear = new Date(b.start_date).getFullYear();
      return eventEndDateFromName(b.event_name, bYear)
        .localeCompare(eventEndDateFromName(a.event_name, aYear));
    });
    return sorted[0] || null;
  }, [events]);

  // Fetch latestCompletedEvent's inventory (for closing_stock).
  useEffect(() => {
    if (!latestCompletedEvent) return;
    if (latestCompletedEvent.id === selectedEventId) return;
    let cancelled = false;
    fetch(`/api/marketing/inventory/${latestCompletedEvent.id}`)
      .then(r => r.json())
      .then((data: { rows?: InventoryRow[] }) => {
        if (cancelled || !data.rows) return;
        setInventory(prev => [
          ...prev.filter(r => r.event_id !== latestCompletedEvent.id),
          ...data.rows!,
        ]);
      })
      .catch(err => console.error('Failed to fetch latest completed inventory:', err));
    return () => { cancelled = true; };
  }, [latestCompletedEvent?.id, selectedEventId, items.length]);

  // Also fetch latestEvent (any status) so we can fall back to live in_stock.
  useEffect(() => {
    if (!latestEvent) return;
    if (latestEvent.id === selectedEventId) return;
    if (latestEvent.id === latestCompletedEvent?.id) return; // same — already fetched above
    let cancelled = false;
    fetch(`/api/marketing/inventory/${latestEvent.id}`)
      .then(r => r.json())
      .then((data: { rows?: InventoryRow[] }) => {
        if (cancelled || !data.rows) return;
        setInventory(prev => [
          ...prev.filter(r => r.event_id !== latestEvent.id),
          ...data.rows!,
        ]);
      })
      .catch(err => console.error('Failed to fetch latest event inventory:', err));
    return () => { cancelled = true; };
  }, [latestEvent?.id, selectedEventId, latestCompletedEvent?.id, items.length]);

  // Fetch previousEvent's inventory for the Carry Forward calculation.
  useEffect(() => {
    if (!previousEvent) return;
    if (previousEvent.id === selectedEventId) return;
    if (previousEvent.id === latestCompletedEvent?.id) return;
    if (previousEvent.id === latestEvent?.id) return;
    let cancelled = false;
    fetch(`/api/marketing/inventory/${previousEvent.id}`)
      .then(r => r.json())
      .then((data: { rows?: InventoryRow[] }) => {
        if (cancelled || !data.rows) return;
        setInventory(prev => [
          ...prev.filter(r => r.event_id !== previousEvent.id),
          ...data.rows!,
        ]);
      })
      .catch(err => console.error('Failed to fetch previous event inventory:', err));
    return () => { cancelled = true; };
  }, [previousEvent?.id, selectedEventId, latestCompletedEvent?.id, latestEvent?.id, items.length]);


  interface StockSummary {
    value: number;
    sourceEvent: MarketingEvent;
    isLive: boolean; // true = in_stock (live count), false = closing_stock (reconciled)
  }

  // All events sorted by name-date descending (latest first).
  const eventsByDateDesc = useMemo(() => {
    return [...events].sort((a, b) => {
      const aYear = new Date(a.start_date).getFullYear();
      const bYear = new Date(b.start_date).getFullYear();
      return eventEndDateFromName(b.event_name, bYear)
        .localeCompare(eventEndDateFromName(a.event_name, aYear));
    });
  }, [events]);

  // Returns the best available stock estimate for an item.
  // Walks events from latest to earliest by name-date. For each:
  //   - If it has data for this item → use it (completed → closing_stock, else → in_stock)
  //   - Else skip and check the previous event
  // This handles future events that haven't been filled in yet (skipped) and
  // surfaces whichever event the user most recently entered data on.
  function stockSummaryFor(itemId: string): StockSummary | null {
    const item = items.find(it => it.id === itemId);
    const returnable = item?.returnable ?? false;
    for (const ev of eventsByDateDesc) {
      const rows = inventory.filter(r => r.event_id === ev.id && r.item_id === itemId);
      if (rows.length === 0) continue;
      const hasData = rows.some(r =>
        r.in_stock > 0 || r.registered > 0 || r.buffer > 0 ||
        r.in_cart > 0 || r.ordered > 0 || r.no_show > 0 || r.walk_in > 0
      );
      if (!hasData) continue;
      if (ev.status === 'completed') {
        const value = rows.reduce((sum, r) => sum + calcDerived(r, returnable).closing_stock, 0);
        return { value, sourceEvent: ev, isLive: false };
      }
      const value = rows.reduce((sum, r) => sum + r.in_stock, 0);
      return { value, sourceEvent: ev, isLive: true };
    }
    return null;
  }

  interface StockBreakdown {
    total: number;
    sourceEvent: MarketingEvent;
    isLive: boolean;
    item: MarketingItem;
    rows: { label: string; value: number }[];
  }

  // Returns per-grade/branch stock values for the same source event as
  // `stockSummaryFor`. Used by the card-detail modal so the user can see
  // a breakdown rather than just the summed total.
  function stockBreakdownFor(itemId: string): StockBreakdown | null {
    const item = items.find(it => it.id === itemId);
    if (!item) return null;
    const summary = stockSummaryFor(itemId);
    if (!summary) return null;
    const returnable = item.returnable;
    const rows = inventory.filter(r => r.event_id === summary.sourceEvent.id && r.item_id === itemId);

    const breakdown = rows.map(r => {
      let label: string;
      if (r.grade !== null) label = `Grade ${r.grade}`;
      else if (r.branch !== null) label = r.branch;
      else label = item.name;
      const value = summary.isLive
        ? r.in_stock
        : calcDerived(r, returnable).closing_stock;
      return { label, value };
    });

    // Sort by item's grade/branch order so the modal lists them naturally.
    if (item.grades.length > 0) {
      breakdown.sort((a, b) => {
        const aKey = a.label.replace(/^Grade /, '');
        const bKey = b.label.replace(/^Grade /, '');
        return item.grades.indexOf(aKey) - item.grades.indexOf(bKey);
      });
    } else if (item.branches.length > 0) {
      breakdown.sort((a, b) => item.branches.indexOf(a.label) - item.branches.indexOf(b.label));
    }

    return {
      total: summary.value,
      sourceEvent: summary.sourceEvent,
      isLive: summary.isLive,
      item,
      rows: breakdown,
    };
  }

  function getLatestWalkIn(itemId: string): number | null {
    if (!latestCompletedEvent) return null;
    const row = inventory.find(r => r.event_id === latestCompletedEvent.id && r.item_id === itemId);
    return row ? row.walk_in : null;
  }

  // Compute the carry-forward value for a given (item, grade) from the previous event.
  //   Previous COMPLETED      → real closing_stock = in_stock + ordered - actual_attended
  //   Previous NOT completed  → conservative      = in_stock + ordered - registered - buffer
  // Returns null when there's no usable data in the previous event (so the row can be skipped).
  function carryForwardValueFor(itemId: string, grade: string | null, branch: string | null): number | null {
    if (!previousEvent) return null;
    const row = inventory.find(r =>
      r.event_id === previousEvent.id && r.item_id === itemId && r.grade === grade && r.branch === branch
    );
    if (!row) return null;
    const item = items.find(it => it.id === itemId);
    const returnable = item?.returnable ?? false;
    // Skip rows that look truly untouched (all 0 AND user never typed in_stock).
    // An explicit user-set 0 still counts as data, so we don't filter it out.
    const hasMeaningfulData =
      row.in_stock_manual ||
      row.in_stock > 0 || row.ordered > 0 ||
      row.registered > 0 || row.buffer > 0;
    if (!hasMeaningfulData) return null;
    if (previousEvent.status === 'completed') {
      return Math.max(0, calcDerived(row, returnable).closing_stock);
    }
    // Conservative estimate for non-completed previous.
    // Returnable items aren't consumed, so the estimate = in_stock + ordered.
    if (returnable) return Math.max(0, row.in_stock + row.ordered);
    return Math.max(0, row.in_stock + row.ordered - row.registered - row.buffer);
  }

  // True if the previous event has at least one item with usable carry-forward data.
  const carryForwardReady = useMemo(() => {
    if (!previousEvent || !selectedEvent) return false;
    return selectedRows.some(({ row }) => carryForwardValueFor(row.item_id, row.grade, row.branch) !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousEvent, selectedEvent, inventory, selectedRows]);

  // ── AUTO CARRY FORWARD (only when previous event is COMPLETED) ────────────
  // Runs whenever inventory or previous event data changes. For each row in
  // the current event flagged in_stock_manual = false (auto), recalculates
  // closing_stock from the previous event and updates in_stock to match.
  // Manual rows (in_stock_manual = true) are never touched.
  // No infinite loop: rows are only updated when newValue !== currentValue,
  // and the source='auto' flag stays false after update.
  useEffect(() => {
    if (!selectedEvent || !previousEvent) return;
    if (previousEvent.status !== 'completed') return;

    const currentRows = inventory.filter(r => r.event_id === selectedEvent.id);
    const previousRows = inventory.filter(r => r.event_id === previousEvent.id);
    if (currentRows.length === 0 || previousRows.length === 0) return;

    type Update = {
      rowId: string;
      in_stock?: number;
      total_to_bring_set?: number | null;
    };
    const updates: Update[] = [];
    for (const row of currentRows) {
      if (row.id.startsWith('tmp-')) continue;
      const prevRow = previousRows.find(p =>
        p.item_id === row.item_id && p.grade === row.grade && p.branch === row.branch
      );
      if (!prevRow) continue;
      const item = items.find(it => it.id === row.item_id);
      const returnable = item?.returnable ?? false;
      const u: Update = { rowId: row.id };

      // Carry forward in_stock (closing_stock from prev) if not user-set.
      if (!row.in_stock_manual) {
        const closing = Math.max(0, calcDerived(prevRow, returnable).closing_stock);
        if (closing !== row.in_stock) {
          u.in_stock = closing;
        }
      }

      // For returnable items, also carry forward total_to_bring_set if not user-set.
      if (returnable && !row.total_to_bring_set_manual) {
        const prevTtb = prevRow.total_to_bring_set;
        if (prevTtb !== row.total_to_bring_set) {
          u.total_to_bring_set = prevTtb;
        }
      }

      if (u.in_stock !== undefined || u.total_to_bring_set !== undefined) {
        updates.push(u);
      }
    }
    if (updates.length === 0) return;

    // Optimistic UI update
    setInventory(prev => prev.map(r => {
      const u = updates.find(x => x.rowId === r.id);
      if (!u) return r;
      const next = { ...r };
      if (u.in_stock !== undefined) {
        next.in_stock = u.in_stock;
        next.in_stock_manual = false;
      }
      if (u.total_to_bring_set !== undefined) {
        next.total_to_bring_set = u.total_to_bring_set;
        next.total_to_bring_set_manual = false;
      }
      return next;
    }));

    Promise.all(updates.map(u => {
      const body: Record<string, unknown> = { source: 'auto' };
      if (u.in_stock !== undefined) body.in_stock = u.in_stock;
      if (u.total_to_bring_set !== undefined) body.total_to_bring_set = u.total_to_bring_set;
      return fetch(`/api/marketing/inventory/row/${u.rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    })).catch(err => console.error('[auto carry forward] PATCH failed:', err));
  }, [selectedEvent, previousEvent, inventory]);

  type CarryFwdModal =
    | { type: 'nothing' }
    | { type: 'confirm'; updates: { rowId: string; newInStock: number }[] }
    | { type: 'success'; count: number }
    | { type: 'error'; message: string }
    | null;
  const [carryFwdModal, setCarryFwdModal] = useState<CarryFwdModal>(null);

  function handleCarryForward() {
    if (!previousEvent || !selectedEvent) return;
    // Skip rows where the user manually typed in_stock (those are locked).
    // Auto-set rows get updated to match the previous event's carry value,
    // even when they already have a non-zero value (e.g. a stale auto-carry
    // from a different previous event).
    const updates: { rowId: string; newInStock: number }[] = [];
    for (const { row } of selectedRows) {
      if (row.in_stock_manual) continue; // user-set, locked
      if (row.id.startsWith('tmp-')) continue;
      const carry = carryForwardValueFor(row.item_id, row.grade, row.branch);
      if (carry === null) continue;
      if (carry === row.in_stock) continue; // already in sync
      updates.push({ rowId: row.id, newInStock: carry });
    }
    if (updates.length === 0) {
      setCarryFwdModal({ type: 'nothing' });
      return;
    }
    setCarryFwdModal({ type: 'confirm', updates });
  }

  async function confirmCarryForward(updates: { rowId: string; newInStock: number }[]) {
    const prevSnapshot = inventory;
    setCarryFwdModal(null);
    // Optimistic UI update
    setInventory(prev => prev.map(r => {
      const u = updates.find(x => x.rowId === r.id);
      return u ? { ...r, in_stock: u.newInStock, in_stock_manual: false } : r;
    }));

    try {
      const results = await Promise.all(
        updates.map(u =>
          fetch(`/api/marketing/inventory/row/${u.rowId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ in_stock: u.newInStock, source: 'auto' }),
          })
        )
      );
      const failed = results.filter(r => !r.ok).length;
      if (failed > 0) {
        setInventory(prevSnapshot);
        setCarryFwdModal({ type: 'error', message: `${failed} of ${updates.length} updates failed. Changes reverted.` });
        return;
      }
      setCarryFwdModal({ type: 'success', count: updates.length });
    } catch {
      setInventory(prevSnapshot);
      setCarryFwdModal({ type: 'error', message: 'Network error. Changes reverted.' });
    }
  }

  // ── modals state ───────────────────────────────────────────────────────────
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemName, setAddItemName] = useState('');
  const [addItemGrades, setAddItemGrades] = useState('');

  // Configure-grades-on-existing-item modal
  // Card-detail modal — shows per-grade/branch breakdown when user clicks a Stock Summary card.
  const [cardDetailItemId, setCardDetailItemId] = useState<string | null>(null);

  const [configureItem, setConfigureItem] = useState<MarketingItem | null>(null);
  const [configureGradesInput, setConfigureGradesInput] = useState('');
  const [configureBranchesInput, setConfigureBranchesInput] = useState('');
  const [configureReturnable, setConfigureReturnable] = useState(false);

  const [deleteItemTarget, setDeleteItemTarget] = useState<MarketingItem | null>(null);

  // Per-row edit modal
  const [editRow, setEditRow] = useState<InventoryRow | null>(null);
  const [editRowForm, setEditRowForm] = useState({
    item_name: '', in_stock: 0, registered: 0, buffer: 0,
    in_cart: 0, ordered: 0, no_show: 0, walk_in: 0,
  });

  // ── actions ────────────────────────────────────────────────────────────────

  async function updateCell(rowId: string, field: keyof InventoryRow, value: number) {
    // Temp placeholder rows don't exist in DB yet — just update locally.
    if (rowId.startsWith('tmp-')) {
      setInventory(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
      return;
    }
    const prevSnapshot = inventory;
    setInventory(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
    try {
      const res = await fetch(`/api/marketing/inventory/row/${rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value, source: 'manual' }),
      });
      if (!res.ok) {
        setInventory(prevSnapshot);
        alert(`Failed to save ${field}`);
      }
    } catch {
      setInventory(prevSnapshot);
      alert('Network error — change reverted');
    }
  }

  async function renameItem(itemId: string, newName: string) {
    const name = newName.trim();
    if (!name) return;
    const prevSnapshot = items;
    // Optimistic update
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, name } : it));
    try {
      const res = await fetch(`/api/marketing/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Failed' }));
        alert(error || 'Rename failed');
        setItems(prevSnapshot);
      }
    } catch {
      alert('Network error');
      setItems(prevSnapshot);
    }
  }

  async function handleAddItem() {
    const name = addItemName.trim();
    if (!name) return;
    if (items.some(it => it.name.toLowerCase() === name.toLowerCase())) {
      alert(`Item "${name}" already exists.`);
      return;
    }
    const grades = parseGrades(addItemGrades);
    if (grades === null) {
      alert('Grades must look like "1-8" or "1,2,3" or "1-3,5". Leave blank for no breakdown.');
      return;
    }
    try {
      const res = await fetch('/api/marketing/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, grades }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to add'); return; }
      // Insert the new item, keeping defaults first then alphabetical
      setItems(prev => [...prev, data.item].sort(
        (a, b) => a.is_default === b.is_default
          ? a.name.localeCompare(b.name)
          : (a.is_default ? -1 : 1)
      ));
      setAddItemName('');
      setAddItemGrades('');
      setAddItemOpen(false);
    } catch {
      alert('Network error');
    }
  }

  function openConfigureGrades(item: MarketingItem) {
    setConfigureItem(item);
    setConfigureGradesInput(formatGrades(item.grades ?? []));
    setConfigureBranchesInput((item.branches ?? []).join(', '));
    setConfigureReturnable(item.returnable ?? false);
  }

  function closeConfigureModal() {
    setConfigureItem(null);
    setConfigureGradesInput('');
    setConfigureBranchesInput('');
    setConfigureReturnable(false);
  }

  async function handleSaveGrades() {
    if (!configureItem) return;
    const grades = parseGrades(configureGradesInput);
    if (grades === null) {
      alert('Grades must look like "1-8" or "1,2,3" or "1-3,5". Leave blank for no breakdown.');
      return;
    }
    const branches = configureBranchesInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    if (grades.length > 0 && branches.length > 0) {
      alert('An item can use either Grades or Branches, not both.');
      return;
    }
    try {
      const res = await fetch(`/api/marketing/items/${configureItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grades, branches, returnable: configureReturnable }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Save failed'); return; }
      setItems(prev => prev.map(it => it.id === configureItem.id ? data.item : it));
      // Drop cached inventory rows for the affected events so the next render
      // refetches and surfaces the new sub-rows (auto-created by GET).
      setInventory(prev => prev.filter(r => r.item_id !== configureItem.id));
      closeConfigureModal();
    } catch {
      alert('Network error');
    }
  }

  async function handleConfirmDeleteItem() {
    if (!deleteItemTarget) return;
    try {
      const res = await fetch(`/api/marketing/items/${deleteItemTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Failed' }));
        alert(error || 'Delete failed');
        return;
      }
      setItems(prev => prev.filter(it => it.id !== deleteItemTarget.id));
      setInventory(prev => prev.filter(r => r.item_id !== deleteItemTarget.id));
      setDeleteItemTarget(null);
    } catch {
      alert('Network error');
    }
  }

  function openEditRow(row: InventoryRow) {
    const item = items.find(it => it.id === row.item_id);
    setEditRow(row);
    setEditRowForm({
      item_name:  item?.name ?? '',
      in_stock:   row.in_stock,
      registered: row.registered,
      buffer:     row.buffer,
      in_cart:    row.in_cart,
      ordered:    row.ordered,
      no_show:    row.no_show,
      walk_in:    row.walk_in,
    });
  }

  async function handleSaveEditRow() {
    if (!editRow) return;
    const targetRowId = editRow.id;
    const targetItemId = editRow.item_id;
    const newName = editRowForm.item_name.trim();
    if (newName) {
      const dup = items.find(it => it.id !== targetItemId && it.name.toLowerCase() === newName.toLowerCase());
      if (dup) { alert(`Item "${newName}" already exists.`); return; }
      const currentName = items.find(it => it.id === targetItemId)?.name ?? '';
      if (newName !== currentName) renameItem(targetItemId, newName);
    }

    const updated: Pick<InventoryRow, 'in_stock' | 'registered' | 'buffer' | 'in_cart' | 'ordered' | 'no_show' | 'walk_in'> = {
      in_stock:   editRowForm.in_stock,
      registered: editRowForm.registered,
      buffer:     editRowForm.buffer,
      in_cart:    editRowForm.in_cart,
      ordered:    editRowForm.ordered,
      no_show:    editRowForm.no_show,
      walk_in:    editRowForm.walk_in,
    };

    const prevSnapshot = inventory;
    // Find the existing row to know if in_stock actually changed
    const existingRow = inventory.find(r => r.id === targetRowId);
    const inStockChanged = existingRow ? existingRow.in_stock !== updated.in_stock : false;

    // Optimistic UI update. Mark in_stock_manual only if the value actually changed.
    setInventory(prev => prev.map(r => r.id === targetRowId
      ? { ...r, ...updated, in_stock_manual: inStockChanged ? true : r.in_stock_manual }
      : r
    ));
    setEditRow(null);

    try {
      const res = await fetch(`/api/marketing/inventory/row/${targetRowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updated, source: 'manual' }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Failed' }));
        alert(error || 'Save failed');
        setInventory(prevSnapshot);
      }
    } catch {
      alert('Network error — changes reverted');
      setInventory(prevSnapshot);
    }
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50/40 via-slate-50 to-rose-50/30 p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-[1500px] mx-auto">

        {/* BACK */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-500 bg-white/70 backdrop-blur border border-slate-200 rounded-xl shadow-sm hover:bg-white hover:text-slate-800 transition-all no-underline">
            ← Back to Inventory
          </Link>
          <LogoutButton />
        </div>

        {/* HERO HEADER */}
        <div className="relative mb-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-pink-500 via-rose-500 to-pink-600 p-8 sm:p-10 text-white shadow-xl shadow-pink-200/40">
          {/* decorative orbs */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-pink-300/30 rounded-full blur-3xl" />
          <div className="relative flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur rounded-full mb-3">
                <span className="text-lg">📣</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Marketing Module</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Marketing Inventory</h1>
              <p className="text-sm font-bold text-pink-100 mt-1 uppercase tracking-widest">Plan · Track · Reconcile per event</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-pink-100">Welcome back</p>
              <p className="text-lg font-black">{userName}</p>
            </div>
          </div>
        </div>

        {/* ── 1. STOCK SUMMARY CARDS ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="w-1 h-12 bg-gradient-to-b from-pink-500 to-rose-500 rounded-full" />
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Current Stock in Store</h2>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  Real-time inventory across {items.length} {items.length === 1 ? 'item' : 'items'}
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-pink-200 rounded-full shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Source per item</span>
              <span className="text-[11px] font-black text-pink-600">Live or Reconciled</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {items.map(it => {
              const summary = stockSummaryFor(it.id);
              const hasBreakdown = (it.grades?.length ?? 0) > 0 || (it.branches?.length ?? 0) > 0;
              const clickable = summary !== null && hasBreakdown;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => { if (clickable) setCardDetailItemId(it.id); }}
                  disabled={!clickable}
                  title={clickable ? `See breakdown by ${it.grades.length > 0 ? 'grade' : 'branch'}` : undefined}
                  className={`relative overflow-hidden rounded-2xl border border-pink-100 bg-gradient-to-br from-white via-pink-50/40 to-rose-50/50 shadow-sm p-5 text-left transition-all ${
                    clickable ? 'hover:shadow-md hover:-translate-y-0.5 hover:border-pink-300 cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-400 to-rose-400" />
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-xl font-black text-slate-900 truncate">{it.name}</p>
                    {clickable && (
                      <span className="text-[10px] font-black text-pink-500 uppercase tracking-widest opacity-60 group-hover:opacity-100 flex-shrink-0 mt-1">›</span>
                    )}
                  </div>
                  {summary === null ? (
                    <>
                      <p className="text-4xl font-black leading-none text-slate-300">—</p>
                      <p className="text-[10px] font-bold text-pink-500 mt-2 uppercase tracking-widest">No data yet</p>
                    </>
                  ) : (
                    <>
                      <p className="text-4xl font-black leading-none text-slate-800">{summary.value}</p>
                      <div className="mt-2 space-y-0.5">
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${summary.isLive ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {summary.isLive ? '◉ Live count' : '✓ Reconciled'}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 truncate" title={summary.sourceEvent.event_name}>
                          from {summary.sourceEvent.event_name}
                        </p>
                        {clickable && (
                          <p className="text-[9px] font-bold text-pink-500 mt-1 italic">Tap for breakdown</p>
                        )}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 2. FILTER BAR ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-16">
          <div className="p-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-50 rounded-2xl p-1.5 border border-slate-200">
              <FilterSelect
                label="Year"
                value={String(year)}
                onChange={v => setYear(Number(v))}
                options={allYears.map(y => ({ value: String(y), label: String(y) }))}
              />
              <span className="text-slate-300 font-bold">/</span>
              <FilterSelect
                label="Month"
                value={String(month)}
                onChange={v => setMonth(Number(v))}
                options={monthsInYear.map(m => ({ value: String(m), label: MONTH_NAMES[m] }))}
                disabled={monthsInYear.length === 0}
              />
              <span className="text-slate-300 font-bold">/</span>
              <FilterSelect
                label="Status"
                value={statusFilter}
                onChange={v => setStatusFilter(v as StatusFilter)}
                options={STATUS_FILTER_OPTIONS.map(opt => {
                  const count = opt.value === 'all'
                    ? events.length
                    : events.filter(e => e.status === opt.value).length;
                  return { value: opt.value, label: `${opt.label} (${count})` };
                })}
              />
              <span className="text-slate-300 font-bold">/</span>
              <FilterSelect
                label="Event"
                value={selectedEventId ?? ''}
                onChange={v => setSelectedEventId(v || null)}
                options={eventsInMonth.map(e => ({ value: e.id, label: e.event_name }))}
                disabled={eventsInMonth.length === 0}
                wide
              />
            </div>
            {selectedEvent && <StatusBadge status={selectedEvent.status} />}

            <div className="ml-auto flex items-center gap-2">
              {selectedEvent && (
                <button onClick={() => setAddItemOpen(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm shadow-pink-200 hover:shadow-md transition-all">
                  + Add Item
                </button>
              )}
            </div>
          </div>
          {selectedEvent && (
            <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-pink-50/30 border-t border-slate-100 flex items-center gap-4 text-xs font-bold text-slate-600 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-base">📅</span>
                {formatEventDateRange(selectedEvent)}
              </span>
              {selectedEvent.venue && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-base">📍</span>
                    {selectedEvent.venue}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── 3. EMPTY STATE OR TABLE ── */}
        {loadingEvents ? (
          <EmptyState message="Loading events from FA system…" />
        ) : !selectedEvent ? (
          <EmptyState
            message={
              eventsInMonth.length === 0
                ? monthsInYear.length === 0
                  ? `No events for ${year}.`
                  : statusFilter !== 'all'
                    ? `No ${STATUS_STYLES[statusFilter].label.toLowerCase()} events in ${MONTH_NAMES[month]} ${year}.`
                    : `No events in ${MONTH_NAMES[month]} ${year}.`
                : `Select an event to view inventory.`
            }
          />
        ) : (
          <>
            {/* TABLE TITLE */}
            <div className="mb-4 flex items-center gap-4 flex-wrap">
              <div className="w-1 h-12 bg-gradient-to-b from-pink-500 to-rose-500 rounded-full" />
              <div className="flex-1 min-w-0">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight truncate">
                  {selectedEvent.event_name}
                </h2>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap">
                  <span>📅 {formatEventDateRange(selectedEvent)}</span>
                  {selectedEvent.venue && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span>📍 {selectedEvent.venue}</span>
                    </>
                  )}
                  <span className="text-slate-300">•</span>
                  <span>{selectedRows.length} {selectedRows.length === 1 ? 'item' : 'items'}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* LIVE REGISTERED REFRESH */}
                <button
                  onClick={() => { void refreshSelectedInventory(); }}
                  disabled={isRefreshing}
                  title="Re-fetch live confirmed-student counts now"
                  className={`inline-flex items-center gap-2 px-3 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                    isRefreshing
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-pink-50 hover:text-pink-700 hover:border-pink-200'
                  }`}
                >
                  <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
                  Refresh
                </button>
                <div className="inline-flex items-center gap-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Updated</span>
                  <span className="text-[10px] font-black text-slate-700">{lastUpdatedLabel}</span>
                </div>
                <StatusBadge status={selectedEvent.status} />
              </div>
            </div>

            {/* CARRY FORWARD STOCK BUTTON
                TEMPORARILY DISABLED: previous event closing_stock can be negative
                when actual_attended > in_stock + ordered (e.g. Certificate has
                0 stock but 109 registered → −109). Carrying that forward would
                propagate confusing numbers. Keep the button visible (so users
                know the feature exists) but lock it. */}
            {selectedEvent.status !== 'completed' && previousEvent && previousEvent.status !== 'completed' && (
              <div className="mb-4 flex items-center gap-3 flex-wrap">
                <button
                  disabled
                  title="Carry Forward is temporarily disabled to prevent propagating negative closing stock from prior events. Coming back soon."
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 opacity-70"
                >
                  <span className="text-base">🚫</span>
                  <span className="line-through">Carry Forward Stock</span>
                  {previousEvent && (
                    <span className="text-[10px] opacity-80 normal-case font-bold line-through">
                      from {previousEvent.event_name}
                    </span>
                  )}
                </button>
                <p className="text-[10px] text-slate-400 font-bold italic">
                  Temporarily disabled — prevents accidentally carrying negative closing stock from a previous event.
                </p>
              </div>
            )}

            {/* ITEM FILTER PILLS — focus the table on one item at a time */}
            <div className="mb-4 flex items-center gap-2 flex-wrap p-3 bg-white/60 backdrop-blur border border-slate-200 rounded-2xl">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mr-1">Show:</span>
              <button
                type="button"
                onClick={() => setItemFilter(null)}
                className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-full transition-all ${
                  itemFilter === null
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm shadow-pink-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Items
              </button>
              {items.map(it => {
                const active = itemFilter === it.id;
                const hasBreakdown = (it.grades?.length ?? 0) > 0 || (it.branches?.length ?? 0) > 0;
                const subCount = it.grades.length || it.branches.length;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setItemFilter(it.id)}
                    className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-full transition-all inline-flex items-center gap-1.5 ${
                      active
                        ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm shadow-pink-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-pink-50 hover:text-pink-700'
                    }`}
                  >
                    {it.name}
                    {hasBreakdown && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                        active ? 'bg-white/30 text-white' : 'bg-white text-slate-500'
                      }`}>
                        {subCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <InventoryTable
              rows={selectedRows}
              event={selectedEvent}
              updateCell={updateCell}
              renameItem={renameItem}
              getLatestWalkIn={getLatestWalkIn}
              onDeleteItem={setDeleteItemTarget}
              onEditRow={openEditRow}
              onConfigureGrades={openConfigureGrades}
            />
          </>
        )}

        {/* LEGEND */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-400">
          <span>Post-event columns unlock on the event start date</span>
          <span>·</span>
          <span>Double-click an item name to rename</span>
          <span className="ml-auto text-pink-500">Signed in as {userName}</span>
        </div>

      </div>

      {/* ── ADD ITEM MODAL ── */}
      {addItemOpen && (
        <Modal title="Add New Item" onClose={() => { setAddItemOpen(false); setAddItemName(''); setAddItemGrades(''); }}>
          <div className="px-6 py-2">
            <Field label="Item Name" full>
              <input value={addItemName} onChange={e => setAddItemName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddItem(); }}
                placeholder="e.g. Trophy, Lanyard, Banner" className={inputCls} autoFocus />
            </Field>
            <Field label="Grades (optional)" full>
              <input value={addItemGrades} onChange={e => setAddItemGrades(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddItem(); }}
                placeholder="e.g. 1-8  or  1,2,3  or  1-3,5,7-8" className={inputCls} />
            </Field>
            <p className="text-[10px] text-slate-400 font-bold mt-3">
              Leave Grades blank for a single row per event. Fill in (e.g. "1-8") to break this
              item down by grade — one inventory row per grade per event.
            </p>
          </div>
          <ModalFooter>
            <button onClick={() => { setAddItemOpen(false); setAddItemName(''); setAddItemGrades(''); }} className={cancelBtn}>Cancel</button>
            <button onClick={handleAddItem} disabled={!addItemName.trim()} className={primaryBtn}>
              Add Item
            </button>
          </ModalFooter>
        </Modal>
      )}

      {/* ── STOCK BREAKDOWN MODAL ── */}
      {cardDetailItemId && (() => {
        const breakdown = stockBreakdownFor(cardDetailItemId);
        if (!breakdown) return null;
        const isGrade = breakdown.item.grades.length > 0;
        const subTypeLabel = isGrade ? 'Grade' : 'Branch';
        return (
          <Modal
            title={`${breakdown.item.name} · Stock Breakdown`}
            onClose={() => setCardDetailItemId(null)}
          >
            <div className="px-6 py-4">
              {/* Source + total panel */}
              <div className="rounded-2xl border-2 border-pink-200 bg-gradient-to-br from-pink-50/80 to-rose-50/60 p-5 mb-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-pink-600">
                      {breakdown.isLive ? '◉ Live count' : '✓ Reconciled'}
                    </p>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">
                      from <span className="text-slate-800">{breakdown.sourceEvent.event_name}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total</p>
                    <p className="text-4xl font-black text-slate-900 leading-none">{breakdown.total}</p>
                  </div>
                </div>
              </div>

              {/* Per-grade/branch list */}
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                By {subTypeLabel}
              </p>
              <div className="rounded-2xl border-2 border-slate-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b-2 border-slate-200">
                    <tr>
                      <th className="text-left py-2 px-4 text-[10px] font-black uppercase tracking-widest text-slate-600">
                        {subTypeLabel}
                      </th>
                      <th className="text-right py-2 px-4 text-[10px] font-black uppercase tracking-widest text-slate-600">
                        Stock
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.rows.map((r, i) => (
                      <tr key={r.label} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} border-t border-slate-100`}>
                        <td className="py-2.5 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-md ${
                            isGrade
                              ? 'bg-gradient-to-br from-indigo-100 to-violet-200 text-indigo-800 border border-indigo-300'
                              : 'bg-gradient-to-br from-indigo-100 to-violet-200 text-indigo-800 border border-indigo-300'
                          }`}>
                            {r.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span className={`text-lg font-black ${r.value === 0 ? 'text-slate-300' : 'text-slate-900'}`}>
                            {r.value}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[10px] text-slate-400 font-bold mt-3 italic">
                {breakdown.isLive
                  ? 'Live count = current in-stock value from the latest non-completed event with data.'
                  : 'Reconciled = closing_stock from the latest completed event.'}
              </p>
            </div>
            <ModalFooter>
              <button onClick={() => setCardDetailItemId(null)} className={primaryBtn}>Close</button>
            </ModalFooter>
          </Modal>
        );
      })()}

      {/* ── CONFIGURE GRADES/BRANCHES MODAL ── */}
      {configureItem && (
        <Modal title={`Configure · ${configureItem.name}`} onClose={closeConfigureModal}>
          <div className="px-6 py-2">
            <Field label="Grades (numeric breakdown)" full>
              <input value={configureGradesInput} onChange={e => setConfigureGradesInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveGrades(); }}
                placeholder="e.g. 1-8  or  1,2,3  or  1-3,5,7-8" className={inputCls} autoFocus />
            </Field>
            <Field label="Branches (text breakdown)" full>
              <input value={configureBranchesInput} onChange={e => setConfigureBranchesInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveGrades(); }}
                placeholder="e.g. ST, BTHO, BBB, SHA, AMP, ..." className={inputCls} />
            </Field>
            <Field label="Returnable" full>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={configureReturnable}
                  onChange={e => setConfigureReturnable(e.target.checked)}
                  className="w-5 h-5 accent-pink-500"
                />
                <span className="text-xs font-bold text-slate-700">
                  Items come back after each event (no consumption — closing stock = in_stock + ordered)
                </span>
              </label>
            </Field>
            <p className="text-[10px] text-slate-400 font-bold mt-3">
              An item can use <span className="font-black">either Grades or Branches</span>, not both.
              Leave both blank for a single row per event.
            </p>
          </div>
          <ModalFooter>
            <button onClick={closeConfigureModal} className={cancelBtn}>Cancel</button>
            <button onClick={handleSaveGrades} className={primaryBtn}>Save</button>
          </ModalFooter>
        </Modal>
      )}

      {/* ── CARRY FORWARD MODALS ── */}
      {carryFwdModal?.type === 'nothing' && (
        <Modal title="Nothing to Carry Forward" onClose={() => setCarryFwdModal(null)}>
          <div className="px-6 py-4">
            <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/60 p-5 text-center">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-sm text-slate-700 font-bold mb-2">
                Nothing here to bring forward.
              </p>
              <p className="text-xs text-slate-500 font-medium">
                Either every row already has an In Stock value, or
                <span className="font-black"> &ldquo;{previousEvent?.event_name}&rdquo;</span> has no In Stock / Ordered data yet.
              </p>
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setCarryFwdModal(null)} className={primaryBtn}>Got it</button>
          </ModalFooter>
        </Modal>
      )}

      {carryFwdModal?.type === 'confirm' && previousEvent && (
        <Modal title="Carry Forward Stock?" onClose={() => setCarryFwdModal(null)}>
          <div className="px-6 py-4">
            <div className="rounded-2xl border-2 border-pink-200 bg-gradient-to-br from-pink-50/80 to-rose-50/40 p-5">
              <div className="flex items-start gap-3">
                <div className="text-3xl">📥</div>
                <div className="flex-1">
                  <p className="text-sm text-slate-800 font-bold leading-snug">
                    Pull expected closing stock from
                    <br />
                    <span className="text-pink-700 text-base">&ldquo;{previousEvent.event_name}&rdquo;</span>
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-pink-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                    <span className="text-[11px] font-black text-slate-700">
                      {carryFwdModal.updates.length} row{carryFwdModal.updates.length === 1 ? '' : 's'} will be updated
                    </span>
                  </div>
                </div>
              </div>
              <ul className="text-[11px] text-slate-600 font-semibold mt-4 space-y-1 list-disc list-inside">
                <li>Only auto-set rows are updated (rows you manually typed are locked)</li>
                <li>Numbers you&rsquo;ve already typed are left untouched</li>
                <li>Formula: <code className="bg-white px-1.5 py-0.5 rounded text-slate-800">in_stock + ordered − registered − buffer</code></li>
              </ul>
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setCarryFwdModal(null)} className={cancelBtn}>Cancel</button>
            <button
              onClick={() => confirmCarryForward(carryFwdModal.updates)}
              className={primaryBtn}
            >
              Yes, Carry Forward
            </button>
          </ModalFooter>
        </Modal>
      )}

      {carryFwdModal?.type === 'success' && (
        <Modal title="Stock Carried Forward" onClose={() => setCarryFwdModal(null)}>
          <div className="px-6 py-4">
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-5 text-center">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-sm text-slate-800 font-bold mb-2">
                {carryFwdModal.count} row{carryFwdModal.count === 1 ? '' : 's'} updated.
              </p>
              <p className="text-xs text-slate-600 font-medium">
                In Stock values were pulled from
                <span className="font-black"> &ldquo;{previousEvent?.event_name}&rdquo;</span>. Adjust any of them in the table below if needed.
              </p>
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setCarryFwdModal(null)} className={primaryBtn}>Done</button>
          </ModalFooter>
        </Modal>
      )}

      {carryFwdModal?.type === 'error' && (
        <Modal title="⚠ Carry Forward Failed" onClose={() => setCarryFwdModal(null)}>
          <div className="px-6 py-4">
            <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/60 p-5 text-center">
              <div className="text-5xl mb-3">⚠️</div>
              <p className="text-sm text-slate-800 font-bold">{carryFwdModal.message}</p>
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setCarryFwdModal(null)} className={primaryBtn}>OK</button>
          </ModalFooter>
        </Modal>
      )}

      {/* ── DELETE ITEM CONFIRM MODAL ── */}
      {deleteItemTarget && (
        <Modal title="⚠ Delete Item — Are You Sure?" onClose={() => setDeleteItemTarget(null)}>
          <div className="px-6 py-2">
            <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/60 p-4 mb-3">
              <p className="text-sm text-slate-800 font-bold">
                You&rsquo;re about to delete <span className="text-rose-700">&ldquo;{deleteItemTarget.name}&rdquo;</span>.
              </p>
              <ul className="text-xs text-slate-700 font-semibold mt-3 space-y-1.5 list-disc list-inside">
                <li>This removes <span className="font-black">{deleteItemTarget.name}</span> from <span className="font-black">every event</span> — past, present, and future.</li>
                <li>All inventory data (In Stock, Registered, Ordered, etc.) for this item will be <span className="font-black text-rose-700">permanently lost</span>.</li>
                <li>This action <span className="font-black text-rose-700">cannot be undone</span>.</li>
              </ul>
            </div>
            <p className="text-xs text-slate-500 font-bold text-center">
              If you&rsquo;re sure, click &ldquo;Yes, Delete Permanently&rdquo; below.
            </p>
          </div>
          <ModalFooter>
            <button onClick={() => setDeleteItemTarget(null)} className={cancelBtn}>Cancel — Keep Item</button>
            <button onClick={handleConfirmDeleteItem} className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all">
              Yes, Delete Permanently
            </button>
          </ModalFooter>
        </Modal>
      )}

      {/* ── EDIT ROW MODAL ── */}
      {editRow && selectedEvent && (() => {
        const postLocked = isPostEventLocked(selectedEvent);
        const derived = calcDerived({
          ...editRow,
          in_stock:   editRowForm.in_stock,
          registered: editRowForm.registered,
          buffer:     editRowForm.buffer,
          in_cart:    editRowForm.in_cart,
          ordered:    editRowForm.ordered,
          no_show:    editRowForm.no_show,
          walk_in:    editRowForm.walk_in,
        });
        return (
          <Modal title={`Edit Row · ${editRowForm.item_name}${editRow.grade !== null ? ` · Grade ${editRow.grade}` : ''}${editRow.branch !== null ? ` · ${editRow.branch}` : ''}`} onClose={() => setEditRow(null)}>
            <FormGrid>
              <Field label="Item Name" full>
                <input value={editRowForm.item_name}
                  onChange={e => setEditRowForm(p => ({ ...p, item_name: e.target.value }))}
                  className={inputCls} />
              </Field>
            </FormGrid>

            <div className="px-6 mt-4">
              <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Pre-event Planning
              </p>
            </div>
            <FormGrid>
              <Field label="In Stock">
                <input type="number" value={editRowForm.in_stock}
                  onChange={e => setEditRowForm(p => ({ ...p, in_stock: parseInt(e.target.value) || 0 }))}
                  className={inputCls} />
              </Field>
              <Field label="Registered (live from confirmed invitations)">
                <div className={`${inputCls} bg-slate-100 text-slate-700 cursor-not-allowed inline-flex items-center justify-between`}>
                  <span>{editRowForm.registered}</span>
                  <span className="text-[10px] text-slate-400">🔒 Auto</span>
                </div>
              </Field>
              <Field label="Buffer">
                <input type="number" value={editRowForm.buffer}
                  onChange={e => setEditRowForm(p => ({ ...p, buffer: parseInt(e.target.value) || 0 }))}
                  className={inputCls} />
              </Field>
              <Field label="Total to Bring (auto)">
                <div className={`${inputCls} bg-blue-50 text-blue-700 cursor-not-allowed`}>{derived.total_to_bring}</div>
              </Field>
              <Field label="Shortfall (auto)" full>
                {derived.shortfall > 0 ? (
                  <div className={`${inputCls} bg-rose-50 text-rose-700 cursor-not-allowed`}>+{derived.shortfall} to order</div>
                ) : (
                  <div className={`${inputCls} bg-emerald-50 text-emerald-700 cursor-not-allowed`}>✓ Sufficient</div>
                )}
              </Field>
            </FormGrid>

            <div className="px-6 mt-4">
              <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Order Tracking
              </p>
            </div>
            <FormGrid>
              <Field label="In Cart">
                <input type="number" value={editRowForm.in_cart}
                  onChange={e => setEditRowForm(p => ({ ...p, in_cart: parseInt(e.target.value) || 0 }))}
                  className={inputCls} />
              </Field>
              <Field label="Ordered">
                <input type="number" value={editRowForm.ordered}
                  onChange={e => setEditRowForm(p => ({ ...p, ordered: parseInt(e.target.value) || 0 }))}
                  className={inputCls} />
              </Field>
            </FormGrid>

            <div className="px-6 mt-4">
              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Post-event Reconciliation
                {postLocked && <span className="text-slate-400 text-[9px]">🔒 unlocks on the event start date</span>}
              </p>
            </div>
            <FormGrid>
              <Field label="Absent (live from fa_invitations)">
                <div className={`${inputCls} bg-slate-100 text-slate-700 cursor-not-allowed inline-flex items-center justify-between`}>
                  <span>{editRowForm.no_show}</span>
                  <span className="text-[10px] text-slate-400">🔒 Auto</span>
                </div>
              </Field>
              <Field label="Walk-in (live from fa_invitations)">
                <div className={`${inputCls} bg-slate-100 text-slate-700 cursor-not-allowed inline-flex items-center justify-between`}>
                  <span>{editRowForm.walk_in}</span>
                  <span className="text-[10px] text-slate-400">🔒 Auto</span>
                </div>
              </Field>
              <Field label="Actual Attended (auto)">
                <div className={`${inputCls} bg-blue-50 text-blue-700 cursor-not-allowed ${postLocked ? 'opacity-40' : ''}`}>
                  {postLocked ? '—' : derived.actual_attended}
                </div>
              </Field>
              <Field label="Returned (auto)">
                <div className={`${inputCls} bg-slate-50 text-slate-700 cursor-not-allowed ${postLocked ? 'opacity-40' : ''}`}>
                  {postLocked ? '—' : derived.returned}
                </div>
              </Field>
              <Field label="Closing Stock (auto)" full>
                <div className={`${inputCls} bg-emerald-50 ${derived.closing_stock < 0 ? 'text-rose-700' : 'text-emerald-700'} cursor-not-allowed ${postLocked ? 'opacity-40' : ''}`}>
                  {postLocked ? '—' : derived.closing_stock}
                </div>
              </Field>
            </FormGrid>

            <ModalFooter>
              <button onClick={() => setEditRow(null)} className={cancelBtn}>Cancel</button>
              <button onClick={handleSaveEditRow} className={primaryBtn}>Save Changes</button>
            </ModalFooter>
          </Modal>
        );
      })()}

    </div>
  );
}

// ── SUBCOMPONENTS ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EventStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span className={`text-[10px] font-black uppercase tracking-widest ${s.text}`}>{s.label}</span>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, disabled, wide }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/60 transition-colors">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        className={`bg-transparent text-sm font-medium text-slate-800 outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${wide ? 'min-w-[220px]' : 'min-w-[90px]'}`}>
        {options.length === 0
          ? <option value="">— none —</option>
          : options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)
        }
      </select>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
      <div className="text-5xl mb-3">📭</div>
      <p className="text-sm font-bold text-slate-500">{message}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Events will appear here when synced from the FA system</p>
    </div>
  );
}

function LockedCell() {
  return (
    <span className="inline-flex items-center gap-1 text-slate-300 text-[10px] font-bold">
      <span className="text-xs">🔒</span>
      <span>—</span>
    </span>
  );
}

interface TableRowEntry {
  row: InventoryRow;
  item: MarketingItem;
  firstOfGroup: boolean;
  groupSize: number;
}

function InventoryTable({ rows, event, updateCell, renameItem, getLatestWalkIn, onDeleteItem, onEditRow, onConfigureGrades }: {
  rows: TableRowEntry[];
  event: MarketingEvent;
  updateCell: (rowId: string, field: keyof InventoryRow, value: number) => void;
  renameItem: (itemId: string, newName: string) => void;
  getLatestWalkIn: (itemId: string) => number | null;
  onDeleteItem: (item: MarketingItem) => void;
  onEditRow: (row: InventoryRow) => void;
  onConfigureGrades: (item: MarketingItem) => void;
}) {
  const postLocked = isPostEventLocked(event);

  return (
    <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-lg shadow-slate-200/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" style={{ minWidth: 1280 }}>

          {/* GROUP HEADERS */}
          <thead>
            <tr>
              <th className="bg-slate-50 sticky left-0 z-30 border-r-2 border-slate-300" />
              <th className="bg-gradient-to-br from-indigo-200 to-violet-300 text-indigo-900 text-sm font-black uppercase tracking-wider text-center py-4 border-r-2 border-indigo-400 shadow-inner">
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-indigo-200 flex-shrink-0" />
                  Group
                </span>
              </th>
              <th colSpan={5} className="bg-gradient-to-br from-pink-200 to-rose-300 text-rose-900 text-sm font-black uppercase tracking-wider text-center py-4 border-r-2 border-rose-400 shadow-inner">
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-600 ring-2 ring-pink-200 flex-shrink-0" />
                  Pre-event Planning
                </span>
              </th>
              <th colSpan={2} className="bg-gradient-to-br from-orange-200 to-amber-300 text-amber-900 text-sm font-black uppercase tracking-wider text-center py-4 border-r-2 border-amber-400 shadow-inner">
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-600 ring-2 ring-orange-200 flex-shrink-0" />
                  Order Tracking
                </span>
              </th>
              <th colSpan={5} className="bg-gradient-to-br from-teal-200 to-emerald-300 text-emerald-900 text-sm font-black uppercase tracking-wider text-center py-4 shadow-inner">
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600 ring-2 ring-teal-200 flex-shrink-0" />
                  Post-event Reconciliation
                  {postLocked && <span className="ml-2 text-[10px] bg-white/80 px-2 py-0.5 rounded-full">🔒 Locked</span>}
                </span>
              </th>
              <th className="bg-slate-50" />
            </tr>
            {/* COL HEADERS */}
            <tr className="border-b-2 border-slate-400">
              <th className="py-4 px-3 text-xs font-black text-slate-900 uppercase tracking-wider text-left sticky left-0 z-20 bg-slate-50 min-w-[140px] border-r-2 border-slate-300">
                Item
              </th>
              <th className="py-4 px-2 text-[11px] font-black text-indigo-900 uppercase tracking-wider text-center min-w-[90px] bg-indigo-50/70 border-r-2 border-indigo-200">Group</th>
              <th className="py-4 px-2 text-[11px] font-black text-rose-900 uppercase tracking-wider text-center bg-pink-50/70">In Stock</th>
              <th className="py-4 px-2 text-[11px] font-black text-rose-900 uppercase tracking-wider text-center bg-pink-50/70">Registered</th>
              <th className="py-4 px-2 text-[11px] font-black text-rose-900 uppercase tracking-wider text-center bg-pink-50/70">Buffer</th>
              <th className="py-4 px-2 text-[11px] font-black text-rose-900 uppercase tracking-wider text-center bg-pink-50/70">Total to Bring</th>
              <th className="py-4 px-2 text-[11px] font-black text-rose-900 uppercase tracking-wider text-center bg-pink-50/70 border-r-2 border-rose-300">Shortfall</th>
              <th className="py-4 px-2 text-[11px] font-black text-amber-900 uppercase tracking-wider text-center bg-amber-50/70">In Cart</th>
              <th className="py-4 px-2 text-[11px] font-black text-amber-900 uppercase tracking-wider text-center bg-amber-50/70 border-r-2 border-amber-300">Ordered</th>
              <th className="py-4 px-2 text-[11px] font-black text-emerald-900 uppercase tracking-wider text-center bg-teal-50/70">Absent</th>
              <th className="py-4 px-2 text-[11px] font-black text-emerald-900 uppercase tracking-wider text-center bg-teal-50/70">Walk-in</th>
              <th className="py-4 px-2 text-[11px] font-black text-emerald-900 uppercase tracking-wider text-center bg-teal-50/70">Actual Attended</th>
              <th className="py-4 px-2 text-[11px] font-black text-emerald-900 uppercase tracking-wider text-center bg-teal-50/70">Returned</th>
              <th className="py-4 px-2 text-[11px] font-black text-emerald-900 uppercase tracking-wider text-center bg-teal-50/70">Closing Stock</th>
              <th className="py-4 px-2 text-[11px] font-black text-slate-900 uppercase tracking-wider text-center min-w-[100px] bg-slate-50">Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((entry, idx) => {
              const { row, item, firstOfGroup } = entry;
              const hasGrades = (item.grades ?? []).length > 0;
              const hasBranches = (item.branches ?? []).length > 0;
              const configLabel = hasGrades
                ? `Grades · ${item.grades.length}`
                : hasBranches
                ? `Branches · ${item.branches.length}`
                : 'Set Grades / Branches';
              const d = calcDerived(row, item.returnable ?? false);
              const lastWalk = getLatestWalkIn(item.id);
              const isEven = idx % 2 === 0;
              // Suppress the top border on grade sub-rows so the group looks merged.
              const borderClass = firstOfGroup ? 'border-t-2 border-slate-400' : 'border-t border-slate-200';
              return (
                <tr key={row.id}
                  className={`group ${isEven ? 'bg-white' : 'bg-slate-50/30'} hover:bg-pink-50/30 transition-all ${borderClass}`}>

                  {/* ITEM — name + 'Grades' link shown once per group */}
                  <td className="py-5 px-3 sticky left-0 z-10 bg-inherit group-hover:bg-pink-50/30 transition-colors shadow-[2px_0_4px_rgba(0,0,0,0.04)] border-r-2 border-slate-300 align-top">
                    {firstOfGroup ? (
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-10 bg-gradient-to-b from-pink-400 to-rose-400 rounded-full opacity-60 group-hover:opacity-100 transition-opacity mt-1" />
                        <div className="flex flex-col gap-1.5 min-w-0">
                          <ItemNameCell item={item} onRename={renameItem} />
                          <button
                            onClick={() => onConfigureGrades(item)}
                            title="Configure grade or branch breakdown for this item"
                            className="self-start inline-flex items-center gap-1 px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-pink-700 text-[9px] font-black uppercase tracking-wider rounded-full border border-pink-200 hover:border-pink-300 transition-all hover:shadow-sm"
                          >
                            <span className="text-[10px] leading-none">⚙</span>
                            <span>{configLabel}</span>
                          </button>
                          {item.returnable && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase tracking-wider rounded-full border border-emerald-200 self-start">
                              ♻ Returnable
                            </span>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </td>

                  {/* GROUP — Grade N (for graded), branch code (for branched), or em-dash */}
                  <td className="py-5 px-2 text-center bg-indigo-50/40 border-r-2 border-indigo-200">
                    {hasGrades ? (
                      <span className="inline-flex items-center px-3 py-1.5 bg-gradient-to-br from-indigo-100 to-violet-200 text-indigo-800 text-[11px] font-black uppercase tracking-wider rounded-lg shadow-sm border border-indigo-300">
                        Grade {row.grade}
                      </span>
                    ) : hasBranches ? (
                      <span className="inline-flex items-center px-3 py-1.5 bg-gradient-to-br from-indigo-100 to-violet-200 text-indigo-800 text-[11px] font-black uppercase tracking-wider rounded-lg shadow-sm border border-indigo-300">
                        {row.branch}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>

                  <td className="py-5 px-2 text-center bg-pink-50/30">
                    <NumCell value={row.in_stock} onSave={v => updateCell(row.id, 'in_stock', v)} prominent />
                  </td>
                  {/* REGISTERED — locked, sourced live from fa_invitations (status='confirmed') */}
                  <td className="py-5 px-2 text-center bg-pink-50/30">
                    <span className="text-base font-bold text-slate-900 inline-flex items-center gap-1" title="Pulled live from confirmed invitations">
                      {row.registered}
                      <span className="text-[8px] text-slate-400">🔒</span>
                    </span>
                  </td>
                  <td className="py-5 px-2 text-center relative bg-pink-50/30">
                    <NumCell value={row.buffer} onSave={v => updateCell(row.id, 'buffer', v)} />
                    {lastWalk !== null && (
                      <div className="absolute left-0 right-0 bottom-0.5 text-[9px] text-slate-400 font-bold italic">Last walk-in: {lastWalk}</div>
                    )}
                  </td>
                  <td className="py-5 px-2 text-center bg-gradient-to-br from-pink-100 to-rose-200/60 border-x border-rose-200">
                    {item.returnable ? (
                      <NumCell
                        value={d.total_to_bring}
                        onSave={v => updateCell(row.id, 'total_to_bring_set', v)}
                        prominent
                      />
                    ) : (
                      <span className="text-xl font-bold text-rose-900 leading-none">{d.total_to_bring}</span>
                    )}
                  </td>
                  <td className="py-5 px-2 text-center bg-pink-50/30 border-r-2 border-rose-300">
                    {d.shortfall > 0 ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-lg font-bold text-slate-900 leading-none">{d.shortfall}</span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-rose-200 to-rose-300 text-rose-900 text-[11px] font-black whitespace-nowrap shadow-sm shadow-rose-200">
                          <span className="text-rose-600">●</span>
                          +{d.shortfall} to order
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-200 to-emerald-300 text-emerald-900 text-[11px] font-black whitespace-nowrap shadow-sm shadow-emerald-200">
                        <span className="text-emerald-600">✓</span>
                        Sufficient
                      </span>
                    )}
                  </td>
                  <td className="py-5 px-2 text-center bg-amber-50/30">
                    <NumCell value={row.in_cart} onSave={v => updateCell(row.id, 'in_cart', v)} />
                  </td>
                  <td className="py-5 px-2 text-center bg-amber-50/30 border-r-2 border-amber-300">
                    <NumCell value={row.ordered} onSave={v => updateCell(row.id, 'ordered', v)} prominent />
                    {row.ordered > 0 && row.ordered > d.shortfall && d.shortfall >= 0 && (
                      <div className="text-[9px] text-amber-700 font-bold mt-1 max-w-[110px] mx-auto italic">Excess → stock</div>
                    )}
                  </td>
                  {/* ABSENT — locked, sourced live from fa_invitations (status='no_show') */}
                  <td className="py-5 px-2 text-center bg-teal-50/30">
                    <span className="text-base font-bold text-slate-900 inline-flex items-center gap-1" title="Pulled live from fa_invitations where status = 'no_show'">
                      {row.no_show}
                      <span className="text-[8px] text-slate-400">🔒</span>
                    </span>
                  </td>
                  {/* WALK-IN — locked, sourced live from fa_invitations (status='walk_in', not yet emitted by FA portal) */}
                  <td className="py-5 px-2 text-center bg-teal-50/30">
                    <span className="text-base font-bold text-slate-900 inline-flex items-center gap-1" title="Pulled live from fa_invitations where status = 'walk_in' (FA portal will start emitting this status soon)">
                      {row.walk_in}
                      <span className="text-[8px] text-slate-400">🔒</span>
                    </span>
                    {row.walk_in > row.buffer && row.walk_in > 0 && (
                      <div className="text-[9px] text-orange-700 font-bold mt-1 flex items-center justify-center gap-1">
                        ⚠ Exceeded buffer
                      </div>
                    )}
                  </td>
                  <td className="py-5 px-2 text-center bg-gradient-to-br from-teal-100 to-emerald-200/60 border-x border-teal-200">
                    {postLocked
                      ? <LockedCell />
                      : <span className="text-xl font-bold text-emerald-900 leading-none">{d.actual_attended}</span>}
                  </td>
                  <td className="py-5 px-2 text-center bg-teal-50/30">
                    {postLocked
                      ? <LockedCell />
                      : item.returnable
                        ? (
                          <span
                            className="text-base font-semibold text-emerald-900 inline-flex items-center gap-1"
                            title="Mirrors Closing Stock for returnable items — edit Closing Stock instead"
                          >
                            {d.returned}
                            <span className="text-[8px] text-slate-400">🔒</span>
                          </span>
                        )
                        : <span className="text-base font-semibold text-emerald-900">{d.returned}</span>}
                  </td>
                  <td className="py-5 px-2 text-center bg-gradient-to-br from-teal-100 to-emerald-200/60 border-l border-teal-200">
                    {postLocked
                      ? <LockedCell />
                      : item.returnable ? (
                          <NumCell
                            value={d.closing_stock}
                            onSave={v => updateCell(row.id, 'closing_stock_set', v)}
                            prominent
                          />
                        ) : (
                          <span className={`text-xl font-bold leading-none ${d.closing_stock < 0 ? 'text-rose-700' : 'text-emerald-900'}`}>
                            {d.closing_stock}
                          </span>
                        )}
                  </td>

                  {/* ACTIONS */}
                  <td className="py-5 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onEditRow(row)}
                        title="Edit all fields for this row"
                        className="px-3 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-[11px] font-black uppercase tracking-wider rounded-lg shadow-sm shadow-pink-200 hover:shadow-md hover:-translate-y-0.5 transition-all"
                      >
                        Edit
                      </button>
                      {!item.is_default && firstOfGroup && (
                        <button
                          onClick={() => onDeleteItem(item)}
                          title="Delete this item from all events"
                          className="w-9 h-9 inline-flex items-center justify-center bg-white hover:bg-rose-50 text-rose-600 text-base rounded-lg border border-rose-200 hover:border-rose-300 transition-colors"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>

        </table>
      </div>
    </div>
  );
}

function ItemNameCell({ item, onRename }: { item: MarketingItem; onRename: (id: string, name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(item.name);

  function finish() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== item.name) onRename(item.id, draft.trim());
    else setDraft(item.name);
  }

  if (editing) {
    return (
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setDraft(item.name); setEditing(false); } }}
        className="text-sm font-black text-slate-800 bg-white border-2 border-pink-400 rounded-lg px-2 py-1 outline-none w-full"
      />
    );
  }

  return (
    <div className="cursor-pointer group" onDoubleClick={() => setEditing(true)} title="Double-click to rename">
      <p className="text-base font-black text-slate-800 group-hover:text-pink-600 transition-colors">{item.name}</p>
      {!item.is_default && (
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Custom</p>
      )}
    </div>
  );
}

function NumCell({ value, onSave, disabled, hint, prominent }: {
  value: number;
  onSave: (v: number) => void;
  disabled?: boolean;
  hint?: string;
  prominent?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(String(value));

  function start() {
    if (disabled) return;
    setDraft(String(value));
    setEditing(true);
  }
  function finish() {
    setEditing(false);
    const n = parseInt(draft);
    if (!isNaN(n) && n !== value) onSave(n);
  }

  if (disabled) return <LockedCell />;

  if (editing) {
    return (
      <input autoFocus type="number" value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false); }}
        className="w-16 px-2 py-1 text-sm font-black text-center bg-white border-2 border-pink-400 rounded-lg outline-none"
      />
    );
  }

  return (
    <div className="flex flex-col items-center">
      <button onClick={start}
        className={`hover:bg-pink-50 hover:text-pink-700 rounded-lg px-2 py-1 transition-all min-w-[36px] border-2 border-transparent hover:border-pink-200 ${
          prominent
            ? 'text-lg font-bold text-slate-900'
            : 'text-base font-semibold text-slate-900'
        }`}
        title="Click to edit">
        {value}
      </button>
      {hint && <span className="text-[9px] text-slate-400 font-bold mt-1 italic">{hint}</span>}
    </div>
  );
}

// ── MODAL HELPERS ────────────────────────────────────────────────────────────

const inputCls   = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-400';
const primaryBtn = 'px-5 py-3 bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all disabled:opacity-50';
const cancelBtn  = 'px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-colors';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 text-2xl leading-none">&times;</button>
        </div>
        <div className="py-5 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">{children}</div>;
}

function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-4 px-6">{children}</div>;
}

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 text-slate-400">{label}</label>
      {children}
    </div>
  );
}
