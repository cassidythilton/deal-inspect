/**
 * Command Center — Hero Metrics & Deal Positioning
 *
 * Rebuilt dashboard with TDR-aligned stat cards and charts.
 * Every metric answers a question an SE Manager would actually ask.
 *
 * Stat Cards: TDR Queue, Competitive Battles, Partner Pipeline, Stale Deals
 * Charts: TDR Coverage (donut), Propensity Distribution (bar), Deal Positioning (scatter)
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { TopBar, SEFilterState } from '@/components/TopBar';
import { DealsTable } from '@/components/DealsTable';
import { DealSearch } from '@/components/DealSearch';
import { AgendaSection } from '@/components/AgendaSection';
import { TDRCoverageChart } from '@/components/charts/TDRCoverageChart';
import { PropensityDistributionChart } from '@/components/charts/PropensityDistributionChart';
import { PropensityQuadrantChart } from '@/components/charts/PropensityQuadrantChart';
import { mockDeals } from '@/data/mockData';
import { useDeals } from '@/hooks/useDomo';
import { MAX_STAGE_AGE_DAYS } from '@/lib/constants';
import { getActiveManagers } from '@/lib/appSettings';
import { Deal } from '@/types/tdr';
import {
  ShieldAlert,
  Swords,
  Handshake,
  Clock,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { calculateTDRScore, TDR_PRIORITY_THRESHOLDS_NEW } from '@/lib/tdrCriticalFactors';
import { getFiscalQuarter } from '@/lib/utils';

// null = show all managers (matches what TopBar sets when "All AE Managers" is selected)
const DEFAULT_MANAGER: string | null = null;

const getCurrentQuarter = () => getFiscalQuarter().label;

const STALE_THRESHOLD_DAYS = 60;

const formatValue = (val: number) => {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
  if (val >= 1000) return `$${Math.round(val / 1000)}K`;
  return `$${val}`;
};

export default function CommandCenter() {
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [hasAppliedSuggestions, setHasAppliedSuggestions] = useState(false);
  const [seFilters, setSEFilters] = useState<SEFilterState>({
    selectedSEManager: null,
    selectedSE: null,
    selectedManager: DEFAULT_MANAGER,
    selectedQuarters: [getCurrentQuarter()],
    selectedPriority: null,
    includeCurrentQuarter: true,
    showAgendaOnly: false,
  });

  const activeManagers = useMemo(() => getActiveManagers(), []);

  // Fetch deals from Domo
  const {
    deals: domoDeals, filterOptions, isLoading, isDomoConnected, refetch,
    suggestedDealIds, aiRecommendations, aiStatus,
  } = useDeals();

  // Auto-pin AI-suggested deals (once, on first load)
  useEffect(() => {
    if (suggestedDealIds.size > 0 && !hasAppliedSuggestions) {
      console.log(`[CommandCenter] Auto-pinning ${suggestedDealIds.size} AI-suggested deals`);
      setPinnedIds((prev) => {
        const next = new Set(prev);
        for (const id of suggestedDealIds) next.add(id);
        return next;
      });
      setHasAppliedSuggestions(true);
    }
  }, [suggestedDealIds, hasAppliedSuggestions]);

  // Pre-filter to only deals from ALLOWED_MANAGERS
  const baseDeals = useMemo(() => {
    let deals: Deal[];
    if (isDomoConnected && domoDeals.length > 0) {
      deals = domoDeals;
    } else {
      deals = mockDeals.filter((d) => !d.stageAge || d.stageAge <= MAX_STAGE_AGE_DAYS);
    }

    const allowedSet = new Set(activeManagers.map(m => m.toLowerCase()));
    const filtered = deals.filter((d) => allowedSet.has(d.owner?.toLowerCase() || ''));
    return filtered;
  }, [domoDeals, isDomoConnected, activeManagers]);

  // All deals (unfiltered by manager) for the global search
  const allDeals = useMemo(() => {
    if (isDomoConnected && domoDeals.length > 0) return domoDeals;
    return mockDeals.filter((d) => !d.stageAge || d.stageAge <= MAX_STAGE_AGE_DAYS);
  }, [domoDeals, isDomoConnected]);

  // Apply all filters to deals
  const deals: Deal[] = useMemo(() => {
    let result = baseDeals.map((d) => ({
      ...d,
      isPinned: pinnedIds.has(d.id),
      agendaStatus: pinnedIds.has(d.id) ? (d.agendaStatus || 'draft') : undefined,
    }));

    // AE Manager filter ('all' shows all allowed managers)
    if (seFilters.selectedManager && seFilters.selectedManager !== 'all') {
      result = result.filter((d) => d.owner === seFilters.selectedManager);
    }

    // SE Manager filter
    if (seFilters.selectedSEManager) {
      result = result.filter((d) => d.seManager === seFilters.selectedSEManager);
    }

    // Individual SE filter (Sales Engineer or PoC Architect)
    if (seFilters.selectedSE) {
      const seValue = seFilters.selectedSE;
      if (seValue.startsWith('poc:')) {
        const pocName = seValue.slice(4);
        result = result.filter((d) => d.pocSalesConsultant === pocName);
      } else if (seValue.startsWith('se:')) {
        const seName = seValue.slice(3);
        result = result.filter((d) => d.salesConsultant === seName);
      } else {
        result = result.filter((d) => d.salesConsultant === seValue || d.pocSalesConsultant === seValue);
      }
    }

    // Quarter filter (scope-level)
    if (seFilters.selectedQuarters && seFilters.selectedQuarters.length > 0) {
      result = result.filter((d) => seFilters.selectedQuarters!.includes(d.closeDateFQ || ''));
    }

    // Agenda toggle — show only pinned deals
    if (seFilters.showAgendaOnly) {
      result = result.filter((d) => d.isPinned);
    }

    return result;
  }, [baseDeals, pinnedIds, seFilters]);

  // ── Displayed deals: what AG Grid actually shows after its column filters ──
  const [displayedDeals, setDisplayedDeals] = useState<Deal[]>([]);

  useEffect(() => {
    setDisplayedDeals(deals);
  }, [deals]);

  const handleDisplayedRowsChange = useCallback((displayed: Deal[]) => {
    setDisplayedDeals(displayed);
  }, []);

  // Pinned deals come from the displayed set
  const pinnedDeals = displayedDeals.filter((d) => d.isPinned);

  // AI recommendation lookup
  const aiRecommendationMap = useMemo(() => {
    const map = new Map<string, typeof aiRecommendations[0]>();
    for (const rec of aiRecommendations) map.set(rec.opportunityId, rec);
    return map;
  }, [aiRecommendations]);

  // ── Sprint 20: TDR-aligned metrics ──
  const metrics = useMemo(() => {
    const scored = displayedDeals.map(d => ({
      ...d,
      score: d.tdrScore ?? calculateTDRScore(d),
    }));

    // TDR Queue: HIGH/CRITICAL-scored deals with no completed TDR session
    const tdrQueue = scored.filter(d =>
      d.score >= TDR_PRIORITY_THRESHOLDS_NEW.high &&
      !d.tdrSessions?.some(s => s.status === 'completed')
    );
    const queueACV = tdrQueue.reduce((s, d) => s + d.acv, 0);

    // Competitive Battles: deals with named competitors
    const competitiveDeals = displayedDeals.filter(d =>
      (d.competitors && d.competitors.trim().length > 0) || (d.numCompetitors && d.numCompetitors > 0)
    );
    const competitiveACV = competitiveDeals.reduce((s, d) => s + d.acv, 0);

    // Partner Pipeline: deals with Snowflake team or partner influence
    const partnerDeals = displayedDeals.filter(d =>
      (d.snowflakeTeam && d.snowflakeTeam.trim().length > 0 && d.snowflakeTeam !== 'None') ||
      d.partnerInfluence === 'Yes' ||
      (d.partnersInvolved && d.partnersInvolved.trim().length > 0)
    );
    const partnerACV = partnerDeals.reduce((s, d) => s + d.acv, 0);

    // Stale Deals: stage age > threshold
    const staleDeals = displayedDeals.filter(d => d.stageAge && d.stageAge > STALE_THRESHOLD_DAYS);
    const staleACV = staleDeals.reduce((s, d) => s + d.acv, 0);

    // Win Propensity: deals with ML scores (propensityScore is 0–1 scale)
    const scoredDeals = displayedDeals.filter(d => d.propensityScore != null && d.propensityScore > 0);
    const avgPropensity = scoredDeals.length > 0
      ? Math.round((scoredDeals.reduce((s, d) => s + (d.propensityScore || 0), 0) / scoredDeals.length) * 100)
      : 0;
    const highPropensity = scoredDeals.filter(d => (d.propensityScore || 0) >= 0.60);
    const highPropensityACV = highPropensity.reduce((s, d) => s + d.acv, 0);

    return {
      queue: { count: tdrQueue.length, acv: queueACV, deals: tdrQueue },
      competitive: { count: competitiveDeals.length, acv: competitiveACV, deals: competitiveDeals },
      partner: { count: partnerDeals.length, acv: partnerACV, deals: partnerDeals },
      stale: { count: staleDeals.length, acv: staleACV, deals: staleDeals.sort((a, b) => (b.stageAge ?? 0) - (a.stageAge ?? 0)) },
      propensity: { avgScore: avgPropensity, highCount: highPropensity.length, highACV: highPropensityACV, scoredCount: scoredDeals.length, deals: highPropensity.sort((a, b) => (b.propensityScore ?? 0) - (a.propensityScore ?? 0)) },
    };
  }, [displayedDeals]);

  const handleSEFilterChange = useCallback((filters: Partial<SEFilterState>) => {
    setSEFilters((prev) => ({ ...prev, ...filters }));
  }, []);

  const handlePinDeal = (id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen flex-col">
        <TopBar
          seFilterOptions={filterOptions}
          seFilterState={seFilters}
          onSEFilterChange={handleSEFilterChange}
          onRefresh={refetch}
          agendaCount={pinnedDeals.length}
          managers={activeManagers}
        />

        <main className="flex-1 p-6 bg-background">
          <div className="mx-auto max-w-7xl space-y-4">
            {/* Zone 1: TDR-Aligned Stat Cards */}
            <section className="grid grid-cols-5 gap-3">
              {/* TDR Queue */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="stat-card group hover:ring-1 hover:ring-purple-500/20 transition-shadow">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-purple-500/70" />
                      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">TDR Queue</span>
                    </div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">{metrics.queue.count}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatValue(metrics.queue.acv)} pipeline</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm p-0">
                  <div className="px-3 pt-2.5 pb-1.5">
                    <p className="text-xs">High/Critical-scored deals with <strong>no completed TDR</strong>.</p>
                  </div>
                  {metrics.queue.deals.length > 0 && (
                    <div className="border-t max-h-52 overflow-y-auto px-3 py-1.5 space-y-1">
                      {metrics.queue.deals.map(d => (
                        <div key={d.id} className="flex justify-between gap-3 text-[10px]">
                          <span className="truncate text-foreground">{d.account}</span>
                          <span className="shrink-0 text-muted-foreground tabular-nums">{formatValue(d.acv)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>

              {/* Competitive Battles */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="stat-card group hover:ring-1 hover:ring-rose-400/20 transition-shadow">
                    <div className="flex items-center gap-1.5">
                      <Swords className="h-3.5 w-3.5 text-rose-400/70" />
                      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Competitive</span>
                    </div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">{metrics.competitive.count}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatValue(metrics.competitive.acv)} at stake</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm p-0">
                  <div className="px-3 pt-2.5 pb-1.5">
                    <p className="text-xs">Deals with <strong>named competitors</strong>.</p>
                  </div>
                  {metrics.competitive.deals.length > 0 && (
                    <div className="border-t max-h-52 overflow-y-auto px-3 py-1.5 space-y-1">
                      {metrics.competitive.deals.map(d => (
                        <div key={d.id} className="flex justify-between gap-3 text-[10px]">
                          <span className="truncate text-foreground">{d.account}</span>
                          <span className="shrink-0 text-muted-foreground">{d.competitors || `${d.numCompetitors} comp.`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>

              {/* Partner Pipeline */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="stat-card group hover:ring-1 hover:ring-blue-400/20 transition-shadow">
                    <div className="flex items-center gap-1.5">
                      <Handshake className="h-3.5 w-3.5 text-blue-400/70" />
                      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Partner Pipeline</span>
                    </div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">{metrics.partner.count}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatValue(metrics.partner.acv)} co-sell</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm p-0">
                  <div className="px-3 pt-2.5 pb-1.5">
                    <p className="text-xs"><strong>Snowflake team</strong>, partner influence, or named partners.</p>
                  </div>
                  {metrics.partner.deals.length > 0 && (
                    <div className="border-t max-h-52 overflow-y-auto px-3 py-1.5 space-y-1">
                      {metrics.partner.deals.map(d => (
                        <div key={d.id} className="flex justify-between gap-3 text-[10px]">
                          <span className="truncate text-foreground">{d.account}</span>
                          <span className="shrink-0 text-muted-foreground tabular-nums">{formatValue(d.acv)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>

              {/* Stale Deals */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="stat-card group hover:ring-1 hover:ring-amber-500/20 transition-shadow">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-500/70" />
                      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Stale Deals</span>
                    </div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">{metrics.stale.count}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatValue(metrics.stale.acv)} · &gt;{STALE_THRESHOLD_DAYS}d in stage</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm p-0">
                  <div className="px-3 pt-2.5 pb-1.5">
                    <p className="text-xs">Stuck in the <strong>same stage for {STALE_THRESHOLD_DAYS}+ days</strong>.</p>
                  </div>
                  {metrics.stale.deals.length > 0 && (
                    <div className="border-t max-h-52 overflow-y-auto px-3 py-1.5 space-y-1">
                      {metrics.stale.deals.map(d => (
                        <div key={d.id} className="flex justify-between gap-3 text-[10px]">
                          <span className="truncate text-foreground">{d.account}</span>
                          <span className="shrink-0 text-amber-500 tabular-nums">{d.stageAge}d</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>

              {/* Win Propensity */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="stat-card group hover:ring-1 hover:ring-emerald-500/20 transition-shadow">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500/70" />
                      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Win Propensity</span>
                    </div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">{metrics.propensity.avgScore}%</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{metrics.propensity.highCount} high · {formatValue(metrics.propensity.highACV)}</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm p-0">
                  <div className="px-3 pt-2.5 pb-1.5">
                    <p className="text-xs">Avg <strong>{metrics.propensity.avgScore}%</strong> win probability across {metrics.propensity.scoredCount} scored deals.</p>
                  </div>
                  {metrics.propensity.deals.length > 0 && (
                    <div className="border-t max-h-52 overflow-y-auto px-3 py-1.5 space-y-1">
                      <p className="text-[9px] text-muted-foreground font-medium sticky top-0 bg-popover pb-0.5">60%+ propensity deals</p>
                      {metrics.propensity.deals.map(d => (
                        <div key={d.id} className="flex justify-between gap-3 text-[10px]">
                          <span className="truncate text-foreground">{d.account}</span>
                          <span className="shrink-0 text-emerald-500 tabular-nums">{Math.round((d.propensityScore ?? 0) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </section>

            {/* Zone 2: Charts — two compact + scatter takes 2x width */}
            <section className="grid grid-cols-4 gap-3">
              <div className="stat-card col-span-1">
                <TDRCoverageChart deals={displayedDeals} />
              </div>
              <div className="stat-card col-span-1">
                <PropensityDistributionChart deals={displayedDeals} />
              </div>
              <div className="stat-card col-span-2">
                <PropensityQuadrantChart deals={displayedDeals} />
              </div>
            </section>

            {/* Zone 3: Grid Toolbar + Deals Table */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <DealSearch allDeals={allDeals} />
                <span className="text-xs text-muted-foreground tabular-nums">
                  Showing {displayedDeals.length}{displayedDeals.length !== deals.length ? ` of ${deals.length}` : ''} deals
                </span>
              </div>
              <DealsTable
                deals={deals}
                onPinDeal={handlePinDeal}
                onDisplayedRowsChange={handleDisplayedRowsChange}
              />
            </section>

            {/* Zone 4: Agenda */}
            <section>
              <AgendaSection
                pinnedDeals={pinnedDeals}
                suggestedDealIds={suggestedDealIds}
                aiRecommendationMap={aiRecommendationMap}
                aiStatus={aiStatus}
              />
            </section>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
