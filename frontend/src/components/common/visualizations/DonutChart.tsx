import { useMemo, useRef, useEffect, useState } from 'react';
import { polarToCartesian, getChartColor, sizePresets, SizePreset } from './utils';

interface DonutSegment {
  value: number;
  label: string;
  color?: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: SizePreset;
  responsive?: boolean;
  thickness?: number;
  showLegend?: boolean;
  showLabels?: boolean;
  centerValue?: string | number;
  centerLabel?: string;
  animated?: boolean;
  className?: string;
}

function describeDonutArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 1, end.x, end.y,
  ].join(' ');
}

export function DonutChart({
  segments,
  size = 'md',
  responsive = false,
  thickness,
  showLegend = false,
  showLabels = false,
  centerValue,
  centerLabel,
  animated = true,
  className = '',
}: DonutChartProps) {
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

      // Use the smaller dimension, with padding for legend
      const legendSpace = showLegend ? 40 : 0;
      const maxSize = Math.min(availableWidth, availableHeight - legendSpace) - 8;
      setContainerSize(Math.max(maxSize, 48));
    };

    calculateSize();

    const resizeObserver = new ResizeObserver(calculateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [responsive, showLegend]);

  const preset = sizePresets[size];
  const dimension = responsive && containerSize ? containerSize : preset.dimension;
  const defaultStrokeWidth = responsive && containerSize ? Math.max(containerSize / 10, 6) : preset.strokeWidth;
  const fontSize = responsive && containerSize ? Math.max(containerSize / 6, 12) : preset.fontSize;
  const strokeWidth = thickness || defaultStrokeWidth + 2;

  const radius = (dimension - strokeWidth) / 2;
  const center = dimension / 2;

  const total = useMemo(() => {
    return segments.reduce((sum, seg) => sum + seg.value, 0);
  }, [segments]);

  const arcs = useMemo(() => {
    if (total === 0) return [];

    const gapDegrees = segments.length > 1 ? 3 : 0; // Gap between segments
    let currentAngle = -90; // Start at top

    return segments.map((segment, index) => {
      const segmentDegrees = (segment.value / total) * 360;
      const startAngle = currentAngle + gapDegrees / 2;
      const endAngle = currentAngle + segmentDegrees - gapDegrees / 2;

      currentAngle += segmentDegrees;

      return {
        ...segment,
        color: segment.color || getChartColor(index),
        startAngle,
        endAngle,
        path: segmentDegrees > 0.5 ? describeDonutArc(center, center, radius, startAngle, endAngle) : '',
        percentage: ((segment.value / total) * 100).toFixed(1),
      };
    });
  }, [segments, total, center, radius]);

  if (responsive && !containerSize) {
    // Render placeholder while measuring
    return <div ref={containerRef} className={`w-full h-full ${className}`} />;
  }

  if (segments.length === 0 || total === 0) {
    return (
      <div ref={containerRef} className={`flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs ${className}`}>
        No data
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`${responsive ? 'w-full h-full flex items-center justify-center' : 'inline-flex'} flex-col items-center ${className}`}>
      <div className="relative">
        <svg
          width={dimension}
          height={dimension}
          viewBox={`0 0 ${dimension} ${dimension}`}
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

          {/* Segment arcs */}
          {arcs.map((arc, index) => (
            arc.path && (
              <path
                key={index}
                d={arc.path}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                style={{
                  transition: animated ? 'stroke-dashoffset 0.5s ease-out' : undefined,
                }}
              />
            )
          ))}
        </svg>

        {/* Center content */}
        {(centerValue !== undefined || centerLabel) && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ pointerEvents: 'none' }}
          >
            {centerValue !== undefined && (
              <span
                className="font-semibold text-gray-900 dark:text-white"
                style={{ fontSize: fontSize + 2 }}
              >
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span
                className="text-gray-500 dark:text-gray-400"
                style={{ fontSize: fontSize - 4 }}
              >
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
          {arcs.map((arc, index) => (
            <div key={index} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: arc.color }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {arc.label}
                {showLabels && ` (${arc.percentage}%)`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
