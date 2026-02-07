import { Deal, HygieneIssue } from '@/types/tdr';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Play, AlertTriangle, Clock, FileWarning } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AgendaSectionProps {
  pinnedDeals: Deal[];
  hygieneIssues: HygieneIssue[];
}

export function AgendaSection({ pinnedDeals, hygieneIssues }: AgendaSectionProps) {
  const navigate = useNavigate();

  const getStatusColor = (status?: Deal['agendaStatus']) => {
    if (status === 'reviewed') return 'bg-success';
    if (status === 'ready') return 'bg-primary';
    return 'bg-muted-foreground';
  };

  const getStatusLabel = (status?: Deal['agendaStatus']) => {
    if (status === 'reviewed') return 'Reviewed';
    if (status === 'ready') return 'Ready';
    return 'Draft';
  };

  const getHygieneIcon = (type: HygieneIssue['type']) => {
    if (type === 'stale-date') return <Clock className="h-3.5 w-3.5" />;
    if (type === 'missing-update') return <FileWarning className="h-3.5 w-3.5" />;
    return <AlertTriangle className="h-3.5 w-3.5" />;
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Agenda for Next TDR */}
      <div className="panel">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-medium">Agenda for Next TDR</h2>
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => navigate('/workspace')}
          >
            <Play className="h-3 w-3" />
            Start TDR
          </Button>
        </div>
        <div className="divide-y divide-border/40">
          {pinnedDeals.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">No deals pinned to agenda</p>
            </div>
          ) : (
            pinnedDeals.map((deal) => (
              <div
                key={deal.id}
                className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'h-2 w-2 rounded-full',
                      getStatusColor(deal.agendaStatus)
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium">{deal.account}</p>
                    <p className="text-xs text-muted-foreground">
                      ${(deal.acv / 1000).toFixed(0)}K · {deal.owner}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-2xs font-medium',
                    deal.agendaStatus === 'reviewed' && 'status-ready',
                    deal.agendaStatus === 'ready' && 'bg-primary/10 text-primary',
                    deal.agendaStatus === 'draft' && 'status-neutral'
                  )}
                >
                  {getStatusLabel(deal.agendaStatus)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Needs Attention */}
      <div className="panel">
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-medium">Needs Attention</h2>
        </div>
        <div className="divide-y divide-border/40">
          {hygieneIssues.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">All deals are up to date</p>
            </div>
          ) : (
            hygieneIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50"
              >
                <div
                  className={cn(
                    'mt-0.5',
                    issue.type === 'high-risk' ? 'text-destructive' : 'text-warning'
                  )}
                >
                  {getHygieneIcon(issue.type)}
                </div>
                <div>
                  <p className="text-sm font-medium">{issue.dealName}</p>
                  <p className="text-xs text-muted-foreground">{issue.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
