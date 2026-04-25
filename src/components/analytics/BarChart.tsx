'use client';

interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  height?: number;
  color?: string;
  showValues?: boolean;
  formatValue?: (value: number) => string;
}

export function BarChart({
  data,
  height = 300,
  color = '#6366f1',
  showValues = false,
  formatValue = (v) => v.toString(),
}: BarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
        No data to display
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));
  const barWidth = 100 / data.length;

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex items-end justify-around gap-2 px-4">
          {data.map((item, index) => {
            const barHeight = maxValue > 0 ? (item.value / maxValue) * 100 : 0;

            return (
              <div key={index} className="flex flex-col items-center flex-1 max-w-[80px]">
                <div className="w-full flex flex-col items-center justify-end" style={{ height: height - 40 }}>
                  {showValues && item.value > 0 && (
                    <div className="text-xs font-medium mb-1 text-foreground">
                      {formatValue(item.value)}
                    </div>
                  )}
                  <div
                    className="w-full rounded-t transition-all hover:opacity-80"
                    style={{
                      height: `${barHeight}%`,
                      backgroundColor: item.color || color,
                      minHeight: item.value > 0 ? '4px' : '0px',
                    }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-2 text-center truncate w-full">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
