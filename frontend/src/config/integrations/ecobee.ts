import { IntegrationConfig } from './types';

export const ecobeeConfig: IntegrationConfig = {
  type: 'ecobee',
  displayName: 'Ecobee',
  category: 'smart-home',
  description: 'Smart thermostat control and monitoring',
  documentationUrl: 'https://www.ecobee.com/home/developer/api/introduction/index.shtml',
  dependencies: {
    apis: ['Ecobee API'],
    notes: 'Uses tokens extracted from browser. See help text for instructions.',
  },
  sampleName: 'Home Thermostat',
  defaultPort: 443,
  sampleHost: 'api.ecobee.com',

  auth: {
    defaultMethod: 'token',
    commonFields: [],
    methods: [
      {
        method: 'token',
        label: 'Browser Token Extraction',
        fields: [
          {
            key: 'accessToken',
            label: 'Access Token',
            type: 'password',
            placeholder: 'JWT access token from browser',
            required: true,
            helpText: 'Extract from browser - see instructions below',
            colSpan: 2,
          },
        ],
      },
    ],
    helpText: `**How to extract your Ecobee token:**
1. Log into **ecobee.com** in your browser
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Go to **Application** → **Local Storage** → **https://www.ecobee.com**
4. Find the key containing "accessToken" (usually in a JSON object)
5. Copy the JWT token value (starts with "eyJ...")

*Note: Tokens expire after ~1 hour. You'll need to update the token when it expires.*`,
  },

  widgets: [
    {
      type: 'ecobee-thermostat',
      name: 'Thermostat',
      description: 'Current temperature, setpoints, and HVAC control',
      metric: 'thermostats',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'dial', label: 'Temperature Dial (Default)' },
        { value: 'card', label: 'Info Card' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Thermostat',
          key: 'thermostatId',
          type: 'text',
          placeholder: 'Thermostat ID (or first)',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Humidity', key: 'showHumidity' },
            { label: 'Show HVAC Mode', key: 'showHvacMode' },
            { label: 'Show Equipment Status', key: 'showEquipment' },
            { label: 'Show Controls', key: 'showControls' },
          ],
        },
      ],
    },
    {
      type: 'ecobee-sensors',
      name: 'Sensors',
      description: 'Remote sensor temperature and occupancy',
      metric: 'sensors',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Sensor Cards (Default)' },
        { value: 'list', label: 'Sensor List' },
        { value: 'grid', label: 'Sensor Grid' },
      ],
      filters: [
        {
          label: 'Thermostat',
          key: 'thermostatId',
          type: 'text',
          placeholder: 'Thermostat ID (or all)',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Temperature', key: 'showTemperature' },
            { label: 'Show Humidity', key: 'showHumidity' },
            { label: 'Show Occupancy', key: 'showOccupancy' },
            { label: 'Show Thermostat Name', key: 'showThermostatName' },
          ],
        },
        {
          label: 'Filter by Type',
          key: 'sensorType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'thermostat', label: 'Thermostat' },
            { value: 'ecobee3_remote_sensor', label: 'Remote' },
          ],
        },
      ],
    },
    {
      type: 'ecobee-weather',
      name: 'Weather',
      description: 'Current weather and forecast from thermostat location',
      metric: 'weather',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'card', label: 'Weather Card (Default)' },
        { value: 'forecast', label: 'With Forecast' },
        { value: 'minimal', label: 'Minimal' },
      ],
      filters: [
        {
          label: 'Thermostat',
          key: 'thermostatId',
          type: 'text',
          placeholder: 'Thermostat ID (or first)',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Forecast', key: 'showForecast' },
            { label: 'Show Wind', key: 'showWind' },
            { label: 'Show Humidity', key: 'showHumidity' },
            { label: 'Show Pressure', key: 'showPressure' },
          ],
        },
      ],
    },
    {
      type: 'ecobee-alerts',
      name: 'Alerts',
      description: 'Active alerts and maintenance reminders',
      metric: 'alerts',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Alert List (Default)' },
        { value: 'cards', label: 'Alert Cards' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Filter Type',
          key: 'alertType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'alert', label: 'Alerts' },
            { value: 'reminder', label: 'Reminders' },
          ],
        },
        {
          label: 'Max Items',
          key: 'maxItems',
          type: 'text',
          placeholder: '10',
        },
      ],
    },
    {
      type: 'ecobee-equipment',
      name: 'Equipment Status',
      description: 'HVAC equipment running status',
      metric: 'equipment',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'indicators', label: 'Status Indicators (Default)' },
        { value: 'list', label: 'Equipment List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Thermostat',
          key: 'thermostatId',
          type: 'text',
          placeholder: 'Thermostat ID (or first)',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Inactive Equipment', key: 'showInactive' },
            { label: 'Show Equipment Capabilities', key: 'showCapabilities' },
          ],
        },
      ],
    },
    {
      type: 'ecobee-schedule',
      name: 'Schedule',
      description: 'Program schedule and current climate',
      metric: 'schedule',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'timeline', label: 'Day Timeline (Default)' },
        { value: 'climates', label: 'Climate Cards' },
        { value: 'compact', label: 'Current Only' },
      ],
      filters: [
        {
          label: 'Thermostat',
          key: 'thermostatId',
          type: 'text',
          placeholder: 'Thermostat ID (or first)',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Temperature Setpoints', key: 'showSetpoints' },
            { label: 'Show Active Hold', key: 'showActiveHold' },
            { label: 'Show Climate Controls', key: 'showControls' },
          ],
        },
      ],
    },
  ],
};
