// Turn start/end 'YYYY-MM-DD' strings (computed on the mobile client with the same
// math as the web) into a Prisma datetime range using UTC day boundaries — this
// matches how the web filters (UTC date-part of doc_date/timestamp vs the range strings).
export function utcDayRange(
  start: string | null,
  end: string | null,
): { gte: Date; lte: Date } | null {
  if (!start || !end) return null;
  return {
    gte: new Date(`${start}T00:00:00.000Z`),
    lte: new Date(`${end}T23:59:59.999Z`),
  };
}
