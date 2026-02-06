import { useEffect } from 'react';
import { useIntegrationStore } from '../stores/integrationStore';

export function useIntegrations() {
  const {
    integrations,
    integrationTypes,
    loading,
    error,
    fetchIntegrations,
    fetchIntegrationTypes,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    testConnection,
  } = useIntegrationStore();

  useEffect(() => {
    // Fetch both in parallel for faster initial load
    // Use Promise.allSettled to ensure both attempts are made even if one fails
    Promise.allSettled([fetchIntegrations(), fetchIntegrationTypes()]);
  }, [fetchIntegrations, fetchIntegrationTypes]);

  return {
    integrations,
    integrationTypes,
    loading,
    error,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    testConnection,
    refetch: fetchIntegrations,
  };
}

export function useEnabledIntegrations() {
  const { integrations } = useIntegrationStore();
  return integrations.filter(i => i.enabled);
}

export function useIntegrationById(id: string) {
  const { integrations } = useIntegrationStore();
  return integrations.find(i => i.id === id);
}
