import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';
import { Deal } from '@/types/tdr';
import { Info } from 'lucide-react';
import { format, parseISO, startOfMonth, startOfWeek, addMonths, addWeeks, addDays, isBefore } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface PipelineByCloseChartProps {
  deals: Deal[];
}

type TimeView = 'D' | 'W' | 'M';

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${value}`;
};

// Calculate TDR score for categorization
const calculateTDRScore = (deal: Deal): number => {
  if (deal.tdrScore !== undefined) return deal.tdrScore;
  let score = 25;
  if (deal.riskLevel === 'green') score += 15;
  if (deal.riskLevel === 'yellow') score += 5;
  if (deal.partnerSignal === 'strong') score += 10;
  if (deal.partnerSignal === 'moderate') score += 5;
  if (deal.stageAge && deal.stageAge < 60) score += 5;
  if (deal.acv > 100000) score += 5;
  return Math.min(50, score);
};

export function PipelineByCloseChart({ deals }: PipelineByCloseChartProps) {
  const [timeView, setTimeView] = useState<TimeView>('M');

  // Generate time periods based on view
  const now = new Date();
  let periods: { start: Date; label: string }[] = [];
  
  if (timeView === 'M') {
    for (let i = 0; i < 4; i++) {
      const month = addMonths(startOfMonth(now), i);
      periods.push({ start: month, label: format(month, 'MMM d') });
    }
  } else if (timeView === 'W') {
    for (let i = 0; i < 6; i++) {
      const week = addWeeks(startOfWeek(now), i);
      periods.push({ start: week, label: format(week, 'MMM d') });
    }
  } else {
    for (let i = 0; i < 14; i++) {
      const day = addDays(now, i);
      periods.push({ start: day, label: format(day, 'MMM d') });
    }
  }

  const data = periods.map((period, idx) => {
    const nextPeriod = periods[idx + 1]?.start || addMonths(period.start, 1);
    const periodDeals = deals.filter((deal) => {
      try {
        const closeDate = parseISO(deal.closeDate);
        return !isBefore(closeDate, period.start) && isBefore(closeDate, nextPeriod);
      } catch {
        return false;
      }
    });

    // Categorize by TDR score instead of risk
    const criticalACV = periodDeals
      .filter(d => calculateTDRScore(d) >= 75)
      .reduce((sum, d) => sum + d.acv, 0);
    const highACV = periodDeals
      .filter(d => {
        const score = calculateTDRScore(d);
        return score >= 50 && score < 75;
      })
      .reduce((sum, d) => sum + d.acv, 0);
    const mediumACV = periodDeals
      .filter(d => {
        const score = calculateTDRScore(d);
        return score >= 35 && score < 50;
      })
      .reduce((sum, d) => sum + d.acv, 0);

    return {
      period: period.label,
      critical: criticalACV / 1000,
      high: highACV / 1000,
      medium: mediumACV / 1000,
    };
  });

  // Calculate max for Y axis label
  const maxTotal = Math.max(...data.map(d => d.critical + d.high + d.medium), 60);
  const maxLabel = formatCurrency(maxTotal * 1000);

  return (
    <TooltipProvider>
      <div className="h-44">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <span className="section-header">TDR PIPELINE BY CLOSE</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">
                  Pipeline ACV distribution by expected close date, segmented by TDR priority level.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-0.5">
            {(['D', 'W', 'M'] as TimeView[]).map((label) => (
              <button
                key={label}
                onClick={() => setTimeView(label)}
                className={cn(
                  'px-2 py-0.5 text-xs rounded transition-colors',
                  timeView === label 
                    ? 'border border-border bg-secondary text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-3">{maxLabel}</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height="75%">
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
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="period" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis hide />
            <RechartsTooltip 
              formatter={(value: number, name: string) => [formatCurrency(value * 1000), name]}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              contentStyle={{ 
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Area
              type="monotone"
              dataKey="medium"
              stackId="1"
              stroke="hsl(217, 91%, 60%)"
              fill="url(#mediumGradient)"
              strokeWidth={2}
              name="Medium"
            />
            <Area
              type="monotone"
              dataKey="high"
              stackId="1"
              stroke="hsl(38, 65%, 50%)"
              fill="url(#highGradient)"
              strokeWidth={2}
              name="High"
            />
            <Area
              type="monotone"
              dataKey="critical"
              stackId="1"
              stroke="hsl(350, 55%, 50%)"
              fill="url(#criticalGradient)"
              strokeWidth={2}
              name="Critical"
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
            <div className="h-1.5 w-1.5 rounded-full bg-[hsl(217,91%,60%)]" />
            <span className="text-2xs text-muted-foreground">Medium</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
