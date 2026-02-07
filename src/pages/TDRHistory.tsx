import { useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { Search, Calendar, CheckCircle2, Clock, AlertCircle, ChevronRight, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TDRRecord {
  id: string;
  dealName: string;
  account: string;
  reviewDate: string;
  reviewer: string;
  outcome: 'approved' | 'deferred' | 'rejected';
  acv: number;
  notes?: string;
  readinessScore: number;
}

const mockHistory: TDRRecord[] = [
  {
    id: '1',
    dealName: 'Enterprise Analytics Platform',
    account: 'Meridian Health Systems',
    reviewDate: '2024-03-15',
    reviewer: 'Sarah Chen',
    outcome: 'approved',
    acv: 485000,
    readinessScore: 92,
    notes: 'Strong executive sponsorship. Approved for negotiation.',
  },
  {
    id: '2',
    dealName: 'Predictive Maintenance',
    account: 'Summit Energy Corp',
    reviewDate: '2024-03-12',
    reviewer: 'Michael Torres',
    outcome: 'approved',
    acv: 520000,
    readinessScore: 88,
    notes: 'Multi-year commitment secured. Partner aligned.',
  },
  {
    id: '3',
    dealName: 'Supply Chain Intelligence',
    account: 'Vertex Manufacturing',
    reviewDate: '2024-03-08',
    reviewer: 'Michael Torres',
    outcome: 'deferred',
    acv: 320000,
    readinessScore: 65,
    notes: 'Technical validation pending. Revisit next week.',
  },
  {
    id: '4',
    dealName: 'Fleet Analytics Dashboard',
    account: 'Northstar Logistics',
    reviewDate: '2024-03-01',
    reviewer: 'James Wilson',
    outcome: 'rejected',
    acv: 180000,
    readinessScore: 35,
    notes: 'No champion identified. Needs more discovery.',
  },
  {
    id: '5',
    dealName: 'Customer 360 Platform',
    account: 'Horizon Retail Group',
    reviewDate: '2024-02-28',
    reviewer: 'Sarah Chen',
    outcome: 'deferred',
    acv: 245000,
    readinessScore: 58,
    notes: 'Complex integration requirements. Architecture review needed.',
  },
  {
    id: '6',
    dealName: 'Risk & Compliance Suite',
    account: 'Cascade Financial',
    reviewDate: '2024-02-22',
    reviewer: 'Sarah Chen',
    outcome: 'approved',
    acv: 275000,
    readinessScore: 85,
    notes: 'Renewal expansion with strong usage metrics.',
  },
];

const outcomeConfig = {
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    className: 'bg-emerald/10 text-emerald border-emerald/20',
  },
  deferred: {
    label: 'Deferred',
    icon: Clock,
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  rejected: {
    label: 'Rejected',
    icon: AlertCircle,
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

export default function TDRHistory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);

  const filteredHistory = mockHistory.filter((record) => {
    const matchesSearch =
      record.dealName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.account.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesOutcome = !selectedOutcome || record.outcome === selectedOutcome;
    return matchesSearch && matchesOutcome;
  });

  const stats = {
    total: mockHistory.length,
    approved: mockHistory.filter((r) => r.outcome === 'approved').length,
    deferred: mockHistory.filter((r) => r.outcome === 'deferred').length,
    rejected: mockHistory.filter((r) => r.outcome === 'rejected').length,
    totalACV: mockHistory
      .filter((r) => r.outcome === 'approved')
      .reduce((sum, r) => sum + r.acv, 0),
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-medium text-foreground">TDR History</h1>
              <p className="text-sm text-muted-foreground">Past technical deal reviews</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="stat-card">
              <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Total Reviews
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{stats.total}</div>
            </div>
            <div className="stat-card">
              <div className="text-2xs font-medium uppercase tracking-wide text-emerald">
                Approved
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-semibold tabular-nums">{stats.approved}</span>
                <span className="text-xs text-muted-foreground">
                  ${(stats.totalACV / 1000000).toFixed(2)}M
                </span>
              </div>
            </div>
            <div className="stat-card">
              <div className="text-2xs font-medium uppercase tracking-wide text-warning">
                Deferred
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{stats.deferred}</div>
            </div>
            <div className="stat-card">
              <div className="text-2xs font-medium uppercase tracking-wide text-destructive">
                Rejected
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{stats.rejected}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search deals or accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-9 text-sm"
              />
            </div>
            <div className="flex gap-1.5">
              {(['approved', 'deferred', 'rejected'] as const).map((outcome) => {
                const config = outcomeConfig[outcome];
                return (
                  <button
                    key={outcome}
                    onClick={() => setSelectedOutcome(selectedOutcome === outcome ? null : outcome)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                      selectedOutcome === outcome
                        ? config.className
                        : 'border-border bg-card text-muted-foreground hover:border-border hover:bg-accent'
                    )}
                  >
                    <config.icon className="h-3 w-3" />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* History List */}
          <div className="panel divide-y divide-border/50">
            {filteredHistory.map((record) => {
              const config = outcomeConfig[record.outcome];
              return (
                <div
                  key={record.id}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-accent/30"
                >
                  <div className={cn('rounded-lg border p-2', config.className)}>
                    <config.icon className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {record.dealName}
                      </span>
                      <span className="text-2xs text-muted-foreground">•</span>
                      <span className="text-2xs text-muted-foreground truncate">
                        {record.account}
                      </span>
                    </div>
                    {record.notes && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {record.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-medium tabular-nums">
                        ${(record.acv / 1000).toFixed(0)}K
                      </div>
                      <div className="text-2xs text-muted-foreground">ACV</div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-medium tabular-nums">{record.readinessScore}%</div>
                      <div className="text-2xs text-muted-foreground">Readiness</div>
                    </div>

                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span className="text-xs">
                        {new Date(record.reviewDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <button className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-8 w-8 mb-2" />
                <span className="text-sm">No reviews found</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
