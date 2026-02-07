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
          {/* Zone 1: Executive Metrics + Visualizations */}
          <section className="grid grid-cols-12 gap-4">
            <div className="col-span-8">
              <MetricsGrid metrics={mockMetrics} />
            </div>
            <div className="col-span-4 grid grid-cols-2 gap-3">
              <div className="stat-card">
                <div className="section-header mb-2">ACV by Deal</div>
                <ACVDistributionChart deals={deals} />
              </div>
              <div className="stat-card">
                <div className="section-header mb-2">Risk Mix</div>
                <RiskMixChart deals={deals} />
              </div>
            </div>
          </section>

          {/* Readiness Trend */}
          <section className="stat-card max-w-xs">
            <ReadinessTrendChart />
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
