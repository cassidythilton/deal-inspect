/**
 * Close Date Urgency Chart — Sprint 20
 * Area chart showing ACV by close date, colored by TDR review status.
 * Supports Day / Week / Month grain toggle (default: Day).
 * Answers: "Which unreviewed deals are closing soonest?"
 */

import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Deal } from '@/types/tdr';
import { Info } from 'lucide-react';
import { format, parseISO, startOfMonth, startOfWeek, startOfDay, addMonths, addWeeks, addDays, isBefore } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CloseUrgencyChartProps {
  deals: Deal[];
}

type TimeGrain = 'D' | 'W' | 'M';

const GRAIN_CONFIG: Record<TimeGrain, { buckets: number; label: string }> = {
  D: { buckets: 14, label: 'Day' },
  W: { buckets: 8, label: 'Week' },
  M: { buckets: 6, label: 'Month' },
};

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
  const [grain, setGrain] = useState<TimeGrain>('D');

  // Classify deals by TDR status
  const reviewedIds = useMemo(() =>
    new Set(deals.filter(d => d.tdrSessions?.some(s => s.status === 'completed')).map(d => d.id)),
    [deals]
  );
  const inProgressIds = useMemo(() =>
    new Set(deals.filter(d => !reviewedIds.has(d.id) && d.tdrSessions?.some(s => s.status === 'in-progress')).map(d => d.id)),
    [deals, reviewedIds]
  );

  // Build time buckets based on grain
  const periods = useMemo(() => {
    const now = new Date();
    const count = GRAIN_CONFIG[grain].buckets;
    const result: { start: Date; end: Date; label: string; sortKey: string }[] = [];

    for (let i = 0; i < count; i++) {
      if (grain === 'M') {
        const start = addMonths(startOfMonth(now), i);
        const end = addMonths(start, 1);
        result.push({
          start,
          end,
          label: format(start, "MMM ''yy"),
          sortKey: format(start, 'yyyy-MM'),
        });
      } else if (grain === 'W') {
        const start = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), i);
        const end = addWeeks(start, 1);
        result.push({
          start,
          end,
          label: format(start, 'MMM d'),
          sortKey: format(start, 'yyyy-MM-dd'),
        });
      } else {
        const start = addDays(startOfDay(now), i);
        const end = addDays(start, 1);
        result.push({
          start,
          end,
          label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(start, 'EEE d'),
          sortKey: format(start, 'yyyy-MM-dd'),
        });
      }
    }
    return result;
  }, [grain]);

  // Map deals into time buckets
  const data = useMemo(() => {
    return periods.map((period) => {
      let reviewed = 0;
      let unreviewed = 0;

      for (const deal of deals) {
        if (!deal.closeDate) continue;
        try {
          const closeDate = parseISO(deal.closeDate);
          if (!isBefore(closeDate, period.start) && isBefore(closeDate, period.end)) {
            const acvK = Math.round(deal.acv / 1000);
            if (reviewedIds.has(deal.id) || inProgressIds.has(deal.id)) {
              reviewed += acvK;
            } else {
              unreviewed += acvK;
            }
          }
        } catch {
          // skip malformed dates
        }
      }

      return {
        period: period.label,
        Reviewed: reviewed,
        Unreviewed: unreviewed,
      };
    });
  }, [deals, periods, reviewedIds, inProgressIds]);

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
                <p className="text-xs">ACV by close date, split by TDR review status. Purple = reviewed/in-progress, Gray = unreviewed (needs TDR).</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-3">
            {/* Time grain toggle */}
            <div className="flex items-center rounded-lg border border-border p-0.5">
              {(['D', 'W', 'M'] as TimeGrain[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGrain(g)}
                  className={cn(
                    'px-2 py-0.5 text-2xs font-medium rounded-md transition-all',
                    grain === g
                      ? 'bg-secondary text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3 text-2xs text-muted-foreground">
              <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'hsl(263, 84%, 55%)' }} />Reviewed</div>
              <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'hsl(260, 15%, 72%)' }} />Unreviewed</div>
            </div>
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
                interval={grain === 'D' ? 1 : 0}
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

