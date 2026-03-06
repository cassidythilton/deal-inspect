/**
 * Propensity Distribution Chart — Sprint 28e
 * Bar chart: deal count by ML propensity quadrant (HIGH / MONITOR / AT_RISK)
 */

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip as RechartsTooltip, LabelList } from 'recharts';
import { Deal } from '@/types/tdr';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PropensityDistributionChartProps {
  deals: Deal[];
}

const QUADRANT_META = [
  { label: 'High', key: 'HIGH' as const, color: 'hsl(263, 84%, 55%)', desc: '≥70% win probability' },
  { label: 'Monitor', key: 'MONITOR' as const, color: 'hsl(280, 60%, 65%)', desc: '40–69% win probability' },
  { label: 'At Risk', key: 'AT_RISK' as const, color: 'hsl(300, 45%, 55%)', desc: '<40% win probability' },
];

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${value}`;
};

const CustomTooltip = ({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; count: number; acv: number; desc: string } }>;
}) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md bg-popover px-3 py-2 text-xs shadow-md border min-w-[150px]">
      <div className="font-semibold mb-1">{d.name}</div>
      <div className="text-muted-foreground text-[10px] mb-1.5">{d.desc}</div>
      <div className="flex justify-between"><span className="text-muted-foreground">Deals</span><span className="font-medium">{d.count}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">ACV</span><span className="font-medium">{formatCurrency(d.acv)}</span></div>
    </div>
  );
};

export function PropensityDistributionChart({ deals }: PropensityDistributionChartProps) {
  const scored = deals.filter(d => d.propensityScore != null);
  const unscored = deals.length - scored.length;

  const data = QUADRANT_META.map(q => {
    const matching = scored.filter(d => d.propensityQuadrant === q.key);
    return {
      name: q.label,
      count: matching.length,
      acv: matching.reduce((s, d) => s + d.acv, 0),
      color: q.color,
      desc: q.desc,
    };
  });

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const avgScore = scored.length > 0
    ? Math.round((scored.reduce((s, d) => s + (d.propensityScore || 0), 0) / scored.length) * 100)
    : null;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="h-52">
        <div className="flex items-center gap-2 mb-3">
          <span className="section-header">Win Propensity</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/40 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">ML-predicted win probability distribution. {scored.length} of {deals.length} deals scored.{avgScore != null && ` Avg: ${avgScore}%.`}</p>
            </TooltipContent>
          </Tooltip>
          {unscored > 0 && scored.length > 0 && (
            <span className="text-[10px] text-muted-foreground/50 ml-auto">{unscored} unscored</span>
          )}
        </div>

        {scored.length === 0 ? (
          <div className="h-36 flex items-center justify-center">
            <p className="text-xs text-muted-foreground/50">No ML scores available yet</p>
          </div>
        ) : (
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 15, right: 5, bottom: 0, left: 5 }}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(260, 10%, 50%)' }}
                />
                <YAxis hide domain={[0, maxCount + 2]} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(260, 15%, 95%)', radius: 4 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={36}>
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                  <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 600, fill: 'hsl(260, 10%, 45%)' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
