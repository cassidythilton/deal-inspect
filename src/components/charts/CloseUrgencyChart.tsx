/**
 * Close Date Urgency Chart — Sprint 20
 * Area chart showing ACV by close month, colored by TDR review status.
 * Answers: "Which unreviewed deals are closing soonest?"
 */

import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Deal } from '@/types/tdr';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CloseUrgencyChartProps {
  deals: Deal[];
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${value}`;
};

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="rounded-md bg-popover px-3 py-2 text-xs shadow-md border min-w-[170px]">
      <p className="font-semibold mb-2">{label}</p>
      {payload.reverse().map((item, i) => (
        <div key={i} className="flex items-center justify-between py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground">{item.name}</span>
          </div>
          <span className="font-medium tabular-nums">{formatCurrency((item.value || 0) * 1000)}</span>
        </div>
      ))}
      <div className="flex justify-between pt-1.5 mt-1 border-t border-border font-medium">
        <span>Total</span>
        <span className="tabular-nums">{formatCurrency(total * 1000)}</span>
      </div>
    </div>
  );
};

export function CloseUrgencyChart({ deals }: CloseUrgencyChartProps) {
  // Classify deals by TDR status
  const reviewed = new Set(deals.filter(d => d.tdrSessions?.some(s => s.status === 'completed')).map(d => d.id));
  const inProgress = new Set(deals.filter(d => !reviewed.has(d.id) && d.tdrSessions?.some(s => s.status === 'in-progress')).map(d => d.id));

  // Group by month
  const monthMap = new Map<string, { reviewed: number; unreviewed: number }>();

  for (const deal of deals) {
    if (!deal.closeDate) continue;
    const date = new Date(deal.closeDate);
    const month = `${date.toLocaleString('default', { month: 'short' })} '${String(date.getFullYear()).slice(-2)}`;
    const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthMap.has(sortKey)) monthMap.set(sortKey, { reviewed: 0, unreviewed: 0 });
    const entry = monthMap.get(sortKey)!;
    const acvK = Math.round(deal.acv / 1000);

    if (reviewed.has(deal.id) || inProgress.has(deal.id)) {
      entry.reviewed += acvK;
    } else {
      entry.unreviewed += acvK;
    }
    // Store display label
    (entry as Record<string, unknown>)['_label'] = month;
  }

  const sortedEntries = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 8);
  const data = sortedEntries.map(([, v]) => ({
    period: (v as Record<string, unknown>)['_label'] as string,
    Reviewed: v.reviewed,
    Unreviewed: v.unreviewed,
  }));

  return (
    <TooltipProvider delayDuration={100}>
      <div className="h-52">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="section-header">Close Urgency</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/40 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">ACV by close month, split by TDR review status. Purple = reviewed/in-progress, Gray = unreviewed (needs TDR).</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-3 text-2xs text-muted-foreground">
            <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'hsl(263, 84%, 55%)' }} />Reviewed</div>
            <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'hsl(260, 15%, 72%)' }} />Unreviewed</div>
          </div>
        </div>

        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
              <defs>
                <linearGradient id="reviewedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(263, 84%, 55%)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(263, 84%, 55%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="unreviewedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(260, 15%, 72%)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(260, 15%, 72%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="period"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(260, 10%, 50%)' }}
              />
              <YAxis hide />
              <RechartsTooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="Unreviewed"
                stackId="1"
                stroke="hsl(260, 15%, 72%)"
                fill="url(#unreviewedGrad)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="Reviewed"
                stackId="1"
                stroke="hsl(263, 84%, 55%)"
                fill="url(#reviewedGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </TooltipProvider>
  );
}

