import { useEffect, useState } from 'react';

// Page-size options for the dropdown (default 50). 'all' shows everything.
export const PAGE_SIZE_OPTIONS = [
  { label: '10 / page', value: '10' },
  { label: '15 / page', value: '15' },
  { label: '25 / page', value: '25' },
  { label: '50 / page', value: '50' },
  { label: '100 / page', value: '100' },
];

// Client-side display pagination over an already-filtered list. We paginate the
// DISPLAY (not the DB query) so the web-matching client filters (type/branch/
// search/sibling-split) still apply across the whole set. `resetKey` should encode
// the active filters so changing any of them returns to the first page.
export function usePagedList<T>(items: T[], resetKey: string) {
  const [pageSize, setPageSize] = useState('50');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const visibleCount = pageSize === 'all' ? items.length : (parseInt(pageSize, 10) || 50) * page;
  const shown = items.slice(0, visibleCount);
  const hasMore = shown.length < items.length;
  const loadMore = () => {
    if (hasMore) setPage((p) => p + 1);
  };

  return { shown, pageSize, setPageSize, loadMore, hasMore, total: items.length };
}
