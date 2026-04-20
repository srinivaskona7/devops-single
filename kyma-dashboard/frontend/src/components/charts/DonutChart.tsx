import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface DonutChartProps {
  value: number;
  total: number;
  label: string;
  color: string;
  unit?: string;
}

export function DonutChart({ value, total, label, color, unit = '%' }: DonutChartProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const data = [
    { name: 'used', value: pct },
    { name: 'free', value: 100 - pct },
  ];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={26}
              outerRadius={36}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill={color} />
              <Cell fill="rgba(255,255,255,0.06)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-kyma-text">
            {pct}{unit}
          </span>
        </div>
      </div>
      <span className="text-[11px] text-kyma-muted font-medium">{label}</span>
    </div>
  );
}
