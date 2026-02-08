import { useState, useMemo, useCallback, useEffect } from 'react';
import { TopBar, SEFilterState } from '@/components/TopBar';
import { DealsTable } from '@/components/DealsTable';
import { AgendaSection } from '@/components/AgendaSection';
import { TopTDRCandidatesChart } from '@/components/charts/TopTDRCandidatesChart';
import { TDRPriorityChart } from '@/components/charts/TDRPriorityChart';
import { PipelineByCloseChart } from '@/components/charts/PipelineByCloseChart';
import { mockDeals, hygieneIssues } from '@/data/mockData';
import { useDeals } from '@/hooks/useDomo';
import { MAX_STAGE_AGE_DAYS, TDR_PRIORITY_THRESHOLDS, ALLOWED_MANAGERS } from '@/lib/constants';
import { Deal } from '@/types/tdr';
import { Info } from 'lucide-react';

// Default manager on load
const DEFAULT_MANAGER = ALLOWED_MANAGERS[0]; // Andrew Rich

export default function CommandCenter() {
  const [activeView, setActiveView] = useState<'recommended' | 'agenda' | 'all'>('recommended');
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [seFilters, setSEFilters] = useState<SEFilterState>({
    selectedSE: null,
    selectedManager: DEFAULT_MANAGER, // Default to first manager
    selectedQuarters: ['Q1 2026'], // Default to Q1 2026
    selectedPriority: null,
    includeCurrentQuarter: true,
  });
  
  // Fetch deals from Domo (pre-filtered for stage age > 365 days)
  const { deals: domoDeals, filterOptions, isLoading, isDomoConnected, refetch } = useDeals();
  
  // Pre-filter to only deals from ALLOWED_MANAGERS
  const baseDeals = useMemo(() => {
    let deals: Deal[];
    
    if (isDomoConnected && domoDeals.length > 0) {
      deals = domoDeals;
    } else {
      // Fall back to mock data for local development
      deals = mockDeals.filter((d) => !d.stageAge || d.stageAge <= MAX_STAGE_AGE_DAYS);
    }
    
    // IMPORTANT: Only include deals from allowed managers
    const allowedSet = new Set(ALLOWED_MANAGERS.map(m => m.toLowerCase()));
    const filtered = deals.filter((d) => {
      const ownerLower = d.owner?.toLowerCase() || '';
      return allowedSet.has(ownerLower);
    });
    
    console.log(`[CommandCenter] Filtered to ${filtered.length} deals from allowed managers (${ALLOWED_MANAGERS.join(', ')})`);
    return filtered;
  }, [domoDeals, isDomoConnected]);

  // Apply all filters to deals
  const deals: Deal[] = useMemo(() => {
    let result = baseDeals.map((d) => ({
      ...d,
      isPinned: pinnedIds.has(d.id),
      agendaStatus: pinnedIds.has(d.id) ? (d.agendaStatus || 'draft') : undefined,
    }));
    
    // Apply SE filter (can be either SE Manager or Sales Consultant)
    if (seFilters.selectedSE) {
      result = result.filter((d) => 
        d.seManager === seFilters.selectedSE || 
        d.salesConsultant === seFilters.selectedSE
      );
    }
    
    // Apply Manager filter
    if (seFilters.selectedManager) {
      result = result.filter((d) => d.owner === seFilters.selectedManager);
    }
    
    // Apply Quarter filter (multi-select)
    if (seFilters.selectedQuarters && seFilters.selectedQuarters.length > 0) {
      result = result.filter((d) => seFilters.selectedQuarters!.includes(d.closeDateFQ || ''));
    }
    
    // Apply TDR Priority filter (based on tdrScore)
    if (seFilters.selectedPriority && seFilters.selectedPriority !== 'all') {
      result = result.filter((d) => {
        const score = d.tdrScore ?? 0;
        switch (seFilters.selectedPriority) {
          case 'critical':
            return score >= TDR_PRIORITY_THRESHOLDS.critical;
          case 'high':
            return score >= TDR_PRIORITY_THRESHOLDS.high && score < TDR_PRIORITY_THRESHOLDS.critical;
          case 'medium':
            return score >= TDR_PRIORITY_THRESHOLDS.medium && score < TDR_PRIORITY_THRESHOLDS.high;
          case 'low':
            return score < TDR_PRIORITY_THRESHOLDS.medium;
          default:
            return true;
        }
      });
    }
    
    return result;
  }, [baseDeals, pinnedIds, seFilters]);

  const pinnedDeals = deals.filter((d) => d.isPinned);
  
  const filteredDeals = activeView === 'recommended'
    ? deals.filter((d) => d.riskLevel !== 'red').slice(0, 10)
    : activeView === 'agenda'
    ? pinnedDeals
    : deals;

  // Calculate metrics from actual deals
  const metrics = useMemo(() => {
    const eligibleACV = deals.reduce((sum, d) => sum + d.acv, 0);
    const recommendedDeals = deals.filter(d => d.riskLevel !== 'red');
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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar 
        activeView={activeView} 
        onViewChange={setActiveView}
        seFilterOptions={filterOptions}
        seFilterState={seFilters}
        onSEFilterChange={handleSEFilterChange}
        onRefresh={refetch}
      />
      
      <main className="flex-1 p-6 bg-background">
        <div className="mx-auto max-w-7xl space-y-4">
          {/* Zone 1: Metrics Row */}
          <section className="grid grid-cols-4 gap-3">
            {/* Eligible ACV */}
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

            {/* Recommended */}
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

            {/* Agenda */}
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

            {/* At-Risk */}
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

          {/* Zone 3: Deals Table */}
          <section>
            <DealsTable deals={filteredDeals} onPinDeal={handlePinDeal} />
          </section>

          {/* Zone 4: Agenda + Hygiene */}
          <section>
            <AgendaSection pinnedDeals={pinnedDeals} hygieneIssues={hygieneIssues} />
          </section>
        </div>
      </main>
    </div>
  );
}
