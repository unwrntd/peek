import React, { useRef, useEffect, useState } from 'react';

interface ScaledMetricProps {
  value: string | number;
  className?: string;
  minFontSize?: number;
  maxFontSize?: number;
  padding?: number;
}

export function ScaledMetric({
  value,
  className = '',
  minFontSize = 16,
  maxFontSize = 200,
  padding = 16,
}: ScaledMetricProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(minFontSize);

  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const calculateFontSize = () => {
      const containerWidth = container.clientWidth - padding * 2;
      const containerHeight = container.clientHeight - padding * 2;

      if (containerWidth <= 0 || containerHeight <= 0) return;

      // Binary search for the optimal font size
      let low = minFontSize;
      let high = maxFontSize;
      let optimalSize = minFontSize;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        text.style.fontSize = `${mid}px`;

        const textWidth = text.scrollWidth;
        const textHeight = text.scrollHeight;

        if (textWidth <= containerWidth && textHeight <= containerHeight) {
          optimalSize = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      setFontSize(optimalSize);
    };

    // Initial calculation
    calculateFontSize();

    // Observe container size changes
    const resizeObserver = new ResizeObserver(() => {
      calculateFontSize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [value, minFontSize, maxFontSize, padding]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden"
    >
      <div
        ref={textRef}
        className={`font-bold leading-none whitespace-nowrap ${className}`}
        style={{ fontSize: `${fontSize}px` }}
      >
        {value}
      </div>
    </div>
  );
}
