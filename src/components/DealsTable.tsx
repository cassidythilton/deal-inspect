import { Deal } from '@/types/tdr';
import { cn } from '@/lib/utils';
import { Pin, ArrowRight, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface DealsTableProps {
  deals: Deal[];
  onPinDeal?: (id: string) => void;
}

export function DealsTable({ deals, onPinDeal }: DealsTableProps) {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${Math.round(value / 1000)}K`;
    return `$${value}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPartnerIcon = (signal: Deal['partnerSignal']) => {
    if (signal === 'strong') return <Users className="h-3.5 w-3.5 text-success" />;
    if (signal === 'moderate') return <Users className="h-3.5 w-3.5 text-warning" />;
    return <Users className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const getRiskIcon = (level: Deal['riskLevel']) => {
    if (level === 'green') return <CheckCircle className="h-3.5 w-3.5 text-success" />;
    if (level === 'yellow') return <AlertCircle className="h-3.5 w-3.5 text-warning" />;
    return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
  };

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-medium">Recommended Deals</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/40">
              <th className="section-header px-4 py-2 text-left">Deal / Account</th>
              <th className="section-header px-3 py-2 text-left">Stage</th>
              <th className="section-header px-3 py-2 text-right">ACV</th>
              <th className="section-header px-3 py-2 text-left">Close</th>
              <th className="section-header px-3 py-2 text-center">Partner</th>
              <th className="section-header px-3 py-2 text-center">Risk</th>
              <th className="section-header px-3 py-2 text-left">Reason</th>
              <th className="section-header px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr
                key={deal.id}
                className="table-row-tight group cursor-pointer"
                onClick={() => navigate(`/workspace?deal=${deal.id}`)}
              >
                <td className="px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{deal.account}</p>
                    <p className="text-xs text-muted-foreground">{deal.dealName}</p>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                    {deal.stage}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="text-sm font-medium tabular-nums">
                    {formatCurrency(deal.acv)}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(deal.closeDate)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  {getPartnerIcon(deal.partnerSignal)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {getRiskIcon(deal.riskLevel)}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {deal.reasons.slice(0, 2).map((reason, i) => (
                      <span
                        key={i}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-2xs',
                          deal.riskLevel === 'green' && 'status-ready',
                          deal.riskLevel === 'yellow' && 'status-warning',
                          deal.riskLevel === 'red' && 'status-critical'
                        )}
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-7 gap-1 px-2 opacity-0 transition-opacity group-hover:opacity-100',
                      deal.isPinned && 'opacity-100'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPinDeal?.(deal.id);
                    }}
                  >
                    <Pin
                      className={cn(
                        'h-3 w-3',
                        deal.isPinned && 'fill-primary text-primary'
                      )}
                    />
                    <span className="text-xs">{deal.isPinned ? 'Pinned' : 'Pin'}</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
