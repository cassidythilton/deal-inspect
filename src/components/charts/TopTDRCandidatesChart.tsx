import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList, Tooltip as RechartsTooltip } from 'recharts';
import { Deal } from '@/types/tdr';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getTDRPriorityLabel } from '@/lib/tooltips';

interface TopTDRCandidatesChartProps {
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

// Custom tooltip component
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { fullName: string; account: string; score: number; acv: number; stage: string; dealName: string } }> }) => {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0].payload;
  const priority = getTDRPriorityLabel(data.score);
  
  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm max-w-[250px]">
      <p className="font-semibold">{data.fullName}</p>
      <p className="text-muted-foreground text-xs">{data.dealName}</p>
      <p className="mt-1">
        <span className="font-medium">TDR: {data.score}</span>
        <span className="text-muted-foreground ml-1">({priority})</span>
      </p>
      <p className="text-muted-foreground text-xs mt-1">
        {formatCurrency(data.acv)} • {data.stage}
      </p>
    </div>
  );
};

export function TopTDRCandidatesChart({ deals }: TopTDRCandidatesChartProps) {
  const data = deals
    .map((deal) => ({
      name: deal.account.length > 15 ? deal.account.substring(0, 15) + '...' : deal.account,
      score: calculateTDRScore(deal),
      fullName: deal.account,
      dealName: deal.dealName,
      acv: deal.acv,
      stage: deal.stage.includes('Validation') ? 'Validation' : 
             deal.stage.includes('Discovery') ? 'Discovery' : 
             deal.stage.includes('Closing') ? 'Closing' : deal.stage,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Find the max score to display range
  const maxScore = Math.max(...data.map(d => d.score), 50);
  const minScore = Math.min(...data.map(d => d.score));

  return (
    <TooltipProvider>
      <div className="h-36">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <span className="section-header">TOP TDR CANDIDATES</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">
                  Deals with the highest TDR priority scores based on technical complexity, partner involvement, and strategic value.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-xs text-muted-foreground">Range: {minScore}–{maxScore}</span>
        </div>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
            <XAxis type="number" domain={[0, 50]} hide />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              width={100}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--secondary))' }} />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={14} fill="hsl(217, 91%, 60%)">
              <LabelList 
                dataKey="score" 
                position="right" 
                style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TooltipProvider>
  );
}
