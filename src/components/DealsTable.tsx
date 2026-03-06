/**
 * DealsTable Component — AG Grid Edition
 * Interactive, sortable, filterable deals table with preserved TDR elegance.
 *
 * Column layout:
 *   1. Deal / Account     — account name, deal name, badges, intel icon
 *   2. AE Manager         — forecast owner (ALLOWED_MANAGERS)
 *   3. AE                 — account executive
 *   4. SE Manager         — looked up via SE mapping
 *   5. SE Team            — SE name (line 1) + PoC (line 2)
 *   6. Stage              — badge with tooltip
 *   7. Age                — days, color-coded
 *   8. ACV                — currency formatted
 *   9. Win %              — ML propensity score, color-coded badge + factor tooltip
 *  10. TDR Score           — colored badge + factor tooltip
 *  11. TDRs               — 5-dot indicator
 *  12. Partner             — dynamic icon + tooltip
 *  13. Why TDR?            — factor pills + ML factor pills
 *  14. Action              — pin button (pinned right)
 */

import { useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef, ICellRendererParams, GridReadyEvent, RowClickedEvent, FilterChangedEvent } from 'ag-grid-community';

// AG Grid v35 Theming API: no CSS file imports needed — themeQuartz is the default.
// Our `.ag-theme-tdr` CSS class provides custom variable overrides on top.

// Register all AG Grid Community modules (required in v35+)
ModuleRegistry.registerModules([AllCommunityModule]);

import { Deal } from '@/types/tdr';
import { cn } from '@/lib/utils';
import {
  Pin, Users, Zap, Swords, Clock, Cloud, DollarSign, Building2,
  TrendingUp, Sparkles, AlertTriangle, Layers, GitMerge, Server,
  Briefcase, ArrowUpRight, AlertOctagon, CheckCircle2, RefreshCcw,
  Search,
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
  /** Called whenever AG Grid's visible rows change (filter, sort, pagination).
   *  Passes the full set of rows that survive all column filters. */
  onDisplayedRowsChange?: (displayed: Deal[]) => void;
}

// ─── HELPERS (preserved from original) ────────────────────────────────────────

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

const FACTOR_PILL_COLORS: Record<string, string> = {
  cyan:      'bg-cyan-500/10 text-cyan-700 border border-cyan-500/20',
  emerald:   'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20',
  amber:     'bg-amber-500/10 text-amber-700 border border-amber-500/20',
  violet:    'bg-violet-500/10 text-violet-700 border border-violet-500/20',
  blue:      'bg-blue-500/10 text-blue-700 border border-blue-500/20',
  orange:    'bg-orange-500/10 text-orange-700 border border-orange-500/20',
  red:       'bg-red-500/10 text-red-700 border border-red-500/20',
  secondary: 'bg-secondary text-muted-foreground',
};

const BRAND_PILL_STYLES = {
  snowflake:  'border text-[#00B9ED] bg-[#00B9ED]/10 border-[#00B9ED]/20',
  databricks: 'border text-[#CB2B1D] bg-[#CB2B1D]/10 border-[#CB2B1D]/20',
  bigquery:   'border text-[#4285F4] bg-[#4285F4]/10 border-[#4285F4]/20',
} as const;

const getFactorPillStyle = (color: string): string =>
  FACTOR_PILL_COLORS[color] || 'bg-secondary/60 text-muted-foreground';

function getBrandPillStyle(factor: CriticalFactor, deal: Deal): string | null {
  if (factor.id !== 'cloudPartner') return null;
  const partner = (deal.partnersInvolved ?? '').toLowerCase();
  const snowflake = (deal.snowflakeTeam ?? '').toLowerCase();
  if (snowflake || partner.includes('snowflake')) return BRAND_PILL_STYLES.snowflake;
  if (partner.includes('databricks')) return BRAND_PILL_STYLES.databricks;
  if (partner.includes('bigquery') || partner.includes('gcp') || partner.includes('google cloud')) return BRAND_PILL_STYLES.bigquery;
  return null;
}

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

function getPartnerIcon(deal: Deal): { Icon: LucideIcon; colorClass: string } {
  const partner = (deal.partnersInvolved ?? '').toLowerCase();
  const snowflake = (deal.snowflakeTeam ?? '').toLowerCase();
  const hasPartner = partner.length > 0 || snowflake.length > 0;
  if (snowflake || partner.includes('snowflake')) return { Icon: Cloud, colorClass: 'text-[#00B9ED]' };
  if (partner.includes('databricks')) return { Icon: Cloud, colorClass: 'text-[#CB2B1D]' };
  if (partner.includes('bigquery') || partner.includes('gcp') || partner.includes('google cloud')) return { Icon: Cloud, colorClass: 'text-[#4285F4]' };
  if (partner.includes('aws') || partner.includes('amazon') || partner.includes('azure') || partner.includes('microsoft')) return { Icon: Cloud, colorClass: 'text-cyan-500' };
  if (hasPartner) return { Icon: Users, colorClass: 'text-emerald-500' };
  return { Icon: Users, colorClass: 'text-muted-foreground/40' };
}

function getPartnerTooltipContent(deal: Deal) {
  const partner = deal.partnersInvolved;
  const role = deal.primaryPartnerRole;
  const code = deal.dealCode;
  const snowflake = deal.snowflakeTeam;
  const isSnowflake = !!(snowflake || /snowflake/i.test(partner ?? ''));
  const isDatabricks = /databricks/i.test(partner ?? '');
  const isBigQuery = /bigquery|google cloud|gcp/i.test(partner ?? '');

  let title = 'Partner Involvement';
  if (isSnowflake) title = 'Snowflake Integration';
  else if (isDatabricks) title = 'Databricks Integration';
  else if (isBigQuery) title = 'BigQuery Integration';
  else if (code?.toUpperCase().startsWith('PA')) title = 'Partner Architecture';
  else if (code?.toUpperCase().startsWith('P')) title = 'Partner Co-Sell';

  let strategy: string;
  if (isSnowflake) strategy = 'Position Domo as composable layer on Snowflake.';
  else if (isDatabricks) strategy = 'Position Domo as semantic/experience layer on Databricks.';
  else if (isBigQuery) strategy = 'Position Domo as analytics/app layer on BigQuery.';
  else if (partner) strategy = `Validate architecture with ${partner}.`;
  else strategy = 'Position Domo as control layer.';

  return { title, platform: partner || snowflake || null, role: role || null, dealCode: code || null, strategy };
}

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
    case 'materialACV':
      if (deal.acv >= 250000) return '$250K+ ACV';
      if (deal.acv >= 100000) return '$100K+ ACV';
      return factor.shortLabel;
    case 'earlyStageSweet':
      return (deal.stageNumber ?? 2) === 2 ? 'Shaping window' : 'Early stage';
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
    case 'veryStale':
      return `${deal.stageAge ?? 0}d in stage`;
    case 'partnerCoSell': {
      const p = deal.partnersInvolved;
      if (p) return `Co-sell: ${p.length > 15 ? p.substring(0, 15) + '…' : p}`;
      return factor.shortLabel;
    }
    case 'upsellExpansion':
      return deal.acv >= 100000 ? 'Material upsell' : 'Upsell';
    case 'newLogoRisk': {
      const comp = deal.numCompetitors ?? 0;
      const age = deal.stageAge ?? 0;
      if (comp >= 1 && age > 60) return 'New logo at risk';
      if (comp >= 1) return 'New + competitive';
      return `New + ${age}d stale`;
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
      if (snowflake || /snowflake/i.test(partner))
        return 'Snowflake is part of this deal. TDR should validate Domo as the composable layer.';
      if (/databricks/i.test(partner))
        return 'Databricks lakehouse is involved. Define semantic/experience layer positioning.';
      if (/bigquery|gcp|google cloud/i.test(partner))
        return 'Google BigQuery is in the stack. Validate analytics and app layer role.';
      if (partner) return `${partner} cloud platform is involved — validate integration architecture.`;
      return factor.description;
    }
    case 'materialACV': {
      const f = deal.acv >= 1000000 ? `$${(deal.acv / 1000000).toFixed(1)}M` : `$${Math.round(deal.acv / 1000)}K`;
      if (deal.acv >= 250000) return `ACV is ${f} — strategic deal demanding executive-level solution design.`;
      return `ACV is ${f} — material revenue at stake. Comprehensive solution design needed.`;
    }
    case 'earlyStageSweet':
      return (deal.stageNumber ?? 2) === 2
        ? 'Stage 2 — TDR sweet spot. Shape architecture before decisions lock in.'
        : 'Stage 3 — strong window to influence technical direction.';
    case 'competitiveDisplacement': {
      const n = deal.numCompetitors ?? 0;
      const names = deal.competitors?.trim();
      if (names) {
        return n >= 2
          ? `${n} competitors in play (${names}) — develop clear differentiation strategy.`
          : `Competitor in play (${names}) — prepare competitive battle card.`;
      }
      return n >= 2
        ? `${n} competitors in play — develop clear differentiation strategy.`
        : 'Competitor present — prepare competitive battle card.';
    }
    case 'staleSignals':
      return `Deal in stage for ${deal.stageAge ?? 0} days — investigate blockers.`;
    case 'veryStale':
      return `Stalled ${deal.stageAge ?? 0} days — re-qualify viability.`;
    case 'upsellExpansion': {
      const f = `$${Math.round(deal.acv / 1000)}K`;
      return deal.acv >= 100000
        ? `Material upsell (${f}). Validate expanded scope fits current architecture.`
        : 'Existing customer expansion — validate new use cases fit current architecture.';
    }
    case 'newLogoRisk': {
      const comp = deal.numCompetitors ?? 0;
      const age = deal.stageAge ?? 0;
      const names = deal.competitors?.trim();
      const compLabel = names ? `${comp} competitor(s): ${names}` : `${comp} competitor(s)`;
      if (comp >= 1 && age > 60) return `New logo with ${compLabel} and ${age}d stale — high risk.`;
      if (comp >= 1) return `New logo in competitive evaluation (${compLabel}).`;
      return `New logo stalling (${age}d). Investigate blockers.`;
    }
    default:
      return factor.description;
  }
}

// ─── CELL RENDERERS ────────────────────────────────────────────────────────────

function DealAccountCell({ data }: ICellRendererParams<Deal>) {
  if (!data) return null;
  return (
    <div className="min-w-0 py-1">
      <div className="flex items-center gap-1.5">
        <p className="text-[13px] font-medium text-foreground truncate">{data.account}</p>
        {data.hasIntel && (
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
        <p className="text-[11px] text-muted-foreground truncate">{data.dealName}</p>
        {data.dealType && (
          <span className={cn(
            'inline-flex items-center shrink-0 rounded px-1 py-0 text-[9px] font-medium leading-tight',
            data.dealType.toLowerCase().includes('new logo')
              ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
          )}>
            {data.dealType.toLowerCase().includes('new logo') ? 'New' : 'Upsell'}
          </span>
        )}
      </div>
                  </div>
  );
}

function StageBadgeCell({ data }: ICellRendererParams<Deal>) {
  if (!data) return null;
  const stageNum = data.stageNumber || getStageNumber(data.stage);
  const stageName = getShortStageName(data.stage);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          'inline-flex items-center gap-[3px] rounded px-1 py-0 text-2xs font-medium cursor-help whitespace-nowrap leading-[20px]',
          getStageBadgeStyle(stageNum)
        )}>
          <CheckCircle2 className={cn(
            'h-[9px] w-[9px] shrink-0',
            stageNum <= 2 ? 'text-emerald-600' : stageNum === 3 ? 'text-teal-600' : 'text-amber-600'
          )} />
          [{stageNum.toString().padStart(2, '0')}] {stageName}
                  </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-md p-4">
        <p className="text-sm font-medium text-foreground mb-1">
          {stageNum <= 2 ? 'Peak TDR Value — Architecture Shaping Window'
            : stageNum === 3 ? 'Strong TDR Value — Evaluation Phase'
            : stageNum === 4 ? 'Limited TDR Value — Confirmation Phase'
            : 'Minimal TDR Value — Closing Phase'}
        </p>
        <p className="text-sm text-foreground/75 leading-relaxed">
          {stageNum <= 2
            ? 'Maximum opportunity to shape architecture decisions before they lock in.'
            : stageNum === 3
            ? 'Customer is actively evaluating. Influence is still possible.'
            : stageNum === 4
            ? 'Technical strategy likely set. Focus on risk validation.'
            : 'Near close. Focus on risk prevention and implementation readiness.'}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function AgeDaysCell({ data }: ICellRendererParams<Deal>) {
  if (!data) return null;
  const colorClass = data.stageAge && data.stageAge >= 60
    ? 'text-red-500/80'
    : data.stageAge && data.stageAge >= 30
    ? 'text-amber-500/80'
    : '';  // inherit AG Grid's muted sage foreground
  return (
    <span className={cn('text-xs font-medium tabular-nums', colorClass)}>
      {data.stageAge ? `${data.stageAge}d` : '-'}
                  </span>
  );
}

function CurrencyCell({ data }: ICellRendererParams<Deal>) {
  if (!data) return null;
  return <span className="text-xs font-medium tabular-nums">{formatCurrency(data.acv)}</span>;
}

function getTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diffMs = Date.now() - d.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

function PropensityScoreCell({ data }: ICellRendererParams<Deal>) {
  if (!data) return null;
  const score = data.propensityScore;
  if (score == null) return <span className="text-xs text-muted-foreground/40">—</span>;

  const pct = Math.round(score * 100);
  const colorClass = pct >= 70 ? 'bg-violet-500/20 text-violet-700'
    : pct >= 40 ? 'bg-purple-400/15 text-purple-600'
    : 'bg-fuchsia-400/10 text-fuchsia-600';

  const quadrant = data.propensityQuadrant;
  const factors = data.propensityFactors;
  const scoredAt = data.propensityScoredAt;
  const timeAgo = scoredAt ? getTimeAgo(scoredAt) : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          'inline-flex items-center justify-center rounded px-1.5 text-[11px] font-semibold tabular-nums cursor-help h-5 leading-5 min-w-[32px]',
          colorClass
        )}>
          {pct}%
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Win Propensity: {pct}%</p>
            {quadrant && (
              <span className={cn(
                'rounded px-1.5 py-0.5 text-xs font-bold',
                quadrant === 'HIGH' ? 'bg-violet-500/20 text-violet-700' :
                quadrant === 'MONITOR' ? 'bg-purple-400/20 text-purple-600' :
                'bg-fuchsia-400/20 text-fuchsia-600'
              )}>{quadrant}</span>
            )}
          </div>
          {factors && factors.length > 0 && (
            <div className="border-t border-border/40 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">ML Factors</p>
              <ul className="space-y-1">
                {factors.map((f, i) => (
                  <li key={i} className="text-sm flex items-center gap-2">
                    <span className={cn(
                      'shrink-0',
                      f.direction === 'helps' ? 'text-emerald-600' :
                      f.direction === 'hurts' ? 'text-red-500' :
                      'text-muted-foreground'
                    )}>
                      {f.direction === 'helps' ? '↑' : f.direction === 'hurts' ? '↓' : '→'}
                    </span>
                    <span className="text-foreground/80">{f.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">{f.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {timeAgo && (
            <p className="text-[10px] text-muted-foreground border-t border-border/40 pt-1.5 mt-1">Scored {timeAgo}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function TDRScoreCell({ data }: ICellRendererParams<Deal>) {
  if (!data) return null;
  const preTDRScore = data.tdrScore ?? calculateTDRScore(data);
  const hasPostTDR = data.postTDRScore != null && data.postTDRScore !== preTDRScore;
  const displayScore = hasPostTDR ? data.postTDRScore! : preTDRScore;
  const priority = getPriorityFromScore(displayScore);
  const whyTags = getTopFactors(data, 2);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          'inline-flex items-center justify-center rounded px-1.5 text-[11px] font-semibold tabular-nums cursor-help h-5 leading-5 min-w-[28px]',
          getTDRBadgeStyle(displayScore),
          hasPostTDR && 'ring-1 ring-violet-500/30'
        )}>
          {displayScore}
                  </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-md p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              TDR Index: {displayScore}/100
              {hasPostTDR && (
                <span className="ml-2 text-xs font-normal text-violet-500">(Post-TDR)</span>
              )}
            </p>
            <span className={cn(
              'rounded px-1.5 py-0.5 text-xs font-bold',
              priority === 'CRITICAL' ? 'bg-red-500/20 text-red-700' :
              priority === 'HIGH' ? 'bg-emerald-500/20 text-emerald-700' :
              priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-700' :
              'bg-secondary text-muted-foreground'
            )}>{priority}</span>
          </div>
          {hasPostTDR && (
            <p className="text-xs text-muted-foreground">
              Pre-TDR base: {preTDRScore} → Post-TDR: {data.postTDRScore} (+{data.postTDRScore! - preTDRScore} from enrichment &amp; input quality)
            </p>
          )}
          <p className="text-sm text-foreground/75 leading-relaxed">
            {priority === 'CRITICAL' ? 'Immediate TDR required — multiple high-value signals converging.' :
             priority === 'HIGH' ? 'TDR strongly recommended — good intervention opportunity.' :
             priority === 'MEDIUM' ? 'TDR beneficial — monitor for escalation.' :
             'Standard process — no urgent TDR need.'}
          </p>
          {data.competitors && (
            <p className="text-sm text-foreground/75 mt-1">
              <span className="font-medium text-foreground">Competitors:</span> {data.competitors}
            </p>
          )}
          {whyTags.length > 0 && (
            <div className="border-t border-border/40 pt-2 mt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Contributing Factors</p>
              <ul className="space-y-0.5">
                {whyTags.map((f, i) => (
                  <li key={i} className="text-sm text-foreground/75 flex gap-2">
                    <span className="text-muted-foreground shrink-0">·</span>
                    <span><span className="font-medium text-foreground">{f.label}</span> — Tier {f.tier}, +{f.points}pts</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function TDRDotsCell({ data }: ICellRendererParams<Deal>) {
  if (!data) return null;
  const sessions = data.tdrSessions || [];
  const MAX_DOTS = 5;
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
                'block h-[6px] w-[6px] rounded-full',
                status === 'completed' && 'bg-emerald-500',
                status === 'in-progress' && 'bg-amber-400',
                status === 'empty' && 'bg-muted-foreground/20',
              )}
            />
          ))}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs p-3">
        <p className="text-sm font-medium text-foreground">{tooltipText}</p>
        {completed.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {completed.map((s, i) => (
              <p key={i} className="text-sm text-foreground/75">
                TDR {i + 1}: {s.completedAt ? new Date(s.completedAt).toLocaleDateString() : 'Completed'}
              </p>
            ))}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function SETeamCell({ data }: ICellRendererParams<Deal>) {
  if (!data) return null;
  return (
    <div className="space-y-0.5 min-w-0">
      {data.salesConsultant ? (
        <p className="text-xs truncate">{data.salesConsultant}</p>
      ) : (
        <p className="text-xs text-muted-foreground/40 italic">No SE</p>
      )}
      {data.pocSalesConsultant && (
        <p className="text-[10px] text-muted-foreground/70 truncate">PoC: {data.pocSalesConsultant}</p>
      )}
    </div>
  );
}

function PartnerIconCell({ data }: ICellRendererParams<Deal>) {
  if (!data) return null;
  const { Icon: PartnerIcon, colorClass } = getPartnerIcon(data);
  const partnerTip = data.partnerSignal !== 'none' ? getPartnerTooltipContent(data) : null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center justify-center cursor-help">
          <PartnerIcon className={cn('h-4 w-4', colorClass)} />
        </span>
      </TooltipTrigger>
      {partnerTip ? (
        <TooltipContent side="top" className="max-w-md p-4">
          <p className="text-sm font-medium text-foreground mb-1">{partnerTip.title}</p>
          {partnerTip.role && (
            <p className="text-sm text-foreground/75">
              Role: <span className="font-medium text-foreground">{partnerTip.role}</span>
            </p>
          )}
          {partnerTip.dealCode && (
            <p className="text-sm text-foreground/75">
              Deal Code: <span className="font-mono text-foreground">{partnerTip.dealCode}</span>
            </p>
          )}
          <p className="text-sm text-foreground/80 mt-2">→ {partnerTip.strategy}</p>
        </TooltipContent>
      ) : (
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs text-muted-foreground">No partner involvement detected</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

function WhyTDRCell({ data }: ICellRendererParams<Deal>) {
  if (!data) return null;
  const whyTags = getTopFactors(data, 3);
  const mlFactors = data.propensityFactors?.slice(0, 2) || [];
  if (whyTags.length === 0 && mlFactors.length === 0) return <span className="text-2xs text-muted-foreground">-</span>;
  return (
    <div className="flex items-center gap-0.5">
      {whyTags.map((factor, i) => {
        const IconComponent = FACTOR_ICONS[factor.icon] || Zap;
        const dynamicLabel = getDynamicFactorLabel(factor, data);
        const dynamicDesc = getDynamicFactorDescription(factor, data);
        const pillStyle = getBrandPillStyle(factor, data) || getFactorPillStyle(factor.color);
        return (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <span className={cn(
                'inline-flex items-center justify-center cursor-help rounded p-[3px]',
                pillStyle
              )}>
                <IconComponent className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-md p-4">
              <p className="text-xs font-semibold mb-1">{dynamicLabel}</p>
              <p className="text-sm text-foreground leading-relaxed mb-2">{dynamicDesc}</p>
              {factor.id === 'competitiveDisplacement' && data.competitors && (
                <p className="text-sm text-foreground/85 leading-relaxed mb-2">
                  <span className="font-medium">Competitors:</span> {data.competitors}
                </p>
              )}
              <p className="text-sm text-foreground/80 leading-relaxed mb-3">→ {factor.strategy}</p>
              {factor.tdrPrep && factor.tdrPrep.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">TDR Preparation</p>
                  <ul className="space-y-1">
                    {factor.tdrPrep.map((step, j) => (
                      <li key={j} className="text-sm text-foreground/75 leading-relaxed flex gap-2">
                        <span className="text-muted-foreground shrink-0">·</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
      {mlFactors.length > 0 && whyTags.length > 0 && (
        <span className="mx-0.5 h-3 w-px bg-border/50" />
      )}
      {mlFactors.map((f, i) => {
        const arrow = f.direction === 'helps' ? '↑' : f.direction === 'hurts' ? '↓' : '→';
        const colorClass = f.direction === 'helps'
          ? 'bg-emerald-500/10 text-emerald-600'
          : f.direction === 'hurts'
            ? 'bg-red-500/10 text-red-600'
            : 'bg-indigo-500/10 text-indigo-600';
        return (
          <Tooltip key={`ml-${i}`}>
            <TooltipTrigger asChild>
              <span className={cn(
                'inline-flex items-center justify-center cursor-help rounded p-[3px] text-2xs font-bold',
                colorClass
              )}>
                {arrow}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs p-3">
              <p className="text-sm text-foreground"><span className="font-medium">{f.name}:</span> {f.value}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {f.direction === 'helps' ? 'Positively' : f.direction === 'hurts' ? 'Negatively' : 'Neutrally'} influences close probability (ML)
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ─── COMPONENT ─────────────────────────────────────────────────────────────────

export function DealsTable({ deals, onPinDeal, onDisplayedRowsChange }: DealsTableProps) {
  const navigate = useNavigate();
  const gridRef = useRef<AgGridReact<Deal>>(null);

  /** Extract all rows that survive AG Grid's column filters and notify parent. */
  const emitDisplayedRows = useCallback((api: GridReadyEvent['api']) => {
    const displayed: Deal[] = [];
    api.forEachNodeAfterFilter((node) => {
      if (node.data) displayed.push(node.data);
    });
    onDisplayedRowsChange?.(displayed);
  }, [onDisplayedRowsChange]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
    // Report initial (unfiltered) dataset
    emitDisplayedRows(params.api);
  }, [emitDisplayedRows]);

  const onFilterChanged = useCallback((params: FilterChangedEvent) => {
    emitDisplayedRows(params.api);
  }, [emitDisplayedRows]);

  const onRowClicked = useCallback((event: RowClickedEvent<Deal>) => {
    // Don't navigate if the click was on the pin button
    const target = event.event?.target as HTMLElement | undefined;
    if (target?.closest('[data-pin-btn]')) return;
    if (event.data) {
      navigate(`/workspace?deal=${event.data.id}`);
    }
  }, [navigate]);

  const PinActionCell = useCallback(({ data }: ICellRendererParams<Deal>) => {
    if (!data) return null;
    return (
                  <Button
                    variant="ghost"
                    size="sm"
        data-pin-btn
                    className={cn(
          'h-7 gap-1 px-2',
          data.isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
          onPinDeal?.(data.id);
                    }}
                  >
        <Pin className={cn('h-3 w-3', data.isPinned && 'fill-primary text-primary')} />
        <span className="text-xs">{data.isPinned ? 'Pinned' : 'Pin'}</span>
                  </Button>
    );
  }, [onPinDeal]);

  const columnDefs = useMemo<ColDef<Deal>[]>(() => [
    {
      headerName: 'Deal / Account',
      field: 'account',
      cellRenderer: DealAccountCell,
      minWidth: 220,
      flex: 2.5,
      filter: 'agTextColumnFilter',
      filterParams: { filterOptions: ['contains'], debounceMs: 200 },
      sortable: true,
      getQuickFilterText: (params) => `${params.data?.account} ${params.data?.dealName}`,
    },
    {
      headerName: 'AE Mgr',
      field: 'owner',
      minWidth: 110,
      flex: 0.8,
      filter: 'agTextColumnFilter',
      filterParams: { filterOptions: ['contains', 'equals'], debounceMs: 200 },
      sortable: true,
      cellClass: 'text-xs',
      hide: true, // covered by TopBar filter — visible via column menu
    },
    {
      headerName: 'AE',
      field: 'accountExecutive',
      minWidth: 120,
      flex: 0.9,
      filter: 'agTextColumnFilter',
      filterParams: { filterOptions: ['contains'], debounceMs: 200 },
      sortable: true,
      cellClass: 'text-xs',
      valueFormatter: (params) => params.value || '—',
    },
    {
      headerName: 'SE Mgr',
      field: 'seManager',
      minWidth: 110,
      flex: 0.8,
      filter: 'agTextColumnFilter',
      filterParams: { filterOptions: ['contains', 'equals'], debounceMs: 200 },
      sortable: true,
      cellClass: 'text-xs',
      hide: true, // covered by TopBar filter — visible via column menu
      valueFormatter: (params) => params.value || '—',
    },
    {
      headerName: 'SE Team',
      field: 'salesConsultant',
      cellRenderer: SETeamCell,
      minWidth: 120,
      flex: 0.9,
      filter: 'agTextColumnFilter',
      filterParams: { filterOptions: ['contains'], debounceMs: 200 },
      sortable: true,
      getQuickFilterText: (params) => `${params.data?.salesConsultant || ''} ${params.data?.pocSalesConsultant || ''}`,
    },
    {
      headerName: 'Stage',
      field: 'stage',
      cellRenderer: StageBadgeCell,
      minWidth: 150,
      flex: 1,
      filter: 'agTextColumnFilter',
      filterParams: { filterOptions: ['contains'], debounceMs: 200 },
      sortable: true,
      comparator: (_, __, nodeA, nodeB) => {
        const a = nodeA?.data?.stageNumber || getStageNumber(nodeA?.data?.stage || '');
        const b = nodeB?.data?.stageNumber || getStageNumber(nodeB?.data?.stage || '');
        return a - b;
      },
    },
    {
      headerName: 'Age',
      headerTooltip: 'Stage Age (days)',
      field: 'stageAge',
      cellRenderer: AgeDaysCell,
      minWidth: 58,
      maxWidth: 72,
      filter: 'agNumberColumnFilter',
      sortable: true,
      cellStyle: { textAlign: 'center' },
      headerClass: 'ag-right-aligned-header',
    },
    {
      headerName: 'ACV',
      field: 'acv',
      cellRenderer: CurrencyCell,
      minWidth: 75,
      maxWidth: 90,
      filter: 'agNumberColumnFilter',
      sortable: true,
      cellStyle: { textAlign: 'right' },
      headerClass: 'ag-right-aligned-header',
    },
    {
      headerName: 'Win %',
      headerTooltip: 'ML Win Propensity — predicted close probability',
      field: 'propensityScore',
      cellRenderer: PropensityScoreCell,
      minWidth: 62,
      maxWidth: 75,
      filter: 'agNumberColumnFilter',
      sortable: true,
      cellStyle: { textAlign: 'center' },
      headerClass: 'ag-right-aligned-header',
      valueGetter: (params) => {
        const s = params.data?.propensityScore;
        return s != null ? Math.round(s * 100) : null;
      },
    },
    {
      headerName: 'TDR',
      headerTooltip: 'TDR Score',
      field: 'tdrScore',
      cellRenderer: TDRScoreCell,
      minWidth: 58,
      maxWidth: 72,
      filter: 'agNumberColumnFilter',
      sortable: true,
      sort: 'desc',
      cellStyle: { textAlign: 'center' },
      headerClass: 'ag-right-aligned-header',
    },
    {
      headerName: 'TDRs',
      headerTooltip: 'TDR Sessions',
      field: 'tdrSessions',
      cellRenderer: TDRDotsCell,
      minWidth: 60,
      maxWidth: 72,
      sortable: true,
      comparator: (_, __, nodeA, nodeB) => {
        const a = (nodeA?.data?.tdrSessions || []).length;
        const b = (nodeB?.data?.tdrSessions || []).length;
        return a - b;
      },
      cellStyle: { textAlign: 'center' },
    },
    {
      headerName: 'Ptr',
      headerTooltip: 'Partner Signal',
      field: 'partnerSignal',
      cellRenderer: PartnerIconCell,
      minWidth: 55,
      maxWidth: 65,
      filter: 'agTextColumnFilter',
      filterParams: { filterOptions: ['contains'], debounceMs: 200 },
      sortable: true,
      cellStyle: { textAlign: 'center' },
    },
    {
      headerName: 'Why TDR?',
      cellRenderer: WhyTDRCell,
      minWidth: 90,
      flex: 1,
      sortable: false,
      filter: false,
    },
    {
      headerName: '',
      cellRenderer: PinActionCell,
      minWidth: 70,
      maxWidth: 80,
      sortable: false,
      filter: false,
      pinned: 'right',
      cellClass: 'flex items-center justify-end',
    },
  ], [PinActionCell]);

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    suppressMovable: false,
    suppressHeaderMenuButton: false,
  }), []);

  if (deals.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-sm text-muted-foreground">No deals match the current filters.</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="panel overflow-hidden">
        <div className="border-b border-border/60 px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Recommended Deals</h2>
          <span className="text-xs text-muted-foreground">{deals.length} loaded</span>
        </div>
        <div className="ag-theme-tdr" style={{ width: '100%', height: Math.min(deals.length * 64 + 90, 800) }}>
          <AgGridReact<Deal>
            ref={gridRef}
            rowData={deals}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            onRowClicked={onRowClicked}
            onFilterChanged={onFilterChanged}
            pagination={true}
            paginationPageSize={25}
            paginationPageSizeSelector={[10, 25, 50, 100]}
            animateRows={true}
            rowSelection={{ mode: 'singleRow', enableClickSelection: false }}
            suppressCellFocus={true}
            domLayout="normal"
            headerHeight={40}
            rowHeight={64}
            tooltipShowDelay={0}
            enableCellTextSelection={false}
          />
      </div>
    </div>
    </TooltipProvider>
  );
}
