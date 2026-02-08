import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Deal } from '@/types/tdr';

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

export function TopTDRCandidatesChart({ deals }: TopTDRCandidatesChartProps) {
  const data = deals
    .map((deal) => ({
      name: deal.account.length > 15 ? deal.account.substring(0, 15) + '...' : deal.account,
      score: calculateTDRScore(deal),
      fullName: deal.account,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Find the max score to display range
  const maxScore = Math.max(...data.map(d => d.score), 50);

  return (
    <div className="h-32">
      <div className="flex items-center justify-between mb-2">
        <span className="section-header">TOP TDR CANDIDATES</span>
        <span className="text-xs text-muted-foreground">Range: {Math.min(...data.map(d => d.score))}-{maxScore}</span>
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
  );
}

