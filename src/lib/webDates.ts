// Date-range helpers that EXACTLY mirror the web clients' date math, computed on
// the device (like the browser) so the mobile windows match the website's.
// Web rows compare a UTC date-part (doc_date.toISOString().slice(0,10)) against
// these LOCAL-formatted range strings — so endpoints must apply UTC day boundaries.

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// "Now" pinned to Malaysia time (UTC+8) regardless of the device timezone, so the
// computed window matches the web (whose users' browsers are in Malaysia) even when
// the device/emulator clock is set to another zone. Local getters on the returned
// Date yield KL wall-clock components.
const KL_OFFSET_MS = 8 * 60 * 60 * 1000;
export function klNow(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + KL_OFFSET_MS);
}

// KL-midnight instant for a 'YYYY-MM-DD' day boundary (for absolute-timestamp compares).
export function klDayStart(day: string): Date {
  return new Date(`${day}T00:00:00.000+08:00`);
}
export function klDayEnd(day: string): Date {
  return new Date(`${day}T23:59:59.999+08:00`);
}

export type Range = { start: string; end: string };

// Used by dashboard, student-manager, scan-log, student-tracker.
// Matches getThisWeekRange/getLastWeekRange (Monday-anchored) == rangeForPreset.
export function stdRange(preset: string): Range {
  const now = klNow();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case 'thisWeek': {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(today);
      monday.setDate(diff);
      return { start: fmt(monday), end: fmt(today) };
    }
    case 'lastWeek': {
      const currentDay = today.getDay();
      const daysToCurrentMonday = currentDay === 0 ? 6 : currentDay - 1;
      const currentMonday = new Date(today);
      currentMonday.setDate(today.getDate() - daysToCurrentMonday);
      const lastMonday = new Date(currentMonday);
      lastMonday.setDate(currentMonday.getDate() - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return { start: fmt(lastMonday), end: fmt(lastSunday) };
    }
    case 'thisMonth':
      return { start: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), end: fmt(today) };
    case 'lastMonth':
      return {
        start: fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        end: fmt(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    default: // 'all'
      return { start: '', end: '' };
  }
}

// Used by RM Dashboard. NOTE: its 'this-week' is Sunday-anchored (start = now - getDay()),
// unlike stdRange — replicated verbatim from RM_DashboardClient.calculateDates.
export function rmRange(range: string): Range {
  const now = klNow();
  switch (range) {
    case 'this-week': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay()); // Sunday
      return { start: fmt(start), end: fmt(now) };
    }
    case 'last-week': {
      const currentDay = now.getDay();
      const daysToCurrentMonday = currentDay === 0 ? 6 : currentDay - 1;
      const currentMonday = new Date(now);
      currentMonday.setDate(now.getDate() - daysToCurrentMonday);
      const lastMonday = new Date(currentMonday);
      lastMonday.setDate(currentMonday.getDate() - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return { start: fmt(lastMonday), end: fmt(lastSunday) };
    }
    case 'this-month':
      return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(now) };
    case 'last-month':
      return {
        start: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        end: fmt(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    default: // 'all'
      return { start: '', end: '' };
  }
}
