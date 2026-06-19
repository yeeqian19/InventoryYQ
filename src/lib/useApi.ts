import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from './api';

// Generic data-fetching hook: returns data + loading + error + a reload() for retry.
export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<T>(path));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load };
}
