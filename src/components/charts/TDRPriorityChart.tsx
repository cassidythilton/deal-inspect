import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Deal } from '@/types/tdr';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TDR_SCORE_TOOLTIPS } from '@/lib/tooltips';

interface TDRPriorityChartProps {
  deals: Deal[];
}

// Calculate TDR score for a deal
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

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${value}`;
};

// Priority tooltip text
const PRIORITY_TOOLTIPS: Record<string, string> = {
  Critical: TDR_SCORE_TOOLTIPS.critical,
  High: TDR_SCORE_TOOLTIPS.high,
  Medium: TDR_SCORE_TOOLTIPS.medium,
  Low: TDR_SCORE_TOOLTIPS.low,
};

// Custom tooltip for the donut chart
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; acv: number } }> }) => {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0].payload;
  const tooltipText = PRIORITY_TOOLTIPS[data.name] || '';
  
  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm max-w-[300px]">
      <p className="text-sm whitespace-pre-wrap">{tooltipText}</p>
    </div>
  );
};

export function TDRPriorityChart({ deals }: TDRPriorityChartProps) {
  // Categorize deals by priority based on TDR score (using correct thresholds)
  const criticalPriority = deals.filter(d => calculateTDRScore(d) >= 75);
  const highPriority = deals.filter(d => {
    const score = calculateTDRScore(d);
    return score >= 50 && score < 75;
  });
  const mediumPriority = deals.filter(d => {
    const score = calculateTDRScore(d);
    return score >= 35 && score < 50;
  });
  const lowPriority = deals.filter(d => calculateTDRScore(d) < 35);

  const criticalACV = criticalPriority.reduce((sum, d) => sum + d.acv, 0);
  const highACV = highPriority.reduce((sum, d) => sum + d.acv, 0);
  const mediumACV = mediumPriority.reduce((sum, d) => sum + d.acv, 0);
  const lowACV = lowPriority.reduce((sum, d) => sum + d.acv, 0);

  const data = [
    { name: 'Critical', value: criticalPriority.length, acv: criticalACV, color: 'hsl(0, 72%, 51%)' },
    { name: 'High', value: highPriority.length, acv: highACV, color: 'hsl(38, 92%, 50%)' },
    { name: 'Medium', value: mediumPriority.length, acv: mediumACV, color: 'hsl(217, 91%, 60%)' },
    { name: 'Low', value: lowPriority.length, acv: lowACV, color: 'hsl(217, 30%, 75%)' },
  ].filter(d => d.value > 0);

  return (
    <TooltipProvider>
      <div className="h-36">
        <div className="flex items-center gap-1 mb-2">
          <span className="section-header">TDR PRIORITY</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-sm">
                Distribution of deals by TDR priority score. Hover over segments for priority definitions.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <RechartsTooltip content={<CustomTooltip />} />
                <Pie
                  data={data}
                  innerRadius={22}
                  outerRadius={38}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5">
            {data.map((entry) => (
              <Tooltip key={entry.name}>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-between text-xs cursor-help">
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-2 w-2 rounded-full" 
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-muted-foreground">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{formatCurrency(entry.acv)}</span>
                      <span className="text-muted-foreground">({entry.value})</span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-sm whitespace-pre-wrap">{PRIORITY_TOOLTIPS[entry.name]}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
