import { useState, useMemo, useCallback, useEffect } from 'react';
import { TopBar, SEFilterState } from '@/components/TopBar';
import { DealsTable } from '@/components/DealsTable';
import { DealSearch } from '@/components/DealSearch';
import { AgendaSection } from '@/components/AgendaSection';
import { TopTDRCandidatesChart } from '@/components/charts/TopTDRCandidatesChart';
import { TDRPriorityChart } from '@/components/charts/TDRPriorityChart';
import { PipelineByCloseChart } from '@/components/charts/PipelineByCloseChart';
import { mockDeals } from '@/data/mockData';
import { useDeals } from '@/hooks/useDomo';
import { MAX_STAGE_AGE_DAYS, ALLOWED_MANAGERS } from '@/lib/constants';
import { Deal } from '@/types/tdr';
import { Info, Loader2 } from 'lucide-react';
import { calculateTDRScore, getTopFactors } from '@/lib/tdrCriticalFactors';

// Default manager on load — null = show all allowed managers
const DEFAULT_MANAGER = null;

// Get current quarter in format matching Domo data (e.g., "2026-Q1")
const getCurrentQuarter = () => {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${q}`;
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
    console.log(`[CommandCenter] Filtered to ${filtered.length} deals from allowed managers (${ALLOWED_MANAGERS.join(', ')})`);
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

    // AE Manager filter
    if (seFilters.selectedManager) {
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

  const pinnedDeals = deals.filter((d) => d.isPinned);

  // AI recommendation lookup
  const aiRecommendationMap = useMemo(() => {
    const map = new Map<string, typeof aiRecommendations[0]>();
    for (const rec of aiRecommendations) map.set(rec.opportunityId, rec);
    return map;
  }, [aiRecommendations]);

  // Metrics
  const metrics = useMemo(() => {
    const recommendedDeals = deals
      .map(d => ({ ...d, tdrScore: d.tdrScore ?? calculateTDRScore(d) }))
      .sort((a, b) => (b.tdrScore ?? 0) - (a.tdrScore ?? 0))
      .slice(0, 10);

    const eligibleACV = deals.reduce((sum, d) => sum + d.acv, 0);
    const recommendedACV = recommendedDeals.reduce((sum, d) => sum + d.acv, 0);
    const agendaACV = pinnedDeals.reduce((sum, d) => sum + d.acv, 0);
    const atRiskDeals = deals.filter(d => d.riskLevel === 'red' || d.riskLevel === 'yellow');
    const atRiskACV = atRiskDeals.reduce((sum, d) => sum + d.acv, 0);
    const criticalCount = deals.filter(d => d.riskLevel === 'red').length;

    const formatValue = (val: number) => {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
      if (val >= 1000) return `$${Math.round(val / 1000)}K`;
      return `$${val}`;
    };

    return {
      eligible: { value: formatValue(eligibleACV), deals: deals.length },
      recommended: { value: formatValue(recommendedACV), deals: recommendedDeals.length },
      agenda: { value: formatValue(agendaACV), deals: pinnedDeals.length },
      atRisk: { value: formatValue(atRiskACV), deals: atRiskDeals.length, critical: criticalCount },
    };
  }, [deals, pinnedDeals]);

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
          {/* Zone 1: Metrics Row */}
          <section className="grid grid-cols-4 gap-3">
            <div className="stat-card">
              <div className="flex items-center gap-1">
                <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  ELIGIBLE ACV
                </span>
                <Info className="h-3 w-3 text-muted-foreground/50" />
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{metrics.eligible.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{metrics.eligible.deals} deals</div>
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-1">
                <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  RECOMMENDED
                </span>
                <Info className="h-3 w-3 text-muted-foreground/50" />
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{metrics.recommended.value}</div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{metrics.recommended.deals} deals</span>
                <div className="h-1.5 w-6 rounded-full bg-success" />
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-1">
                <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  AGENDA
                </span>
                <Info className="h-3 w-3 text-muted-foreground/50" />
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{metrics.agenda.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{metrics.agenda.deals} deals pinned</div>
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-1">
                <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  AT-RISK
                </span>
                <Info className="h-3 w-3 text-muted-foreground/50" />
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{metrics.atRisk.value}</div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {metrics.atRisk.critical} critical · {metrics.atRisk.deals - metrics.atRisk.critical} at risk
                </span>
                <div className="h-1.5 w-6 rounded-full bg-destructive" />
              </div>
            </div>
          </section>

          {/* Zone 2: Charts Row */}
          <section className="grid grid-cols-3 gap-3">
            <div className="stat-card">
              <TopTDRCandidatesChart deals={deals} />
            </div>
            <div className="stat-card">
              <TDRPriorityChart deals={deals} />
            </div>
            <div className="stat-card">
              <PipelineByCloseChart deals={deals} />
            </div>
          </section>

          {/* Zone 3: Grid Toolbar + Deals Table */}
          <section>
            {/* Grid Toolbar Row */}
            <div className="flex items-center justify-between mb-2">
              <DealSearch allDeals={allDeals} />
              <span className="text-xs text-muted-foreground tabular-nums">
                Showing {deals.length} deals
              </span>
            </div>
            <DealsTable deals={deals} onPinDeal={handlePinDeal} />
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
  );
}
