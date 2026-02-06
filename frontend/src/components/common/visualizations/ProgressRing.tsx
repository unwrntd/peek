import { useMemo } from 'react';
import { sizePresets, SizePreset, getThresholdHexColor } from './utils';

interface ProgressRingProps {
  value: number;
  max?: number;
  size?: SizePreset;
  thickness?: number;
  color?: string;
  useThresholdColors?: boolean;
  warningThreshold?: number;
  criticalThreshold?: number;
  showValue?: boolean;
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
  className?: string;
}

export function ProgressRing({
  value,
  max = 100,
  size = 'md',
  thickness,
  color,
  useThresholdColors = false,
  warningThreshold = 75,
  criticalThreshold = 90,
  showValue = true,
  showLabel = false,
  label,
  animated = true,
  className = '',
}: ProgressRingProps) {
  const preset = sizePresets[size];
  const { dimension, strokeWidth: defaultStrokeWidth, fontSize } = preset;
  const strokeWidth = thickness || defaultStrokeWidth;

  const percentage = useMemo(() => {
    return Math.min(Math.max((value / max) * 100, 0), 100);
  }, [value, max]);

  const radius = (dimension - strokeWidth) / 2;
  const center = dimension / 2;
  const circumference = 2 * Math.PI * radius;

  const strokeDashoffset = useMemo(() => {
    return circumference - (percentage / 100) * circumference;
  }, [circumference, percentage]);

  const strokeColor = useMemo(() => {
    if (color) return color;
    if (useThresholdColors) {
      return getThresholdHexColor(percentage, warningThreshold, criticalThreshold);
    }
    return '#3b82f6'; // blue-500 default
  }, [color, useThresholdColors, percentage, warningThreshold, criticalThreshold]);

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div className="relative" style={{ width: dimension, height: dimension }}>
        <svg
          width={dimension}
          height={dimension}
          viewBox={`0 0 ${dimension} ${dimension}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-gray-200 dark:text-gray-700"
          />

          {/* Progress circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: animated ? 'stroke-dashoffset 0.5s ease-out, stroke 0.3s ease' : undefined,
            }}
          />
        </svg>

        {/* Center value */}
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-semibold"
              style={{ fontSize, color: strokeColor }}
            >
              {Math.round(percentage)}%
            </span>
          </div>
        )}
      </div>

      {/* Label below ring */}
      {showLabel && label && (
        <span
          className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-center truncate"
          style={{ maxWidth: dimension }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
