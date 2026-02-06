import React, { createContext, useCallback, useRef } from 'react';

interface WidgetRefreshState {
  refetch: () => Promise<void>;
  lastUpdated: Date | null;
}

type UpdateListener = (widgetId: string, lastUpdated: Date) => void;

interface WidgetRefreshContextValue {
  register: (widgetId: string, refetch: () => Promise<void>, lastUpdated: Date | null) => void;
  unregister: (widgetId: string) => void;
  updateLastUpdated: (widgetId: string, lastUpdated: Date) => void;
  refresh: (widgetId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  getLastUpdated: (widgetId: string) => Date | null;
  subscribeToUpdates: (listener: UpdateListener) => () => void;
}

export const WidgetRefreshContext = createContext<WidgetRefreshContextValue | null>(null);

interface WidgetRefreshProviderProps {
  children: React.ReactNode;
}

export function WidgetRefreshProvider({ children }: WidgetRefreshProviderProps) {
  const widgetsRef = useRef<Map<string, WidgetRefreshState>>(new Map());
  const listenersRef = useRef<Set<UpdateListener>>(new Set());

  const register = useCallback((widgetId: string, refetch: () => Promise<void>, lastUpdated: Date | null) => {
    widgetsRef.current.set(widgetId, { refetch, lastUpdated });
  }, []);

  const unregister = useCallback((widgetId: string) => {
    widgetsRef.current.delete(widgetId);
  }, []);

  const updateLastUpdated = useCallback((widgetId: string, lastUpdated: Date) => {
    const widget = widgetsRef.current.get(widgetId);
    if (widget) {
      widget.lastUpdated = lastUpdated;
      // Notify all listeners
      listenersRef.current.forEach(listener => listener(widgetId, lastUpdated));
    }
  }, []);

  const refresh = useCallback(async (widgetId: string) => {
    const widget = widgetsRef.current.get(widgetId);
    if (widget) {
      await widget.refetch();
    }
  }, []);

  const refreshAll = useCallback(async () => {
    const promises: Promise<void>[] = [];
    widgetsRef.current.forEach((widget) => {
      promises.push(widget.refetch());
    });
    await Promise.all(promises);
  }, []);

  const getLastUpdated = useCallback((widgetId: string) => {
    return widgetsRef.current.get(widgetId)?.lastUpdated || null;
  }, []);

  const subscribeToUpdates = useCallback((listener: UpdateListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  return (
    <WidgetRefreshContext.Provider value={{ register, unregister, updateLastUpdated, refresh, refreshAll, getLastUpdated, subscribeToUpdates }}>
      {children}
    </WidgetRefreshContext.Provider>
  );
}
