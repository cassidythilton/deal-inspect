import { AreaChart, Area, ResponsiveContainer } from 'recharts';

const trendData = [
  { week: 'W1', ready: 2, atRisk: 3 },
  { week: 'W2', ready: 3, atRisk: 2 },
  { week: 'W3', ready: 2, atRisk: 3 },
  { week: 'W4', ready: 4, atRisk: 2 },
  { week: 'W5', ready: 5, atRisk: 2 },
];

export function ReadinessTrendChart() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-2xs text-muted-foreground">
        <span>5-week trend</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-success" />
            <span>Ready</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-warning" />
            <span>At Risk</span>
          </div>
        </div>
      </div>
      <div className="h-12">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="readyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(152, 73%, 40%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(152, 73%, 40%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(38, 65%, 50%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(38, 65%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="ready"
              stroke="hsl(152, 73%, 40%)"
              strokeWidth={1.5}
              fill="url(#readyGradient)"
            />
            <Area
              type="monotone"
              dataKey="atRisk"
              stroke="hsl(38, 65%, 50%)"
              strokeWidth={1.5}
              fill="url(#riskGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
