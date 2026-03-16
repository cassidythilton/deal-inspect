/**
 * Sprint 35 — TDR Admin: Activity Log + Usage Metrics + NLQ Analyst
 *
 * Consolidates the former History (mock) and Analytics pages into a single
 * admin surface with three tabs:
 *   1. Activity Log — all TDR sessions with input/chat counts
 *   2. Usage — leaderboard, stat cards, weekly activity
 *   3. Analyst — NLQ powered by Cortex AI (lifted from TDRAnalytics)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip,
  LabelList,
} from 'recharts';
import {
  Search, Loader2, BarChart3, ArrowRight, Sparkles, Table2,
  MessageSquareText, Users, Clock, FileText, ChevronRight,
  RefreshCw, Activity, Trophy, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { snowflakeStore } from '@/lib/snowflakeStore';
import type { AdminSession, UsageMetrics } from '@/lib/snowflakeStore';
import { cortexAi, AnalystResult } from '@/lib/cortexAi';
import { parseCompletedSteps } from '@/lib/snowflakeStore';
import { useNavigate } from 'react-router-dom';

const BAR_COLOR = 'hsl(263, 84%, 58%)';

const SUGGESTED_QUESTIONS = [
  'What are our most common competitors across all TDRs?',
  'Which cloud platforms appear most frequently?',
  'How many TDR sessions are in progress vs completed?',
  'What is the proceed rate across all TDRs?',
];

function formatAcv(acv: number): string {
  if (acv >= 1_000_000) return `$${(acv / 1_000_000).toFixed(1)}M`;
  if (acv >= 1_000) return `$${Math.round(acv / 1_000)}K`;
  return `$${acv}`;
}

function formatDate(ts: string): string {
  if (!ts) return '—';
  const d = new Date(Number(ts) > 1e12 ? Number(ts) : Number(ts) * 1000);
  if (isNaN(d.getTime())) {
    const parsed = new Date(ts);
    if (isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatWeek(w: string): string {
  const d = new Date(w);
  if (isNaN(d.getTime())) return w;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── NLQ Result Table (lifted from TDRAnalytics) ────────────────────────────

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

// ─── Auto Chart (lifted from TDRAnalytics) ──────────────────────────────────

function AutoChart({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
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
            <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: 'hsl(260, 12%, 50%)' }} axisLine={false} tickLine={false} />
            <RechartsTooltip contentStyle={{ backgroundColor: '#1B1630', border: '1px solid #2a2540', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#fff' }} />
            {valueCols.map((vc, i) => (
              <Bar key={vc} dataKey={vc} fill={i === 0 ? BAR_COLOR : 'hsl(280, 60%, 50%)'} radius={[0, 4, 4, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Main Admin Page ────────────────────────────────────────────────────────

export default function TDRAdmin() {
  const navigate = useNavigate();

  // ── Activity Log state ──
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState<string | null>(null);

  // ── Usage Metrics state ──
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // ── NLQ state ──
  const [question, setQuestion] = useState('');
  const [nlqResult, setNlqResult] = useState<AnalystResult | null>(null);
  const [nlqLoading, setNlqLoading] = useState(false);

  // ── Load data ──
  const loadActivityLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const data = await snowflakeStore.getAdminActivityLog();
      setSessions(data);
    } catch (err) {
      console.error('[TDRAdmin] Failed to load activity log:', err);
    }
    setLogLoading(false);
  }, []);

  const loadUsageMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const data = await snowflakeStore.getUsageMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('[TDRAdmin] Failed to load usage metrics:', err);
    }
    setMetricsLoading(false);
  }, []);

  useEffect(() => {
    loadActivityLog();
    loadUsageMetrics();
  }, [loadActivityLog, loadUsageMetrics]);

  // ── Filtered sessions ──
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const matchesSearch = !logSearch ||
        (s.opportunityName || '').toLowerCase().includes(logSearch.toLowerCase()) ||
        (s.accountName || '').toLowerCase().includes(logSearch.toLowerCase()) ||
        (s.createdBy || '').toLowerCase().includes(logSearch.toLowerCase());
      const matchesStatus = !logStatusFilter || s.status === logStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sessions, logSearch, logStatusFilter]);

  // ── NLQ ──
  const handleAsk = useCallback(async (q?: string) => {
    const query = q || question.trim();
    if (!query) return;
    setNlqLoading(true);
    setNlqResult(null);
    try {
      const result = await cortexAi.askAnalyst(query);
      setNlqResult(result);
    } catch (err) {
      setNlqResult({ success: false, columns: [], rows: [], error: String(err) });
    }
    setNlqLoading(false);
  }, [question]);

  const summary = metrics?.summary;
  const users = metrics?.users || [];
  const weekly = metrics?.weekly || [];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-violet-500" />
              TDR Admin
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Activity, usage, and analytics across all TDR sessions
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => { loadActivityLog(); loadUsageMetrics(); }}
            disabled={logLoading || metricsLoading}
          >
            {logLoading || metricsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl">
          <Tabs defaultValue="activity" className="space-y-4">
            <TabsList>
              <TabsTrigger value="activity" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                Activity Log
              </TabsTrigger>
              <TabsTrigger value="usage" className="gap-1.5 text-xs">
                <BarChart3 className="h-3.5 w-3.5" />
                Usage
              </TabsTrigger>
              <TabsTrigger value="analyst" className="gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Analyst
              </TabsTrigger>
            </TabsList>

            {/* ═══════════ TAB 1: Activity Log ═══════════ */}
            <TabsContent value="activity" className="space-y-4">
              {/* Search + Filters */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search deals, accounts, or users..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="h-8 pl-9 text-sm"
                  />
                </div>
                <div className="flex gap-1.5">
                  {(['in-progress', 'completed'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setLogStatusFilter(logStatusFilter === status ? null : status)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                        logStatusFilter === status
                          ? status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                          : 'border-border bg-card text-muted-foreground hover:bg-accent'
                      )}
                    >
                      <Filter className="h-3 w-3" />
                      {status === 'completed' ? 'Completed' : 'In Progress'}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Session List */}
              {logLoading && sessions.length === 0 ? (
                <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading activity log...
                </div>
              ) : (
                <div className="rounded-lg border divide-y divide-border/50">
                  {filteredSessions.map(s => {
                    const completedSteps = parseCompletedSteps(s.completedSteps);
                    const stepsCompleted = completedSteps.length;
                    return (
                      <div
                        key={s.sessionId}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/workspace?deal=${s.opportunityId}`)}
                      >
                        {/* Status indicator */}
                        <div className={cn(
                          'h-2 w-2 rounded-full shrink-0',
                          s.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'
                        )} />

                        {/* Deal info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{s.opportunityName || s.accountName}</span>
                            <span className="text-2xs text-muted-foreground">v{s.iteration || 1}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-2xs text-muted-foreground">{s.accountName}</span>
                            {s.createdBy && s.createdBy !== 'current-user' && (
                              <>
                                <span className="text-2xs text-muted-foreground/30">·</span>
                                <span className="text-2xs text-violet-500">{s.createdBy}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Metrics */}
                        <div className="flex items-center gap-5 shrink-0 text-right">
                          <div>
                            <div className="text-xs font-medium tabular-nums">{stepsCompleted}</div>
                            <div className="text-2xs text-muted-foreground">steps</div>
                          </div>
                          <div>
                            <div className="text-xs font-medium tabular-nums">{s.inputCount || 0}</div>
                            <div className="text-2xs text-muted-foreground">inputs</div>
                          </div>
                          <div>
                            <div className="text-xs font-medium tabular-nums">{s.msgCount || 0}</div>
                            <div className="text-2xs text-muted-foreground">chats</div>
                          </div>
                          <div>
                            <div className="text-xs font-medium tabular-nums">{formatAcv(s.acv || 0)}</div>
                            <div className="text-2xs text-muted-foreground">ACV</div>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span className="text-2xs">{formatDate(s.updatedAt)}</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      </div>
                    );
                  })}

                  {filteredSessions.length === 0 && !logLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileText className="h-8 w-8 mb-2" />
                      <span className="text-sm">No sessions found</span>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ═══════════ TAB 2: Usage Metrics ═══════════ */}
            <TabsContent value="usage" className="space-y-5">
              {metricsLoading && !metrics ? (
                <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading usage metrics...
                </div>
              ) : (
                <>
                  {/* Stat Cards */}
                  <section className="grid grid-cols-4 gap-3">
                    <TooltipProvider delayDuration={200}>
                      {[
                        { label: 'Total TDRs', value: summary?.totalSessions ?? 0, sub: `${summary?.completedSessions ?? 0} completed` },
                        { label: 'Active Users', value: summary?.totalUsers ?? 0, sub: `${summary?.activeSessions ?? 0} sessions active` },
                        { label: 'Total Inputs', value: summary?.totalInputs ?? 0, sub: 'fields saved across all TDRs' },
                        { label: 'Avg ACV', value: summary?.avgAcv ? formatAcv(summary.avgAcv) : '—', sub: 'across TDR deals' },
                      ].map(card => (
                        <div key={card.label} className="stat-card">
                          <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</span>
                          <div className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</div>
                          {card.sub && <p className="mt-0.5 text-xs text-muted-foreground">{card.sub}</p>}
                        </div>
                      ))}
                    </TooltipProvider>
                  </section>

                  {/* User Leaderboard */}
                  <section className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border bg-card p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <h3 className="text-sm font-semibold">User Leaderboard</h3>
                      </div>
                      {users.length > 0 ? (
                        <div className="space-y-0 divide-y divide-border/50">
                          {users.slice(0, 10).map((u, i) => (
                            <div key={u.userName} className="flex items-center gap-3 py-2">
                              <span className={cn(
                                'text-xs font-bold w-5 text-center',
                                i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-muted-foreground'
                              )}>
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium truncate block">{u.userName}</span>
                              </div>
                              <div className="flex items-center gap-4 text-right">
                                <div>
                                  <span className="text-xs font-medium tabular-nums">{u.sessions}</span>
                                  <span className="text-2xs text-muted-foreground ml-1">TDRs</span>
                                </div>
                                <div>
                                  <span className="text-xs font-medium tabular-nums">{u.inputs}</span>
                                  <span className="text-2xs text-muted-foreground ml-1">inputs</span>
                                </div>
                                <div>
                                  <span className="text-xs font-medium tabular-nums">{u.messages}</span>
                                  <span className="text-2xs text-muted-foreground ml-1">chats</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                          <Users className="h-4 w-4 mr-2" />
                          No user data available yet
                        </div>
                      )}
                    </div>

                    {/* Weekly Activity */}
                    <div className="rounded-lg border bg-card p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="h-4 w-4 text-violet-500" />
                        <h3 className="text-sm font-semibold">Weekly TDR Activity</h3>
                        <span className="text-2xs text-muted-foreground">Last 12 weeks</span>
                      </div>
                      {weekly.length > 0 ? (
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weekly.map(w => ({ name: formatWeek(w.week), sessions: w.sessions }))} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(260, 12%, 50%)' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 9, fill: 'hsl(260, 12%, 50%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                              <RechartsTooltip
                                contentStyle={{ backgroundColor: '#1B1630', border: '1px solid #2a2540', borderRadius: 8, fontSize: 11 }}
                                labelStyle={{ color: '#fff' }}
                              />
                              <Bar dataKey="sessions" fill={BAR_COLOR} radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="sessions" position="top" style={{ fontSize: 9, fill: 'hsl(260, 10%, 50%)' }} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                          <BarChart3 className="h-4 w-4 mr-2" />
                          No weekly data available
                        </div>
                      )}
                    </div>
                  </section>
                </>
              )}
            </TabsContent>

            {/* ═══════════ TAB 3: NLQ Analyst ═══════════ */}
            <TabsContent value="analyst" className="space-y-4">
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
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
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

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {SUGGESTED_QUESTIONS.map((sq, i) => (
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
                        {nlqResult.answer && (
                          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3">
                            <div className="flex items-start gap-2">
                              <MessageSquareText className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
                              <p className="text-sm text-slate-200 leading-relaxed">{nlqResult.answer}</p>
                            </div>
                          </div>
                        )}
                        {nlqResult.columns.length >= 2 && nlqResult.rows.length >= 2 && (
                          <AutoChart columns={nlqResult.columns} rows={nlqResult.rows} />
                        )}
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
              </section>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
