/**
 * Command Center — Sprint 20: Hero Metrics & Nav Cleanup
 *
 * Rebuilt dashboard with TDR-aligned stat cards and charts.
 * Every metric answers a question an SE Manager would actually ask.
 *
 * Stat Cards: TDR Queue, Competitive Battles, Partner Pipeline, Stale Deals
 * Charts: TDR Coverage (donut), Score Distribution (bar), Close Urgency (area)
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { TopBar, SEFilterState } from '@/components/TopBar';
import { DealsTable } from '@/components/DealsTable';
import { DealSearch } from '@/components/DealSearch';
import { AgendaSection } from '@/components/AgendaSection';
import { TDRCoverageChart } from '@/components/charts/TDRCoverageChart';
import { ScoreDistributionChart } from '@/components/charts/ScoreDistributionChart';
import { CloseUrgencyChart } from '@/components/charts/CloseUrgencyChart';
import { mockDeals } from '@/data/mockData';
import { useDeals } from '@/hooks/useDomo';
import { MAX_STAGE_AGE_DAYS, ALLOWED_MANAGERS } from '@/lib/constants';
import { Deal } from '@/types/tdr';
import {
  ShieldAlert,
  Swords,
  Handshake,
  Clock,
  Loader2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { calculateTDRScore, TDR_PRIORITY_THRESHOLDS_NEW } from '@/lib/tdrCriticalFactors';

// Default manager on load — show all managers
const DEFAULT_MANAGER: string = 'all';

// Get current quarter in format matching Domo data (e.g., "2026-Q1")
const getCurrentQuarter = () => {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${q}`;
};

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

    const allowedSet = new Set(ALLOWED_MANAGERS.map(m => m.toLowerCase()));
    const filtered = deals.filter((d) => allowedSet.has(d.owner?.toLowerCase() || ''));
    return filtered;
  }, [domoDeals, isDomoConnected]);

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

    return {
      queue: { count: tdrQueue.length, acv: queueACV },
      competitive: { count: competitiveDeals.length, acv: competitiveACV },
      partner: { count: partnerDeals.length, acv: partnerACV },
      stale: { count: staleDeals.length, acv: staleACV },
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
        />

        <main className="flex-1 p-6 bg-background">
          <div className="mx-auto max-w-7xl space-y-4">
            {/* Zone 1: TDR-Aligned Stat Cards */}
            <section className="grid grid-cols-4 gap-3">
              {/* TDR Queue */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="stat-card cursor-help group">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-purple-500/70" />
                      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                        TDR Queue
                      </span>
                    </div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">{metrics.queue.count}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatValue(metrics.queue.acv)} pipeline
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">High/Critical-scored deals with <strong>no completed TDR session</strong>. These need your attention.</p>
                </TooltipContent>
              </Tooltip>

              {/* Competitive Battles */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="stat-card cursor-help group">
                    <div className="flex items-center gap-1.5">
                      <Swords className="h-3.5 w-3.5 text-rose-400/70" />
                      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                        Competitive
                      </span>
                    </div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">{metrics.competitive.count}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatValue(metrics.competitive.acv)} at stake
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">Deals with <strong>named competitors</strong>. Use KB battle cards and TDR competitive analysis.</p>
                </TooltipContent>
              </Tooltip>

              {/* Partner Pipeline */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="stat-card cursor-help group">
                    <div className="flex items-center gap-1.5">
                      <Handshake className="h-3.5 w-3.5 text-blue-400/70" />
                      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                        Partner Pipeline
                      </span>
                    </div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">{metrics.partner.count}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatValue(metrics.partner.acv)} co-sell
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">Deals with <strong>Snowflake team involvement</strong>, partner influence, or named partners. Cloud Amplifier pipeline.</p>
                </TooltipContent>
              </Tooltip>

              {/* Stale Deals */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="stat-card cursor-help group">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-500/70" />
                      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                        Stale Deals
                      </span>
                    </div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">{metrics.stale.count}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatValue(metrics.stale.acv)} · &gt;{STALE_THRESHOLD_DAYS}d in stage
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">Deals stuck in the <strong>same stage for {STALE_THRESHOLD_DAYS}+ days</strong>. May need intervention or pipeline hygiene.</p>
                </TooltipContent>
              </Tooltip>
            </section>

            {/* Zone 2: Charts Row */}
            <section className="grid grid-cols-3 gap-3">
              <div className="stat-card">
                <TDRCoverageChart deals={displayedDeals} />
              </div>
              <div className="stat-card">
                <ScoreDistributionChart deals={displayedDeals} />
              </div>
              <div className="stat-card">
                <CloseUrgencyChart deals={displayedDeals} />
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
