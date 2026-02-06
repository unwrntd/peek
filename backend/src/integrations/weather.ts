import axios, { AxiosInstance } from 'axios';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import { IntegrationConfig, IntegrationData } from '../types';
import { logger } from '../services/logger';

export interface WeatherConfig {
  apiKey: string;
}

// In-memory cache for weather data
interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CURRENT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const FORECAST_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCached(key: string, ttl: number): unknown | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export class WeatherIntegration extends BaseIntegration {
  readonly type = 'weather';
  readonly name = 'Weather (OpenWeatherMap)';

  private createClient(config: WeatherConfig): AxiosInstance {
    return axios.create({
      baseURL: 'https://api.openweathermap.org',
      timeout: 15000,
      params: {
        appid: config.apiKey,
      },
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const weatherConfig = config as WeatherConfig;

    if (!weatherConfig.apiKey) {
      return {
        success: false,
        message: 'API key is required',
      };
    }

    try {
      const client = this.createClient(weatherConfig);

      // Test with a simple weather request for a known location
      const response = await client.get('/data/2.5/weather', {
        params: {
          lat: 40.7128,
          lon: -74.0060, // New York
          units: 'metric',
        },
      });

      if (response.data && response.data.name) {
        return {
          success: true,
          message: `Connected successfully. Test location: ${response.data.name}`,
          details: {
            testLocation: response.data.name,
            temperature: `${Math.round(response.data.main.temp)}°C`,
          },
        };
      }

      return {
        success: false,
        message: 'Unexpected response from API',
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            message: 'Invalid API key',
          };
        }
        if (error.response?.status === 429) {
          return {
            success: false,
            message: 'API rate limit exceeded',
          };
        }
        return {
          success: false,
          message: `API error: ${error.message}`,
        };
      }
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const weatherConfig = config as WeatherConfig;

    if (!weatherConfig.apiKey) {
      throw new Error('API key not configured');
    }

    const client = this.createClient(weatherConfig);

    // Parse metric - format: "current:lat:lon:units" or "forecast:lat:lon:units"
    const parts = metric.split(':');
    const metricType = parts[0];
    const lat = parts[1];
    const lon = parts[2];
    const units = parts[3] || 'metric';

    if (!lat || !lon) {
      throw new Error('Location coordinates required in metric');
    }

    switch (metricType) {
      case 'current':
        return this.getCurrentWeather(client, lat, lon, units);
      case 'forecast':
        return this.getForecast(client, lat, lon, units);
      default:
        throw new Error(`Unknown metric type: ${metricType}`);
    }
  }

  private async getCurrentWeather(
    client: AxiosInstance,
    lat: string,
    lon: string,
    units: string
  ): Promise<IntegrationData> {
    const cacheKey = `current:${lat}:${lon}:${units}`;
    const cached = getCached(cacheKey, CURRENT_CACHE_TTL);
    if (cached) {
      logger.debug('weather', 'Serving current weather from cache', { lat, lon });
      return { data: cached };
    }

    logger.debug('weather', 'Fetching current weather from API', { lat, lon, units });

    const response = await client.get('/data/2.5/weather', {
      params: { lat, lon, units },
    });

    setCache(cacheKey, response.data);
    return { data: response.data };
  }

  private async getForecast(
    client: AxiosInstance,
    lat: string,
    lon: string,
    units: string
  ): Promise<IntegrationData> {
    const cacheKey = `forecast:${lat}:${lon}:${units}`;
    const cached = getCached(cacheKey, FORECAST_CACHE_TTL);
    if (cached) {
      logger.debug('weather', 'Serving forecast from cache', { lat, lon });
      return { data: cached };
    }

    logger.debug('weather', 'Fetching forecast from API', { lat, lon, units });

    const response = await client.get('/data/2.5/forecast', {
      params: { lat, lon, units },
    });

    setCache(cacheKey, response.data);
    return { data: response.data };
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'weather',
        name: 'Weather',
        description: 'Current weather and forecast data',
        widgetTypes: ['weather'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Current Weather - Implemented
      {
        id: 'current-weather',
        name: 'Current Weather',
        description: 'Get current weather data for a location including temperature, humidity, pressure, wind, clouds, and conditions',
        method: 'GET',
        endpoint: '/data/2.5/weather',
        implemented: true,
        category: 'Current Weather',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
          { name: 'units', type: 'string', required: false, description: 'Units: standard, metric, or imperial' },
          { name: 'lang', type: 'string', required: false, description: 'Language code for descriptions' },
        ],
        documentationUrl: 'https://openweathermap.org/current',
      },
      {
        id: 'current-weather-city',
        name: 'Current Weather by City Name',
        description: 'Get current weather by city name (deprecated, use coordinates)',
        method: 'GET',
        endpoint: '/data/2.5/weather',
        implemented: false,
        category: 'Current Weather',
        parameters: [
          { name: 'q', type: 'string', required: true, description: 'City name, state code and country code (e.g., "London,uk")' },
          { name: 'units', type: 'string', required: false, description: 'Units: standard, metric, or imperial' },
        ],
      },
      {
        id: 'current-weather-zip',
        name: 'Current Weather by ZIP Code',
        description: 'Get current weather by ZIP/postal code',
        method: 'GET',
        endpoint: '/data/2.5/weather',
        implemented: false,
        category: 'Current Weather',
        parameters: [
          { name: 'zip', type: 'string', required: true, description: 'ZIP code and country (e.g., "10001,us")' },
          { name: 'units', type: 'string', required: false, description: 'Units: standard, metric, or imperial' },
        ],
      },

      // 5-Day Forecast - Implemented
      {
        id: 'forecast-5day',
        name: '5 Day / 3 Hour Forecast',
        description: 'Get 5 day weather forecast with 3-hour step for a location',
        method: 'GET',
        endpoint: '/data/2.5/forecast',
        implemented: true,
        category: 'Forecast',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
          { name: 'units', type: 'string', required: false, description: 'Units: standard, metric, or imperial' },
          { name: 'cnt', type: 'number', required: false, description: 'Number of timestamps to return (max 40)' },
          { name: 'lang', type: 'string', required: false, description: 'Language code for descriptions' },
        ],
        documentationUrl: 'https://openweathermap.org/forecast5',
      },

      // One Call API 3.0
      {
        id: 'onecall',
        name: 'One Call API 3.0',
        description: 'Get all essential weather data in one call: current, hourly (48h), daily (8 days), and alerts',
        method: 'GET',
        endpoint: '/data/3.0/onecall',
        implemented: false,
        category: 'One Call API',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
          { name: 'exclude', type: 'string', required: false, description: 'Exclude parts: current, minutely, hourly, daily, alerts' },
          { name: 'units', type: 'string', required: false, description: 'Units: standard, metric, or imperial' },
          { name: 'lang', type: 'string', required: false, description: 'Language code' },
        ],
        documentationUrl: 'https://openweathermap.org/api/one-call-3',
      },
      {
        id: 'onecall-timemachine',
        name: 'One Call Historical',
        description: 'Get historical weather data for a specific date (One Call API 3.0)',
        method: 'GET',
        endpoint: '/data/3.0/onecall/timemachine',
        implemented: false,
        category: 'One Call API',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
          { name: 'dt', type: 'number', required: true, description: 'Unix timestamp for the date' },
          { name: 'units', type: 'string', required: false, description: 'Units: standard, metric, or imperial' },
        ],
        documentationUrl: 'https://openweathermap.org/api/one-call-3#history',
      },
      {
        id: 'onecall-overview',
        name: 'Weather Overview',
        description: 'Get AI-generated human-readable weather summary for today and tomorrow',
        method: 'GET',
        endpoint: '/data/3.0/onecall/overview',
        implemented: false,
        category: 'One Call API',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
          { name: 'units', type: 'string', required: false, description: 'Units: standard, metric, or imperial' },
        ],
        documentationUrl: 'https://openweathermap.org/api/one-call-3#overview',
      },

      // Daily Forecast (16 days)
      {
        id: 'forecast-daily',
        name: 'Daily Forecast 16 Days',
        description: 'Get daily weather forecast for up to 16 days',
        method: 'GET',
        endpoint: '/data/2.5/forecast/daily',
        implemented: false,
        category: 'Forecast',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
          { name: 'cnt', type: 'number', required: false, description: 'Number of days (1-16)' },
          { name: 'units', type: 'string', required: false, description: 'Units: standard, metric, or imperial' },
        ],
        documentationUrl: 'https://openweathermap.org/forecast16',
      },

      // Hourly Forecast
      {
        id: 'forecast-hourly',
        name: 'Hourly Forecast 4 Days',
        description: 'Get hourly weather forecast for up to 4 days (96 hours)',
        method: 'GET',
        endpoint: '/data/2.5/forecast/hourly',
        implemented: false,
        category: 'Forecast',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
          { name: 'units', type: 'string', required: false, description: 'Units: standard, metric, or imperial' },
        ],
        documentationUrl: 'https://openweathermap.org/api/hourly-forecast',
      },

      // Climatic Forecast
      {
        id: 'forecast-climate',
        name: 'Climatic Forecast 30 Days',
        description: 'Get climatic forecast for 30 days ahead',
        method: 'GET',
        endpoint: '/data/2.5/forecast/climate',
        implemented: false,
        category: 'Forecast',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
          { name: 'units', type: 'string', required: false, description: 'Units: standard, metric, or imperial' },
        ],
        documentationUrl: 'https://openweathermap.org/api/forecast30',
      },

      // Air Pollution
      {
        id: 'air-pollution-current',
        name: 'Current Air Pollution',
        description: 'Get current air pollution data including AQI and pollutant concentrations (CO, NO, NO2, O3, SO2, NH3, PM2.5, PM10)',
        method: 'GET',
        endpoint: '/data/2.5/air_pollution',
        implemented: false,
        category: 'Air Pollution',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
        ],
        documentationUrl: 'https://openweathermap.org/api/air-pollution',
      },
      {
        id: 'air-pollution-forecast',
        name: 'Air Pollution Forecast',
        description: 'Get 5-day air pollution forecast with hourly granularity',
        method: 'GET',
        endpoint: '/data/2.5/air_pollution/forecast',
        implemented: false,
        category: 'Air Pollution',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
        ],
        documentationUrl: 'https://openweathermap.org/api/air-pollution',
      },
      {
        id: 'air-pollution-history',
        name: 'Air Pollution Historical',
        description: 'Get historical air pollution data (from Nov 27, 2020)',
        method: 'GET',
        endpoint: '/data/2.5/air_pollution/history',
        implemented: false,
        category: 'Air Pollution',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
          { name: 'start', type: 'number', required: true, description: 'Start date Unix timestamp' },
          { name: 'end', type: 'number', required: true, description: 'End date Unix timestamp' },
        ],
        documentationUrl: 'https://openweathermap.org/api/air-pollution',
      },

      // Geocoding API
      {
        id: 'geocoding-direct',
        name: 'Direct Geocoding',
        description: 'Convert city name/address to geographic coordinates',
        method: 'GET',
        endpoint: '/geo/1.0/direct',
        implemented: false,
        category: 'Geocoding',
        parameters: [
          { name: 'q', type: 'string', required: true, description: 'City name, state code (US), and country code (e.g., "London,GB")' },
          { name: 'limit', type: 'number', required: false, description: 'Number of results (max 5)' },
        ],
        documentationUrl: 'https://openweathermap.org/api/geocoding-api',
      },
      {
        id: 'geocoding-reverse',
        name: 'Reverse Geocoding',
        description: 'Convert coordinates to location name',
        method: 'GET',
        endpoint: '/geo/1.0/reverse',
        implemented: false,
        category: 'Geocoding',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
          { name: 'limit', type: 'number', required: false, description: 'Number of results (max 5)' },
        ],
        documentationUrl: 'https://openweathermap.org/api/geocoding-api',
      },
      {
        id: 'geocoding-zip',
        name: 'ZIP Code Geocoding',
        description: 'Get coordinates by ZIP/postal code',
        method: 'GET',
        endpoint: '/geo/1.0/zip',
        implemented: false,
        category: 'Geocoding',
        parameters: [
          { name: 'zip', type: 'string', required: true, description: 'ZIP code and country code (e.g., "10001,US")' },
        ],
        documentationUrl: 'https://openweathermap.org/api/geocoding-api',
      },

      // Weather Maps
      {
        id: 'weather-map',
        name: 'Weather Map Tile',
        description: 'Get weather map tiles (precipitation, clouds, pressure, temp, wind, etc.)',
        method: 'GET',
        endpoint: '/map/2.0/weather/{layer}/{z}/{x}/{y}',
        implemented: false,
        category: 'Weather Maps',
        parameters: [
          { name: 'layer', type: 'string', required: true, description: 'Map layer: clouds_new, precipitation_new, pressure_new, wind_new, temp_new' },
          { name: 'z', type: 'number', required: true, description: 'Zoom level' },
          { name: 'x', type: 'number', required: true, description: 'Tile X coordinate' },
          { name: 'y', type: 'number', required: true, description: 'Tile Y coordinate' },
        ],
        documentationUrl: 'https://openweathermap.org/api/weather-map-2',
      },
      {
        id: 'precipitation-map',
        name: 'Global Precipitation Map',
        description: 'Get global precipitation map tiles based on radar and satellite data',
        method: 'GET',
        endpoint: '/map/2.0/precipitation/{z}/{x}/{y}',
        implemented: false,
        category: 'Weather Maps',
        parameters: [
          { name: 'z', type: 'number', required: true, description: 'Zoom level' },
          { name: 'x', type: 'number', required: true, description: 'Tile X coordinate' },
          { name: 'y', type: 'number', required: true, description: 'Tile Y coordinate' },
        ],
        documentationUrl: 'https://openweathermap.org/api/precipitation-map',
      },

      // UV Index
      {
        id: 'uvi-current',
        name: 'Current UV Index',
        description: 'Get current UV index for a location',
        method: 'GET',
        endpoint: '/data/2.5/uvi',
        implemented: false,
        category: 'UV Index',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
        ],
        documentationUrl: 'https://openweathermap.org/api/uvi',
      },
      {
        id: 'uvi-forecast',
        name: 'UV Index Forecast',
        description: 'Get UV index forecast for up to 8 days',
        method: 'GET',
        endpoint: '/data/2.5/uvi/forecast',
        implemented: false,
        category: 'UV Index',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
          { name: 'cnt', type: 'number', required: false, description: 'Number of days' },
        ],
        documentationUrl: 'https://openweathermap.org/api/uvi',
      },
      {
        id: 'uvi-history',
        name: 'UV Index Historical',
        description: 'Get historical UV index data',
        method: 'GET',
        endpoint: '/data/2.5/uvi/history',
        implemented: false,
        category: 'UV Index',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
          { name: 'start', type: 'number', required: true, description: 'Start timestamp' },
          { name: 'end', type: 'number', required: true, description: 'End timestamp' },
        ],
        documentationUrl: 'https://openweathermap.org/api/uvi',
      },

      // Weather Alerts
      {
        id: 'weather-alerts',
        name: 'Weather Alerts',
        description: 'Get weather alerts and warnings (via One Call API)',
        method: 'GET',
        endpoint: '/data/3.0/onecall',
        implemented: false,
        category: 'Alerts',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
        ],
        documentationUrl: 'https://openweathermap.org/api/one-call-3#alerts',
      },

      // Road Risk API
      {
        id: 'road-risk',
        name: 'Road Risk API',
        description: 'Get road conditions and risk assessment for driving safety',
        method: 'GET',
        endpoint: '/data/2.5/roadrisk',
        implemented: false,
        category: 'Specialized',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
        ],
        documentationUrl: 'https://openweathermap.org/api/road-risk',
      },

      // Solar Radiation
      {
        id: 'solar-radiation',
        name: 'Solar Radiation API',
        description: 'Get solar radiation data including GHI, DNI, and DHI',
        method: 'GET',
        endpoint: '/data/2.5/solar_radiation',
        implemented: false,
        category: 'Specialized',
        parameters: [
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
        ],
        documentationUrl: 'https://openweathermap.org/api/solar-energy-prediction',
      },

      // Weather Stations (user-contributed)
      {
        id: 'stations-list',
        name: 'List Weather Stations',
        description: 'Get list of user-contributed weather stations',
        method: 'GET',
        endpoint: '/data/3.0/stations',
        implemented: false,
        category: 'Stations',
        documentationUrl: 'https://openweathermap.org/stations',
      },
      {
        id: 'station-register',
        name: 'Register Weather Station',
        description: 'Register a new weather station',
        method: 'POST',
        endpoint: '/data/3.0/stations',
        implemented: false,
        category: 'Stations',
        parameters: [
          { name: 'external_id', type: 'string', required: true, description: 'Your station ID' },
          { name: 'name', type: 'string', required: true, description: 'Station name' },
          { name: 'lat', type: 'number', required: true, description: 'Latitude' },
          { name: 'lon', type: 'number', required: true, description: 'Longitude' },
          { name: 'altitude', type: 'number', required: false, description: 'Altitude in meters' },
        ],
        documentationUrl: 'https://openweathermap.org/stations',
      },
      {
        id: 'station-measurements',
        name: 'Post Station Measurements',
        description: 'Post measurements from a weather station',
        method: 'POST',
        endpoint: '/data/3.0/measurements',
        implemented: false,
        category: 'Stations',
        parameters: [
          { name: 'station_id', type: 'string', required: true, description: 'Station ID' },
          { name: 'dt', type: 'number', required: true, description: 'Measurement timestamp' },
        ],
        documentationUrl: 'https://openweathermap.org/stations',
      },

      // Weather Icons
      {
        id: 'weather-icon',
        name: 'Weather Icon',
        description: 'Get weather condition icon image',
        method: 'GET',
        endpoint: '/img/wn/{icon}@2x.png',
        implemented: false,
        category: 'Assets',
        parameters: [
          { name: 'icon', type: 'string', required: true, description: 'Icon code (e.g., "01d", "02n")' },
        ],
        documentationUrl: 'https://openweathermap.org/weather-conditions',
      },
    ];
  }
}
