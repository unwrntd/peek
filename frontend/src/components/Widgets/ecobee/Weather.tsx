import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface WeatherCurrent {
  dateTime: string;
  condition: string;
  temperature: number;
  tempHigh: number;
  tempLow: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  pressure: number;
  dewpoint: number;
  visibility: number;
  weatherSymbol: number;
}

interface WeatherForecast {
  dateTime: string;
  condition: string;
  temperature: number;
  tempHigh: number;
  tempLow: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  pop: number;
  weatherSymbol: number;
}

interface EcobeeWeather {
  thermostatId: string;
  thermostatName: string;
  available: boolean;
  useCelsius: boolean;
  weatherStation?: string;
  current?: WeatherCurrent;
  forecasts?: WeatherForecast[];
}

interface WeatherData {
  weather: EcobeeWeather[];
}

interface WeatherProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatTemperature(temp: number, useCelsius: boolean): string {
  if (useCelsius) {
    const celsius = (temp - 32) * (5 / 9);
    return `${celsius.toFixed(0)}°`;
  }
  return `${temp.toFixed(0)}°`;
}

function getWeatherIcon(symbol: number): JSX.Element {
  // Ecobee weather symbols: 0=Sunny, 1=Few Clouds, 2=Partly Cloudy, 3=Mostly Cloudy,
  // 4=Overcast, 5=Drizzle, 6=Rain, 7=Freezing Rain, 8=Showers, 9=Hail, 10=Snow,
  // 11=Flurries, 12=Freezing Rain, 13=Blizzard, 14=Pellets, 15=Thunderstorm
  switch (symbol) {
    case 0: // Sunny
      return (
        <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case 1: // Few Clouds
    case 2: // Partly Cloudy
      return (
        <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      );
    case 3: // Mostly Cloudy
    case 4: // Overcast
      return (
        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      );
    case 5: // Drizzle
    case 6: // Rain
    case 8: // Showers
      return (
        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      );
    case 7: // Freezing Rain
    case 12: // Freezing Rain
    case 9: // Hail
    case 14: // Pellets
      return (
        <svg className="w-8 h-8 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      );
    case 10: // Snow
    case 11: // Flurries
    case 13: // Blizzard
      return (
        <svg className="w-8 h-8 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
        </svg>
      );
    case 15: // Thunderstorm
      return (
        <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    default:
      return (
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      );
  }
}

function getWindDirection(direction: string): string {
  const directions: Record<string, string> = {
    'N': 'N', 'NNE': 'NNE', 'NE': 'NE', 'ENE': 'ENE',
    'E': 'E', 'ESE': 'ESE', 'SE': 'SE', 'SSE': 'SSE',
    'S': 'S', 'SSW': 'SSW', 'SW': 'SW', 'WSW': 'WSW',
    'W': 'W', 'WNW': 'WNW', 'NW': 'NW', 'NNW': 'NNW',
  };
  return directions[direction] || direction;
}

export function Weather({ integrationId, config, widgetId }: WeatherProps) {
  const { data, loading, error } = useWidgetData<WeatherData>({
    integrationId,
    metric: 'weather',
    refreshInterval: (config.refreshInterval as number) || 300000, // 5 minutes
    widgetId,
  });

  const showForecast = config.showForecast !== false;
  const showWind = config.showWind !== false;
  const showHumidity = config.showHumidity !== false;
  const showPressure = config.showPressure === true;
  const selectedThermostatId = config.thermostatId as string | undefined;
  const visualization = (config.visualization as string) || 'card';

  // Filter to selected thermostat if specified
  let weatherData = data?.weather || [];
  if (selectedThermostatId) {
    weatherData = weatherData.filter(w =>
      w.thermostatId === selectedThermostatId ||
      w.thermostatName.toLowerCase().includes(selectedThermostatId.toLowerCase())
    );
  }

  const weather = weatherData.find(w => w.available) || weatherData[0];

  const renderCard = (w: EcobeeWeather) => {
    if (!w.current) return null;

    return (
      <div className="flex flex-col h-full">
        {/* Current weather */}
        <div className="flex items-center gap-4 mb-3">
          {getWeatherIcon(w.current.weatherSymbol)}
          <div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatTemperature(w.current.temperature, w.useCelsius)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
              {w.current.condition.toLowerCase().replace(/_/g, ' ')}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            <span>High: {formatTemperature(w.current.tempHigh, w.useCelsius)}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span>Low: {formatTemperature(w.current.tempLow, w.useCelsius)}</span>
          </div>
          {showHumidity && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3" />
              </svg>
              <span>Humidity: {w.current.humidity}%</span>
            </div>
          )}
          {showWind && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span>{w.current.windSpeed} mph {getWindDirection(w.current.windDirection)}</span>
            </div>
          )}
          {showPressure && (
            <div className="col-span-2 flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <span>Pressure: {w.current.pressure} mb</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderForecast = (w: EcobeeWeather) => {
    if (!w.current || !w.forecasts) return null;

    return (
      <div className="flex flex-col h-full">
        {/* Current weather (compact) */}
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
          {getWeatherIcon(w.current.weatherSymbol)}
          <div className="flex-1">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatTemperature(w.current.temperature, w.useCelsius)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
              {w.current.condition.toLowerCase().replace(/_/g, ' ')}
            </div>
          </div>
          <div className="text-right text-sm text-gray-600 dark:text-gray-400">
            <div>H: {formatTemperature(w.current.tempHigh, w.useCelsius)}</div>
            <div>L: {formatTemperature(w.current.tempLow, w.useCelsius)}</div>
          </div>
        </div>

        {/* Forecast */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-4 gap-2">
            {w.forecasts.slice(0, 4).map((f, i) => {
              const date = new Date(f.dateTime);
              const dayName = i === 0 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' });

              return (
                <div key={i} className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{dayName}</div>
                  <div className="flex justify-center mb-1">
                    {React.cloneElement(getWeatherIcon(f.weatherSymbol), { className: 'w-6 h-6' })}
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatTemperature(f.tempHigh, w.useCelsius)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTemperature(f.tempLow, w.useCelsius)}
                  </div>
                  {f.pop > 0 && (
                    <div className="text-xs text-blue-500">{f.pop}%</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMinimal = (w: EcobeeWeather) => {
    if (!w.current) return null;

    return (
      <div className="flex items-center justify-between h-full">
        <div className="flex items-center gap-3">
          {getWeatherIcon(w.current.weatherSymbol)}
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatTemperature(w.current.temperature, w.useCelsius)}
          </div>
        </div>
        <div className="text-right text-sm text-gray-600 dark:text-gray-400">
          <div className="capitalize">{w.current.condition.toLowerCase().replace(/_/g, ' ')}</div>
          {showHumidity && <div>{w.current.humidity}% humidity</div>}
        </div>
      </div>
    );
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {!weather?.available ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
          <p className="text-sm">Weather data unavailable</p>
        </div>
      ) : (
        <>
          {visualization === 'card' && renderCard(weather)}
          {visualization === 'forecast' && (showForecast ? renderForecast(weather) : renderCard(weather))}
          {visualization === 'minimal' && renderMinimal(weather)}
        </>
      )}
    </BaseWidget>
  );
}
