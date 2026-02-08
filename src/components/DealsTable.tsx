/**
 * DealsTable Component
 * Displays recommended deals in a table with proper formatting, pills, and tooltips
 *
 * Partner icons vary by deal code prefix:
 *   PA = Partner Architecture (Cloud icon)
 *   P  = Partner deal (Users icon)
 *   E  = Enterprise (Building2 icon)
 *   Default = RefreshCcw
 *
 * Partner tooltips are DYNAMIC — they show the actual partner name, not a generic list.
 * WHY TDR? factor descriptions are also dynamic to the deal's specific data.
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

const getTDRBadgeStyle = (score: number): string => {
  if (score >= 75) return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-700';
  if (score >= 50) return 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-700';
  if (score >= 25) return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-700';
  return 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600';
};

const getStageBadgeStyle = (stageNum: number): string => {
  if (stageNum <= 2) return PILL_STYLES.emerald;
  if (stageNum === 3) return PILL_STYLES.teal;
  return PILL_STYLES.amber;
};

// ─── Partner icon/tooltip helpers ──────────────────────────────────────────────

/**
 * Get the appropriate partner icon based on deal code and partner type.
 *
 * Deal code prefixes:
 *   PA  = Partner Architecture → Cloud icon
 *   P   = Partner deal → Users icon
 *   E   = Enterprise → Building2 icon
 *   Default → RefreshCcw (integration icon)
 */
function getPartnerIcon(deal: Deal): { Icon: LucideIcon; colorClass: string } {
  const code = (deal.dealCode ?? '').toUpperCase();
  const hasPartner = deal.partnerSignal !== 'none';
  const isStrong = deal.partnerSignal === 'strong';

  if (!hasPartner) {
    return { Icon: Users, colorClass: 'text-muted-foreground/30' };
  }

  if (code.startsWith('PA')) {
    // Partner Architecture — cloud platform deal
    return { Icon: Cloud, colorClass: isStrong ? 'text-violet-500' : 'text-violet-400' };
  }
  if (code.startsWith('P')) {
    // Partner deal — co-sell / channel
    return { Icon: Users, colorClass: isStrong ? 'text-teal-500' : 'text-teal-400' };
  }
  if (code.startsWith('E')) {
    // Enterprise deal with partner involvement
    return { Icon: Building2, colorClass: isStrong ? 'text-emerald-500' : 'text-emerald-400' };
  }

  // Default: integration icon
  return { Icon: RefreshCcw, colorClass: isStrong ? 'text-emerald-500' : 'text-teal-500' };
}

/**
 * Build a DYNAMIC partner tooltip showing actual partner/platform details.
 * Not "Snowflake, Databricks, or BigQuery" — just the actual partner.
 */
function getPartnerTooltipContent(deal: Deal): {
  title: string;
  platform: string | null;
  role: string | null;
  dealCode: string | null;
  strategy: string;
} {
  const partner = deal.partnersInvolved;
  const role = deal.primaryPartnerRole;
  const code = deal.dealCode;
  const snowflake = deal.snowflakeTeam;

  // Detect specific cloud platform
  const isSnowflake = snowflake || /snowflake/i.test(partner ?? '');
  const isDatabricks = /databricks/i.test(partner ?? '');
  const isBigQuery = /bigquery|google cloud|gcp/i.test(partner ?? '');
  const isAWS = /aws|amazon/i.test(partner ?? '');
  const isAzure = /azure|microsoft/i.test(partner ?? '');

  // Dynamic title
  let title = 'Partner Integration';
  if (isSnowflake) title = 'Snowflake Integration';
  else if (isDatabricks) title = 'Databricks Integration';
  else if (isBigQuery) title = 'BigQuery Integration';
  else if (isAWS) title = 'AWS Integration';
  else if (isAzure) title = 'Azure Integration';
  else if (code?.startsWith('PA')) title = 'Partner Architecture';
  else if (code?.startsWith('P')) title = 'Partner Co-Sell';

  // Dynamic strategy
  let strategy: string;
  if (isSnowflake) {
    strategy = 'Position Domo as composable layer on Snowflake. Run MagicETL on Snowflake compute.';
  } else if (isDatabricks) {
    strategy = 'Position Domo as the semantic/experience layer on Databricks lakehouse.';
  } else if (isBigQuery) {
    strategy = 'Position Domo as the analytics and app layer on BigQuery.';
  } else if (role === 'Co-sell') {
    strategy = 'Validate integration approach and co-sell alignment with partner.';
  } else if (partner) {
    strategy = `Validate architecture compatibility with ${partner}.`;
  } else {
    strategy = 'Position Domo as control layer on their infrastructure.';
  }

  return {
    title,
    platform: partner || snowflake || null,
    role: role || null,
    dealCode: code || null,
    strategy,
  };
}

/**
 * Build DYNAMIC factor descriptions based on the deal's actual data.
 * e.g., "Cloud partner" becomes "Snowflake integration" if Snowflake is involved.
 */
function getDynamicFactorLabel(factor: CriticalFactor, deal: Deal): string {
  switch (factor.id) {
    case 'cloudPartner': {
      const partner = deal.partnersInvolved ?? '';
      const snowflake = deal.snowflakeTeam;
      if (snowflake || /snowflake/i.test(partner)) return 'Snowflake';
      if (/databricks/i.test(partner)) return 'Databricks';
      if (/bigquery|gcp/i.test(partner)) return 'BigQuery';
      if (/aws/i.test(partner)) return 'AWS';
      if (/azure/i.test(partner)) return 'Azure';
      return factor.shortLabel;
    }
    case 'materialACV': {
      if (deal.acv >= 250000) return '$250K+ ACV';
      if (deal.acv >= 100000) return '$100K+ ACV';
      return factor.shortLabel;
    }
    case 'earlyStageSweet': {
      const stageNum = deal.stageNumber ?? 2;
      return stageNum === 2 ? 'Shaping window' : 'Early stage';
    }
    case 'competitiveDisplacement': {
      const n = deal.numCompetitors ?? 0;
      return n >= 2 ? `${n} competitors` : 'Competitive';
    }
    case 'forecastMomentum': {
      const cat = deal.forecastCategory ?? '';
      if (cat.toLowerCase().includes('probable')) return 'Probable';
      if (cat.toLowerCase().includes('commit')) return 'Commit';
      return factor.shortLabel;
    }
    case 'staleSignals':
    case 'veryStale': {
      const age = deal.stageAge ?? 0;
      return `${age}d in stage`;
    }
    case 'partnerCoSell': {
      const p = deal.partnersInvolved;
      if (p) return `Co-sell: ${p.length > 15 ? p.substring(0, 15) + '…' : p}`;
      return factor.shortLabel;
    }
    default:
      return factor.shortLabel;
  }
}

function getDynamicFactorDescription(factor: CriticalFactor, deal: Deal): string {
  switch (factor.id) {
    case 'cloudPartner': {
      const partner = deal.partnersInvolved ?? deal.snowflakeTeam ?? '';
      if (partner) return `${partner} is involved in this deal's architecture.`;
      return factor.description;
    }
    case 'materialACV': {
      const formatted = deal.acv >= 1000000
        ? `$${(deal.acv / 1000000).toFixed(1)}M`
        : `$${Math.round(deal.acv / 1000)}K`;
      return `ACV is ${formatted} — material revenue warrants deep technical engagement.`;
    }
    case 'competitiveDisplacement': {
      const n = deal.numCompetitors ?? 0;
      return `${n} competitor${n !== 1 ? 's' : ''} present — differentiation strategy needed.`;
    }
    case 'staleSignals':
    case 'veryStale': {
      const age = deal.stageAge ?? 0;
      return `Deal has been in current stage for ${age} days — potential blockers.`;
    }
    case 'partnerCoSell': {
      const p = deal.partnersInvolved;
      if (p) return `Active co-sell with ${p}. Validate integration approach.`;
      return factor.description;
    }
    default:
      return factor.description;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DealsTable({ deals, onPinDeal }: DealsTableProps) {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${Math.round(value / 1000)}K`;
    return `$${value}`;
  };

  const getStageNumber = (stage: string): number => {
    const match = stage.match(/^(\d+):/);
    if (match) return parseInt(match[1]);
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
    return stage.replace(/^\d+:\s*/, '').substring(0, 12);
  };

  const getWhyTDRTags = (deal: Deal): CriticalFactor[] => {
    return getTopFactors(deal, 2);
  };

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
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Recommended Deals</h2>
        </div>

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

                const ageColorClass = deal.stageAge && deal.stageAge > 180
                  ? 'text-rose-600 dark:text-rose-400'
                  : deal.stageAge && deal.stageAge > 90
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground';

                // Partner icon + tooltip (dynamic)
                const { Icon: PartnerIcon, colorClass: partnerColorClass } = getPartnerIcon(deal);
                const partnerTip = deal.partnerSignal !== 'none' ? getPartnerTooltipContent(deal) : null;

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

                    {/* Partner — dynamic icon + dynamic tooltip */}
                    <td className="px-4 py-4 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex cursor-help">
                            <PartnerIcon className={cn("h-[18px] w-[18px]", partnerColorClass)} />
                          </div>
                        </TooltipTrigger>
                        {partnerTip && (
                          <TooltipContent side="top" className="max-w-sm">
                            <div className="space-y-2">
                              <p className="font-bold flex items-center gap-2">
                                <PartnerIcon className="h-3.5 w-3.5" />
                                {partnerTip.title}
                              </p>
                              {partnerTip.platform && (
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Platform:</span>{' '}
                                  <span className="font-medium">{partnerTip.platform}</span>
                                </p>
                              )}
                              {partnerTip.role && (
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Role:</span>{' '}
                                  <span className="font-medium">{partnerTip.role}</span>
                                </p>
                              )}
                              {partnerTip.dealCode && (
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Deal Code:</span>{' '}
                                  <span className="font-mono text-xs">{partnerTip.dealCode}</span>
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2 italic">
                                → {partnerTip.strategy}
                              </p>
                            </div>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </td>

                    {/* WHY TDR? Tags — dynamic labels + descriptions */}
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {whyTags.map((factor, i) => {
                          const IconComponent = getFactorIcon(factor.icon);
                          const dynamicLabel = getDynamicFactorLabel(factor, deal);
                          const dynamicDesc = getDynamicFactorDescription(factor, deal);
                          return (
                            <Tooltip key={i}>
                              <TooltipTrigger asChild>
                                <span className={cn(
                                  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium cursor-help transition-all hover:shadow-sm',
                                  getFactorPillStyle(factor.color)
                                )}>
                                  <IconComponent className="h-3.5 w-3.5" />
                                  {dynamicLabel}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-sm">
                                <div className="space-y-2">
                                  <p className="font-bold flex items-center gap-2">
                                    <IconComponent className="h-4 w-4" />
                                    {factor.label}
                                  </p>
                                  <p className="text-sm">{dynamicDesc}</p>
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
