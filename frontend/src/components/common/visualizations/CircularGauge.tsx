import { useMemo, useRef, useEffect, useState } from 'react';
import { describeArc, getThresholdHexColor, sizePresets, SizePreset } from './utils';

interface CircularGaugeProps {
  value: number;
  max?: number;
  size?: SizePreset;
  responsive?: boolean;
  warningThreshold?: number;
  criticalThreshold?: number;
  showValue?: boolean;
  showLabel?: boolean;
  label?: string;
  /** Unit to display (e.g., "°C" for temperature). If not set, shows percentage */
  unit?: string;
  animated?: boolean;
  className?: string;
}

export function CircularGauge({
  value,
  max = 100,
  size = 'md',
  responsive = false,
  warningThreshold = 75,
  criticalThreshold = 90,
  showValue = true,
  showLabel = false,
  label,
  unit,
  animated = true,
  className = '',
}: CircularGaugeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<number | null>(null);

  useEffect(() => {
    if (!responsive) return;

    const container = containerRef.current;
    if (!container) return;

    const calculateSize = () => {
      const availableWidth = container.clientWidth;
      const availableHeight = container.clientHeight;

      if (availableWidth <= 0 || availableHeight <= 0) return;

      // Use the smaller dimension, with some padding for label
      const labelSpace = showLabel && label ? 24 : 0;
      const maxSize = Math.min(availableWidth, availableHeight - labelSpace) - 8;
      setContainerSize(Math.max(maxSize, 48));
    };

    calculateSize();

    const resizeObserver = new ResizeObserver(calculateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [responsive, showLabel, label]);

  const preset = sizePresets[size];
  const baseDimension = responsive && containerSize ? containerSize : preset.dimension;
  const dimension = baseDimension;
  const strokeWidth = responsive && containerSize ? Math.max(containerSize / 12, 4) : preset.strokeWidth;
  const fontSize = responsive && containerSize ? Math.max(containerSize / 5, 10) : preset.fontSize;

  const percentage = useMemo(() => {
    return Math.min(Math.max((value / max) * 100, 0), 100);
  }, [value, max]);

  const radius = (dimension - strokeWidth) / 2;
  const center = dimension / 2;

  // Arc goes from -135 to +135 degrees (270 degree sweep)
  const startAngle = -135;
  const endAngle = startAngle + (percentage / 100) * 270;

  const backgroundArc = useMemo(
    () => describeArc(center, center, radius, -135, 135),
    [center, radius]
  );

  const valueArc = useMemo(
    () => describeArc(center, center, radius, startAngle, endAngle),
    [center, radius, startAngle, endAngle]
  );

  const color = getThresholdHexColor(percentage, warningThreshold, criticalThreshold);

  if (responsive && !containerSize) {
    // Render placeholder while measuring
    return <div ref={containerRef} className={`w-full h-full ${className}`} />;
  }

  return (
    <div ref={containerRef} className={`${responsive ? 'w-full h-full flex items-center justify-center' : 'inline-flex'} flex-col items-center ${className}`}>
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
        className="transform -rotate-0"
      >
        {/* Background arc */}
        <path
          d={backgroundArc}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-gray-200 dark:text-gray-700"
        />

        {/* Value arc */}
        {percentage > 0 && (
          <path
            d={valueArc}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{
              transition: animated ? 'stroke-dashoffset 0.5s ease-out' : undefined,
            }}
          />
        )}

        {/* Center value text */}
        {showValue && (
          <text
            x={center}
            y={center + fontSize / 4}
            textAnchor="middle"
            fontSize={fontSize}
            fontWeight="600"
            fill={color}
            className="select-none"
          >
            {unit ? `${Math.round(value)}${unit}` : `${Math.round(percentage)}%`}
          </text>
        )}
      </svg>

      {/* Label below gauge */}
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
