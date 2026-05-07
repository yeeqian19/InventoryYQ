export const STAGE_DAYS = {
  hq_prep: 10,
  bm_pickup: 8,
  bm_handover: 6,
} as const;

export const DUE_SOON_THRESHOLD_DAYS = 2;
export const DEFAULT_EXTENSION_DAYS = 7;

export type TrackerStage = 'HQ_PREP' | 'BM_PICKUP' | 'BM_HANDOVER' | 'COMPLETED';
export type TrackerStatus = 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED';

export type TrackerInput = {
  doc_date: Date | string | null;
  package: string | null;
  sk_prep: boolean;
  sk_prep_date: Date | string | null;
  eg_prep: boolean;
  eg_prep_date: Date | string | null;
  bm_pickup: boolean;
  bm_pickup_date: Date | string | null;
  student_received: boolean;
  student_received_date: Date | string | null;
  hq_prep_extension_days: number;
  bm_pickup_extension_days: number;
  bm_handover_extension_days: number;
};

export type TrackerComputed = {
  stage: TrackerStage;
  deadline: Date | null;
  status: TrackerStatus;
  skDone: boolean;
  egDone: boolean;
  egRequired: boolean;
  daysRemaining: number | null;
  hqPrepDeadline: Date | null;
  bmPickupDeadline: Date | null;
  bmHandoverDeadline: Date | null;
};

export function isEgRequired(pkg: string | null | undefined): boolean {
  if (!pkg) return false;
  return /^12M/i.test(pkg.trim());
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

function maxDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

function startOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function computeTracker(input: TrackerInput, now: Date = new Date()): TrackerComputed {
  const docDate = toDate(input.doc_date);
  const skDate = toDate(input.sk_prep_date);
  const egDate = toDate(input.eg_prep_date);
  const pickupDate = toDate(input.bm_pickup_date);

  const egRequired = isEgRequired(input.package);
  const skDone = !!input.sk_prep;
  const egDone = !!input.eg_prep;
  const hqPrepDone = skDone && (!egRequired || egDone);
  const hqPrepCompletedAt = hqPrepDone
    ? (egRequired ? maxDate(skDate, egDate) : skDate)
    : null;

  const bmPickupDone = !!input.bm_pickup;
  const handoverDone = !!input.student_received;

  const hqPrepDeadline = docDate
    ? addDays(docDate, STAGE_DAYS.hq_prep + (input.hq_prep_extension_days ?? 0))
    : null;

  const bmPickupDeadline = hqPrepCompletedAt
    ? addDays(hqPrepCompletedAt, STAGE_DAYS.bm_pickup + (input.bm_pickup_extension_days ?? 0))
    : null;

  const bmHandoverDeadline = pickupDate
    ? addDays(pickupDate, STAGE_DAYS.bm_handover + (input.bm_handover_extension_days ?? 0))
    : null;

  let stage: TrackerStage;
  let deadline: Date | null;
  if (handoverDone) {
    stage = 'COMPLETED';
    deadline = null;
  } else if (bmPickupDone) {
    stage = 'BM_HANDOVER';
    deadline = bmHandoverDeadline;
  } else if (hqPrepDone) {
    stage = 'BM_PICKUP';
    deadline = bmPickupDeadline;
  } else {
    stage = 'HQ_PREP';
    deadline = hqPrepDeadline;
  }

  let status: TrackerStatus;
  let daysRemaining: number | null = null;
  if (stage === 'COMPLETED') {
    status = 'COMPLETED';
  } else if (!deadline) {
    status = 'ON_TRACK';
  } else {
    const today = startOfDay(now);
    const due = startOfDay(deadline);
    const diffMs = due.getTime() - today.getTime();
    daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (daysRemaining < 0) status = 'OVERDUE';
    else if (daysRemaining <= DUE_SOON_THRESHOLD_DAYS) status = 'DUE_SOON';
    else status = 'ON_TRACK';
  }

  return {
    stage,
    deadline,
    status,
    skDone,
    egDone,
    egRequired,
    daysRemaining,
    hqPrepDeadline,
    bmPickupDeadline,
    bmHandoverDeadline,
  };
}

export function formatTrackerDate(date: Date | string | null | undefined): string {
  const d = toDate(date as Date | string | null);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function statusBadgeClasses(status: TrackerStatus): string {
  switch (status) {
    case 'ON_TRACK':
      return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    case 'DUE_SOON':
      return 'bg-amber-50 text-amber-600 border border-amber-100';
    case 'OVERDUE':
      return 'bg-red-50 text-red-600 border border-red-100';
    case 'COMPLETED':
      return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

export function statusLabel(status: TrackerStatus): string {
  switch (status) {
    case 'ON_TRACK': return 'On-Track';
    case 'DUE_SOON': return 'Due Soon';
    case 'OVERDUE': return 'Overdue';
    case 'COMPLETED': return 'Completed';
  }
}

export function stageLabel(stage: TrackerStage): string {
  switch (stage) {
    case 'HQ_PREP': return 'HQ Prep';
    case 'BM_PICKUP': return 'BM Pickup';
    case 'BM_HANDOVER': return 'BM Handover';
    case 'COMPLETED': return 'Completed';
  }
}

export function stagesAfter(stage: TrackerStage): TrackerStage[] {
  switch (stage) {
    case 'HQ_PREP': return ['HQ_PREP', 'BM_PICKUP', 'BM_HANDOVER'];
    case 'BM_PICKUP': return ['BM_PICKUP', 'BM_HANDOVER'];
    case 'BM_HANDOVER': return ['BM_HANDOVER'];
    case 'COMPLETED': return [];
  }
}
