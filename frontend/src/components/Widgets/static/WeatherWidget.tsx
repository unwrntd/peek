import React, { useState, useEffect } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useBrandingStore } from '../../../stores/brandingStore';
import {
  SunIcon,
  MoonIcon,
  PartlyCloudyIcon,
  CloudIcon,
  RainIcon,
  ThunderstormIcon,
  SnowIcon,
  FogIcon,
  TemperatureIcon,
  LocationIcon,
  HumidityIcon,
  WindIcon,
} from '../../../utils/icons';

interface WeatherLocation {
  name: string;
  lat: number;
  lon: number;
  displayName?: string;
}

interface WeatherConfig {
  locations?: WeatherLocation[];
  units?: 'metric' | 'imperial';
  layout?: 'compact' | 'detailed' | 'forecast-only';
  forecastDays?: number;
  showFeelsLike?: boolean;
  showHumidity?: boolean;
  showWind?: boolean;
  showForecast?: boolean;
}

interface WeatherWidgetProps {
  title: string;
  integrationId: string;
  config: Record<string, unknown>;
  onConfigChange?: (config: Record<string, unknown>) => void;
  isEditMode?: boolean;
  widgetId?: string;
}

interface CurrentWeather {
  temp: number;
  feels_like: number;
  humidity: number;
  description: string;
  icon: string;
  wind_speed: number;
  temp_min: number;
  temp_max: number;
  name: string;
}

interface ForecastDay {
  date: string;
  dayName: string;
  temp_min: number;
  temp_max: number;
  icon: string;
  description: string;
}

interface LocationWeatherData {
  location: WeatherLocation;
  current: CurrentWeather | null;
  forecast: ForecastDay[];
  error?: string;
}

// Weather condition to icon mapping
function getWeatherIcon(
  iconCode: string,
  size: 'sm' | 'md' | 'lg' = 'md',
  iconStyle: 'emoji' | 'simple' | 'none' = 'emoji'
): React.ReactNode {
  if (iconStyle === 'none') return null;

  const sizeClass = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-4xl' : 'text-2xl';
  const svgSizeClass = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-10 h-10' : 'w-7 h-7';

  // OpenWeatherMap icon codes: https://openweathermap.org/weather-conditions
  // Format: XXd (day) or XXn (night)
  const code = iconCode.slice(0, 2);
  const isNight = iconCode.endsWith('n');

  if (iconStyle === 'simple') {
    // SVG icons for simple mode
    const svgIcons: Record<string, React.ReactNode> = {
      '01': isNight ? <MoonIcon className={svgSizeClass} /> : <SunIcon className={svgSizeClass} />,
      '02': <PartlyCloudyIcon className={svgSizeClass} />,
      '03': <PartlyCloudyIcon className={svgSizeClass} />,
      '04': <CloudIcon className={svgSizeClass} />,
      '09': <RainIcon className={svgSizeClass} />,
      '10': <RainIcon className={svgSizeClass} />,
      '11': <ThunderstormIcon className={svgSizeClass} />,
      '13': <SnowIcon className={svgSizeClass} />,
      '50': <FogIcon className={svgSizeClass} />,
    };
    return <span className="text-gray-600 dark:text-gray-300">{svgIcons[code] || <TemperatureIcon className={svgSizeClass} />}</span>;
  }

  // Emoji icons (default)
  const emojiIcons: Record<string, string> = {
    '01': isNight ? '🌙' : '☀️',
    '02': isNight ? '🌙' : '🌤️',
    '03': '⛅',
    '04': '☁️',
    '09': '🌧️',
    '10': '🌧️',
    '11': '⛈️',
    '13': '🌨️',
    '50': '🌫️',
  };

  return <span className={sizeClass}>{emojiIcons[code] || '🌡️'}</span>;
}

function formatTemp(temp: number, units: 'metric' | 'imperial'): string {
  return `${Math.round(temp)}°${units === 'metric' ? 'C' : 'F'}`;
}

function formatWind(speed: number, units: 'metric' | 'imperial'): string {
  if (units === 'metric') {
    return `${Math.round(speed * 3.6)} km/h`; // Convert m/s to km/h
  }
  return `${Math.round(speed)} mph`;
}

export function WeatherWidget({ integrationId, config }: WeatherWidgetProps) {
  const [weatherData, setWeatherData] = useState<LocationWeatherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iconStyle = useBrandingStore((state) => state.branding.iconStyle);

  const weatherConfig = config as WeatherConfig;
  const locations = weatherConfig.locations || [];
  const units = weatherConfig.units || 'metric';
  // Check both visualization (from style selector) and layout (from filter) - map 'forecast' to 'forecast-only'
  const rawLayout = (weatherConfig as Record<string, unknown>).visualization as string || weatherConfig.layout || 'detailed';
  const layout = rawLayout === 'forecast' ? 'forecast-only' : rawLayout;
  const forecastDays = weatherConfig.forecastDays || 5;
  const showFeelsLike = weatherConfig.showFeelsLike !== false;
  const showHumidity = weatherConfig.showHumidity !== false;
  const showWind = weatherConfig.showWind !== false;
  const showForecast = weatherConfig.showForecast !== false;

  // Fetch weather data for all locations via the integration data endpoint
  useEffect(() => {
    if (locations.length === 0) {
      setLoading(false);
      setError(null);
      setWeatherData([]);
      return;
    }

    const fetchWeather = async () => {
      setLoading(true);
      setError(null);

      try {
        const results: LocationWeatherData[] = await Promise.all(
          locations.map(async (location) => {
            try {
              // Fetch current weather via integration data endpoint
              const currentMetric = `current:${location.lat}:${location.lon}:${units}`;
              const currentRes = await fetch(
                `/api/data/${integrationId}/${encodeURIComponent(currentMetric)}`
              );

              if (!currentRes.ok) {
                const errData = await currentRes.json();
                throw new Error(errData.error || 'Failed to fetch weather');
              }

              const currentResponse = await currentRes.json();
              const currentData = currentResponse.data || currentResponse;

              // Validate response structure
              if (!currentData.main || !currentData.weather?.[0] || !currentData.wind) {
                throw new Error('Invalid weather data received');
              }

              // Fetch forecast if needed
              let forecastData: ForecastDay[] = [];
              if (showForecast && layout !== 'compact') {
                const forecastMetric = `forecast:${location.lat}:${location.lon}:${units}`;
                const forecastRes = await fetch(
                  `/api/data/${integrationId}/${encodeURIComponent(forecastMetric)}`
                );

                if (forecastRes.ok) {
                  const forecastResponse = await forecastRes.json();
                  const forecast = forecastResponse.data || forecastResponse;
                  // Process forecast data - group by day
                  const dailyMap = new Map<string, { temps: number[]; icons: string[]; descriptions: string[] }>();

                  forecast.list?.forEach((item: { dt: number; main: { temp: number }; weather: { icon: string; description: string }[] }) => {
                    const date = new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    const dayName = new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' });

                    if (!dailyMap.has(date)) {
                      dailyMap.set(date, { temps: [], icons: [], descriptions: [] });
                    }
                    const day = dailyMap.get(date)!;
                    day.temps.push(item.main.temp);
                    day.icons.push(item.weather[0].icon);
                    day.descriptions.push(item.weather[0].description);
                  });

                  forecastData = Array.from(dailyMap.entries())
                    .slice(0, forecastDays)
                    .map(([date, data]) => ({
                      date,
                      dayName: date.split(',')[0],
                      temp_min: Math.min(...data.temps),
                      temp_max: Math.max(...data.temps),
                      icon: data.icons[Math.floor(data.icons.length / 2)], // Use midday icon
                      description: data.descriptions[Math.floor(data.descriptions.length / 2)],
                    }));
                }
              }

              return {
                location,
                current: {
                  temp: currentData.main.temp,
                  feels_like: currentData.main.feels_like,
                  humidity: currentData.main.humidity,
                  description: currentData.weather[0].description,
                  icon: currentData.weather[0].icon,
                  wind_speed: currentData.wind.speed,
                  temp_min: currentData.main.temp_min,
                  temp_max: currentData.main.temp_max,
                  name: currentData.name,
                },
                forecast: forecastData,
              };
            } catch (err) {
              return {
                location,
                current: null,
                forecast: [],
                error: err instanceof Error ? err.message : 'Failed to fetch weather',
              };
            }
          })
        );

        setWeatherData(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch weather data');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();

    // Refresh every 10 minutes
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [integrationId, locations, units, showForecast, forecastDays, layout]);

  // Helper to render icon based on style
  const renderIcon = (type: 'location' | 'humidity' | 'wind', className?: string) => {
    if (iconStyle === 'none') return null;
    if (iconStyle === 'simple') {
      switch (type) {
        case 'location': return <LocationIcon className={className || 'w-3 h-3'} />;
        case 'humidity': return <HumidityIcon className={className || 'w-3 h-3'} />;
        case 'wind': return <WindIcon className={className || 'w-3 h-3'} />;
      }
    }
    // Emoji mode
    switch (type) {
      case 'location': return '📍';
      case 'humidity': return '💧';
      case 'wind': return '💨';
    }
  };

  // No locations configured
  if (locations.length === 0) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <span className="text-3xl mb-2 block">
              {iconStyle === 'simple' ? <PartlyCloudyIcon className="w-8 h-8 mx-auto" /> : iconStyle !== 'none' ? '🌤️' : null}
            </span>
            <p className="text-sm">No locations configured</p>
            <p className="text-xs mt-1">Edit this widget to add locations</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className={`h-full ${locations.length > 1 ? 'space-y-3' : ''}`}>
        {weatherData.map((data, index) => {
          if (data.error || !data.current) {
            return (
              <div key={index} className="text-center text-gray-500 dark:text-gray-400 py-2">
                <p className="text-sm">{data.location.name}</p>
                <p className="text-xs">{data.error || 'No data'}</p>
              </div>
            );
          }

          const { current, forecast, location } = data;

          // Compact layout
          if (layout === 'compact') {
            return (
              <div key={index} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  {getWeatherIcon(current.icon, 'sm', iconStyle)}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[100px]">
                    {location.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatTemp(current.temp, units)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ↑{Math.round(current.temp_max)}° ↓{Math.round(current.temp_min)}°
                  </span>
                </div>
              </div>
            );
          }

          // Forecast only layout
          if (layout === 'forecast-only') {
            return (
              <div key={index}>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {location.name}
                </div>
                <div className="flex justify-between gap-1">
                  {forecast.slice(0, forecastDays).map((day, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 min-w-0">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{day.dayName}</span>
                      {getWeatherIcon(day.icon, 'sm', iconStyle)}
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                        {Math.round(day.temp_max)}°
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {Math.round(day.temp_min)}°
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          // Detailed layout (default)
          return (
            <div key={index} className="space-y-2">
              {/* Header with location and current weather */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{renderIcon('location')}</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {location.name}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {formatTemp(current.temp, units)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 capitalize">
                    {current.description}
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  {getWeatherIcon(current.icon, 'lg', iconStyle)}
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    ↑{Math.round(current.temp_max)}° ↓{Math.round(current.temp_min)}°
                  </div>
                </div>
              </div>

              {/* Weather details */}
              {(showFeelsLike || showHumidity || showWind) && (
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-2">
                  {showFeelsLike && (
                    <span>Feels like {formatTemp(current.feels_like, units)}</span>
                  )}
                  {showHumidity && (
                    <span className="flex items-center gap-1">{renderIcon('humidity')} {current.humidity}%</span>
                  )}
                  {showWind && (
                    <span className="flex items-center gap-1">{renderIcon('wind')} {formatWind(current.wind_speed, units)}</span>
                  )}
                </div>
              )}

              {/* Forecast */}
              {showForecast && forecast.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
                  <div className="flex justify-between gap-1">
                    {forecast.slice(0, Math.min(forecastDays, 5)).map((day, i) => (
                      <div key={i} className="flex flex-col items-center flex-1 min-w-0">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{day.dayName}</span>
                        {getWeatherIcon(day.icon, 'sm', iconStyle)}
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                          {Math.round(day.temp_max)}°
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {Math.round(day.temp_min)}°
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </BaseWidget>
  );
}
