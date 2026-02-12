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

// Get bar color based on score — purple gradient
const getBarColor = (score: number): string => {
  if (score >= 75) return 'hsl(263, 84%, 55%)';  // Deep violet
  if (score >= 50) return 'hsl(280, 60%, 50%)';  // Purple
  if (score >= 25) return 'hsl(300, 45%, 65%)';  // Magenta-lavender
  return 'hsl(260, 15%, 65%)';                    // Muted purple-gray
};

// Custom tooltip — compact, matching backup
const CustomTooltip = ({ active, payload }: { 
  active?: boolean; 
  payload?: Array<{ payload: ChartDataPoint }> 
}) => {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0].payload;
  const priority = getPriorityFromScore(data.score);
  
  return (
    <div className="rounded-md bg-popover px-3 py-2 text-xs shadow-md border">
      <div className="font-medium">{data.fullName}</div>
      <div className="text-muted-foreground">{data.dealName}</div>
      <div className="flex items-center gap-2 mt-1">
        <span className="font-semibold">TDR: {data.score}</span>
        <span className="text-muted-foreground">({priority})</span>
      </div>
      <div className="text-muted-foreground mt-0.5">
        {formatCurrency(data.acv)} • {data.stage}
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
        name: deal.account.length > 18 ? deal.account.substring(0, 18) + '...' : deal.account,
        score,
        fullName: deal.account,
        dealName: deal.dealName,
        acv: deal.acv,
        stage: deal.stage.replace(/^\d+:\s*/, ''),
        fill: getBarColor(score),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Range label
  const maxScore = data.length > 0 ? Math.max(...data.map(d => d.score)) : 50;
  const minScore = data.length > 0 ? Math.min(...data.map(d => d.score)) : 0;
  const rangeLabel = minScore === maxScore ? `All scoring ${maxScore}` : `Range: ${minScore}–${maxScore}`;

  if (data.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="section-header">Top TDR Candidates</span>
        </div>
        <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
          No deal data
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-2">
        {/* Header — matching backup */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="section-header">Top TDR Candidates</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">
                  <strong>Top 5 deals by TDR Score</strong><br />
                  Color indicates priority cohort:<br />
                  • <span className="text-red-500">Red</span>: Critical (75+)<br />
                  • <span className="text-amber-500">Amber</span>: High (50-74)<br />
                  • <span className="text-sky-500">Blue</span>: Medium (25-49)<br />
                  • <span className="text-gray-400">Gray</span>: Low (&lt;25)
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-2xs text-muted-foreground">{rangeLabel}</span>
        </div>

        {/* Chart — backup uses h-28 */}
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={data} 
              layout="vertical" 
              margin={{ top: 0, right: 35, bottom: 0, left: 0 }}
            >
              <XAxis type="number" hide domain={[0, 100]} />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                width={100}
                tick={{ 
                  fontSize: 10, 
                  fill: 'hsl(260, 10%, 55%)',
                }}
              />
              <RechartsTooltip 
                content={<CustomTooltip />} 
                cursor={{ fill: 'hsl(260, 15%, 95%)', radius: 4 }} 
              />
              <Bar 
                dataKey="score" 
                radius={[0, 4, 4, 0]} 
              >
                <LabelList 
                  dataKey="score" 
                  position="right" 
                  style={{ 
                    fontSize: 10, 
                    fill: 'hsl(260, 10%, 50%)',
                  }}
                  formatter={(v: number) => v.toString()}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </TooltipProvider>
  );
}
