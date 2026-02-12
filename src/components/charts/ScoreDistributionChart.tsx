/**
 * Score Distribution Chart — Sprint 20
 * Vertical bar chart: deal count by TDR score bracket (Low / Medium / High / Critical)
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
import { calculateTDRScore, TDR_PRIORITY_THRESHOLDS_NEW } from '@/lib/tdrCriticalFactors';

interface ScoreDistributionChartProps {
  deals: Deal[];
}

const BRACKET_META = [
  { label: 'Critical', min: TDR_PRIORITY_THRESHOLDS_NEW.critical, color: 'hsl(263, 84%, 55%)', desc: '75+' },
  { label: 'High',     min: TDR_PRIORITY_THRESHOLDS_NEW.high,     color: 'hsl(280, 60%, 50%)', desc: '50–74' },
  { label: 'Medium',   min: TDR_PRIORITY_THRESHOLDS_NEW.medium,   color: 'hsl(300, 45%, 65%)', desc: '25–49' },
  { label: 'Low',      min: TDR_PRIORITY_THRESHOLDS_NEW.low,      color: 'hsl(260, 15%, 65%)', desc: '<25' },
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
      <div className="font-semibold mb-1">{d.name} Priority</div>
      <div className="text-muted-foreground text-[10px] mb-1.5">Score: {d.desc}</div>
      <div className="flex justify-between"><span className="text-muted-foreground">Deals</span><span className="font-medium">{d.count}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">ACV</span><span className="font-medium">{formatCurrency(d.acv)}</span></div>
    </div>
  );
};

export function ScoreDistributionChart({ deals }: ScoreDistributionChartProps) {
  // Categorize each deal
  const scored = deals.map(d => ({ ...d, score: d.tdrScore ?? calculateTDRScore(d) }));

  const data = BRACKET_META.map(b => {
    const matching = scored.filter(d => {
      if (b.label === 'Critical') return d.score >= 75;
      if (b.label === 'High') return d.score >= 50 && d.score < 75;
      if (b.label === 'Medium') return d.score >= 25 && d.score < 50;
      return d.score < 25;
    });
    return {
      name: b.label,
      count: matching.length,
      acv: matching.reduce((s, d) => s + d.acv, 0),
      color: b.color,
      desc: b.desc,
    };
  });

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="h-52">
        <div className="flex items-center gap-2 mb-3">
          <span className="section-header">Score Distribution</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/40 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">Deal count by TDR priority score bracket. Higher scores = greater SE engagement priority.</p>
            </TooltipContent>
          </Tooltip>
        </div>

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
      </div>
    </TooltipProvider>
  );
}

