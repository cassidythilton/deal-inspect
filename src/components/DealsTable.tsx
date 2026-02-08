/**
 * DealsTable Component
 * Displays recommended deals in a table with proper formatting, pills, and tooltips
 * Rebuilt with coolors.co palette and improved UX
 */

import { Deal } from '@/types/tdr';
import { cn } from '@/lib/utils';
import { 
  Pin, Users, Zap, Swords, Clock, Cloud, DollarSign, Building2, 
  TrendingUp, Sparkles, AlertTriangle, Layers, GitMerge, Server, 
  Briefcase, ArrowUpRight, AlertOctagon, CheckCircle2, RefreshCcw,
  LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getTopFactors, CriticalFactor, calculateTDRScore, getPriorityFromScore } from '@/lib/tdrCriticalFactors';

interface DealsTableProps {
  deals: Deal[];
  onPinDeal?: (id: string) => void;
}

// Icon mapping for critical factors
const FACTOR_ICONS: Record<string, LucideIcon> = {
  'DollarSign': DollarSign,
  'Cloud': Cloud,
  'Building2': Building2,
  'Swords': Swords,
  'Zap': Zap,
  'TrendingUp': TrendingUp,
  'Users': Users,
  'Sparkles': Sparkles,
  'Clock': Clock,
  'AlertTriangle': AlertTriangle,
  'Layers': Layers,
  'GitMerge': GitMerge,
  'Server': Server,
  'Briefcase': Briefcase,
  'ArrowUpRight': ArrowUpRight,
  'AlertOctagon': AlertOctagon,
};

// Pill color styles using the coolors.co palette
const PILL_STYLES = {
  emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
  teal: 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-800',
  amber: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
  violet: 'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800',
  rose: 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800',
  slate: 'bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-700',
} as const;

// Map factor colors to pill styles
const getFactorPillStyle = (color: string): string => {
  switch (color) {
    case 'green': return PILL_STYLES.emerald;
    case 'blue': return PILL_STYLES.teal;
    case 'orange': return PILL_STYLES.amber;
    case 'purple': return PILL_STYLES.violet;
    case 'red': return PILL_STYLES.rose;
    case 'amber': return PILL_STYLES.amber;
    default: return PILL_STYLES.slate;
  }
};

// Get TDR score badge style
const getTDRBadgeStyle = (score: number): string => {
  if (score >= 75) return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-700';
  if (score >= 50) return 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-700';
  if (score >= 25) return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-700';
  return 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600';
};

// Get stage badge style
const getStageBadgeStyle = (stageNum: number): string => {
  if (stageNum <= 2) return PILL_STYLES.emerald; // Early stage - sweet spot
  if (stageNum === 3) return PILL_STYLES.teal;   // Validation
  return PILL_STYLES.amber;                       // Late stage
};

export function DealsTable({ deals, onPinDeal }: DealsTableProps) {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${Math.round(value / 1000)}K`;
    return `$${value}`;
  };

  // Get stage number from stage name
  const getStageNumber = (stage: string): number => {
    const lower = stage.toLowerCase();
    if (lower.includes('discovery') || lower.includes('determine')) return 2;
    if (lower.includes('validation') || lower.includes('demonstrate')) return 3;
    if (lower.includes('proposal') || lower.includes('negotiate')) return 4;
    if (lower.includes('closing') || lower.includes('close')) return 5;
    return 1;
  };

  // Get short stage name
  const getShortStageName = (stage: string): string => {
    const lower = stage.toLowerCase();
    if (lower.includes('discovery') || lower.includes('determine')) return 'Discovery';
    if (lower.includes('validation') || lower.includes('demonstrate')) return 'Validation';
    if (lower.includes('proposal')) return 'Proposal';
    if (lower.includes('negotiat')) return 'Negotiating';
    if (lower.includes('closing') || lower.includes('close')) return 'Closing';
    return stage.replace(/^\d+:\s*/, '').substring(0, 12);
  };

  // Get WHY TDR tags
  const getWhyTDRTags = (deal: Deal): CriticalFactor[] => {
    return getTopFactors(deal, 2);
  };

  // Get icon for a factor
  const getFactorIcon = (iconName: string): LucideIcon => {
    return FACTOR_ICONS[iconName] || Zap;
  };

  if (deals.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-muted-foreground">No deals match the current filters.</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="panel overflow-hidden">
        {/* Header */}
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Recommended Deals</h2>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Deal / Account
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Stage
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Age
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  ACV
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  TDR
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  SE Team
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Partner
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Why TDR?
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deals.map((deal) => {
                const stageNum = deal.stageNumber || getStageNumber(deal.stage);
                const stageName = getShortStageName(deal.stage);
                const tdrScore = deal.tdrScore ?? calculateTDRScore(deal);
                const priority = getPriorityFromScore(tdrScore);
                const whyTags = getWhyTDRTags(deal);
                
                // Age color based on staleness
                const ageColorClass = deal.stageAge && deal.stageAge > 180 
                  ? 'text-rose-600 dark:text-rose-400' 
                  : deal.stageAge && deal.stageAge > 90 
                  ? 'text-amber-600 dark:text-amber-400' 
                  : 'text-muted-foreground';
                
                return (
                  <tr
                    key={deal.id}
                    className="group cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={() => navigate(`/workspace?deal=${deal.id}`)}
                  >
                    {/* Deal / Account */}
                    <td className="px-5 py-4">
                      <div className="min-w-[180px]">
                        <p className="text-sm font-semibold text-foreground">{deal.account}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-[220px]">
                          {deal.dealName}
                        </p>
                      </div>
                    </td>
                    
                    {/* Stage */}
                    <td className="px-4 py-4">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 cursor-help">
                            <CheckCircle2 className={cn(
                              "h-4 w-4 shrink-0",
                              stageNum <= 2 ? 'text-emerald-500' : 
                              stageNum === 3 ? 'text-teal-500' : 'text-amber-500'
                            )} />
                            <span className={cn(
                              "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium",
                              getStageBadgeStyle(stageNum)
                            )}>
                              [{stageNum.toString().padStart(2, '0')}] {stageName}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-sm">
                          <p className="font-medium mb-1">Stage {stageNum}: {stageName}</p>
                          <p className="text-xs text-muted-foreground">
                            {stageNum <= 2 
                              ? 'Maximum opportunity to shape architecture and solution direction.'
                              : stageNum === 3
                              ? 'Good opportunity to influence technical decisions.'
                              : 'Focus on risk validation and delivery readiness.'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    
                    {/* Age */}
                    <td className={cn("px-4 py-4 text-right tabular-nums text-sm font-medium", ageColorClass)}>
                      {deal.stageAge ? `${deal.stageAge}d` : '-'}
                    </td>
                    
                    {/* ACV */}
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(deal.acv)}
                      </span>
                    </td>
                    
                    {/* TDR Score */}
                    <td className="px-4 py-4 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn(
                            "inline-flex h-7 min-w-[36px] items-center justify-center rounded-lg px-2 text-sm font-bold tabular-nums cursor-help border",
                            getTDRBadgeStyle(tdrScore)
                          )}>
                            {tdrScore}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-sm">
                          <div className="space-y-2">
                            <p className="font-bold">{priority} Priority</p>
                            <p className="text-xs text-muted-foreground">
                              {priority === 'CRITICAL' && 'Highest priority for SE engagement. Major decisions pending.'}
                              {priority === 'HIGH' && 'Strong TDR candidate. Multiple technical factors present.'}
                              {priority === 'MEDIUM' && 'Moderate complexity. Consider for TDR if bandwidth allows.'}
                              {priority === 'LOW' && 'Standard sales-led motion likely sufficient.'}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    
                    {/* SE Team */}
                    <td className="px-4 py-4">
                      <span className="text-sm text-foreground font-medium">
                        {deal.salesConsultant || '-'}
                      </span>
                    </td>
                    
                    {/* Partner */}
                    <td className="px-4 py-4 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex cursor-help">
                            {deal.partnerSignal === 'strong' || deal.partnerSignal === 'moderate' ? (
                              <RefreshCcw className={cn(
                                "h-4.5 w-4.5",
                                deal.partnerSignal === 'strong' ? 'text-emerald-500' : 'text-teal-500'
                              )} />
                            ) : (
                              <Users className="h-4.5 w-4.5 text-muted-foreground/30" />
                            )}
                          </div>
                        </TooltipTrigger>
                        {deal.partnerSignal !== 'none' && (
                          <TooltipContent side="top" className="max-w-sm">
                            <div className="space-y-2">
                              <p className="font-bold flex items-center gap-2">
                                <RefreshCcw className="h-3.5 w-3.5" />
                                Partner Integration
                              </p>
                              {deal.partnersInvolved && (
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Platform:</span> {deal.partnersInvolved}
                                </p>
                              )}
                              {deal.primaryPartnerRole && (
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Role:</span> {deal.primaryPartnerRole}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2 italic">
                                → Position Domo as control layer on their infrastructure
                              </p>
                            </div>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </td>
                    
                    {/* WHY TDR? Tags */}
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {whyTags.map((factor, i) => {
                          const IconComponent = getFactorIcon(factor.icon);
                          return (
                            <Tooltip key={i}>
                              <TooltipTrigger asChild>
                                <span className={cn(
                                  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium cursor-help transition-all hover:shadow-sm',
                                  getFactorPillStyle(factor.color)
                                )}>
                                  <IconComponent className="h-3.5 w-3.5" />
                                  {factor.shortLabel}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-sm">
                                <div className="space-y-2">
                                  <p className="font-bold flex items-center gap-2">
                                    <IconComponent className="h-4 w-4" />
                                    {factor.label}
                                  </p>
                                  <p className="text-sm">{factor.description}</p>
                                  <p className="text-xs text-muted-foreground italic">
                                    → {factor.strategy}
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                        {whyTags.length === 0 && (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </td>
                    
                    {/* Action */}
                    <td className="px-4 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'h-8 gap-1.5 px-3 opacity-0 transition-all group-hover:opacity-100',
                          deal.isPinned && 'opacity-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400'
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPinDeal?.(deal.id);
                        }}
                      >
                        <Pin className={cn(
                          'h-3.5 w-3.5',
                          deal.isPinned && 'fill-current'
                        )} />
                        <span className="text-xs font-medium">{deal.isPinned ? 'Pinned' : 'Pin'}</span>
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
