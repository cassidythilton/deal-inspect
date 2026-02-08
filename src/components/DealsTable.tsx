import { Deal } from '@/types/tdr';
import { cn } from '@/lib/utils';
import { Pin, Users, Zap, Swords, Clock, Cloud, DollarSign, Building2, TrendingUp, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  getStageConfig, 
  getTDRScoreTooltip, 
  getTDRPriorityLabel,
  getTDRPriorityFactorsTooltip,
} from '@/lib/tooltips';
import { getTopFactors, CriticalFactor, calculateTDRScore } from '@/lib/tdrCriticalFactors';

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

  // Get stage display with number prefix
  const getStageDisplay = (deal: Deal) => {
    const stageNum = deal.stageNumber || getStageNumber(deal.stage);
    const stageName = getShortStageName(deal.stage);
    return { num: stageNum, name: stageName };
  };

  const getStageNumber = (stage: string): number => {
    const lower = stage.toLowerCase();
    if (lower.includes('discovery') || lower.includes('determine')) return 2;
    if (lower.includes('validation') || lower.includes('demonstrate')) return 3;
    if (lower.includes('proposal') || lower.includes('negotiate')) return 4;
    if (lower.includes('closing') || lower.includes('close')) return 5;
    return 1;
  };

  const getShortStageName = (stage: string): string => {
    const lower = stage.toLowerCase();
    if (lower.includes('discovery') || lower.includes('determine')) return 'Discovery';
    if (lower.includes('validation') || lower.includes('demonstrate')) return 'Validation';
    if (lower.includes('proposal')) return 'Proposal';
    if (lower.includes('negotiat')) return 'Negotiating';
    if (lower.includes('closing') || lower.includes('close')) return 'Closing';
    return stage.split(' ').slice(0, 2).join(' ');
  };

  // Calculate TDR score using critical factors framework
  const getTDRScore = (deal: Deal): number => {
    if (deal.tdrScore !== undefined) return deal.tdrScore;
    return calculateTDRScore(deal);
  };

  // Get WHY TDR? tags using critical factors framework
  const getWhyTDRTags = (deal: Deal): CriticalFactor[] => {
    return getTopFactors(deal, 2);
  };

  // Get icon component for a factor
  const getFactorIcon = (factor: CriticalFactor) => {
    switch (factor.icon) {
      case 'DollarSign': return DollarSign;
      case 'Cloud': return Cloud;
      case 'Building2': return Building2;
      case 'Swords': return Swords;
      case 'Zap': return Zap;
      case 'TrendingUp': return TrendingUp;
      case 'Users': return Users;
      case 'Sparkles': return Sparkles;
      case 'Clock': return Clock;
      case 'AlertTriangle': return AlertTriangle;
      default: return Zap;
    }
  };

  const getTagStyle = (color: string) => {
    switch (color) {
      case 'orange':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'blue':
        return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400';
      case 'purple':
        return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
      case 'red':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
      case 'amber':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'green':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      default:
        return 'bg-secondary text-muted-foreground';
    }
  };

  // Get partner tooltip
  const getPartnerTooltip = (deal: Deal): string | null => {
    if (deal.partnerSignal === 'none') return null;
    
    const lines: string[] = [];
    
    // Cloud platform info (would come from deal data)
    if (deal.partnersInvolved) {
      lines.push(`Cloud Platform: ${deal.partnersInvolved}`);
    }
    
    if (deal.primaryPartnerRole) {
      lines.push(`Role: ${deal.primaryPartnerRole}`);
    }
    
    if (deal.dealCode) {
      lines.push(`Deal Code: ${deal.dealCode}`);
    }
    
    // Strategy recommendation
    lines.push('→ Position Domo as control layer on their infrastructure');
    
    return lines.join('\n');
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="panel overflow-hidden">
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-medium">Recommended Deals</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40">
                <th className="section-header px-4 py-2 text-left">DEAL / ACCOUNT</th>
                <th className="section-header px-3 py-2 text-left">STAGE</th>
                <th className="section-header px-3 py-2 text-right">Age</th>
                <th className="section-header px-3 py-2 text-right">ACV</th>
                <th className="section-header px-3 py-2 text-center">TDR</th>
                <th className="section-header px-3 py-2 text-left">SE Team</th>
                <th className="section-header px-3 py-2 text-center">PARTNER</th>
                <th className="section-header px-3 py-2 text-left">WHY TDR?</th>
                <th className="section-header px-3 py-2 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => {
                const stageInfo = getStageDisplay(deal);
                const tdrScore = getTDRScore(deal);
                const whyTags = getWhyTDRTags(deal);
                const stageConfig = getStageConfig(deal.stage);
                const ageColor = deal.stageAge && deal.stageAge > 180 ? 'text-destructive' : 
                                deal.stageAge && deal.stageAge > 90 ? 'text-warning' : 'text-muted-foreground';
                
                return (
                  <tr
                    key={deal.id}
                    className="table-row-tight group cursor-pointer hover:bg-secondary/30"
                    onClick={() => navigate(`/workspace?deal=${deal.id}`)}
                  >
                    {/* Deal / Account */}
                    <td className="px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{deal.account}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{deal.dealName}</p>
                      </div>
                    </td>
                    
                    {/* Stage with badge and tooltip */}
                    <td className="px-3 py-2.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 cursor-help">
                            <Zap className="h-3 w-3 text-emerald-500" />
                            <span className="rounded bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                              [{stageInfo.num.toString().padStart(2, '0')}] {stageInfo.name}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="text-sm whitespace-pre-wrap">
                            {stageConfig?.tooltip || `Stage ${stageInfo.num} - ${stageInfo.name}`}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    
                    {/* Age */}
                    <td className={cn("px-3 py-2.5 text-right tabular-nums text-sm", ageColor)}>
                      {deal.stageAge ? `${deal.stageAge}d` : '-'}
                    </td>
                    
                    {/* ACV */}
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm font-medium tabular-nums">
                        {formatCurrency(deal.acv)}
                      </span>
                    </td>
                    
                    {/* TDR Score with tooltip */}
                    <td className="px-3 py-2.5 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn(
                            "inline-flex h-6 min-w-[28px] items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular-nums cursor-help",
                            tdrScore >= 40 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                            tdrScore >= 30 ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" :
                            "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
                          )}>
                            {tdrScore}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-sm">
                          <div className="space-y-2">
                            <p className="text-sm font-medium">
                              TDR Priority Factors:
                            </p>
                            <ul className="text-xs space-y-1 text-muted-foreground">
                              {deal.isCompetitive && <li>• 1 competitor</li>}
                              {deal.isPartnerPlay && <li>• Partner play</li>}
                              {deal.stageAge && <li>• {deal.stageAge}d in stage</li>}
                            </ul>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    
                    {/* SE Team */}
                    <td className="px-3 py-2.5">
                      <span className="text-sm text-foreground">
                        {deal.salesConsultant || '-'}
                      </span>
                    </td>
                    
                    {/* Partner with tooltip */}
                    <td className="px-3 py-2.5 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex cursor-help">
                            {deal.partnersInvolved?.toLowerCase().includes('snowflake') ? (
                              <Cloud className={cn(
                                "h-4 w-4 mx-auto",
                                deal.partnerSignal === 'strong' ? 'text-sky-500' :
                                deal.partnerSignal === 'moderate' ? 'text-sky-400' :
                                'text-muted-foreground/40'
                              )} />
                            ) : (
                              <Users className={cn(
                                "h-4 w-4 mx-auto",
                                deal.partnerSignal === 'strong' ? 'text-teal-500' :
                                deal.partnerSignal === 'moderate' ? 'text-teal-400' :
                                'text-muted-foreground/40'
                              )} />
                            )}
                          </div>
                        </TooltipTrigger>
                        {(deal.partnerSignal !== 'none' && deal.partnersInvolved) && (
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="space-y-1 text-sm">
                              <p className="font-medium">Cloud Platform: {deal.partnersInvolved}</p>
                              {deal.primaryPartnerRole && <p>Role: {deal.primaryPartnerRole}</p>}
                              {deal.dealCode && <p>Deal Code: {deal.dealCode}</p>}
                              <p className="text-muted-foreground text-xs mt-2">
                                → Position Domo as control layer on their infrastructure
                              </p>
                            </div>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </td>
                    
                    {/* WHY TDR? Tags with tooltips - using Critical Factors framework */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {whyTags.map((factor, i) => {
                          const IconComponent = getFactorIcon(factor);
                          return (
                            <Tooltip key={i}>
                              <TooltipTrigger asChild>
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium cursor-help',
                                    getTagStyle(factor.color)
                                  )}
                                >
                                  <IconComponent className="h-3 w-3" />
                                  {factor.shortLabel}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <div className="text-sm space-y-2">
                                  <p className="font-medium">{factor.description}</p>
                                  <p className="text-xs text-muted-foreground">→ {factor.strategy}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </td>
                    
                    {/* Action */}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}
