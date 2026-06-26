import { useEffect, useState } from 'react';

// Page-size options for the dropdown (default 50). 'all' shows everything on one page.
export const PAGE_SIZE_OPTIONS = [
  { label: '10 / page', value: '10' },
  { label: '15 / page', value: '15' },
  { label: '25 / page', value: '25' },
  { label: '50 / page', value: '50' },
  { label: '100 / page', value: '100' },
];

// Client-side DISPLAY pagination over an already-filtered list. We paginate the
// display (not the DB query) so the web-matching client filters (type/branch/
// search/sibling-split) still apply across the whole set. `resetKey` should encode
// the active filters so changing any of them jumps back to page 1.
//
// Page-based navigation: `shown` is exactly ONE page of items; use `page`,
// `totalPages` and `setPage` with the <Pagination/> control to move between pages.
export function usePagedList<T>(items: T[], resetKey: string) {
  const [pageSize, setPageSize] = useState('50');
  const [page, setPage] = useState(1);

  // Reset to the first page whenever the filters or page size change.
  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const total = items.length;
  const perPage = pageSize === 'all' ? Math.max(total, 1) : parseInt(pageSize, 10) || 50;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  // Clamp in case the list shrank (e.g. after a filter) while page was high.
  const current = Math.min(page, totalPages);
  const startIdx = (current - 1) * perPage;
  const endIdx = Math.min(startIdx + perPage, total);
  const shown = items.slice(startIdx, endIdx);

  return {
    shown,
    page: current,
    setPage,
    totalPages,
    pageSize,
    setPageSize,
    total,
    rangeStart: total === 0 ? 0 : startIdx + 1, // 1-based, for "X–Y of Z" labels
    rangeEnd: endIdx,
  };
}
