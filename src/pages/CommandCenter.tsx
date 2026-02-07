import { useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { MetricsGrid } from '@/components/MetricsGrid';
import { DealsTable } from '@/components/DealsTable';
import { AgendaSection } from '@/components/AgendaSection';
import { ACVDistributionChart } from '@/components/charts/ACVDistributionChart';
import { RiskMixChart } from '@/components/charts/RiskMixChart';
import { ReadinessTrendChart } from '@/components/charts/ReadinessTrendChart';
import { mockDeals, mockMetrics, hygieneIssues } from '@/data/mockData';

export default function CommandCenter() {
  const [activeView, setActiveView] = useState<'recommended' | 'agenda' | 'all'>('recommended');
  const [deals, setDeals] = useState(mockDeals);

  const pinnedDeals = deals.filter((d) => d.isPinned);
  
  const filteredDeals = activeView === 'recommended'
    ? deals.filter((d) => d.riskLevel !== 'red').slice(0, 5)
    : activeView === 'agenda'
    ? pinnedDeals
    : deals;

  const handlePinDeal = (id: string) => {
    setDeals((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, isPinned: !d.isPinned, agendaStatus: d.isPinned ? undefined : 'draft' }
          : d
      )
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar activeView={activeView} onViewChange={setActiveView} />
      
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Zone 1: Metrics + Visualizations in balanced grid */}
          <section className="space-y-3">
            {/* Row 1: 4 metric cards + 2 chart cards */}
            <div className="grid grid-cols-6 gap-3">
              {/* Metrics - first 4 columns */}
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
              {/* ACV by Deal */}
              <div className="stat-card">
                <div className="section-header mb-2">ACV by Deal</div>
                <ACVDistributionChart deals={deals} />
              </div>
              {/* Risk Mix */}
              <div className="stat-card">
                <div className="section-header mb-2">Risk Mix</div>
                <RiskMixChart deals={deals} />
              </div>
            </div>

            {/* Row 2: 5-week trend spanning appropriate width */}
            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-2 stat-card">
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
