import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { dataApi } from '../api/client';
import { WidgetRefreshContext } from '../contexts/WidgetRefreshContext';
import { useMockWidgetData } from '../contexts/MockWidgetDataContext';

// Request deduplication cache - shared across all widget instances
// Maps "integrationId:metric" to pending promise with timestamp
interface CachedRequest {
  promise: Promise<unknown>;
  timestamp: number;
}
const pendingRequests = new Map<string, CachedRequest>();
const CACHE_CLEANUP_INTERVAL = 30000; // 30 seconds
const CACHE_MAX_AGE = 60000; // 60 seconds max age for stale entries

// Periodic cleanup of stale cache entries to prevent memory leaks
// This handles edge cases where finally() might not be called (e.g., uncaught exceptions)
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of pendingRequests.entries()) {
      if (now - entry.timestamp > CACHE_MAX_AGE) {
        pendingRequests.delete(key);
      }
    }
  }, CACHE_CLEANUP_INTERVAL);
}

/**
 * Fetch data with request deduplication.
 * Multiple widgets requesting the same integration+metric share one in-flight request.
 * NOTE: Abort signals are NOT passed to shared requests - if one consumer aborts,
 * it shouldn't cancel the request for other consumers waiting on the same promise.
 */
async function fetchWithDedup<T>(
  integrationId: string,
  metric: string
): Promise<T> {
  const cacheKey = `${integrationId}:${metric}`;

  // Return existing promise if request is already in flight
  const existing = pendingRequests.get(cacheKey);
  if (existing) {
    return existing.promise as Promise<T>;
  }

  // Create new request and cache the promise (no abort signal - shared request)
  const promise = dataApi.getData<T>(integrationId, metric)
    .finally(() => {
      // Remove from cache after request completes (success or failure)
      pendingRequests.delete(cacheKey);
    });

  pendingRequests.set(cacheKey, { promise, timestamp: Date.now() });
  return promise;
}

interface UseWidgetDataOptions {
  integrationId: string;
  metric: string;
  refreshInterval?: number;
  enabled?: boolean;
  widgetId?: string;
}

interface UseWidgetDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
}

export function useWidgetData<T = unknown>({
  integrationId,
  metric,
  refreshInterval = 30000,
  enabled = true,
  widgetId,
}: UseWidgetDataOptions): UseWidgetDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refreshContext = useContext(WidgetRefreshContext);
  const mockContext = useMockWidgetData();

  // If in mock mode, return mock data immediately
  if (mockContext?.isMockMode) {
    const mockEntry = mockContext.getMockData(metric);
    return {
      data: (mockEntry?.data as T) || null,
      loading: mockEntry?.loading ?? false,
      error: mockEntry?.error ?? null,
      lastUpdated: new Date(),
      refetch: async () => {},
    };
  }

  // Track mounted state to avoid state updates on unmounted components
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled || !integrationId || !metric) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const result = await fetchWithDedup<T>(integrationId, metric);

      // Only update state if still mounted
      if (isMountedRef.current) {
        setData(result);
        setLastUpdated(new Date());
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [integrationId, metric, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Register this widget's refresh function with the context
  // Note: lastUpdated is handled separately via updateLastUpdated, so it's not in dependencies
  useEffect(() => {
    if (widgetId && refreshContext) {
      refreshContext.register(widgetId, fetchData, null);
      return () => refreshContext.unregister(widgetId);
    }
  }, [widgetId, fetchData, refreshContext]);

  // Update context when lastUpdated changes
  useEffect(() => {
    if (widgetId && refreshContext && lastUpdated) {
      refreshContext.updateLastUpdated(widgetId, lastUpdated);
    }
  }, [widgetId, lastUpdated, refreshContext]);

  useEffect(() => {
    fetchData();

    if (refreshInterval > 0 && enabled) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval, enabled]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch: fetchData,
  };
}
