/**
 * TDR Priority Chart
 * Donut chart showing distribution of deals by TDR priority level
 * Rebuilt with coolors.co palette and improved tooltips
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
import { calculateTDRScore, TDR_PRIORITY_THRESHOLDS_NEW } from '@/lib/tdrCriticalFactors';

interface TDRPriorityChartProps {
  deals: Deal[];
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${value}`;
};

// Priority definitions for tooltips
const PRIORITY_INFO = {
  Critical: {
    description: 'TDR Score 75+',
    strategy: 'Highest priority for SE engagement. Major architecture decisions pending.',
    color: 'hsl(152, 73%, 45%)', // Emerald
  },
  High: {
    description: 'TDR Score 50-74',
    strategy: 'Strong TDR candidates. Multiple technical factors present.',
    color: 'hsl(161, 50%, 50%)', // Teal
  },
  Medium: {
    description: 'TDR Score 25-49',
    strategy: 'Moderate complexity. Consider for TDR if bandwidth allows.',
    color: 'hsl(38, 65%, 55%)', // Amber
  },
  Low: {
    description: 'TDR Score <25',
    strategy: 'Standard sales-led motion likely sufficient.',
    color: 'hsl(127, 9%, 55%)', // Sage gray
  },
} as const;

// Custom tooltip for the donut chart
const CustomTooltip = ({ active, payload }: { 
  active?: boolean; 
  payload?: Array<{ payload: { name: keyof typeof PRIORITY_INFO; value: number; acv: number } }> 
}) => {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0].payload;
  const info = PRIORITY_INFO[data.name];
  
  return (
    <div className="bg-card border border-border rounded-lg shadow-xl p-4 text-sm min-w-[220px]">
      <div className="flex items-center gap-2 mb-2">
        <div 
          className="h-3 w-3 rounded-full" 
          style={{ backgroundColor: info.color }}
        />
        <span className="font-bold">{data.name} Priority</span>
      </div>
      <p className="text-muted-foreground text-xs mb-2">{info.description}</p>
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-muted-foreground">Pipeline</span>
        <span className="font-bold">{formatCurrency(data.acv)}</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-muted-foreground">Deals</span>
        <span className="font-medium">{data.value}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-3 italic">
        → {info.strategy}
      </p>
    </div>
  );
};

export function TDRPriorityChart({ deals }: TDRPriorityChartProps) {
  // Categorize deals by priority based on TDR score
  const categorized = deals.reduce((acc, deal) => {
    const score = deal.tdrScore ?? calculateTDRScore(deal);
    if (score >= TDR_PRIORITY_THRESHOLDS_NEW.critical) {
      acc.critical.count++;
      acc.critical.acv += deal.acv;
    } else if (score >= TDR_PRIORITY_THRESHOLDS_NEW.high) {
      acc.high.count++;
      acc.high.acv += deal.acv;
    } else if (score >= TDR_PRIORITY_THRESHOLDS_NEW.medium) {
      acc.medium.count++;
      acc.medium.acv += deal.acv;
    } else {
      acc.low.count++;
      acc.low.acv += deal.acv;
    }
    return acc;
  }, {
    critical: { count: 0, acv: 0 },
    high: { count: 0, acv: 0 },
    medium: { count: 0, acv: 0 },
    low: { count: 0, acv: 0 },
  });

  const data = [
    { name: 'Critical' as const, value: categorized.critical.count, acv: categorized.critical.acv, color: PRIORITY_INFO.Critical.color },
    { name: 'High' as const, value: categorized.high.count, acv: categorized.high.acv, color: PRIORITY_INFO.High.color },
    { name: 'Medium' as const, value: categorized.medium.count, acv: categorized.medium.acv, color: PRIORITY_INFO.Medium.color },
    { name: 'Low' as const, value: categorized.low.count, acv: categorized.low.acv, color: PRIORITY_INFO.Low.color },
  ].filter(d => d.value > 0);

  const totalDeals = deals.length;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="h-52">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            TDR Priority
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground/40 cursor-help hover:text-muted-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-sm">
                Distribution of deals by TDR priority score. 
                Higher scores indicate greater technical complexity.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Chart + Legend */}
        <div className="flex items-start gap-6">
          {/* Donut Chart */}
          <div className="w-28 h-28 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <RechartsTooltip content={<CustomTooltip />} />
                <Pie
                  data={data}
                  innerRadius={30}
                  outerRadius={50}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-bold">{totalDeals}</span>
              <span className="text-2xs text-muted-foreground">deals</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2.5 pt-1">
            {data.map((entry) => (
              <Tooltip key={entry.name}>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-between text-sm cursor-help hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div 
                        className="h-2.5 w-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="font-medium">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="font-semibold">{formatCurrency(entry.acv)}</span>
                      <span className="text-muted-foreground text-xs">({entry.value})</span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-sm font-medium mb-1">{PRIORITY_INFO[entry.name].description}</p>
                  <p className="text-xs text-muted-foreground">{PRIORITY_INFO[entry.name].strategy}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
