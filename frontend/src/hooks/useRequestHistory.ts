import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'peek-request-history';
const MAX_ENTRIES = 100;

export interface RequestHistoryEntry {
  id: string;
  timestamp: number;
  integrationId: string;
  integrationName: string;
  capabilityId: string;
  capabilityName: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  parameters?: Record<string, unknown>;
  response: {
    success: boolean;
    statusCode?: number;
    timing: number;
    data?: unknown;
    error?: string;
  };
}

export interface UseRequestHistoryResult {
  entries: RequestHistoryEntry[];
  addEntry: (entry: Omit<RequestHistoryEntry, 'id' | 'timestamp'>) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
  getEntry: (id: string) => RequestHistoryEntry | undefined;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function loadFromStorage(): RequestHistoryEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load request history from localStorage:', e);
  }
  return [];
}

function saveToStorage(entries: RequestHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Failed to save request history to localStorage:', e);
  }
}

export function useRequestHistory(): UseRequestHistoryResult {
  const [entries, setEntries] = useState<RequestHistoryEntry[]>(() => loadFromStorage());

  // Sync to localStorage whenever entries change
  useEffect(() => {
    saveToStorage(entries);
  }, [entries]);

  const addEntry = useCallback((entry: Omit<RequestHistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: RequestHistoryEntry = {
      ...entry,
      id: generateId(),
      timestamp: Date.now(),
    };

    setEntries((prev) => {
      const updated = [newEntry, ...prev];
      // Prune to max entries
      if (updated.length > MAX_ENTRIES) {
        return updated.slice(0, MAX_ENTRIES);
      }
      return updated;
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setEntries([]);
  }, []);

  const getEntry = useCallback(
    (id: string) => entries.find((e) => e.id === id),
    [entries]
  );

  return {
    entries,
    addEntry,
    removeEntry,
    clearAll,
    getEntry,
  };
}

// Code snippet generators
export function generateCurlSnippet(entry: RequestHistoryEntry, baseUrl: string): string {
  const url = `${baseUrl}/api/integrations/${entry.integrationId}/capability`;
  const body = JSON.stringify({
    capabilityId: entry.capabilityId,
    method: entry.method,
    endpoint: entry.endpoint,
    parameters: entry.parameters,
  }, null, 2);

  return `curl -X POST '${url}' \\
  -H 'Content-Type: application/json' \\
  -d '${body}'`;
}

export function generateFetchSnippet(entry: RequestHistoryEntry, baseUrl: string): string {
  const url = `${baseUrl}/api/integrations/${entry.integrationId}/capability`;
  const body = JSON.stringify({
    capabilityId: entry.capabilityId,
    method: entry.method,
    endpoint: entry.endpoint,
    parameters: entry.parameters,
  }, null, 2);

  return `const response = await fetch('${url}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(${body})
});
const data = await response.json();`;
}

export function generateAxiosSnippet(entry: RequestHistoryEntry, baseUrl: string): string {
  const url = `${baseUrl}/api/integrations/${entry.integrationId}/capability`;
  const body = JSON.stringify({
    capabilityId: entry.capabilityId,
    method: entry.method,
    endpoint: entry.endpoint,
    parameters: entry.parameters,
  }, null, 2);

  return `const { data } = await axios.post('${url}', ${body});`;
}

export function generatePythonSnippet(entry: RequestHistoryEntry, baseUrl: string): string {
  const url = `${baseUrl}/api/integrations/${entry.integrationId}/capability`;
  const body = JSON.stringify({
    capabilityId: entry.capabilityId,
    method: entry.method,
    endpoint: entry.endpoint,
    parameters: entry.parameters,
  }, null, 2).replace(/"/g, "'").replace(/null/g, 'None').replace(/true/g, 'True').replace(/false/g, 'False');

  return `import requests

response = requests.post(
    '${url}',
    json=${body}
)
data = response.json()`;
}
