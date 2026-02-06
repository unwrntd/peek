import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { WidgetRefreshContext } from '../contexts/WidgetRefreshContext';

// Request deduplication cache
const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Cross-integration API response type
 */
export interface CrossIntegrationResponse<T> {
  timestamp: number;
  availableIntegrations: {
    [type: string]: {
      id: string;
      name: string;
      enabled: boolean;
    }[];
  };
  missingIntegrations: string[];
  data: T;
}

/**
 * Fetch cross-integration data with request deduplication
 */
async function fetchCrossIntegrationData<T>(endpoint: string): Promise<CrossIntegrationResponse<T>> {
  const cacheKey = `cross:${endpoint}`;

  // Return existing promise if request is already in flight
  const existing = pendingRequests.get(cacheKey);
  if (existing) {
    return existing as Promise<CrossIntegrationResponse<T>>;
  }

  const promise = fetch(`/api/cross-integration/${endpoint}`)
    .then(async (response) => {
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      return response.json() as Promise<CrossIntegrationResponse<T>>;
    })
    .finally(() => {
      pendingRequests.delete(cacheKey);
    });

  pendingRequests.set(cacheKey, promise);
  return promise;
}

interface UseCrossIntegrationDataOptions {
  endpoint: string;
  refreshInterval?: number;
  enabled?: boolean;
  widgetId?: string;
}

interface UseCrossIntegrationDataResult<T> {
  data: T | null;
  availableIntegrations: CrossIntegrationResponse<T>['availableIntegrations'] | null;
  missingIntegrations: string[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching cross-integration data
 */
export function useCrossIntegrationData<T = unknown>({
  endpoint,
  refreshInterval = 30000,
  enabled = true,
  widgetId,
}: UseCrossIntegrationDataOptions): UseCrossIntegrationDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [availableIntegrations, setAvailableIntegrations] = useState<CrossIntegrationResponse<T>['availableIntegrations'] | null>(null);
  const [missingIntegrations, setMissingIntegrations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refreshContext = useContext(WidgetRefreshContext);
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled || !endpoint) {
      return;
    }

    try {
      setError(null);
      const result = await fetchCrossIntegrationData<T>(endpoint);

      if (isMountedRef.current) {
        setData(result.data);
        setAvailableIntegrations(result.availableIntegrations);
        setMissingIntegrations(result.missingIntegrations);
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
  }, [endpoint, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Register with refresh context
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

  // Initial fetch and interval
  useEffect(() => {
    fetchData();

    if (refreshInterval > 0 && enabled) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval, enabled]);

  return {
    data,
    availableIntegrations,
    missingIntegrations,
    loading,
    error,
    lastUpdated,
    refetch: fetchData,
  };
}
