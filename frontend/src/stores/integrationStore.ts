import { create } from 'zustand';
import { Integration, IntegrationType } from '../types';
import { integrationApi, getIntegrationTypes } from '../api/client';

export interface ConnectionStatus {
  status: 'unknown' | 'checking' | 'connected' | 'failed';
  lastChecked?: string;
  message?: string;
}

interface IntegrationState {
  integrations: Integration[];
  integrationTypes: IntegrationType[];
  connectionStatuses: Record<string, ConnectionStatus>;
  loading: boolean;
  error: string | null;

  fetchIntegrations: () => Promise<void>;
  fetchIntegrationTypes: () => Promise<void>;
  createIntegration: (data: Omit<Integration, 'id' | 'created_at' | 'updated_at'>) => Promise<Integration>;
  updateIntegration: (id: string, data: Partial<Integration>) => Promise<void>;
  deleteIntegration: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<{ success: boolean; message: string }>;
  checkConnection: (id: string) => Promise<void>;
  checkAllConnections: () => Promise<void>;
}

export const useIntegrationStore = create<IntegrationState>((set, get) => ({
  integrations: [],
  integrationTypes: [],
  connectionStatuses: {},
  loading: false,
  error: null,

  fetchIntegrations: async () => {
    set({ loading: true, error: null });
    try {
      const integrations = await integrationApi.getAll();
      set({ integrations, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  fetchIntegrationTypes: async () => {
    try {
      const integrationTypes = await getIntegrationTypes();
      set({ integrationTypes });
    } catch (error) {
      console.error('Failed to fetch integration types:', error);
    }
  },

  createIntegration: async (data) => {
    const integration = await integrationApi.create(data);
    set({ integrations: [...get().integrations, integration] });
    return integration;
  },

  updateIntegration: async (id, data) => {
    const updated = await integrationApi.update(id, data);
    set({
      integrations: get().integrations.map(i => (i.id === id ? updated : i)),
    });
  },

  deleteIntegration: async (id) => {
    await integrationApi.delete(id);
    set({
      integrations: get().integrations.filter(i => i.id !== id),
    });
  },

  testConnection: async (id) => {
    return integrationApi.testConnection(id);
  },

  checkConnection: async (id) => {
    // Set status to checking
    set({
      connectionStatuses: {
        ...get().connectionStatuses,
        [id]: { status: 'checking' },
      },
    });

    try {
      const result = await integrationApi.testConnection(id);
      set({
        connectionStatuses: {
          ...get().connectionStatuses,
          [id]: {
            status: result.success ? 'connected' : 'failed',
            lastChecked: new Date().toISOString(),
            message: result.message,
          },
        },
      });
    } catch (error) {
      set({
        connectionStatuses: {
          ...get().connectionStatuses,
          [id]: {
            status: 'failed',
            lastChecked: new Date().toISOString(),
            message: error instanceof Error ? error.message : 'Connection failed',
          },
        },
      });
    }
  },

  checkAllConnections: async () => {
    const { integrations, checkConnection } = get();
    const enabledIntegrations = integrations.filter(i => i.enabled);

    // Check all enabled integrations in parallel (with concurrency limit)
    const CONCURRENCY = 3;
    for (let i = 0; i < enabledIntegrations.length; i += CONCURRENCY) {
      const batch = enabledIntegrations.slice(i, i + CONCURRENCY);
      await Promise.allSettled(batch.map(integration => checkConnection(integration.id)));
    }
  },
}));
