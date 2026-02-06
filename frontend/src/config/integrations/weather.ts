import { IntegrationConfig } from './types';

export const weatherConfig: IntegrationConfig = {
  type: 'weather',
  displayName: 'Weather (OpenWeatherMap)',
  category: 'utilities',
  description: 'Current weather and forecast data',
  documentationUrl: 'https://openweathermap.org/api',
  dependencies: {
    apis: ['OpenWeatherMap API'],
    notes: 'Free tier allows 1,000 calls/day',
  },
  sampleName: 'My Weather',
  defaultPort: 443,
  sampleHost: 'api.openweathermap.org',

  auth: {
    defaultMethod: 'api',
    commonFields: [],
    methods: [
      {
        method: 'api',
        label: 'API Key',
        fields: [
          {
            key: 'apiKey',
            label: 'OpenWeatherMap API Key',
            type: 'password',
            placeholder: 'Enter your API key',
            required: true,
            helpText: 'Get a free API key at openweathermap.org/api',
            colSpan: 2,
          },
        ],
      },
    ],
    helpText: 'Sign up at openweathermap.org for a free API key (1,000 calls/day free tier).',
  },

  widgets: [
    {
      type: 'weather',
      name: 'Weather',
      description: 'Display current weather and forecast for locations',
      metric: 'weather',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'detailed', label: 'Detailed View (Default)' },
        { value: 'compact', label: 'Compact View' },
        { value: 'forecast', label: 'Forecast Only' },
      ],
      filters: [
        {
          label: 'Locations',
          key: 'locations',
          type: 'weather-location-search',
        },
        {
          label: 'Units',
          key: 'units',
          type: 'select',
          options: [
            { value: 'metric', label: 'Celsius (°C)' },
            { value: 'imperial', label: 'Fahrenheit (°F)' },
          ],
        },
        {
          label: 'Layout',
          key: 'layout',
          type: 'select',
          options: [
            { value: 'detailed', label: 'Detailed (Default)' },
            { value: 'compact', label: 'Compact' },
            { value: 'forecast-only', label: 'Forecast Only' },
          ],
        },
        {
          label: 'Forecast Days',
          key: 'forecastDays',
          type: 'select',
          options: [
            { value: '3', label: '3 Days' },
            { value: '5', label: '5 Days (Default)' },
            { value: '7', label: '7 Days' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Feels Like', key: 'showFeelsLike' },
            { label: 'Humidity', key: 'showHumidity' },
            { label: 'Wind', key: 'showWind' },
            { label: 'Forecast', key: 'showForecast' },
          ],
        },
      ],
    },
  ],
};
