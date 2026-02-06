import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface EcobeeEquipment {
  thermostatId: string;
  thermostatName: string;
  hvacMode: string;
  statusString: string;
  heatPump: boolean;
  heatPump2: boolean;
  heatPump3: boolean;
  compCool1: boolean;
  compCool2: boolean;
  auxHeat1: boolean;
  auxHeat2: boolean;
  auxHeat3: boolean;
  fan: boolean;
  humidifier: boolean;
  dehumidifier: boolean;
  ventilator: boolean;
  economizer: boolean;
  compHotWater: boolean;
  auxHotWater: boolean;
  // Capabilities
  hasHeatPump: boolean;
  hasForcedAir: boolean;
  hasBoiler: boolean;
  hasHumidifier: boolean;
  hasErv: boolean;
  hasHrv: boolean;
  heatStages: number;
  coolStages: number;
}

interface EquipmentData {
  equipment: EcobeeEquipment[];
}

interface EquipmentProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface EquipmentItem {
  key: string;
  name: string;
  active: boolean;
  available: boolean;
  category: 'heating' | 'cooling' | 'fan' | 'humidity' | 'other';
}

function getEquipmentItems(equipment: EcobeeEquipment): EquipmentItem[] {
  const items: EquipmentItem[] = [];

  // Heat Pump
  if (equipment.hasHeatPump) {
    items.push({
      key: 'heatPump',
      name: 'Heat Pump',
      active: equipment.heatPump,
      available: true,
      category: 'heating',
    });
    if (equipment.heatStages >= 2) {
      items.push({
        key: 'heatPump2',
        name: 'Heat Pump Stage 2',
        active: equipment.heatPump2,
        available: true,
        category: 'heating',
      });
    }
    if (equipment.heatStages >= 3) {
      items.push({
        key: 'heatPump3',
        name: 'Heat Pump Stage 3',
        active: equipment.heatPump3,
        available: true,
        category: 'heating',
      });
    }
  }

  // Auxiliary/Emergency Heat
  if (equipment.hasForcedAir || equipment.hasBoiler) {
    items.push({
      key: 'auxHeat1',
      name: equipment.hasBoiler ? 'Boiler' : 'Aux Heat',
      active: equipment.auxHeat1,
      available: true,
      category: 'heating',
    });
    if (equipment.heatStages >= 2) {
      items.push({
        key: 'auxHeat2',
        name: 'Aux Heat Stage 2',
        active: equipment.auxHeat2,
        available: true,
        category: 'heating',
      });
    }
  }

  // Compressor Cooling
  items.push({
    key: 'compCool1',
    name: 'Compressor Cool',
    active: equipment.compCool1,
    available: true,
    category: 'cooling',
  });
  if (equipment.coolStages >= 2) {
    items.push({
      key: 'compCool2',
      name: 'Compressor Cool Stage 2',
      active: equipment.compCool2,
      available: true,
      category: 'cooling',
    });
  }

  // Fan
  items.push({
    key: 'fan',
    name: 'Fan',
    active: equipment.fan,
    available: true,
    category: 'fan',
  });

  // Humidity
  if (equipment.hasHumidifier) {
    items.push({
      key: 'humidifier',
      name: 'Humidifier',
      active: equipment.humidifier,
      available: true,
      category: 'humidity',
    });
  }

  items.push({
    key: 'dehumidifier',
    name: 'Dehumidifier',
    active: equipment.dehumidifier,
    available: equipment.dehumidifier, // Show if active
    category: 'humidity',
  });

  // Ventilation
  if (equipment.hasErv || equipment.hasHrv) {
    items.push({
      key: 'ventilator',
      name: equipment.hasErv ? 'ERV' : 'HRV',
      active: equipment.ventilator,
      available: true,
      category: 'other',
    });
  }

  // Economizer
  items.push({
    key: 'economizer',
    name: 'Economizer',
    active: equipment.economizer,
    available: equipment.economizer, // Show if active
    category: 'other',
  });

  // Hot Water
  if (equipment.compHotWater || equipment.auxHotWater) {
    items.push({
      key: 'hotWater',
      name: 'Hot Water',
      active: equipment.compHotWater || equipment.auxHotWater,
      available: true,
      category: 'other',
    });
  }

  return items.filter(item => item.available);
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'heating':
      return 'text-orange-500 bg-orange-100 dark:bg-orange-900/30';
    case 'cooling':
      return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30';
    case 'fan':
      return 'text-gray-500 bg-gray-100 dark:bg-gray-700';
    case 'humidity':
      return 'text-cyan-500 bg-cyan-100 dark:bg-cyan-900/30';
    default:
      return 'text-purple-500 bg-purple-100 dark:bg-purple-900/30';
  }
}

function getEquipmentIcon(key: string, category: string): JSX.Element {
  switch (category) {
    case 'heating':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        </svg>
      );
    case 'cooling':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
        </svg>
      );
    case 'fan':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case 'humidity':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
  }
}

function getHvacModeLabel(mode: string): string {
  switch (mode) {
    case 'heat': return 'Heating Mode';
    case 'cool': return 'Cooling Mode';
    case 'auto': return 'Auto Mode';
    case 'auxHeatOnly': return 'Aux Heat Only';
    case 'off': return 'System Off';
    default: return mode;
  }
}

export function Equipment({ integrationId, config, widgetId }: EquipmentProps) {
  const { data, loading, error } = useWidgetData<EquipmentData>({
    integrationId,
    metric: 'equipment',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const showInactive = config.showInactive !== false;
  const showCapabilities = config.showCapabilities === true;
  const selectedThermostatId = config.thermostatId as string | undefined;
  const visualization = (config.visualization as string) || 'indicators';

  // Filter to selected thermostat if specified
  let equipmentData = data?.equipment || [];
  if (selectedThermostatId) {
    equipmentData = equipmentData.filter(e =>
      e.thermostatId === selectedThermostatId ||
      e.thermostatName.toLowerCase().includes(selectedThermostatId.toLowerCase())
    );
  }

  const equipment = equipmentData[0];

  if (!equipment) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          </svg>
          <p className="text-sm">No equipment data</p>
        </div>
      </BaseWidget>
    );
  }

  const items = getEquipmentItems(equipment);
  const visibleItems = showInactive ? items : items.filter(i => i.active);
  const activeCount = items.filter(i => i.active).length;

  const renderIndicators = () => (
    <div className="flex flex-col h-full">
      {/* Status header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {getHvacModeLabel(equipment.hvacMode)}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${activeCount > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
          {activeCount > 0 ? `${activeCount} Running` : 'Idle'}
        </span>
      </div>

      {/* Equipment indicators */}
      <div className="flex-1 grid grid-cols-3 gap-2 overflow-y-auto">
        {visibleItems.map((item) => (
          <div
            key={item.key}
            className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
              item.active
                ? getCategoryColor(item.category)
                : 'bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400'
            }`}
          >
            <div className={item.active ? '' : 'opacity-50'}>
              {getEquipmentIcon(item.key, item.category)}
            </div>
            <span className="text-xs mt-1 text-center leading-tight">{item.name}</span>
            {item.active && (
              <span className="w-2 h-2 rounded-full bg-current mt-1 animate-pulse" />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderList = () => (
    <div className="space-y-2 h-full overflow-y-auto">
      <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {getHvacModeLabel(equipment.hvacMode)}
        </span>
        <span className={`w-3 h-3 rounded-full ${equipment.statusString ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
      </div>

      {visibleItems.map((item) => (
        <div
          key={item.key}
          className={`flex items-center justify-between p-2 rounded-lg ${
            item.active ? 'bg-gray-50 dark:bg-gray-800' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={item.active ? getCategoryColor(item.category).split(' ')[0] : 'text-gray-400'}>
              {getEquipmentIcon(item.key, item.category)}
            </div>
            <span className={`text-sm ${item.active ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
              {item.name}
            </span>
          </div>
          <span className={`w-2 h-2 rounded-full ${item.active ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
        </div>
      ))}

      {showCapabilities && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <div>Heat Stages: {equipment.heatStages}</div>
            <div>Cool Stages: {equipment.coolStages}</div>
          </div>
        </div>
      )}
    </div>
  );

  const renderCompact = () => (
    <div className="flex items-center justify-between h-full">
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${equipment.statusString ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {activeCount > 0 ? equipment.statusString.split(',').filter(Boolean).join(', ') : 'Idle'}
        </span>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {getHvacModeLabel(equipment.hvacMode)}
      </span>
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {visualization === 'indicators' && renderIndicators()}
      {visualization === 'list' && renderList()}
      {visualization === 'compact' && renderCompact()}
    </BaseWidget>
  );
}
