/**
 * Top TDR Candidates Chart
 * Horizontal bar chart showing deals with highest TDR priority scores
 * Rebuilt with improved spacing and readability
 */

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList, Tooltip as RechartsTooltip } from 'recharts';
import { Deal } from '@/types/tdr';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { calculateTDRScore, getPriorityFromScore } from '@/lib/tdrCriticalFactors';

interface TopTDRCandidatesChartProps {
  deals: Deal[];
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${value}`;
};

// Get bar color based on score
const getBarColor = (score: number): string => {
  if (score >= 75) return 'hsl(152, 73%, 45%)';  // Emerald
  if (score >= 50) return 'hsl(161, 50%, 50%)';  // Teal
  if (score >= 35) return 'hsl(38, 65%, 55%)';   // Amber
  return 'hsl(217, 30%, 60%)';                    // Gray-blue
};

// Custom tooltip component with rich information
const CustomTooltip = ({ active, payload }: { 
  active?: boolean; 
  payload?: Array<{ payload: ChartDataPoint }> 
}) => {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0].payload;
  const priority = getPriorityFromScore(data.score);
  
  return (
    <div className="bg-card border border-border rounded-lg shadow-xl p-4 text-sm min-w-[220px]">
      <p className="font-bold text-foreground">{data.fullName}</p>
      <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{data.dealName}</p>
      <div className="mt-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">TDR Score</span>
          <span className="font-bold text-lg">{data.score}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-muted-foreground">Priority</span>
          <span className={`font-medium ${
            priority === 'CRITICAL' ? 'text-emerald-600' :
            priority === 'HIGH' ? 'text-teal-600' :
            priority === 'MEDIUM' ? 'text-amber-600' : 'text-muted-foreground'
          }`}>{priority}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-muted-foreground">ACV</span>
          <span className="font-medium">{formatCurrency(data.acv)}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-muted-foreground">Stage</span>
          <span className="font-medium">{data.stage}</span>
        </div>
      </div>
    </div>
  );
};

interface ChartDataPoint {
  name: string;
  score: number;
  fullName: string;
  dealName: string;
  acv: number;
  stage: string;
  fill: string;
}

export function TopTDRCandidatesChart({ deals }: TopTDRCandidatesChartProps) {
  // Sort by TDR score and take top 5
  const data: ChartDataPoint[] = deals
    .map((deal) => {
      const score = deal.tdrScore ?? calculateTDRScore(deal);
      return {
        // Show more of the account name for readability
        name: deal.account.length > 20 ? deal.account.substring(0, 20) + '...' : deal.account,
        score,
        fullName: deal.account,
        dealName: deal.dealName,
        acv: deal.acv,
        stage: deal.stage.replace(/^\d+:\s*/, ''), // Remove "2: " prefix if present
        fill: getBarColor(score),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Calculate range for display
  const maxScore = data.length > 0 ? Math.max(...data.map(d => d.score)) : 50;
  const minScore = data.length > 0 ? Math.min(...data.map(d => d.score)) : 0;

  if (data.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
        No deals to display
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="h-52">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Top TDR Candidates
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/40 cursor-help hover:text-muted-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">
                  Deals ranked by TDR priority score. Higher scores indicate greater 
                  technical complexity and opportunity for SE engagement.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Range: {minScore}–{maxScore}
          </span>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height="85%">
          <BarChart 
            data={data} 
            layout="vertical" 
            margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              width={130}
              tick={{ 
                fontSize: 12, 
                fill: 'hsl(var(--foreground))',
                fontWeight: 500,
              }}
            />
            <RechartsTooltip 
              content={<CustomTooltip />} 
              cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.3 }} 
            />
            <Bar 
              dataKey="score" 
              radius={[0, 6, 6, 0]} 
              barSize={22}
            >
              <LabelList 
                dataKey="score" 
                position="right" 
                style={{ 
                  fontSize: 12, 
                  fill: 'hsl(var(--muted-foreground))',
                  fontWeight: 600,
                }} 
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TooltipProvider>
  );
}
