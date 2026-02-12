/**
 * Pipeline By Close Chart
 * Area chart showing pipeline distribution by close date
 * Rebuilt with coolors.co palette and improved tooltips
 */

import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Deal } from '@/types/tdr';
import { Info } from 'lucide-react';
import { format, parseISO, startOfMonth, startOfWeek, addMonths, addWeeks, addDays, isBefore, startOfDay } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { calculateTDRScore, TDR_PRIORITY_THRESHOLDS_NEW } from '@/lib/tdrCriticalFactors';

interface PipelineByCloseChartProps {
  deals: Deal[];
}

type TimeView = 'D' | 'W' | 'M';

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${value}`;
};

// Colors — purple gradient palette
const CHART_COLORS = {
  critical: 'hsl(263, 84%, 58%)', // Vivid violet
  high: 'hsl(280, 60%, 50%)',     // Purple
  medium: 'hsl(300, 45%, 65%)',   // Magenta-lavender
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: { 
  active?: boolean; 
  payload?: Array<{ name: string; value: number; color: string }>; 
  label?: string 
}) => {
  if (!active || !payload || !payload.length) return null;
  
  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
  
  return (
    <div className="bg-card border border-border rounded-lg shadow-xl p-4 text-sm min-w-[180px]">
      <p className="font-bold text-foreground mb-3">{label}</p>
      {payload.reverse().map((item, i) => (
        <div key={i} className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2">
            <div 
              className="h-2.5 w-2.5 rounded-full" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground">{item.name}</span>
          </div>
          <span className="font-medium tabular-nums">{formatCurrency(item.value * 1000)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
        <span className="font-medium">Total</span>
        <span className="font-bold tabular-nums">{formatCurrency(total * 1000)}</span>
      </div>
    </div>
  );
};

export function PipelineByCloseChart({ deals }: PipelineByCloseChartProps) {
  const [timeView, setTimeView] = useState<TimeView>('M');

  // Generate time periods based on view
  const periods = useMemo(() => {
    const now = new Date();
    const result: { start: Date; end: Date; label: string }[] = [];
    
    if (timeView === 'M') {
      for (let i = 0; i < 4; i++) {
        const start = addMonths(startOfMonth(now), i);
        const end = addMonths(start, 1);
        result.push({ start, end, label: format(start, 'MMM') });
      }
    } else if (timeView === 'W') {
      for (let i = 0; i < 6; i++) {
        const start = addWeeks(startOfWeek(now), i);
        const end = addWeeks(start, 1);
        result.push({ start, end, label: format(start, 'MMM d') });
      }
    } else {
      for (let i = 0; i < 7; i++) {
        const start = addDays(startOfDay(now), i);
        const end = addDays(start, 1);
        result.push({ start, end, label: format(start, 'EEE') });
      }
    }
    
    return result;
  }, [timeView]);

  // Process data
  const data = useMemo(() => {
    return periods.map((period) => {
      const periodDeals = deals.filter((deal) => {
        try {
          const closeDate = parseISO(deal.closeDate);
          return !isBefore(closeDate, period.start) && isBefore(closeDate, period.end);
        } catch {
          return false;
        }
      });

      // Categorize by TDR score
      let critical = 0, high = 0, medium = 0;
      
      for (const deal of periodDeals) {
        const score = deal.tdrScore ?? calculateTDRScore(deal);
        const acvK = deal.acv / 1000;
        
        if (score >= TDR_PRIORITY_THRESHOLDS_NEW.critical) {
          critical += acvK;
        } else if (score >= TDR_PRIORITY_THRESHOLDS_NEW.high) {
          high += acvK;
        } else if (score >= TDR_PRIORITY_THRESHOLDS_NEW.medium) {
          medium += acvK;
        }
      }

      return {
        period: period.label,
        Critical: critical,
        High: high,
        Medium: medium,
      };
    });
  }, [deals, periods]);

  // Calculate max for display
  const maxTotal = Math.max(...data.map(d => d.Critical + d.High + d.Medium), 50);
  const maxLabel = formatCurrency(maxTotal * 1000);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="h-52">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              TDR Pipeline by Close
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/40 cursor-help hover:text-muted-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">
                  Pipeline ACV distribution by expected close date, 
                  stacked by TDR priority level.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            {/* Time toggle */}
            <div className="flex items-center rounded-lg border border-border p-0.5">
              {(['D', 'W', 'M'] as TimeView[]).map((label) => (
                <button
                  key={label}
                  onClick={() => setTimeView(label)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                    timeView === label 
                      ? 'bg-secondary text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground font-medium ml-2">{maxLabel}</span>
          </div>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height="70%">
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
            <defs>
              <linearGradient id="criticalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.critical} stopOpacity={0.4} />
                <stop offset="95%" stopColor={CHART_COLORS.critical} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="highGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.high} stopOpacity={0.4} />
                <stop offset="95%" stopColor={CHART_COLORS.high} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="mediumGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.medium} stopOpacity={0.4} />
                <stop offset="95%" stopColor={CHART_COLORS.medium} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="period" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: 'hsl(260, 10%, 50%)' }}
            />
            <YAxis hide />
            <RechartsTooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="Medium"
              stackId="1"
              stroke={CHART_COLORS.medium}
              fill="url(#mediumGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="High"
              stackId="1"
              stroke={CHART_COLORS.high}
              fill="url(#highGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="Critical"
              stackId="1"
              stroke={CHART_COLORS.critical}
              fill="url(#criticalGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.critical }} />
            <span className="text-xs text-muted-foreground">Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.high }} />
            <span className="text-xs text-muted-foreground">High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.medium }} />
            <span className="text-xs text-muted-foreground">Medium</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
