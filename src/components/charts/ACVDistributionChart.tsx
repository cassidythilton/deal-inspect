import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { Deal } from '@/types/tdr';

interface ACVDistributionChartProps {
  deals: Deal[];
}

export function ACVDistributionChart({ deals }: ACVDistributionChartProps) {
  const data = deals
    .sort((a, b) => b.acv - a.acv)
    .slice(0, 5)
    .map((deal) => ({
      name: deal.account.split(' ')[0],
      acv: deal.acv / 1000,
      risk: deal.riskLevel,
    }));

  const getBarColor = (risk: string) => {
    switch (risk) {
      case 'green':
        return 'hsl(263, 84%, 58%)';
      case 'yellow':
        return 'hsl(300, 45%, 65%)';
      case 'red':
        return 'hsl(340, 55%, 55%)';
      default:
        return 'hsl(280, 60%, 50%)';
    }
  };

  return (
    <div className="h-24">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            width={60}
            tick={{ fontSize: 10, fill: 'hsl(260, 10%, 50%)' }}
          />
          <Bar dataKey="acv" radius={[0, 2, 2, 0]} barSize={12}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.risk)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
