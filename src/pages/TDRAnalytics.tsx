/**
 * Sprint 17.6 — TDR Portfolio Analytics Page + NLQ
 *
 * Surfaces portfolio-level patterns from structured TDR data
 * (V_TDR_ANALYTICS view). Includes an NLQ hero bar ("Ask Your TDR Data")
 * powered by the askAnalyst Code Engine function (Cortex AI_COMPLETE).
 */

import { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip,
  PieChart, Pie, Cell, Legend, LabelList,
} from 'recharts';
import { cortexAi, AnalystResult } from '@/lib/cortexAi';
import { snowflakeStore, SnowflakeSession } from '@/lib/snowflakeStore';
import { Info, Search, Loader2, Sparkles, Table2, BarChart3, MessageSquareText, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ─── Chart colour palettes ─────────────────────────────────────────────────

const PIE_COLORS = [
  'hsl(263, 84%, 58%)', // vivid violet
  'hsl(280, 60%, 50%)', // purple
  'hsl(300, 45%, 65%)', // magenta-lavender
  'hsl(240, 55%, 58%)', // indigo
  'hsl(340, 55%, 55%)', // rose-magenta
  'hsl(255, 50%, 72%)', // soft lavender
  'hsl(320, 50%, 55%)', // fuchsia
  'hsl(260, 15%, 65%)', // muted purple-gray
];

const BAR_COLOR = 'hsl(263, 84%, 58%)';
const BAR_SECONDARY = 'hsl(280, 60%, 50%)';

// ─── Suggested questions ────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  'What are our most common competitors across all TDRs?',
  'Which cloud platforms appear most frequently?',
  'What is the average ACV for deals with Snowflake as the platform?',
  'How many TDR sessions are in progress vs completed?',
  'What are the top risk categories across deals?',
  'Which Domo capabilities are most in demand?',
  'Show me deals where the verdict is Proceed ordered by ACV',
  'What is the proceed rate across all TDRs?',
];

// ─── NLQ Result Table ───────────────────────────────────────────────────────

function ResultTable({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
  if (!columns.length || !rows.length) return null;

  const formatCell = (val: unknown): string => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'number') {
      if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 1_000) return `$${Math.round(val / 1_000)}K`;
      if (Number.isInteger(val)) return val.toLocaleString();
      return val.toFixed(2);
    }
    return String(val);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-[#2a2540]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#2a2540] bg-[#1B1630]">
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row, i) => (
            <tr key={i} className={cn('border-b border-[#2a2540]/50', i % 2 === 0 ? 'bg-[#0f0d17]' : 'bg-[#13111d]')}>
              {columns.map((col) => (
                <td key={col} className="px-3 py-1.5 text-slate-300 whitespace-nowrap">
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 && (
        <p className="px-3 py-1.5 text-[10px] text-slate-500">Showing first 50 of {rows.length} rows</p>
      )}
    </div>
  );
}

// ─── Auto-chart: tries to render a bar chart when the shape fits ────────────

function AutoChart({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
  // Need at least one string column and one numeric column
  if (columns.length < 2 || rows.length < 2 || rows.length > 20) return null;

  const labelCol = columns.find((c) => typeof rows[0][c] === 'string');
  const valueCols = columns.filter((c) => typeof rows[0][c] === 'number');
  if (!labelCol || valueCols.length === 0) return null;

  const data = rows.map((r) => ({
    name: String(r[labelCol]).length > 25 ? String(r[labelCol]).substring(0, 25) + '…' : String(r[labelCol]),
    ...Object.fromEntries(valueCols.map((vc) => [vc, Number(r[vc]) || 0])),
  }));

  return (
    <div className="mt-3 rounded-lg border border-[#2a2540] bg-[#0f0d17] p-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <BarChart3 className="inline h-3 w-3 mr-1" />
        Auto-generated chart
      </p>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 10 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(260, 12%, 50%)' }} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fontSize: 10, fill: 'hsl(260, 12%, 50%)' }}
              axisLine={false}
              tickLine={false}
            />
            <RechartsTooltip
              contentStyle={{ backgroundColor: '#1B1630', border: '1px solid #2a2540', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#fff' }}
            />
            {valueCols.map((vc, i) => (
              <Bar key={vc} dataKey={vc} fill={i === 0 ? BAR_COLOR : BAR_SECONDARY} radius={[0, 4, 4, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, tooltip }: { label: string; value: string | number; sub?: string; tooltip?: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="stat-card">
        <div className="flex items-center gap-1">
          <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </TooltipProvider>
  );
}

// ─── Horizontal Bar Chart Section ───────────────────────────────────────────

function HBarSection({
  title,
  tooltip,
  data,
  color = BAR_COLOR,
}: {
  title: string;
  tooltip: string;
  data: { name: string; count: number }[];
  color?: string;
}) {
  if (!data.length) {
    return (
      <div className="stat-card">
        <div className="flex items-center gap-2">
          <span className="section-header">{title}</span>
        </div>
        <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
          No data yet — complete more TDRs
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="stat-card">
        <div className="flex items-center gap-2 mb-2">
          <span className="section-header">{title}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 35, bottom: 0, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                width={110}
                tick={{ fontSize: 10, fill: 'hsl(260, 10%, 55%)' }}
              />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#1B1630', border: '1px solid #2a2540', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: 'hsl(260, 10%, 50%)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ─── Donut Chart Section ────────────────────────────────────────────────────

function DonutSection({
  title,
  tooltip,
  data,
}: {
  title: string;
  tooltip: string;
  data: { name: string; value: number }[];
}) {
  if (!data.length) {
    return (
      <div className="stat-card">
        <div className="flex items-center gap-2">
          <span className="section-header">{title}</span>
        </div>
        <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
          No data yet — complete more TDRs
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="stat-card">
        <div className="flex items-center gap-2 mb-2">
          <span className="section-header">{title}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        </div>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.slice(0, 6)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={55}
                paddingAngle={2}
                stroke="none"
              >
                {data.slice(0, 6).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconSize={8}
                wrapperStyle={{ fontSize: 10, color: 'hsl(260, 10%, 55%)' }}
              />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#1B1630', border: '1px solid #2a2540', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function TDRAnalytics() {
  // NLQ state
  const [question, setQuestion] = useState('');
  const [nlqResult, setNlqResult] = useState<AnalystResult | null>(null);
  const [nlqLoading, setNlqLoading] = useState(false);
  const [nlqHistory, setNlqHistory] = useState<{ q: string; r: AnalystResult }[]>([]);

  // Chart data state — loaded once via NLQ queries on mount
  const [chartData, setChartData] = useState<{
    competitors: { name: string; count: number }[];
    platforms: { name: string; value: number }[];
    entryLayers: { name: string; count: number }[];
    risks: { name: string; count: number }[];
    verdicts: { name: string; value: number }[];
    useCases: { name: string; count: number }[];
    stats: {
      totalTDRs: number;
      completedTDRs: number;
      inProgressTDRs: number;
      avgACV: number;
      proceedRate: string;
    };
  } | null>(null);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsLoaded, setChartsLoaded] = useState(false);

  // ── Load chart data ───────────────────────────────────────────────────────

  const loadChartData = useCallback(async () => {
    if (chartsLoaded || chartsLoading) return;
    setChartsLoading(true);

    try {
      // PRIMARY: Get session data directly from Snowflake (deterministic, no NLQ)
      const sessions: SnowflakeSession[] = await snowflakeStore.getAllSessions();
      console.log(`[TDRAnalytics] Loaded ${sessions.length} sessions from Snowflake`);

      const completedSessions = sessions.filter(s => s.status === 'completed');
      const inProgressSessions = sessions.filter(s => s.status === 'in-progress');
      const totalTDRs = sessions.length;
      const completedTDRs = completedSessions.length;
      const inProgressTDRs = inProgressSessions.length;
      const totalACV = sessions.reduce((sum, s) => sum + (s.acv || 0), 0);
      const avgACV = totalTDRs > 0 ? Math.round(totalACV / totalTDRs) : 0;
      const proceedRate = totalTDRs > 0 ? `${Math.round((completedTDRs / totalTDRs) * 100)}%` : '—';

      // SECONDARY: Try NLQ for competitor data (best-effort, non-blocking)
      const competitors: { name: string; count: number }[] = [];
      try {
        const competitorsRes = await cortexAi.askAnalyst(
          'List all named competitors across all TDR structured extracts. Show competitor name and count of how many deals mention them, ordered by count descending. Limit to top 10.'
        );
        if (competitorsRes.success && competitorsRes.rows.length > 0) {
          for (const row of competitorsRes.rows) {
            const vals = Object.values(row);
            if (vals.length >= 2) {
              competitors.push({ name: String(vals[0]), count: Number(vals[1]) || 0 });
            }
          }
        }
      } catch (nlqErr) {
        console.warn('[TDRAnalytics] NLQ competitor query failed (non-fatal):', nlqErr);
      }

      // Build verdict distribution from session outcomes
      const outcomeMap = new Map<string, number>();
      for (const s of sessions) {
        const label = s.status === 'completed' ? (s.outcome || 'Completed') : 'In Progress';
        outcomeMap.set(label, (outcomeMap.get(label) || 0) + 1);
      }

      setChartData({
        competitors,
        platforms: [],  // Will populate as more TDR data accumulates
        entryLayers: [],
        risks: [],
        verdicts: Array.from(outcomeMap.entries())
          .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
          .filter((d) => d.value > 0),
        useCases: [],
        stats: { totalTDRs, completedTDRs, inProgressTDRs, avgACV, proceedRate },
      });
    } catch (err) {
      console.error('[TDRAnalytics] Failed to load chart data:', err);
    }

    setChartsLoading(false);
    setChartsLoaded(true);
  }, [chartsLoaded, chartsLoading]);

  // Auto-load on mount
  useMemo(() => { loadChartData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── NLQ submit ────────────────────────────────────────────────────────────

  const handleAsk = useCallback(async (q?: string) => {
    const query = q || question.trim();
    if (!query) return;

    setNlqLoading(true);
    setNlqResult(null);

    try {
      const result = await cortexAi.askAnalyst(query);
      setNlqResult(result);
      setNlqHistory((prev) => [{ q: query, r: result }, ...prev].slice(0, 10));
    } catch (err) {
      console.error('[TDRAnalytics] NLQ failed:', err);
      setNlqResult({ success: false, columns: [], rows: [], error: String(err) });
    }

    setNlqLoading(false);
  }, [question]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = chartData?.stats;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">TDR Portfolio Analytics</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Patterns across all Technical Deal Reviews
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => { setChartsLoaded(false); loadChartData(); }}
            disabled={chartsLoading}
          >
            {chartsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
            Refresh Data
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-5">

        {/* ── NLQ Hero Bar ─────────────────────────────────────────────────── */}
        <section className="rounded-lg border bg-[#1B1630] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Ask Your TDR Data</h2>
            <span className="text-[10px] text-violet-400/70 ml-1">Powered by Cortex AI</span>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Ask a question about your TDR portfolio…"
                className="pl-9 bg-[#0f0d17] border-[#2a2540] text-sm h-9"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={nlqLoading}
              />
            </div>
            <Button
              size="sm"
              className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white h-9"
              onClick={() => handleAsk()}
              disabled={nlqLoading || !question.trim()}
            >
              {nlqLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
              Ask
            </Button>
          </div>

          {/* Suggested questions */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {SUGGESTED_QUESTIONS.slice(0, 4).map((sq, i) => (
              <button
                key={i}
                className="rounded-full border border-[#2a2540] bg-[#0f0d17] px-2.5 py-1 text-[10px] text-slate-400 hover:text-white hover:border-violet-500/50 transition-colors"
                onClick={() => { setQuestion(sq); handleAsk(sq); }}
                disabled={nlqLoading}
              >
                {sq}
              </button>
            ))}
          </div>

          {/* NLQ Result */}
          {nlqLoading && (
            <div className="flex items-center gap-2 mt-4 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing your question…
            </div>
          )}

          {nlqResult && !nlqLoading && (
            <div className="mt-4 space-y-3">
              {nlqResult.error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {nlqResult.error}
                </div>
              ) : (
                <>
                  {/* Natural language answer */}
                  {nlqResult.answer && (
                    <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3">
                      <div className="flex items-start gap-2">
                        <MessageSquareText className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-200 leading-relaxed">{nlqResult.answer}</p>
                      </div>
                    </div>
                  )}

                  {/* Auto chart */}
                  {nlqResult.columns.length >= 2 && nlqResult.rows.length >= 2 && (
                    <AutoChart columns={nlqResult.columns} rows={nlqResult.rows} />
                  )}

                  {/* Result table */}
                  {nlqResult.rows.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Table2 className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {nlqResult.rows.length} result{nlqResult.rows.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <ResultTable columns={nlqResult.columns} rows={nlqResult.rows} />
                    </div>
                  )}

                  {/* SQL (collapsed) */}
                  {nlqResult.sql && (
                    <details className="text-[10px] text-slate-600">
                      <summary className="cursor-pointer hover:text-slate-400">View generated SQL</summary>
                      <pre className="mt-1 rounded bg-[#0f0d17] p-2 overflow-x-auto text-[10px] text-slate-500">
                        {nlqResult.sql}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </div>
          )}

          {/* NLQ History */}
          {nlqHistory.length > 1 && (
            <details className="mt-3 text-[10px] text-slate-600">
              <summary className="cursor-pointer hover:text-slate-400">Previous questions ({nlqHistory.length})</summary>
              <div className="mt-1 space-y-1">
                {nlqHistory.slice(1).map((h, i) => (
                  <button
                    key={i}
                    className="block w-full text-left text-slate-500 hover:text-white truncate"
                    onClick={() => { setQuestion(h.q); setNlqResult(h.r); }}
                  >
                    → {h.q}
                  </button>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* ── Stat Cards ───────────────────────────────────────────────────── */}
        {chartsLoading && !chartData && (
          <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading analytics data…
          </div>
        )}

        {chartData && (
          <>
            <section className="grid grid-cols-4 gap-3">
              <StatCard
                label="Total TDRs"
                value={stats?.totalTDRs ?? 0}
                sub={`${stats?.completedTDRs ?? 0} completed`}
                tooltip="Total TDR sessions created across all deals"
              />
              <StatCard
                label="In Progress"
                value={stats?.inProgressTDRs ?? 0}
                sub="active reviews"
                tooltip="TDR sessions currently in progress"
              />
              <StatCard
                label="Completion Rate"
                value={stats?.proceedRate ?? '—'}
                sub="of all TDRs"
                tooltip="Percentage of TDR sessions that reached completed status"
              />
              <StatCard
                label="Avg ACV"
                value={stats?.avgACV ? (stats.avgACV >= 1_000_000 ? `$${(stats.avgACV / 1_000_000).toFixed(1)}M` : stats.avgACV >= 1_000 ? `$${Math.round(stats.avgACV / 1_000)}K` : `$${stats.avgACV}`) : '—'}
                sub="across all TDR deals"
                tooltip="Average Annual Contract Value of deals with TDR sessions"
              />
            </section>

            {/* ── Row 1: Platform & Competitive ─────────────────────────────── */}
            <section className="grid grid-cols-2 gap-3">
              <DonutSection
                title="TDR Status Distribution"
                tooltip="Breakdown of TDR sessions by current status"
                data={chartData.verdicts}
              />
              <HBarSection
                title="Top Competitors"
                tooltip="Most frequently named competitors across all TDR structured extracts"
                data={chartData.competitors}
                color="hsl(340, 60%, 55%)"
              />
            </section>

            {/* ── Row 2: Entry Layers & Risk ─────────────────────────────────── */}
            <section className="grid grid-cols-2 gap-3">
              <HBarSection
                title="Cloud Platforms"
                tooltip="Cloud platforms most frequently identified in TDR sessions"
                data={chartData.platforms}
                color="hsl(199, 75%, 52%)"
              />
              <HBarSection
                title="Risk Categories"
                tooltip="Most common risk categories identified across all TDR sessions"
                data={chartData.risks}
                color="hsl(38, 65%, 55%)"
              />
            </section>

            {/* ── Row 3: Domo Positioning ────────────────────────────────────── */}
            <section className="grid grid-cols-2 gap-3">
              <HBarSection
                title="Domo Entry Layers"
                tooltip="How Domo enters the customer's stack across TDR sessions"
                data={chartData.entryLayers}
              />
              <HBarSection
                title="Domo Capabilities in Demand"
                tooltip="Most requested Domo capabilities identified in TDR sessions"
                data={chartData.useCases}
                color="hsl(263, 84%, 58%)"
              />
            </section>
          </>
        )}

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {chartsLoaded && (!chartData || chartData.stats.totalTDRs === 0) && (
          <div className="rounded-lg border bg-[#1B1630] p-8 text-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-semibold mb-1">No TDR Analytics Yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Complete a TDR to start seeing portfolio patterns. Analytics are extracted automatically
              when a TDR is marked complete, or manually via the "Extract Analytics" button in the
              Intelligence panel.
            </p>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

