import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Deal } from '@/types/tdr';
import { format, parseISO, startOfMonth, addMonths, isBefore, isAfter } from 'date-fns';

interface PipelineByCloseChartProps {
  deals: Deal[];
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${value}`;
};

export function PipelineByCloseChart({ deals }: PipelineByCloseChartProps) {
  // Group deals by month and calculate ACV by risk level
  const now = new Date();
  const months: Date[] = [];
  for (let i = 0; i < 4; i++) {
    months.push(addMonths(startOfMonth(now), i));
  }

  const data = months.map((month) => {
    const nextMonth = addMonths(month, 1);
    const monthDeals = deals.filter((deal) => {
      try {
        const closeDate = parseISO(deal.closeDate);
        return !isBefore(closeDate, month) && isBefore(closeDate, nextMonth);
      } catch {
        return false;
      }
    });

    const criticalACV = monthDeals
      .filter(d => d.riskLevel === 'red')
      .reduce((sum, d) => sum + d.acv, 0);
    const highACV = monthDeals
      .filter(d => d.riskLevel === 'yellow')
      .reduce((sum, d) => sum + d.acv, 0);
    const mediumACV = monthDeals
      .filter(d => d.riskLevel === 'green')
      .reduce((sum, d) => sum + d.acv, 0);

    return {
      month: format(month, 'MMM d'),
      critical: criticalACV / 1000,
      high: highACV / 1000,
      medium: mediumACV / 1000,
    };
  });

  return (
    <div className="h-32">
      <div className="flex items-center justify-between mb-2">
        <span className="section-header">TDR PIPELINE BY CLOSE</span>
        <div className="flex items-center gap-1">
          {['D', 'W', 'M'].map((label, i) => (
            <button
              key={label}
              className={`px-1.5 py-0.5 text-2xs rounded ${
                i === 2 ? 'bg-secondary text-foreground' : 'text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-2">$60K</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
          <defs>
            <linearGradient id="criticalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(350, 55%, 50%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(350, 55%, 50%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="highGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(38, 65%, 50%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(38, 65%, 50%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="mediumGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(152, 73%, 40%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(152, 73%, 40%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="month" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis hide />
          <Area
            type="monotone"
            dataKey="medium"
            stackId="1"
            stroke="hsl(152, 73%, 40%)"
            fill="url(#mediumGradient)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="high"
            stackId="1"
            stroke="hsl(38, 65%, 50%)"
            fill="url(#highGradient)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="critical"
            stackId="1"
            stroke="hsl(350, 55%, 50%)"
            fill="url(#criticalGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-1">
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-[hsl(350,55%,50%)]" />
          <span className="text-2xs text-muted-foreground">Critical</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-[hsl(38,65%,50%)]" />
          <span className="text-2xs text-muted-foreground">High</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-[hsl(152,73%,40%)]" />
          <span className="text-2xs text-muted-foreground">Medium</span>
        </div>
      </div>
    </div>
  );
}

