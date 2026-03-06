/**
 * Propensity Quadrant Scatter — Sprint 28e
 * TDR Score (X) × Win Propensity (Y) scatter plot.
 * Clean 2×2 quadrant grid, axes scale to data.
 * Click a dot to navigate to TDR Workspace.
 */

import { useMemo, useCallback } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ReferenceArea,
  Cell,
  Label,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Deal } from '@/types/tdr';
import { calculateTDRScore } from '@/lib/tdrCriticalFactors';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PropensityQuadrantChartProps {
  deals: Deal[];
}

const QUADRANT_COLORS = {
  HIGH: 'hsl(263, 84%, 55%)',
  MONITOR: 'hsl(280, 60%, 65%)',
  AT_RISK: 'hsl(300, 45%, 55%)',
  NONE: 'hsl(260, 10%, 45%)',
} as const;

const QUADRANT_LABELS: Record<string, string> = {
  HIGH: 'High Win',
  MONITOR: 'Monitor',
  AT_RISK: 'At Risk',
};

const formatCurrency = (val: number) => {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${Math.round(val / 1_000)}K`;
  return `$${val}`;
};

interface ScatterPoint {
  id: string;
  name: string;
  account: string;
  tdrScore: number;
  propensity: number;
  acv: number;
  quadrant: string;
  color: string;
}

const WIN_THRESHOLD = 40;
const COMPLEXITY_THRESHOLD = 50;

function snap(val: number, step: number, dir: 'up' | 'down') {
  return dir === 'up' ? Math.ceil(val / step) * step : Math.floor(val / step) * step;
}

const CustomDot = (props: Record<string, unknown>) => {
  const { cx, cy, payload } = props as { cx: number; cy: number; payload: ScatterPoint };
  if (!cx || !cy) return null;
  const acv = payload?.acv || 0;
  const r = Math.max(3, Math.min(11, Math.sqrt(acv / 5000) * 2));
  return (
    <circle
      cx={cx} cy={cy} r={r}
      fill={payload?.color || QUADRANT_COLORS.NONE}
      fillOpacity={0.55}
      stroke={payload?.color || QUADRANT_COLORS.NONE}
      strokeWidth={1} strokeOpacity={0.8}
      className="cursor-pointer hover:fill-opacity-90"
    />
  );
};

const CustomTooltipContent = ({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: ScatterPoint }>;
}) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const q = QUADRANT_LABELS[d.quadrant] || 'Unscored';
  return (
    <div className="rounded-md bg-popover px-3 py-2.5 text-xs shadow-lg border min-w-[170px] space-y-1">
      <p className="font-semibold text-foreground truncate">{d.account}</p>
      <p className="text-muted-foreground text-[10px] truncate">{d.name}</p>
      <div className="border-t border-border/40 pt-1 mt-1 space-y-0.5">
        <div className="flex justify-between"><span className="text-muted-foreground">TDR Score</span><span className="font-medium">{d.tdrScore}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Win %</span><span className="font-medium">{d.propensity}%</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">ACV</span><span className="font-medium">{formatCurrency(d.acv)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Cohort</span><span className="font-medium" style={{ color: d.color }}>{q}</span></div>
      </div>
      <p className="text-[9px] text-muted-foreground/60 pt-0.5">Click to open TDR</p>
    </div>
  );
};

export function PropensityQuadrantChart({ deals }: PropensityQuadrantChartProps) {
  const navigate = useNavigate();

  const points: ScatterPoint[] = useMemo(() => {
    return deals
      .filter(d => d.propensityScore != null)
      .map(d => {
        const tdr = d.tdrScore ?? calculateTDRScore(d);
        const pct = Math.round((d.propensityScore ?? 0) * 100);
        const q = d.propensityQuadrant || 'NONE';
        return {
          id: d.id, name: d.name, account: d.account,
          tdrScore: tdr, propensity: pct, acv: d.acv,
          quadrant: q,
          color: QUADRANT_COLORS[q as keyof typeof QUADRANT_COLORS] || QUADRANT_COLORS.NONE,
        };
      });
  }, [deals]);

  const { xDomain, yDomain } = useMemo(() => {
    if (points.length === 0) return { xDomain: [0, 100] as [number, number], yDomain: [0, 100] as [number, number] };

    const xs = points.map(p => p.tdrScore);
    const ys = points.map(p => p.propensity);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);

    let x0 = snap(Math.max(0, xMin - 5), 5, 'down');
    let x1 = snap(xMax + 5, 5, 'up');
    if (x0 > COMPLEXITY_THRESHOLD - 5) x0 = snap(COMPLEXITY_THRESHOLD - 10, 5, 'down');
    if (x1 < COMPLEXITY_THRESHOLD + 5) x1 = COMPLEXITY_THRESHOLD + 10;

    let y0 = snap(Math.max(0, yMin - 5), 5, 'down');
    let y1 = snap(Math.min(100, yMax + 5), 5, 'up');
    if (y0 > WIN_THRESHOLD - 5) y0 = snap(WIN_THRESHOLD - 10, 5, 'down');
    if (y1 < WIN_THRESHOLD + 5) y1 = snap(WIN_THRESHOLD + 10, 5, 'up');

    return { xDomain: [x0, x1] as [number, number], yDomain: [y0, y1] as [number, number] };
  }, [points]);

  const handleClick = useCallback((_: unknown, entry: { payload?: ScatterPoint } | undefined) => {
    if (entry?.payload?.id) navigate(`/tdr/${entry.payload.id}`);
  }, [navigate]);

  const scoredCount = points.length;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="h-52">
        <div className="flex items-center gap-2 mb-1">
          <span className="section-header">Deal Positioning</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/40 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm p-3">
              <p className="text-xs mb-2">TDR complexity (X) vs ML win probability (Y). Dot size = ACV. {scoredCount}/{deals.length} scored. Click to open.</p>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="flex items-start gap-1.5"><span className="rounded px-1 py-0.5 text-[9px] font-bold bg-purple-600 text-white shrink-0 mt-px">Prioritize</span> <span className="text-muted-foreground">complex & likely to close, TDR maximizes value</span></div>
                <div className="flex items-start gap-1.5"><span className="rounded px-1 py-0.5 text-[9px] font-bold bg-emerald-600 text-white shrink-0 mt-px">Fast Track</span> <span className="text-muted-foreground">likely to close, low complexity, light-touch TDR</span></div>
                <div className="flex items-start gap-1.5"><span className="rounded px-1 py-0.5 text-[9px] font-bold bg-amber-500 text-amber-950 shrink-0 mt-px">Investigate</span> <span className="text-muted-foreground">complex but unlikely, diagnose blockers first</span></div>
                <div className="flex items-start gap-1.5"><span className="rounded px-1 py-0.5 text-[9px] font-bold bg-slate-600 text-slate-200 shrink-0 mt-px">Deprioritize</span> <span className="text-muted-foreground">low complexity & probability, monitor only</span></div>
              </div>
            </TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-3 ml-auto">
            {(['HIGH', 'MONITOR', 'AT_RISK'] as const).map(q => (
              <span key={q} className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: QUADRANT_COLORS[q] }} />
                <span className="text-[9px] text-muted-foreground">{QUADRANT_LABELS[q]}</span>
              </span>
            ))}
          </div>
        </div>

        {scoredCount === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground/50">No ML scores available yet</p>
          </div>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 5, right: 10, bottom: 20, left: 20 }}>
                {/* Two-band background */}
                <ReferenceArea x1={xDomain[0]} x2={xDomain[1]} y1={WIN_THRESHOLD} y2={yDomain[1]} fill="hsl(263, 50%, 50%)" fillOpacity={0.035} />
                <ReferenceArea x1={xDomain[0]} x2={xDomain[1]} y1={yDomain[0]} y2={WIN_THRESHOLD} fill="hsl(300, 30%, 50%)" fillOpacity={0.035} />

                <XAxis
                  type="number" dataKey="tdrScore" name="TDR Score"
                  domain={xDomain}
                  axisLine={false} tickLine={false}
                  tick={{ fontSize: 9, fill: 'hsl(260, 10%, 55%)' }}
                >
                  <Label value="TDR Complexity →" position="bottom" offset={4}
                    style={{ fontSize: 10, fill: 'hsl(260, 10%, 45%)', fontWeight: 500 }} />
                </XAxis>
                <YAxis
                  type="number" dataKey="propensity" name="Win %"
                  domain={yDomain}
                  axisLine={false} tickLine={false}
                  tick={{ fontSize: 9, fill: 'hsl(260, 10%, 55%)' }}
                  width={30}
                  tickFormatter={(v: number) => `${v}%`}
                >
                  <Label value="Win %" position="left" angle={-90} offset={4}
                    style={{ fontSize: 10, fill: 'hsl(260, 10%, 45%)', fontWeight: 500, textAnchor: 'middle' }} />
                </YAxis>
                <ZAxis type="number" dataKey="acv" range={[20, 300]} />
                <RechartsTooltip content={<CustomTooltipContent />} />

                {/* Quadrant dividers */}
                <ReferenceLine y={WIN_THRESHOLD} stroke="hsl(260, 20%, 50%)" strokeDasharray="4 3" strokeOpacity={0.35} />
                <ReferenceLine x={COMPLEXITY_THRESHOLD} stroke="hsl(260, 15%, 45%)" strokeDasharray="4 3" strokeOpacity={0.25} />

                {/* Quadrant labels — pinned to far edges of each quadrant */}
                <ReferenceArea
                  x1={COMPLEXITY_THRESHOLD + (xDomain[1] - COMPLEXITY_THRESHOLD) * 0.3}
                  x2={xDomain[1]}
                  y1={WIN_THRESHOLD + (yDomain[1] - WIN_THRESHOLD) * 0.75}
                  y2={yDomain[1]}
                  label={{ value: 'PRIORITIZE', fontSize: 8, fill: 'hsl(260, 20%, 55%)', opacity: 0.55, fontWeight: 600 }}
                  fill="transparent" />
                <ReferenceArea
                  x1={xDomain[0]}
                  x2={xDomain[0] + (COMPLEXITY_THRESHOLD - xDomain[0]) * 0.4}
                  y1={WIN_THRESHOLD + (yDomain[1] - WIN_THRESHOLD) * 0.75}
                  y2={yDomain[1]}
                  label={{ value: 'FAST TRACK', fontSize: 8, fill: 'hsl(260, 20%, 55%)', opacity: 0.55, fontWeight: 600 }}
                  fill="transparent" />
                <ReferenceArea
                  x1={COMPLEXITY_THRESHOLD + (xDomain[1] - COMPLEXITY_THRESHOLD) * 0.3}
                  x2={xDomain[1]}
                  y1={yDomain[0]}
                  y2={yDomain[0] + (WIN_THRESHOLD - yDomain[0]) * 0.3}
                  label={{ value: 'INVESTIGATE', fontSize: 8, fill: 'hsl(260, 20%, 55%)', opacity: 0.55, fontWeight: 600 }}
                  fill="transparent" />
                <ReferenceArea
                  x1={xDomain[0]}
                  x2={xDomain[0] + (COMPLEXITY_THRESHOLD - xDomain[0]) * 0.4}
                  y1={yDomain[0]}
                  y2={yDomain[0] + (WIN_THRESHOLD - yDomain[0]) * 0.3}
                  label={{ value: 'DEPRIORITIZE', fontSize: 8, fill: 'hsl(260, 20%, 55%)', opacity: 0.55, fontWeight: 600 }}
                  fill="transparent" />

                <Scatter data={points} shape={<CustomDot />} onClick={handleClick}>
                  {points.map((p) => (
                    <Cell key={p.id} fill={p.color} fillOpacity={0.55} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
