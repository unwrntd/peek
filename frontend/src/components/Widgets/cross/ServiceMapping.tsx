import React from 'react';
import { useCrossIntegrationData } from '../../../hooks/useCrossIntegrationData';
import { BaseWidget } from '../BaseWidget';
import { useBrandingStore } from '../../../stores/brandingStore';
import {
  MovieIcon,
  ChartIcon,
  TvIcon,
  VideoCameraIcon,
  ChatIcon,
  DocumentIcon,
  SearchIcon,
  InboxIcon,
  RefreshIcon,
  ShieldIcon,
  RouterIcon,
  HomeIcon,
  BridgeIcon,
  CameraIcon,
  PlugIcon,
} from '../../../utils/icons';

interface ServiceMappingProps {
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ServiceMappingData {
  services: {
    integrationId: string;
    integrationName: string;
    integrationType: string;
    host: string;
    vm: {
      vmid: number;
      name: string;
      type: 'qemu' | 'lxc';
      status: string;
      cpu: number;
      memory: number;
      node: string;
    } | null;
  }[];
  unmappedVms: {
    vmid: number;
    name: string;
    type: 'qemu' | 'lxc';
    status: string;
    node: string;
    ip?: string;
  }[];
}

function getStatusColor(status: string): string {
  if (status === 'running') return 'bg-green-500';
  if (status === 'stopped') return 'bg-red-500';
  return 'bg-yellow-500';
}

// Icon components map for simple mode
const integrationIconComponents: Record<string, React.FC<{ className?: string }>> = {
  plex: MovieIcon,
  tautulli: ChartIcon,
  sonarr: TvIcon,
  radarr: VideoCameraIcon,
  bazarr: ChatIcon,
  overseerr: DocumentIcon,
  prowlarr: SearchIcon,
  sabnzbd: InboxIcon,
  qbittorrent: InboxIcon,
  tdarr: RefreshIcon,
  adguard: ShieldIcon,
  unifi: RouterIcon,
  beszel: ChartIcon,
  homeassistant: HomeIcon,
  homebridge: BridgeIcon,
  immich: CameraIcon,
};

// Emoji icons map
const integrationEmojiIcons: Record<string, string> = {
  plex: '🎬',
  tautulli: '📊',
  sonarr: '📺',
  radarr: '🎥',
  bazarr: '💬',
  overseerr: '📝',
  prowlarr: '🔍',
  sabnzbd: '📥',
  qbittorrent: '🌊',
  tdarr: '🔄',
  adguard: '🛡️',
  unifi: '📡',
  beszel: '📈',
  homeassistant: '🏠',
  homebridge: '🌉',
  immich: '📷',
};

function getIntegrationIcon(type: string, iconStyle: 'emoji' | 'simple' | 'none'): React.ReactNode {
  if (iconStyle === 'none') return null;

  if (iconStyle === 'simple') {
    const IconComponent = integrationIconComponents[type] || PlugIcon;
    return <IconComponent className="w-5 h-5" />;
  }

  return integrationEmojiIcons[type] || '🔌';
}

export function ServiceMapping({ config, widgetId }: ServiceMappingProps) {
  const { data, loading, error, missingIntegrations } = useCrossIntegrationData<ServiceMappingData>({
    endpoint: 'service-mapping',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });
  const iconStyle = useBrandingStore((state) => state.branding.iconStyle);

  // Config options
  const showVmStatus = config.showVmStatus !== false;
  const showResourceUsage = config.showResourceUsage !== false;
  const showUnmappedVms = config.showUnmappedVms !== false;
  const groupBy = (config.groupBy as string) || 'none';

  // Group services if needed
  const groupedServices = React.useMemo(() => {
    if (!data?.services) return {};

    if (groupBy === 'none') {
      return { '': data.services };
    }

    if (groupBy === 'node') {
      const groups: Record<string, typeof data.services> = {};
      for (const service of data.services) {
        const key = service.vm?.node || 'Unmapped';
        if (!groups[key]) groups[key] = [];
        groups[key].push(service);
      }
      return groups;
    }

    if (groupBy === 'type') {
      const groups: Record<string, typeof data.services> = {};
      for (const service of data.services) {
        const key = service.integrationType;
        if (!groups[key]) groups[key] = [];
        groups[key].push(service);
      }
      return groups;
    }

    return { '': data.services };
  }, [data?.services, groupBy]);

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="h-full flex flex-col overflow-hidden">
          {/* Services */}
          <div className="flex-1 overflow-auto space-y-4">
            {Object.entries(groupedServices).map(([group, services]) => (
              <div key={group || 'default'}>
                {group && groupBy !== 'none' && (
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 sticky top-0 bg-white dark:bg-gray-800 py-1">
                    {groupBy === 'node' ? `Node: ${group}` : group}
                  </div>
                )}

                <div className="space-y-2">
                  {services.map((service, index) => (
                    <div
                      key={service.integrationId || index}
                      className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      {/* Integration icon */}
                      <div className="text-xl flex-shrink-0 text-gray-600 dark:text-gray-300">
                        {getIntegrationIcon(service.integrationType, iconStyle)}
                      </div>

                      {/* Service info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {service.integrationName}
                          </span>
                          {service.vm && showVmStatus && (
                            <span className={`w-2 h-2 rounded-full ${getStatusColor(service.vm.status)}`} />
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {service.host}
                        </div>
                      </div>

                      {/* VM info */}
                      {service.vm ? (
                        <div className="flex-shrink-0 text-right">
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {service.vm.name}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {service.vm.type === 'lxc' ? 'LXC' : 'VM'} {service.vm.vmid}
                          </div>
                          {showResourceUsage && service.vm.status === 'running' && (
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              CPU: {service.vm.cpu}% | RAM: {service.vm.memory}%
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 italic">
                          Not mapped
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Unmapped VMs */}
          {showUnmappedVms && data.unmappedVms.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Unmapped VMs/Containers ({data.unmappedVms.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {data.unmappedVms.slice(0, 8).map((vm) => (
                  <span
                    key={vm.vmid}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${
                      vm.status === 'running'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(vm.status)}`} />
                    {vm.name}
                  </span>
                ))}
                {data.unmappedVms.length > 8 && (
                  <span className="text-xs text-gray-400">
                    +{data.unmappedVms.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* No services */}
          {data.services.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                No services configured
              </div>
            </div>
          )}

          {/* Missing Proxmox */}
          {missingIntegrations.includes('proxmox') && (
            <div className="mt-2 text-xs text-center text-orange-500 dark:text-orange-400">
              Proxmox integration required for VM mapping
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
