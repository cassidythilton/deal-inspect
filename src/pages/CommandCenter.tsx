import { useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { MetricsGrid } from '@/components/MetricsGrid';
import { DealsTable } from '@/components/DealsTable';
import { AgendaSection } from '@/components/AgendaSection';
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
          {/* Zone 1: Executive Metrics */}
          <section>
            <MetricsGrid metrics={mockMetrics} />
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
