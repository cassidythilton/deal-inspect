import { Deal } from '@/types/tdr';
import type { TDRRecommendation } from '@/lib/domoAi';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Play, Sparkles, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AgendaSectionProps {
  pinnedDeals: Deal[];
  suggestedDealIds: Set<string>;
  aiRecommendationMap: Map<string, TDRRecommendation>;
  aiStatus: 'idle' | 'loading' | 'loaded' | 'error';
}

export function AgendaSection({
  pinnedDeals,
  suggestedDealIds,
  aiRecommendationMap,
  aiStatus,
}: AgendaSectionProps) {
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

  return (
    <TooltipProvider delayDuration={150}>
      <div className="panel">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium">Agenda for Next TDR</h2>
            {aiStatus === 'loading' && (
              <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                AI analyzing…
              </span>
            )}
            {aiStatus === 'loaded' && suggestedDealIds.size > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-2xs font-medium text-violet-600 dark:text-violet-400">
                <Sparkles className="h-2.5 w-2.5" />
                {suggestedDealIds.size} AI suggested
              </span>
            )}
          </div>
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
              <p className="text-xs text-muted-foreground">
                {aiStatus === 'loading'
                  ? 'Analyzing pipeline for TDR candidates…'
                  : 'No deals pinned to agenda'}
              </p>
            </div>
          ) : (
            pinnedDeals.map((deal) => {
              const isAISuggested = suggestedDealIds.has(deal.id);
              const aiRec = aiRecommendationMap.get(deal.id);

              return (
                <div
                  key={deal.id}
                  className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-accent/50 cursor-pointer"
                  onClick={() => navigate(`/workspace?deal=${deal.id}`)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        getStatusColor(deal.agendaStatus),
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{deal.account}</p>
                        {isAISuggested && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="shrink-0">
                                <Sparkles className="h-3 w-3 text-violet-500" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs p-3">
                              <p className="text-xs font-medium mb-1">
                                AI Suggested — Score: {aiRec?.score ?? deal.tdrScore}
                                {aiRec?.priority && ` (${aiRec.priority})`}
                              </p>
                              {aiRec?.reasons && aiRec.reasons.length > 0 && (
                                <ul className="text-2xs text-muted-foreground space-y-0.5 mb-1.5">
                                  {aiRec.reasons.slice(0, 3).map((r, i) => (
                                    <li key={i}>• {r}</li>
                                  ))}
                                </ul>
                              )}
                              {aiRec?.suggestedActions && aiRec.suggestedActions.length > 0 && (
                                <div className="border-t border-border pt-1.5 mt-1">
                                  <p className="text-2xs text-primary font-medium">
                                    → {aiRec.suggestedActions[0]}
                                  </p>
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        ${(deal.acv / 1000).toFixed(0)}K · {deal.owner}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded px-2 py-0.5 text-2xs font-medium',
                      isAISuggested && 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
                      !isAISuggested && deal.agendaStatus === 'reviewed' && 'status-ready',
                      !isAISuggested && deal.agendaStatus === 'ready' && 'bg-primary/10 text-primary',
                      !isAISuggested && deal.agendaStatus === 'draft' && 'status-neutral',
                      !isAISuggested && !deal.agendaStatus && 'status-neutral',
                    )}
                  >
                    {isAISuggested ? 'AI Suggested' : getStatusLabel(deal.agendaStatus)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
