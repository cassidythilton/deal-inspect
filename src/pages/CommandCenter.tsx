import { useState, useMemo, useCallback } from 'react';
import { TopBar, SEFilterState } from '@/components/TopBar';
import { MetricsGrid } from '@/components/MetricsGrid';
import { DealsTable } from '@/components/DealsTable';
import { AgendaSection } from '@/components/AgendaSection';
import { ACVDistributionChart } from '@/components/charts/ACVDistributionChart';
import { RiskMixChart } from '@/components/charts/RiskMixChart';
import { ReadinessTrendChart } from '@/components/charts/ReadinessTrendChart';
import { mockDeals, mockMetrics, hygieneIssues } from '@/data/mockData';
import { useDeals } from '@/hooks/useDomo';
import { MAX_STAGE_AGE_DAYS } from '@/lib/domo';
import { Deal } from '@/types/tdr';

export default function CommandCenter() {
  const [activeView, setActiveView] = useState<'recommended' | 'agenda' | 'all'>('recommended');
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [seFilters, setSEFilters] = useState<SEFilterState>({
    seManager: null,
    pocSalesConsultant: null,
  });
  
  // Fetch deals from Domo (pre-filtered for stage age > 365 days)
  const { deals: domoDeals, filterOptions, isLoading, isDomoConnected } = useDeals();
  
  // Use Domo data if connected, otherwise fall back to pre-filtered mock data
  const baseDeals = useMemo(() => {
    if (isDomoConnected && domoDeals.length > 0) {
      console.log(`[CommandCenter] Using ${domoDeals.length} Domo deals (pre-filtered for Stage Age <= ${MAX_STAGE_AGE_DAYS})`);
      return domoDeals;
    }
    // Fall back to mock data for local development, also pre-filtered
    const filtered = mockDeals.filter((d) => !d.stageAge || d.stageAge <= MAX_STAGE_AGE_DAYS);
    console.log(`[CommandCenter] Using ${filtered.length} mock deals (dev mode)`);
    return filtered;
  }, [domoDeals, isDomoConnected]);

  // Apply pinned status and SE filters to deals
  const deals: Deal[] = useMemo(() => {
    let result = baseDeals.map((d) => ({
      ...d,
      isPinned: pinnedIds.has(d.id),
      agendaStatus: pinnedIds.has(d.id) ? (d.agendaStatus || 'draft') : undefined,
    }));
    
    // Apply SE Manager filter
    if (seFilters.seManager) {
      result = result.filter((d) => d.seManager === seFilters.seManager);
    }
    
    // Apply PoC Sales Consultant filter
    if (seFilters.pocSalesConsultant) {
      result = result.filter((d) => d.pocSalesConsultant === seFilters.pocSalesConsultant);
    }
    
    return result;
  }, [baseDeals, pinnedIds, seFilters]);

  const pinnedDeals = deals.filter((d) => d.isPinned);
  
  const filteredDeals = activeView === 'recommended'
    ? deals.filter((d) => d.riskLevel !== 'red').slice(0, 5)
    : activeView === 'agenda'
    ? pinnedDeals
    : deals;
    
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
      />
      
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Zone 1: Metrics + Visualizations in balanced 4-3 grid */}
          <section className="space-y-3">
            {/* Row 1: 4 metric cards - evenly spaced */}
            <div className="grid grid-cols-4 gap-3">
              {mockMetrics.map((metric, index) => (
                <div key={index} className="stat-card">
                  <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                    {metric.label}
                  </div>
                  <div className="mt-1 text-xl font-semibold tabular-nums">{metric.value}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{metric.subValue}</span>
                    {metric.status && (
                      <div
                        className={`h-1.5 w-6 rounded-full ${
                          metric.status === 'green' ? 'bg-success' : 'bg-destructive'
                        }`}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Row 2: 3 chart cards - evenly spaced */}
            <div className="grid grid-cols-3 gap-3">
              <div className="stat-card">
                <div className="section-header mb-2">ACV by Deal</div>
                <ACVDistributionChart deals={deals} />
              </div>
              <div className="stat-card">
                <div className="section-header mb-2">Risk Mix</div>
                <RiskMixChart deals={deals} />
              </div>
              <div className="stat-card">
                <ReadinessTrendChart />
              </div>
            </div>
          </section>

          {/* Zone 2: Deals Table */}
          <section>
            <DealsTable deals={filteredDeals} onPinDeal={handlePinDeal} />
          </section>

          {/* Zone 3: Agenda + Hygiene */}
          <section>
            <AgendaSection pinnedDeals={pinnedDeals} hygieneIssues={hygieneIssues} />
          </section>
        </div>
      </main>
    </div>
  );
}
