import { useState, useEffect, useCallback, useRef } from "react";
import { cache } from "./cache";

interface UseCachedQueryResult<T> {
  data: T | null;
  loading: boolean;
  isStale: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useCachedQuery<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): UseCachedQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(() => {
    // 1. Check fresh cache
    const fresh = cache.get<T>(cacheKey);
    if (fresh) {
      setData(fresh);
      setLoading(false);
      setIsStale(false);
      setError(null);
    } else {
      // 2. Show stale data while loading
      const stale = cache.getStale<T>(cacheKey);
      if (stale) {
        setData(stale);
        setIsStale(true);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }

    // 3. Fetch from API
    fetcher()
      .then((result) => {
        if (!mountedRef.current) return;
        cache.set(cacheKey, result);
        setData(result);
        setIsStale(false);
        setError(null);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        // 4. On failure: keep stale data, only set error if no fallback
        const stale = cache.getStale<T>(cacheKey);
        if (stale && !data) {
          setData(stale);
          setIsStale(true);
        }
        if (!stale && !data) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, [cacheKey, ...deps]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  return { data, loading, isStale, error, refresh: load };
}
