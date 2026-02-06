import { create } from 'zustand';

export type AdminTab = 'dashboards' | 'integrations' | 'media' | 'branding' | 'system' | 'logs' | 'docs' | 'dev' | 'network';

interface AdminNavigationState {
  // Navigation request
  targetTab: AdminTab | null;

  // For API Explorer: which integration type to select
  apiExplorerType: string | null;

  // For Integrations tab: which integration type to add
  addIntegrationType: string | null;

  // Actions
  navigateToApiExplorer: (integrationType: string) => void;
  navigateToAddIntegration: (integrationType: string) => void;
  clearNavigation: () => void;
}

export const useAdminNavigationStore = create<AdminNavigationState>((set) => ({
  targetTab: null,
  apiExplorerType: null,
  addIntegrationType: null,

  navigateToApiExplorer: (integrationType: string) => {
    set({
      targetTab: 'dev',
      apiExplorerType: integrationType,
      addIntegrationType: null,
    });
  },

  navigateToAddIntegration: (integrationType: string) => {
    set({
      targetTab: 'integrations',
      addIntegrationType: integrationType,
      apiExplorerType: null,
    });
  },

  clearNavigation: () => {
    set({
      targetTab: null,
      apiExplorerType: null,
      addIntegrationType: null,
    });
  },
}));
