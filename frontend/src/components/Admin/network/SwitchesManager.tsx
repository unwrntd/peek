import React, { useState, useMemo, useEffect } from 'react';
import { useIntegrationStore } from '../../../stores/integrationStore';
import { settingsApi, ManualSwitchData } from '../../../api/client';

interface NetworkSwitch {
  id: string;
  name: string;
  model?: string;
  mac?: string;
  ip?: string;
  portCount?: number;
  source: 'integration' | 'manual';
  integrationId?: string;
  integrationName?: string;
}

type ManualSwitch = ManualSwitchData;

export function SwitchesManager() {
  const integrations = useIntegrationStore((state) => state.integrations);
  const fetchIntegrations = useIntegrationStore((state) => state.fetchIntegrations);

  // Fetch integrations on mount
  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);
  const [detectedSwitches, setDetectedSwitches] = useState<NetworkSwitch[]>([]);
  const [manualSwitches, setManualSwitches] = useState<ManualSwitch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingSwitch, setIsAddingSwitch] = useState(false);
  const [editingSwitch, setEditingSwitch] = useState<ManualSwitch | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    model: '',
    mac: '',
    ip: '',
    portCount: 24,
  });

  // Get UniFi integrations
  const unifiIntegrations = useMemo(() => {
    return integrations.filter((i) => i.type === 'unifi' && i.enabled);
  }, [integrations]);

  // Load manual switches from settings
  useEffect(() => {
    const loadManualSwitches = async () => {
      try {
        const saved = await settingsApi.getManualSwitches();
        if (saved && Array.isArray(saved)) {
          setManualSwitches(saved);
        }
      } catch (err) {
        console.error('Failed to load manual switches:', err);
      }
    };
    loadManualSwitches();
  }, []);

  // Fetch switches from integrations
  useEffect(() => {
    const fetchSwitches = async () => {
      setIsLoading(true);
      setError(null);

      const allSwitches: NetworkSwitch[] = [];

      for (const integration of unifiIntegrations) {
        try {
          const response = await fetch(`/api/data/${integration.id}/switch-ports`);
          const contentType = response.headers.get('content-type');
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[SwitchesManager] API error for ${integration.name}:`, response.status, errorText.substring(0, 500));
            continue;
          }
          if (!contentType?.includes('application/json')) {
            const errorText = await response.text();
            console.error(`[SwitchesManager] Unexpected content-type for ${integration.name}:`, contentType, errorText.substring(0, 500));
            continue;
          }
          const data = await response.json();
          console.log('[SwitchesManager] API response for', integration.name, ':', data);
            if (data.devices && Array.isArray(data.devices)) {
              console.log('[SwitchesManager] Found', data.devices.length, 'devices');
              for (const device of data.devices) {
                // Include devices that are switches - either by port_table or by device type
                const hasPortTable = device.port_table && device.port_table.length > 0;
                const isSwitch = device.type === 'usw' || device.type === 'USW';
                const isUdm = device.type === 'udm' || device.type === 'UDM';

                console.log('[SwitchesManager] Device:', device.name, 'type:', device.type, 'hasPortTable:', hasPortTable, '_id:', device._id);

                if (hasPortTable || isSwitch || isUdm) {
                  allSwitches.push({
                    id: device._id || device.mac,
                    name: device.name || device.model || 'Unknown Switch',
                    model: device.model,
                    mac: device.mac,
                    ip: device.ip,
                    portCount: device.port_table?.length || (isSwitch ? 24 : isUdm ? 8 : 0),
                    source: 'integration',
                    integrationId: integration.id,
                    integrationName: integration.name,
                  });
                }
              }
            }
        } catch (err) {
          console.error(`[SwitchesManager] Failed to fetch switches from ${integration.name}:`, err);
        }
      }

      setDetectedSwitches(allSwitches);
      setIsLoading(false);
    };

    if (unifiIntegrations.length > 0) {
      fetchSwitches();
    } else {
      setIsLoading(false);
    }
  }, [unifiIntegrations]);

  // Save manual switches to settings
  const saveManualSwitches = async (switches: ManualSwitch[]) => {
    try {
      await settingsApi.saveManualSwitches(switches);
      setManualSwitches(switches);
    } catch (err) {
      console.error('Failed to save manual switches:', err);
    }
  };

  // All switches combined
  const allSwitches = useMemo(() => {
    const manualAsSwitches: NetworkSwitch[] = manualSwitches.map((s) => ({
      ...s,
      source: 'manual' as const,
    }));
    return [...detectedSwitches, ...manualAsSwitches];
  }, [detectedSwitches, manualSwitches]);

  const handleOpenAdd = () => {
    setFormData({ name: '', model: '', mac: '', ip: '', portCount: 24 });
    setEditingSwitch(null);
    setIsAddingSwitch(true);
  };

  const handleOpenEdit = (sw: ManualSwitch) => {
    setFormData({
      name: sw.name,
      model: sw.model || '',
      mac: sw.mac || '',
      ip: sw.ip || '',
      portCount: sw.portCount || 24,
    });
    setEditingSwitch(sw);
    setIsAddingSwitch(true);
  };

  const handleClose = () => {
    setIsAddingSwitch(false);
    setEditingSwitch(null);
    setFormData({ name: '', model: '', mac: '', ip: '', portCount: 24 });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    if (editingSwitch) {
      // Update existing
      const updated = manualSwitches.map((s) =>
        s.id === editingSwitch.id
          ? {
              ...s,
              name: formData.name.trim(),
              model: formData.model.trim() || undefined,
              mac: formData.mac.trim() || undefined,
              ip: formData.ip.trim() || undefined,
              portCount: formData.portCount,
            }
          : s
      );
      saveManualSwitches(updated);
    } else {
      // Add new
      const newSwitch: ManualSwitch = {
        id: `manual-${Date.now()}`,
        name: formData.name.trim(),
        model: formData.model.trim() || undefined,
        mac: formData.mac.trim() || undefined,
        ip: formData.ip.trim() || undefined,
        portCount: formData.portCount,
      };
      saveManualSwitches([...manualSwitches, newSwitch]);
    }

    handleClose();
  };

  const handleDelete = (sw: ManualSwitch) => {
    if (confirm(`Delete switch "${sw.name}"? This cannot be undone.`)) {
      saveManualSwitches(manualSwitches.filter((s) => s.id !== sw.id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {unifiIntegrations.length > 0
              ? `Detecting switches from ${unifiIntegrations.length} UniFi integration${unifiIntegrations.length > 1 ? 's' : ''}`
              : 'No UniFi integrations configured. Add switches manually below.'}
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Manual Switch
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-6 w-6 text-primary-500 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-gray-500 dark:text-gray-400">Detecting switches...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Switch List */}
      {!isLoading && allSwitches.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <svg
            className="w-12 h-12 mx-auto text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">No switches found.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {unifiIntegrations.length === 0
              ? 'Configure a UniFi integration or add switches manually.'
              : 'No switches detected from your UniFi controller.'}
          </p>
        </div>
      )}

      {!isLoading && allSwitches.length > 0 && (
        <div className="space-y-2">
          {allSwitches.map((sw) => (
            <div
              key={sw.id}
              className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-4">
                {/* Switch Icon */}
                <div className="text-2xl" title={sw.source === 'integration' ? 'From Integration' : 'Manual'}>
                  {sw.source === 'integration' ? '🔌' : '📦'}
                </div>

                {/* Switch Info */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{sw.name}</span>
                    {sw.model && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">({sw.model})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {sw.ip && <span className="font-mono">{sw.ip}</span>}
                    {sw.mac && <span className="font-mono text-xs">{sw.mac}</span>}
                    {sw.portCount && <span>{sw.portCount} ports</span>}
                  </div>
                  {sw.source === 'integration' && sw.integrationName && (
                    <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                      via {sw.integrationName}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions (only for manual switches) */}
              {sw.source === 'manual' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(sw as ManualSwitch)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Edit switch"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(sw as ManualSwitch)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete switch"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Switch Modal */}
      {isAddingSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingSwitch ? 'Edit Switch' : 'Add Manual Switch'}
              </h3>
              <button
                onClick={handleClose}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Switch Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Core Switch"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g., USW-Pro-24-PoE"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* IP Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  IP Address
                </label>
                <input
                  type="text"
                  value={formData.ip}
                  onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                  placeholder="e.g., 192.168.1.2"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* MAC Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  MAC Address
                </label>
                <input
                  type="text"
                  value={formData.mac}
                  onChange={(e) => setFormData({ ...formData, mac: e.target.value })}
                  placeholder="e.g., 00:1A:2B:3C:4D:5E"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Port Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Number of Ports
                </label>
                <input
                  type="number"
                  min="1"
                  max="128"
                  value={formData.portCount}
                  onChange={(e) => setFormData({ ...formData, portCount: parseInt(e.target.value) || 24 })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editingSwitch ? 'Save Changes' : 'Add Switch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
