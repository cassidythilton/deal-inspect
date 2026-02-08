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

/**
 * WHY TDR? pill colors — exact match to backup's factor category palette.
 * Uses /10 opacity backgrounds with 500-level text and /20 borders.
 */
const FACTOR_PILL_COLORS: Record<string, string> = {
  cyan:      'bg-cyan-500/10 text-cyan-700 border border-cyan-500/20',       // cloud-platform, partner-play, co-sell
  emerald:   'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20', // early-stage, arch-window
  amber:     'bg-amber-500/10 text-amber-700 border border-amber-500/20',    // competitive
  violet:    'bg-violet-500/10 text-violet-700 border border-violet-500/20',  // greenfield
  blue:      'bg-blue-500/10 text-blue-700 border border-blue-500/20',       // enterprise, material
  orange:    'bg-orange-500/10 text-orange-700 border border-orange-500/20',  // stalled, check-progress
  red:       'bg-red-500/10 text-red-700 border border-red-500/20',          // no-se
  secondary: 'bg-secondary text-muted-foreground',                            // late-stage
};

/**
 * Brand-specific pill styles for cloud platform pills.
 * Snowflake: #00B9ED  |  Databricks: #CB2B1D  |  BigQuery: #4285F4
 */
const BRAND_PILL_STYLES = {
  snowflake:  'border text-[#00B9ED] bg-[#00B9ED]/10 border-[#00B9ED]/20',
  databricks: 'border text-[#CB2B1D] bg-[#CB2B1D]/10 border-[#CB2B1D]/20',
  bigquery:   'border text-[#4285F4] bg-[#4285F4]/10 border-[#4285F4]/20',
} as const;

const getFactorPillStyle = (color: string): string => {
  return FACTOR_PILL_COLORS[color] || 'bg-secondary/60 text-muted-foreground';
};

/** Get brand-specific pill style if the factor is cloudPartner. */
function getBrandPillStyle(factor: CriticalFactor, deal: Deal): string | null {
  if (factor.id !== 'cloudPartner') return null;
  const partner = (deal.partnersInvolved ?? '').toLowerCase();
  const snowflake = (deal.snowflakeTeam ?? '').toLowerCase();
  if (snowflake || partner.includes('snowflake')) return BRAND_PILL_STYLES.snowflake;
  if (partner.includes('databricks')) return BRAND_PILL_STYLES.databricks;
  if (partner.includes('bigquery') || partner.includes('gcp') || partner.includes('google cloud')) return BRAND_PILL_STYLES.bigquery;
  return null; // fall back to generic cyan
}

// Stage pill styles (kept from backup patterns)
const PILL_STYLES = {
  emerald: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20',
  teal: 'bg-teal-500/10 text-teal-700 border border-teal-500/20',
  amber: 'bg-amber-500/10 text-amber-700 border border-amber-500/20',
} as const;

const getTDRBadgeStyle = (score: number): string => {
  if (score >= 50) return 'bg-emerald-500/20 text-emerald-700';
  if (score >= 35) return 'bg-amber-500/20 text-amber-700';
  return 'bg-secondary text-muted-foreground';
};

const getStageBadgeStyle = (stageNum: number): string => {
  if (stageNum <= 2) return PILL_STYLES.emerald;
  if (stageNum === 3) return PILL_STYLES.teal;
  return PILL_STYLES.amber;
};

// ─── Partner icon/tooltip helpers ──────────────────────────────────────────────

/**
 * Get the appropriate partner icon based on partner name (cloud platform detection).
 *
 * Matches original backup behavior:
 *   - Snowflake / Databricks / BigQuery → Cloud icon (cyan)
 *   - Any other partner present → Users icon (emerald)
 *   - No partner → Users icon (muted)
 */
function getPartnerIcon(deal: Deal): { Icon: LucideIcon; colorClass: string } {
  const partner = (deal.partnersInvolved ?? '').toLowerCase();
  const snowflake = (deal.snowflakeTeam ?? '').toLowerCase();
  const hasPartner = partner.length > 0 || snowflake.length > 0;

  // Brand-specific cloud partner colors
  if (snowflake || partner.includes('snowflake')) {
    return { Icon: Cloud, colorClass: 'text-[#00B9ED]' };
  }
  if (partner.includes('databricks')) {
    return { Icon: Cloud, colorClass: 'text-[#CB2B1D]' };
  }
  if (partner.includes('bigquery') || partner.includes('gcp') || partner.includes('google cloud')) {
    return { Icon: Cloud, colorClass: 'text-[#4285F4]' };
  }
  // Other cloud platforms
  if (partner.includes('aws') || partner.includes('amazon') || partner.includes('azure') || partner.includes('microsoft')) {
    return { Icon: Cloud, colorClass: 'text-cyan-500' };
  }

  // Non-cloud partner
  if (hasPartner) {
    return { Icon: Users, colorClass: 'text-emerald-500' };
  }

  // No partner
  return { Icon: Users, colorClass: 'text-muted-foreground/40' };
}

/**
 * Build a DYNAMIC partner tooltip showing actual partner/platform details.
 * Not "Snowflake, Databricks, or BigQuery" — just the actual partner.
 */
function getPartnerTooltipContent(deal: Deal): {
  title: string;
  platformLabel: string;
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
  const isCloud = !!(snowflake || /snowflake|databricks|bigquery|google cloud|gcp|aws|amazon|azure|microsoft/i.test(partner ?? ''));
  const isSnowflake = !!(snowflake || /snowflake/i.test(partner ?? ''));
  const isDatabricks = /databricks/i.test(partner ?? '');
  const isBigQuery = /bigquery|google cloud|gcp/i.test(partner ?? '');
  const isAWS = /aws|amazon/i.test(partner ?? '');
  const isAzure = /azure|microsoft/i.test(partner ?? '');

  // Dynamic title based on actual partner
  let title = 'Partner Involvement';
  if (isSnowflake) title = 'Snowflake Integration';
  else if (isDatabricks) title = 'Databricks Integration';
  else if (isBigQuery) title = 'BigQuery Integration';
  else if (isAWS) title = 'AWS Integration';
  else if (isAzure) title = 'Azure Integration';
  else if (code?.toUpperCase().startsWith('PA')) title = 'Partner Architecture';
  else if (code?.toUpperCase().startsWith('P')) title = 'Partner Co-Sell';

  // Label: "Cloud Platform" for cloud deals, "Partner" for others
  const platformLabel = isCloud ? 'Cloud Platform' : 'Partner';

  // Dynamic strategy
  let strategy: string;
  if (isSnowflake) {
    strategy = 'Position Domo as composable layer on Snowflake. Run MagicETL on Snowflake compute.';
  } else if (isDatabricks) {
    strategy = 'Position Domo as the semantic/experience layer on Databricks lakehouse.';
  } else if (isBigQuery) {
    strategy = 'Position Domo as the analytics and app layer on BigQuery.';
  } else if (role?.toLowerCase() === 'co-sell' || role?.toLowerCase() === 'co sell') {
    strategy = `Validate integration approach and co-sell opportunity with ${partner || 'partner'}.`;
  } else if (role?.toLowerCase() === 'referral') {
    strategy = `Leverage referral relationship with ${partner || 'partner'} to accelerate deal.`;
  } else if (partner) {
    strategy = `Validate architecture compatibility with ${partner}.`;
  } else {
    strategy = 'Position Domo as control layer on their infrastructure.';
  }

  return {
    title,
    platformLabel,
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
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-medium">Recommended Deals</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            {/* Column widths matching backup layout */}
            <colgroup>
              <col className="w-[18%]" />  {/* Deal / Account */}
              <col className="w-[10%]" />  {/* Stage */}
              <col className="w-[5%]" />   {/* Age */}
              <col className="w-[7%]" />   {/* ACV */}
              <col className="w-[5%]" />   {/* TDR */}
              <col className="w-[12%]" />  {/* SE Team */}
              <col className="w-[5%]" />   {/* Partner */}
              <col className="w-[28%]" />  {/* Why TDR? */}
              <col className="w-[10%]" />  {/* Action */}
            </colgroup>
            <thead>
              <tr className="border-b border-border/40">
                <th className="section-header px-4 py-2 text-left">Deal / Account</th>
                <th className="section-header px-3 py-2 text-left">Stage</th>
                <th className="section-header px-3 py-2 text-center">Age</th>
                <th className="section-header px-3 py-2 text-right">ACV</th>
                <th className="section-header px-3 py-2 text-center">TDR</th>
                <th className="section-header px-3 py-2 text-left">SE Team</th>
                <th className="section-header px-3 py-2 text-center">Partner</th>
                <th className="section-header px-3 py-2 text-left">Why TDR?</th>
                <th className="section-header px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => {
                const stageNum = deal.stageNumber || getStageNumber(deal.stage);
                const stageName = getShortStageName(deal.stage);
                const tdrScore = deal.tdrScore ?? calculateTDRScore(deal);
                const priority = getPriorityFromScore(tdrScore);
                const whyTags = getWhyTDRTags(deal);

                const ageColorClass = deal.stageAge && deal.stageAge >= 60
                  ? 'text-red-600'
                  : deal.stageAge && deal.stageAge >= 30
                  ? 'text-amber-600'
                  : 'text-muted-foreground';

                // Partner icon + tooltip (dynamic)
                const { Icon: PartnerIcon, colorClass: partnerColorClass } = getPartnerIcon(deal);
                const partnerTip = deal.partnerSignal !== 'none' ? getPartnerTooltipContent(deal) : null;

                return (
                  <tr
                    key={deal.id}
                    className="table-row-tight group cursor-pointer"
                    onClick={() => navigate(`/workspace?deal=${deal.id}`)}
                  >
                    {/* Deal / Account */}
                    <td className="px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{deal.account}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {deal.dealName}
                        </p>
                      </div>
                    </td>

                    {/* Stage */}
                    <td className="px-3 py-2.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium cursor-help",
                            getStageBadgeStyle(stageNum)
                          )}>
                            <CheckCircle2 className={cn(
                              "h-3 w-3 shrink-0",
                              stageNum <= 2 ? 'text-emerald-600' :
                              stageNum === 3 ? 'text-teal-600' : 'text-amber-600'
                            )} />
                            [{stageNum.toString().padStart(2, '0')}] {stageName}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="text-xs">
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
                    <td className={cn("px-3 py-2.5 text-center text-xs font-medium tabular-nums", ageColorClass)}>
                      {deal.stageAge ? `${deal.stageAge}d` : '-'}
                    </td>

                    {/* ACV */}
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm font-medium tabular-nums">
                        {formatCurrency(deal.acv)}
                      </span>
                    </td>

                    {/* TDR Score */}
                    <td className="px-3 py-2.5 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn(
                            "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums cursor-help",
                            getTDRBadgeStyle(tdrScore)
                          )}>
                            {tdrScore}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="text-xs font-medium mb-1">TDR Priority Factors:</p>
                          <ul className="text-xs space-y-0.5">
                            {whyTags.map((f, i) => (
                              <li key={i}>• {f.label}</li>
                            ))}
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </td>

                    {/* SE Team */}
                    <td className="px-3 py-2.5">
                      <div className="space-y-0.5 min-w-0">
                        {deal.salesConsultant ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs font-medium truncate cursor-help">{deal.salesConsultant}</p>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="text-xs">
                                <strong>Sales Consultant (SE)</strong><br />
                                {deal.seManager && <span className="text-muted-foreground">SE Manager: {deal.seManager}</span>}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <p className="text-xs text-muted-foreground/50 italic">No SE</p>
                        )}
                        {deal.pocSalesConsultant && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-2xs text-muted-foreground truncate cursor-help">PoC: {deal.pocSalesConsultant}</p>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">PoC Sales Consultant for demos/POCs</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>

                    {/* Partner — dynamic icon + dynamic tooltip */}
                    <td className="px-3 py-2.5 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-center cursor-help">
                            <PartnerIcon className={cn("h-4 w-4", partnerColorClass)} />
                          </span>
                        </TooltipTrigger>
                        {partnerTip ? (
                          <TooltipContent side="top" className="max-w-xs p-3">
                            <p className="text-xs font-medium text-foreground mb-1">{partnerTip.title}</p>
                            {partnerTip.role && (
                              <p className="text-2xs text-muted-foreground">
                                Role: <span className="font-medium">{partnerTip.role}</span>
                              </p>
                            )}
                            {partnerTip.dealCode && (
                              <p className="text-2xs text-muted-foreground">
                                Deal Code: <span className="font-mono">{partnerTip.dealCode}</span>
                              </p>
                            )}
                            {partnerTip.platform && (
                              <p className="text-xs text-primary mt-1.5">
                                → {partnerTip.strategy}
                              </p>
                            )}
                          </TooltipContent>
                        ) : (
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs text-muted-foreground">No partner involvement detected</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </td>

                    {/* WHY TDR? Tags — dynamic labels + descriptions, backup sizing */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {whyTags.map((factor, i) => {
                          const IconComponent = getFactorIcon(factor.icon);
                          const dynamicLabel = getDynamicFactorLabel(factor, deal);
                          const dynamicDesc = getDynamicFactorDescription(factor, deal);
                          // Use brand-specific style for cloud partner, fall back to category color
                          const pillStyle = getBrandPillStyle(factor, deal) || getFactorPillStyle(factor.color);
                          return (
                            <Tooltip key={i}>
                              <TooltipTrigger asChild>
                                <span className={cn(
                                  'inline-flex items-center gap-1 cursor-help rounded px-1.5 py-0.5 text-2xs font-medium',
                                  pillStyle
                                )}>
                                  <IconComponent className="h-2.5 w-2.5" />
                                  {dynamicLabel}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs p-3">
                                <p className="text-xs font-medium text-foreground mb-1.5">
                                  {dynamicDesc}
                                </p>
                                <p className="text-xs text-primary">
                                  → {factor.strategy}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                        {whyTags.length === 0 && (
                          <span className="text-2xs text-muted-foreground">-</span>
                        )}
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
                        <Pin className={cn(
                          'h-3 w-3',
                          deal.isPinned && 'fill-primary text-primary'
                        )} />
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
