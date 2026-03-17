/**
 * TDR Coverage Chart — Sprint 20
 * Donut chart showing: Reviewed (completed TDR) vs In-Progress vs Unreviewed
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Deal } from '@/types/tdr';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TDRCoverageChartProps {
  deals: Deal[];
}

const COVERAGE_COLORS = {
  reviewed: 'hsl(263, 84%, 55%)',     // Deep violet — completed
  inProgress: 'hsl(300, 45%, 65%)',   // Magenta-lavender — in-progress
  unreviewed: 'hsl(260, 15%, 72%)',   // Muted purple-gray — unreviewed
};

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${value}`;
};

const CustomTooltip = ({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number; acv: number; color: string } }>;
}) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md bg-popover px-3 py-2 text-xs shadow-md border min-w-[160px]" style={{ position: 'relative', zIndex: 50 }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
        <span className="font-semibold">{d.name}</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>Deals</span><span className="font-medium text-foreground">{d.value}</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>ACV</span><span className="font-medium text-foreground">{formatCurrency(d.acv)}</span>
      </div>
    </div>
  );
};

export function TDRCoverageChart({ deals }: TDRCoverageChartProps) {
  const reviewed = deals.filter(d => d.tdrSessions?.some(s => s.status === 'completed'));
  const inProgress = deals.filter(d => !reviewed.includes(d) && d.tdrSessions?.some(s => s.status === 'in-progress'));
  const unreviewed = deals.filter(d => !reviewed.includes(d) && !inProgress.includes(d));

  const data = [
    { name: 'Reviewed', value: reviewed.length, acv: reviewed.reduce((s, d) => s + d.acv, 0), color: COVERAGE_COLORS.reviewed },
    { name: 'In Progress', value: inProgress.length, acv: inProgress.reduce((s, d) => s + d.acv, 0), color: COVERAGE_COLORS.inProgress },
    { name: 'Unreviewed', value: unreviewed.length, acv: unreviewed.reduce((s, d) => s + d.acv, 0), color: COVERAGE_COLORS.unreviewed },
  ].filter(d => d.value > 0);

  const totalDeals = deals.length;
  const coveragePct = totalDeals > 0 ? Math.round((reviewed.length / totalDeals) * 100) : 0;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="h-52">
        <div className="flex items-center gap-2 mb-3">
          <span className="section-header">TDR Coverage</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/40 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">Deals that have completed a TDR review vs. those in-progress or unreviewed.</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-start gap-5">
          <div className="w-28 h-28 relative" style={{ zIndex: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <RechartsTooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 50 }} />
                <Pie data={data} innerRadius={30} outerRadius={50} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-bold">{coveragePct}%</span>
              <span className="text-2xs text-muted-foreground">covered</span>
            </div>
          </div>

          <div className="flex-1 space-y-2 pt-1">
            {data.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="font-medium text-xs">{entry.name}</span>
                </div>
                <div className="flex items-center gap-3 tabular-nums text-xs">
                  <span className="text-muted-foreground">{formatCurrency(entry.acv)}</span>
                  <span className="font-semibold w-6 text-right">{entry.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

