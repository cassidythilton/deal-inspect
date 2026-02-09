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
  Search, Tag,
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
      const snowflake = deal.snowflakeTeam ?? '';
      if (snowflake || /snowflake/i.test(partner)) {
        return `Snowflake is part of this deal. TDR should validate Domo as the composable layer \u2014 MagicETL compute strategy, Snowflake-native features, and joint positioning.`;
      }
      if (/databricks/i.test(partner)) {
        return `Databricks lakehouse is involved. TDR should define the semantic/experience layer positioning and validate data pipeline architecture across platforms.`;
      }
      if (/bigquery|gcp|google cloud/i.test(partner)) {
        return `Google BigQuery is in the stack. TDR should validate the analytics and app layer role and confirm data connectivity architecture.`;
      }
      if (partner) return `${partner} cloud platform is involved \u2014 validate integration architecture and positioning before technical decisions lock in.`;
      return factor.description;
    }
    case 'materialACV': {
      const formatted = deal.acv >= 1000000
        ? `$${(deal.acv / 1000000).toFixed(1)}M`
        : `$${Math.round(deal.acv / 1000)}K`;
      if (deal.acv >= 250000) {
        return `ACV is ${formatted} \u2014 strategic deal demanding executive-level solution design and multi-stakeholder alignment. Ensure architecture supports long-term account expansion.`;
      }
      return `ACV is ${formatted} \u2014 material revenue at stake. Comprehensive solution design and ROI framework should be prepared for the TDR.`;
    }
    case 'earlyStageSweet': {
      const stageNum = deal.stageNumber ?? 2;
      if (stageNum === 2) {
        return 'Stage 2 (Determine Needs) \u2014 this is the TDR sweet spot. The SME can shape architecture decisions, partner alignment, and competitive positioning before they lock in.';
      }
      return 'Stage 3 (Demonstrate Value) \u2014 still a strong window to influence technical direction. Architecture decisions are being evaluated but not yet committed.';
    }
    case 'competitiveDisplacement': {
      const n = deal.numCompetitors ?? 0;
      if (n >= 2) {
        return `${n} competitors are in play \u2014 contested evaluation. TDR should develop a clear differentiation strategy, identify competitor weaknesses, and design demo scenarios that highlight unique strengths.`;
      }
      return 'Competitor present \u2014 head-to-head evaluation likely. TDR should prepare competitive battle card and design evaluation criteria that favor the Domo architecture.';
    }
    case 'newLogoDeal': {
      return 'New business with no existing footprint. TDR should cover full discovery: business challenge, current tech stack, integration requirements, and a phased implementation approach for land-and-expand.';
    }
    case 'staleSignals': {
      const age = deal.stageAge ?? 0;
      return `Deal has been in current stage for ${age} days \u2014 likely facing technical or organizational blockers. TDR should investigate root cause and determine whether a technical reset or champion re-engagement is needed.`;
    }
    case 'veryStale': {
      const age = deal.stageAge ?? 0;
      return `Deal has been stalled for ${age} days (6+ months). TDR should re-qualify: is this deal still viable? If so, what fundamental approach change is needed? Consider opportunity cost of SE time.`;
    }
    case 'partnerCoSell': {
      const p = deal.partnersInvolved;
      if (p) return `Active co-sell with ${p} \u2014 architecture has not been validated across both platforms. TDR should include a joint architecture review and confirm both teams are positioning consistently.`;
      return factor.description;
    }
    case 'forecastMomentum': {
      const cat = deal.forecastCategory ?? '';
      if (cat.toLowerCase().includes('probable')) {
        return 'Deal is forecast as Probable \u2014 the customer is actively evaluating and progression is expected. TDR should ensure technical requirements are fully understood and timeline is realistic.';
      }
      if (cat.toLowerCase().includes('best case')) {
        return 'Deal is Best Case \u2014 positive momentum but uncertainty remains. TDR should validate technical fit and identify potential blockers that could prevent progression.';
      }
      return factor.description;
    }
    case 'complexDealCode': {
      const code = deal.dealCode ?? '';
      if (code.toUpperCase().startsWith('PA')) {
        return `Partner architecture deal (${code}) \u2014 multi-platform solution with integration complexity. Each component needs technical validation and cross-platform dependencies must be mapped.`;
      }
      return `Complex deal structure (${code || 'multi-component'}) \u2014 ensure all solution components are technically validated and integration points are well-defined.`;
    }
    case 'lateStageRisk': {
      return 'Stage 4+ \u2014 technical strategy is likely already committed. TDR focus should shift from shaping to risk validation: is the committed architecture sound? Are there hidden risks before contracts close?';
    }
    default:
      return factor.description;
  }
}

/**
 * Get DYNAMIC TDR preparation steps tailored to the deal data.
 * Pulls from factor.tdrPrep but can inject deal-specific context.
 */
function getDynamicTDRPrep(factor: CriticalFactor, deal: Deal): string[] {
  const base = factor.tdrPrep || [];

  switch (factor.id) {
    case 'cloudPartner': {
      const partner = deal.partnersInvolved ?? deal.snowflakeTeam ?? '';
      const snowflake = deal.snowflakeTeam;
      if (snowflake || /snowflake/i.test(partner)) {
        return [
          'Validate MagicETL compute strategy \u2014 Domo compute vs. Snowflake pushdown',
          'Identify Snowflake SA and schedule joint architecture review',
          'Prepare Snowflake-native integration diagram (data sharing, external tables)',
          'Confirm role in the stack: control layer, semantic layer, or app layer on Snowflake',
          'Review Snowflake consumption model impact on customer TCO',
        ];
      }
      if (/databricks/i.test(partner)) {
        return [
          'Define the role in the Databricks lakehouse architecture',
          'Validate data connectivity: Unity Catalog, Delta Lake, or direct query',
          'Prepare joint positioning with Databricks partner team',
          'Confirm governance model across both platforms',
        ];
      }
      if (/bigquery|gcp|google cloud/i.test(partner)) {
        return [
          'Validate BigQuery connector performance and data freshness requirements',
          'Confirm analytics layer role vs. Looker positioning',
          'Prepare Google Cloud integration architecture diagram',
          'Review BigQuery cost model implications for the customer',
        ];
      }
      return base;
    }
    case 'materialACV': {
      if (deal.acv >= 250000) {
        return [
          'Prepare executive-level solution architecture and ROI framework',
          'Map all stakeholders in the buying committee and their technical concerns',
          'Ensure solution scope matches long-term data strategy',
          'Identify account expansion opportunities beyond the initial deal scope',
          'Review pricing model alignment with the proposed architecture',
        ];
      }
      return base;
    }
    case 'competitiveDisplacement': {
      const n = deal.numCompetitors ?? 0;
      if (n >= 2) {
        return [
          `Prepare battle cards for all ${n} competitors in the evaluation`,
          'Design demo scenarios that highlight unique differentiators',
          'Anticipate competitor objections and prepare counter-narratives',
          'Validate evaluation criteria \u2014 ensure they favor Domo strengths',
          'Identify potential landmines and address proactively',
        ];
      }
      return base;
    }
    case 'earlyStageSweet': {
      const stageNum = deal.stageNumber ?? 2;
      if (stageNum === 2) {
        return [
          'This is the peak shaping window \u2014 architecture decisions are being made now',
          'Map current vs. target architecture and identify the optimal insertion point',
          'Define what the SME can uniquely influence: platform choice, data flow, governance',
          'Align with any cloud partner SA before the customer commits to a direction',
          'Prepare a solution vision the technical team can rally around',
        ];
      }
      return [
        'Architecture evaluation is in progress \u2014 influence is still possible',
        'Validate that technical proof points align with evaluation criteria',
        'Ensure demo/POC scenarios address specific business challenges',
        'Prepare competitive positioning materials for active evaluation',
      ];
    }
    default:
      return base;
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
            {/* Column widths */}
            <colgroup>
              <col className="w-[17%]" />  {/* Deal / Account */}
              <col className="w-[10%]" />  {/* Stage */}
              <col className="w-[4%]" />   {/* Age */}
              <col className="w-[7%]" />   {/* ACV */}
              <col className="w-[5%]" />   {/* TDR Score */}
              <col className="w-[4%]" />   {/* TDR Done */}
              <col className="w-[11%]" />  {/* SE Team */}
              <col className="w-[5%]" />   {/* Partner */}
              <col className="w-[27%]" />  {/* Why TDR? */}
              <col className="w-[10%]" />  {/* Action */}
            </colgroup>
            <thead>
              <tr className="border-b border-border/40">
                <th className="section-header px-4 py-2 text-left">Deal / Account</th>
                <th className="section-header px-3 py-2 text-left">Stage</th>
                <th className="section-header px-3 py-2 text-center">Age</th>
                <th className="section-header px-3 py-2 text-right">ACV</th>
                <th className="section-header px-3 py-2 text-center">TDR</th>
                <th className="section-header px-2 py-2 text-center">TDRs</th>
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
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{deal.account}</p>
                          {deal.hasIntel && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Search className="h-3 w-3 shrink-0 text-violet-500" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                Account intelligence available
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">
                            {deal.dealName}
                          </p>
                          {deal.dealType && (
                            <span className={cn(
                              'inline-flex items-center gap-0.5 shrink-0 rounded px-1 py-0 text-[10px] font-medium leading-tight',
                              deal.dealType.toLowerCase().includes('new logo')
                                ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                                : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                            )}>
                              <Tag className="h-2.5 w-2.5" />
                              {deal.dealType.toLowerCase().includes('new logo') ? 'New' : 'Upsell'}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Stage */}
                    <td className="px-3 py-2.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium cursor-help whitespace-nowrap",
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
                        <TooltipContent side="top" className="max-w-sm p-3">
                          <p className="text-xs font-medium mb-1">
                            {stageNum <= 2
                              ? 'Peak TDR Value \u2014 Architecture Shaping Window'
                              : stageNum === 3
                              ? 'Strong TDR Value \u2014 Evaluation Phase'
                              : stageNum === 4
                              ? 'Limited TDR Value \u2014 Confirmation Phase'
                              : 'Minimal TDR Value \u2014 Closing Phase'}
                          </p>
                          <p className="text-2xs text-muted-foreground">
                            {stageNum <= 2
                              ? 'Maximum opportunity to shape architecture. The SE SME can influence platform choice, data strategy, partner alignment, and competitive positioning before technical decisions lock in.'
                              : stageNum === 3
                              ? 'Customer is actively evaluating. Technical proof points and demos are happening. Architecture decisions are being made \u2014 influence is still possible but the window is narrowing.'
                              : stageNum === 4
                              ? 'Technical strategy is likely set. TDR value shifts from shaping to risk validation \u2014 verify the committed architecture will work at scale before contracts close.'
                              : 'Deal is near close. TDR should only focus on last-minute risk prevention and ensuring implementation readiness.'}
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
                        <TooltipContent side="top" className="max-w-sm p-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold">TDR Index: {tdrScore}/100</p>
                              <span className={cn(
                                'rounded px-1.5 py-0.5 text-2xs font-bold',
                                priority === 'CRITICAL' ? 'bg-red-500/20 text-red-700' :
                                priority === 'HIGH' ? 'bg-emerald-500/20 text-emerald-700' :
                                priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-700' :
                                'bg-secondary text-muted-foreground'
                              )}>{priority}</span>
                            </div>
                            <p className="text-2xs text-muted-foreground">
                              {priority === 'CRITICAL' ? 'Immediate TDR required \u2014 multiple high-value signals converging. Early-stage shaping opportunity with strategic impact.' :
                               priority === 'HIGH' ? 'TDR strongly recommended \u2014 good intervention opportunity to shape technical strategy and protect deal integrity.' :
                               priority === 'MEDIUM' ? 'TDR beneficial \u2014 monitor for escalation. Consider scheduling if additional signals emerge.' :
                               'Standard process \u2014 no urgent TDR need at this time.'}
                            </p>
                            {whyTags.length > 0 && (
                              <div className="border-t border-border/40 pt-1.5">
                                <p className="text-2xs font-medium text-muted-foreground mb-1">Contributing Factors:</p>
                                <ul className="space-y-0.5">
                                  {whyTags.map((f, i) => (
                                    <li key={i} className="text-2xs text-muted-foreground">
                                      {'\u2022'} <span className="font-medium text-foreground">{f.label}</span> {'\u2014'} Tier {f.tier}, +{f.points}pts
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </td>

                    {/* TDR Sessions — 5 dots */}
                    <td className="px-2 py-2.5 text-center">
                      {(() => {
                        const sessions = deal.tdrSessions || [];
                        const MAX_DOTS = 5;
                        // Build dot array: completed → emerald, in-progress → amber, empty → gray
                        const completed = sessions.filter(s => s.status === 'completed');
                        const inProgress = sessions.filter(s => s.status === 'in-progress');
                        const filledCount = completed.length + inProgress.length;

                        const dots = Array.from({ length: MAX_DOTS }, (_, i) => {
                          if (i < completed.length) return 'completed' as const;
                          if (i < filledCount) return 'in-progress' as const;
                          return 'empty' as const;
                        });

                        const tooltipText = filledCount === 0
                          ? 'No TDRs performed'
                          : `${completed.length} completed${inProgress.length > 0 ? `, ${inProgress.length} in progress` : ''} of ${MAX_DOTS} max`;

                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center gap-[3px] cursor-help">
                                {dots.map((status, i) => (
                                  <span
                                    key={i}
                                    className={cn(
                                      'block h-[6px] w-[6px] rounded-full transition-colors',
                                      status === 'completed' && 'bg-emerald-500',
                                      status === 'in-progress' && 'bg-amber-400',
                                      status === 'empty' && 'bg-muted-foreground/20',
                                    )}
                                  />
                                ))}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="text-xs font-medium">{tooltipText}</p>
                              {completed.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {completed.map((s, i) => (
                                    <p key={i} className="text-2xs text-muted-foreground">
                                      TDR {i + 1}: {s.completedAt ? new Date(s.completedAt).toLocaleDateString() : 'Completed'}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
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

                    {/* WHY TDR? Tags — comprehensive tooltips aligned to AI framework */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {whyTags.map((factor, i) => {
                          const IconComponent = getFactorIcon(factor.icon);
                          const dynamicLabel = getDynamicFactorLabel(factor, deal);
                          const dynamicDesc = getDynamicFactorDescription(factor, deal);
                          const tdrPrep = getDynamicTDRPrep(factor, deal);
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
                              <TooltipContent side="top" className="max-w-sm p-3">
                                {/* Factor context */}
                                <p className="text-xs font-medium text-foreground mb-1">
                                  {dynamicDesc}
                                </p>
                                {/* Strategy */}
                                <p className="text-xs text-primary mt-1.5 mb-2">
                                  {'\u2192'} {factor.strategy}
                                </p>
                                {/* TDR Preparation Steps */}
                                {tdrPrep.length > 0 && (
                                  <div className="border-t border-border/40 pt-2">
                                    <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                      TDR Preparation
                                    </p>
                                    <ul className="space-y-0.5">
                                      {tdrPrep.map((step, j) => (
                                        <li key={j} className="text-2xs text-muted-foreground leading-relaxed">
                                          {'\u2022'} {step}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
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
