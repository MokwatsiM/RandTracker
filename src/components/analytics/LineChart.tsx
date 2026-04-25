'use client';

interface LineChartData {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LineChartData[];
  height?: number;
  color?: string;
  fillColor?: string;
  showDots?: boolean;
  showGrid?: boolean;
  formatValue?: (value: number) => string;
}

export function LineChart({
  data,
  height = 300,
  color = '#10b981',
  fillColor,
  showDots = true,
  showGrid = true,
  formatValue = (v) => v.toString(),
}: LineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
        No data to display
      </div>
    );
  }

  const padding = 40;
  const width = 600;
  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;

  const maxValue = Math.max(...data.map((d) => d.value), 0);
  const minValue = Math.min(...data.map((d) => d.value), 0);
  const valueRange = maxValue - minValue || 1;

  // Generate points
  const points = data.map((item, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - ((item.value - minValue) / valueRange) * chartHeight;
    return { x, y, value: item.value, label: item.label };
  });

  // Generate line path
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Generate area path (if fillColor is provided)
  const areaPath = fillColor
    ? `${linePath} L ${points[points.length - 1].x} ${padding + chartHeight} L ${padding} ${padding + chartHeight} Z`
    : '';

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="min-w-full">
        {/* Grid lines */}
        {showGrid && (
          <g className="opacity-10">
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
              const y = padding + chartHeight * (1 - fraction);
              return (
                <line
                  key={fraction}
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="1"
                />
              );
            })}
          </g>
        )}

        {/* Area fill */}
        {fillColor && (
          <path
            d={areaPath}
            fill={fillColor}
            opacity="0.2"
          />
        )}

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {showDots &&
          points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill={color}
                className="transition-all hover:r-6"
              />
              <title>{`${point.label}: ${formatValue(point.value)}`}</title>
            </g>
          ))}

        {/* X-axis labels */}
        {data.length <= 12 && points.map((point, index) => (
          <text
            key={index}
            x={point.x}
            y={height - padding + 20}
            textAnchor="middle"
            className="text-xs fill-muted-foreground"
          >
            {point.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
