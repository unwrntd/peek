import { useMemo } from 'react';
import { dataToPolylinePoints, dataToAreaPoints, getChartColor } from './utils';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillGradient?: boolean;
  showDots?: boolean;
  showMinMax?: boolean;
  showLastValue?: boolean;
  animated?: boolean;
  className?: string;
}

export function Sparkline({
  data,
  width = 200,
  height = 40,
  color,
  fillGradient = false,
  showDots = false,
  showMinMax = false,
  showLastValue = false,
  animated = false,
  className = '',
}: SparklineProps) {
  // Filter out invalid data points
  const validData = useMemo(() => {
    return data.filter(d => d !== undefined && d !== null && !isNaN(d));
  }, [data]);

  const strokeColor = color || getChartColor(0);
  const gradientId = useMemo(() => `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`, []);

  const { points, areaPoints, minIndex, maxIndex, minY, maxY } = useMemo(() => {
    if (validData.length === 0) {
      return { points: '', areaPoints: '', minIndex: -1, maxIndex: -1, minY: 0, maxY: 0 };
    }

    const padding = 2;
    const min = Math.min(...validData);
    const max = Math.max(...validData);
    const range = max - min || 1;

    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    let minIdx = 0;
    let maxIdx = 0;

    const coords = validData.map((value, index) => {
      if (value === min) minIdx = index;
      if (value === max) maxIdx = index;

      const x = padding + (index / (validData.length - 1 || 1)) * innerWidth;
      const y = padding + innerHeight - ((value - min) / range) * innerHeight;
      return { x, y };
    });

    const linePoints = coords.map(c => `${c.x},${c.y}`).join(' ');
    const area = `${padding},${height - padding} ${linePoints} ${padding + innerWidth},${height - padding}`;

    return {
      points: linePoints,
      areaPoints: area,
      minIndex: minIdx,
      maxIndex: maxIdx,
      minY: coords[minIdx]?.y || 0,
      maxY: coords[maxIdx]?.y || 0,
    };
  }, [validData, width, height]);

  if (validData.length === 0) {
    return (
      <div className={`flex items-center justify-center text-gray-600 dark:text-gray-400 text-xs ${className}`} style={{ width, height }}>
        No data
      </div>
    );
  }

  const padding = 2;
  const innerWidth = width - padding * 2;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
    >
      {/* Gradient definition for area fill */}
      {fillGradient && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.05" />
          </linearGradient>
        </defs>
      )}

      {/* Area fill */}
      {fillGradient && (
        <polygon
          fill={`url(#${gradientId})`}
          points={areaPoints}
          className={animated ? 'transition-all duration-300' : ''}
        />
      )}

      {/* Main line */}
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className={animated ? 'transition-all duration-300' : ''}
      />

      {/* Min/Max dots */}
      {showMinMax && validData.length > 1 && (
        <>
          {/* Min point */}
          <circle
            cx={padding + (minIndex / (validData.length - 1 || 1)) * innerWidth}
            cy={minY}
            r="3"
            fill="#ef4444"
            className="drop-shadow-sm"
          />
          {/* Max point */}
          <circle
            cx={padding + (maxIndex / (validData.length - 1 || 1)) * innerWidth}
            cy={maxY}
            r="3"
            fill="#22c55e"
            className="drop-shadow-sm"
          />
        </>
      )}

      {/* All dots */}
      {showDots && validData.map((_, index) => {
        const x = padding + (index / (validData.length - 1 || 1)) * innerWidth;
        const min = Math.min(...validData);
        const max = Math.max(...validData);
        const range = max - min || 1;
        const y = padding + (height - padding * 2) - ((validData[index] - min) / range) * (height - padding * 2);

        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="2"
            fill={strokeColor}
          />
        );
      })}

      {/* Last value dot */}
      {showLastValue && validData.length > 0 && (
        <circle
          cx={padding + innerWidth}
          cy={(() => {
            const min = Math.min(...validData);
            const max = Math.max(...validData);
            const range = max - min || 1;
            const lastValue = validData[validData.length - 1];
            return padding + (height - padding * 2) - ((lastValue - min) / range) * (height - padding * 2);
          })()}
          r="3"
          fill={strokeColor}
          className="drop-shadow-sm"
        />
      )}
    </svg>
  );
}
