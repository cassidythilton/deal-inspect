import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Deal } from '@/types/tdr';

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

export function TDRPriorityChart({ deals }: TDRPriorityChartProps) {
  // Categorize deals by priority based on TDR score
  const highPriority = deals.filter(d => calculateTDRScore(d) >= 40);
  const mediumPriority = deals.filter(d => {
    const score = calculateTDRScore(d);
    return score >= 30 && score < 40;
  });
  const lowPriority = deals.filter(d => calculateTDRScore(d) < 30);

  const highACV = highPriority.reduce((sum, d) => sum + d.acv, 0);
  const mediumACV = mediumPriority.reduce((sum, d) => sum + d.acv, 0);
  const lowACV = lowPriority.reduce((sum, d) => sum + d.acv, 0);

  const data = [
    { name: 'High', value: highPriority.length, acv: highACV, color: 'hsl(152, 73%, 40%)' },
    { name: 'Medium', value: mediumPriority.length, acv: mediumACV, color: 'hsl(217, 91%, 60%)' },
    { name: 'Low', value: lowPriority.length, acv: lowACV, color: 'hsl(217, 30%, 75%)' },
  ].filter(d => d.value > 0);

  return (
    <div className="h-32">
      <div className="section-header mb-2">TDR PRIORITY</div>
      <div className="flex items-center gap-4">
        <div className="w-20 h-20">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
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
            <div key={entry.name} className="flex items-center justify-between text-xs">
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
          ))}
        </div>
      </div>
    </div>
  );
}

