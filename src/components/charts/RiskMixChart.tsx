import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Deal } from '@/types/tdr';

interface RiskMixChartProps {
  deals: Deal[];
}

export function RiskMixChart({ deals }: RiskMixChartProps) {
  const riskCounts = deals.reduce(
    (acc, deal) => {
      acc[deal.riskLevel] = (acc[deal.riskLevel] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const data = [
    { name: 'Ready', value: riskCounts['green'] || 0, color: 'hsl(263, 84%, 58%)' },
    { name: 'At Risk', value: riskCounts['yellow'] || 0, color: 'hsl(300, 45%, 65%)' },
    { name: 'Critical', value: riskCounts['red'] || 0, color: 'hsl(340, 55%, 55%)' },
  ].filter((d) => d.value > 0);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex items-center gap-3">
      <div className="h-16 w-16">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={18}
              outerRadius={28}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-1">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-2xs">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground">
              {item.name}: {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
