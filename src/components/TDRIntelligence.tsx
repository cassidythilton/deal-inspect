import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { Deal, ReadinessLevel } from '@/types/tdr';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Link,
  Sparkles,
  Building2,
  Users,
  User,
  Info,
  Globe,
  Search,
  Loader2,
  ExternalLink,
  RefreshCw,
  Cpu,
  Layers,
  History,
  Briefcase,
  Tag,
  TrendingUp,
  TrendingDown,
  BarChart3,
  BookOpen,
  MapPin,
  Target,
  UserCheck,
  Linkedin,
  ChevronDown,
  Zap,
  ClipboardList,
  Shield,
  HelpCircle,
  ChevronRight,
  ImageIcon,
} from 'lucide-react';
import { SumbleIcon } from '@/components/icons/SumbleIcon';
import { PerplexityIcon } from '@/components/icons/PerplexityIcon';
import { accountIntel } from '@/lib/accountIntel';
import type { SumbleEnrichment, PerplexityResearch, SumbleOrgData, SumbleJobData, SumblePeopleData } from '@/lib/accountIntel';
import { cortexAi, parseBriefSections, FINDING_CATEGORY_STYLES } from '@/lib/cortexAi';
import type { TDRBrief, ClassifiedFinding, ExtractedEntities, BriefSection, SentimentDataPoint, StructuredExtractResult, ActionPlanResult } from '@/lib/cortexAi';
import { calculateTDRScore, calculatePostTDRScore, getPriorityFromScore, detectCriticalFactors, calculateTDRConfidence } from '@/lib/tdrCriticalFactors';
import type { PostTDRScoreBreakdown, TDRConfidenceBreakdown } from '@/lib/tdrCriticalFactors';
import { getAppSettings } from '@/lib/appSettings';
import { getMLFactorDisplayName, getMLFactorExplanation } from '@/lib/constants';
import { extractTechFromSignals } from '@/lib/domoAi';
import { filesetIntel } from '@/lib/filesetIntel';
import type { FilesetSearchResult, FilesetSummary } from '@/lib/filesetIntel';
import { CortexLogo, SnowflakeLogo } from '@/components/CortexBranding';
import { parseTechStackScreenshot, buildSumbleUrl } from '@/lib/geminiVision';

interface TDRIntelligenceProps {
  deal?: Deal;
  readinessLevel: ReadinessLevel;
  missingInfo: string[];
  riskFlags: string[];
  sessionId?: string;
  completedStepCount?: number;    // required steps completed
  requiredStepCount?: number;     // total required steps (default 4)
  optionalCompletedCount?: number; // optional steps completed
  optionalTotalCount?: number;    // total optional steps (default 1)
  totalStepCount?: number;        // all steps
}

// ── Source badge component ───────────────────────────────────────────────────
function SourceBadge({ source }: { source: 'sumble' | 'perplexity' | 'cortex' | 'kb' | 'crm' }) {
  const config = {
    sumble:     { icon: SumbleIcon,     label: 'Sumble',     color: 'text-blue-400/60' },
    perplexity: { icon: PerplexityIcon, label: 'Perplexity', color: 'text-teal-400/60' },
    cortex:     { icon: CortexLogo,     label: 'Cortex AI',  color: 'text-violet-400/60' },
    kb:         { icon: BookOpen,        label: 'Knowledge Base', color: 'text-cyan-400/60' },
    crm:        { icon: Briefcase,       label: 'CRM',        color: 'text-slate-400/60' },
  }[source];
  const Icon = config.icon;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex items-center shrink-0', config.color)}>
            <Icon className="h-2.5 w-2.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px] bg-[#1e1a30] border-[#362f50] text-slate-300">
          {config.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Tech category badge colors ───────────────────────────────────────────────
const TECH_CATEGORY_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  CRM:    { label: 'CRM',             bg: 'bg-orange-500/15', text: 'text-orange-300' },
  BI:     { label: 'BI/Analytics',     bg: 'bg-blue-500/15',   text: 'text-blue-300' },
  DW:     { label: 'Data Warehouse',   bg: 'bg-violet-500/15', text: 'text-violet-300' },
  ETL:    { label: 'Data Engineering', bg: 'bg-amber-500/15',  text: 'text-amber-300' },
  Cloud:  { label: 'Cloud',            bg: 'bg-cyan-500/15',   text: 'text-cyan-300' },
  ML:     { label: 'AI/ML',            bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  ERP:    { label: 'ERP',              bg: 'bg-indigo-500/15', text: 'text-indigo-300' },
  DevOps: { label: 'DevOps',           bg: 'bg-rose-500/15',   text: 'text-rose-300' },
  Other:  { label: 'Other',            bg: 'bg-slate-500/15',  text: 'text-slate-400' },
};

function formatDate(value: string | number | null | undefined): string {
  if (!value) return '';
  let d: Date;
  if (typeof value === 'number') {
    d = new Date(value > 1e12 ? value : value * 1000);
  } else {
    d = new Date(value);
    if (isNaN(d.getTime())) {
      const epoch = parseFloat(value);
      if (!isNaN(epoch)) d = new Date(epoch * 1000);
    }
  }
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

// ── Lightweight Markdown renderer ────────────────────────────────────────────
function renderMarkdownBlock(text: string, keyPrefix: string | number = 'md'): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let paraBuffer: string[] = [];

  const flushPara = () => {
    if (paraBuffer.length === 0) return;
    const raw = paraBuffer.join(' ');
    elements.push(<p key={`${keyPrefix}-p${elements.length}`} className="mb-2 last:mb-0">{renderInline(raw)}</p>);
    paraBuffer = [];
  };
  const flushList = () => {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul key={`${keyPrefix}-ul${elements.length}`} className="mb-2 list-disc pl-4 space-y-1 last:mb-0">
        {listBuffer.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
      </ul>
    );
    listBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) { flushPara(); listBuffer.push(bulletMatch[1]); }
    else if (trimmed === '') { flushList(); flushPara(); }
    else { flushList(); paraBuffer.push(trimmed); }
  }
  flushList();
  flushPara();
  return <>{elements}</>;
}

function formatKBSummary(raw: string): React.ReactNode {
  if (!raw) return null;
  let text = raw.replace(/^["']|["']$/g, '').trim();
  text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  text = text.replace(/([.!?)\d])\s*\n?\s*([A-Z][A-Za-z &/]+:)/g, '$1\n\n$2');
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((block, i) => {
        const headerMatch = block.match(/^([A-Z][A-Za-z &/]+):\s*([\s\S]*)$/);
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        const hasBullets = lines.some((l) => /^[+\-•\t]/.test(l));
        if (headerMatch && headerMatch[2]) {
          const heading = headerMatch[1];
          const body = headerMatch[2];
          const bodyLines = body.split('\n').map((l) => l.trim()).filter(Boolean);
          const bullets = bodyLines.filter((l) => /^[+\-•]\s/.test(l));
          const prose = bodyLines.filter((l) => !/^[+\-•]\s/.test(l)).join(' ');
          return (
            <div key={i}>
              <p className="font-semibold text-slate-300 mb-0.5">{renderInline(heading)}</p>
              {prose && <p className="text-slate-400 mb-1">{renderInline(prose)}</p>}
              {bullets.length > 0 && (
                <ul className="list-disc pl-3.5 space-y-0.5 text-slate-400">
                  {bullets.map((b, j) => <li key={j}>{renderInline(b.replace(/^[+\-•]\s*/, ''))}</li>)}
                </ul>
              )}
            </div>
          );
        }
        if (hasBullets) {
          const bulletLines = lines.filter((l) => /^[+\-•\t]/.test(l));
          const nonBullet = lines.filter((l) => !/^[+\-•\t]/.test(l)).join(' ');
          return (
            <div key={i}>
              {nonBullet && <p className="text-slate-400 mb-1">{renderInline(nonBullet)}</p>}
              <ul className="list-disc pl-3.5 space-y-0.5 text-slate-400">
                {bulletLines.map((b, j) => <li key={j}>{renderInline(b.replace(/^[+\-•\t]\s*/, ''))}</li>)}
              </ul>
            </div>
          );
        }
        return <p key={i} className="text-slate-400">{renderInline(block.replace(/\n/g, ' '))}</p>;
      })}
    </>
  );
}

// ── Action Plan Section rendering ────────────────────────────────────────────
const AP_SECTION_META: Record<string, { icon: typeof Briefcase; color: string; bg: string }> = {
  'executive summary':      { icon: Briefcase,     color: 'text-violet-400',  bg: 'bg-violet-500/10' },
  'competitive strategy':   { icon: Target,        color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  'technical positioning':  { icon: Cpu,           color: 'text-cyan-400',    bg: 'bg-cyan-500/10' },
  'risk mitigation':        { icon: AlertCircle,   color: 'text-rose-400',    bg: 'bg-rose-500/10' },
  'stakeholder engagement': { icon: Users,         color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  'demo & poc strategy':    { icon: Layers,        color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  'timeline & next steps':  { icon: ClipboardList, color: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
};

function getSectionMeta(title: string) {
  const lower = title.toLowerCase();
  for (const key of Object.keys(AP_SECTION_META)) {
    if (lower.includes(key)) return AP_SECTION_META[key];
  }
  return { icon: Sparkles, color: 'text-slate-400', bg: 'bg-slate-500/10' };
}

function renderActionPlan(raw: string): React.ReactNode {
  if (!raw) return null;
  const normalized = raw.replace(/\\n/g, '\n');
  const sectionHeaderRegex = /^(\d+)\.\s+(.+)/gm;
  const matches = [...normalized.matchAll(sectionHeaderRegex)];
  if (matches.length === 0) return <div className="text-[12px] text-slate-300 leading-[1.7]">{renderMarkdownBlock(normalized, 'ap')}</div>;

  const sections: { num: string; title: string; startIdx: number; content: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    sections.push({ num: matches[i][1], title: matches[i][2].trim(), startIdx: matches[i].index!, content: '' });
  }
  for (let i = 0; i < sections.length; i++) {
    const nextStart = i + 1 < sections.length ? sections[i + 1].startIdx : normalized.length;
    const headerEnd = normalized.indexOf('\n', sections[i].startIdx);
    sections[i].content = normalized.substring(headerEnd > 0 ? headerEnd + 1 : sections[i].startIdx, nextStart).trim();
  }

  return (
    <div className="space-y-5">
      {sections.map((section) => {
        const meta = getSectionMeta(section.title);
        const Icon = meta.icon;
        return (
          <div key={`ap-s${section.num}`} className="rounded-lg border border-[#322b4d]/60 overflow-hidden">
            <div className={cn('flex items-center gap-2.5 px-4 py-2.5', meta.bg)}>
              <div className={cn('flex items-center justify-center w-6 h-6 rounded-md', meta.bg)}>
                <Icon className={cn('h-3.5 w-3.5', meta.color)} />
              </div>
              <h3 className={cn('text-[13px] font-semibold tracking-wide', meta.color)}>{section.title}</h3>
              <span className="text-[10px] text-slate-600 ml-auto font-mono">§{section.num}</span>
            </div>
            <div className="px-4 py-3 text-[12px] text-slate-300 leading-[1.7] space-y-2">
              {renderActionPlanContent(section.content)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderActionPlanContent(content: string): React.ReactNode {
  if (!content) return null;
  const elements: React.ReactNode[] = [];
  const lines = content.split('\n');
  let listBuffer: { num?: string; text: string }[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    elements.push(
      <div key={`apl-${elements.length}`} className="space-y-1.5 pl-1">
        {listBuffer.map((item, j) => (
          <div key={j} className="flex items-start gap-2">
            {item.num ? (
              <span className="text-[11px] font-semibold text-violet-400/70 mt-[1px] w-4 shrink-0">{item.num}.</span>
            ) : (
              <span className="text-slate-600 mt-[5px] text-[6px] shrink-0">●</span>
            )}
            <span>{renderInline(item.text)}</span>
          </div>
        ))}
      </div>
    );
    listBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { flushList(); continue; }
    const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (numberedMatch) { listBuffer.push({ num: numberedMatch[1], text: numberedMatch[2] }); }
    else if (bulletMatch) { listBuffer.push({ text: bulletMatch[1] }); }
    else { flushList(); elements.push(<p key={`app-${elements.length}`}>{renderInline(trimmed)}</p>); }
  }
  flushList();
  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let i = 0;
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  while ((match = regex.exec(remaining)) !== null) {
    if (match.index > lastIndex) parts.push(remaining.substring(lastIndex, match.index));
    if (match[2]) parts.push(<strong key={`b${i++}`} className="font-semibold text-slate-200">{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={`i${i++}`} className="italic text-slate-300">{match[3]}</em>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < remaining.length) parts.push(remaining.substring(lastIndex));
  return parts.length > 0 ? <>{parts}</> : text;
}

// ── Collapsible Section ──────────────────────────────────────────────────────
export interface CollapsibleSectionHandle { expand: () => void; }

const CollapsibleSection = forwardRef<CollapsibleSectionHandle, {
  title: string; icon: typeof Briefcase; iconColor?: string;
  defaultExpanded?: boolean; children: React.ReactNode;
  badge?: React.ReactNode; trailing?: React.ReactNode;
}>(function CollapsibleSection({ title, icon: Icon, iconColor = 'text-slate-500', defaultExpanded = true, children, badge, trailing }, ref) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  useImperativeHandle(ref, () => ({ expand: () => setExpanded(true) }), []);
  return (
    <div className="border-b border-[#2a2540]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-5 py-3 hover:bg-[#221d38]/30 transition-colors"
      >
        <Icon className={cn('h-3 w-3 shrink-0', iconColor)} />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 flex-1 text-left">{title}</span>
        {badge}
        {trailing}
        <ChevronDown className={cn('h-3 w-3 text-slate-600 transition-transform duration-200', !expanded && '-rotate-90')} />
      </button>
      {expanded && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
});

// ── Factor pill colors (dark-mode variants matching DealsTable palette) ──────
const INTEL_FACTOR_PILL_COLORS: Record<string, string> = {
  cyan:      'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  emerald:   'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  amber:     'bg-amber-500/10 text-amber-300 border-amber-500/20',
  violet:    'bg-violet-500/10 text-violet-300 border-violet-500/20',
  blue:      'bg-blue-500/10 text-blue-300 border-blue-500/20',
  orange:    'bg-orange-500/10 text-orange-300 border-orange-500/20',
  red:       'bg-red-500/10 text-red-300 border-red-500/20',
  secondary: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

// ── Score context descriptions (lifecycle-aware) ─────────────────────────────
// The TDR goes through distinct lifecycle phases. The score context messaging
// must shift from "you should do a TDR" → "here's what the TDR reveals."
//
// Phases:
//   NOT_STARTED  — no session or 0 steps completed, no enrichment
//   EARLY        — session exists, 1–30% steps
//   IN_PROGRESS  — 31–70% steps completed
//   NEAR_COMPLETE — 71–99% steps completed
//   COMPLETE     — 100% steps completed
//   ENRICHED     — complete + external intel pulled + strategy generated

type TDRLifecyclePhase = 'NOT_STARTED' | 'EARLY' | 'IN_PROGRESS' | 'NEAR_COMPLETE' | 'COMPLETE' | 'ENRICHED';

function getTDRLifecyclePhase(
  requiredCompleted: number,
  requiredTotal: number,
  hasSession: boolean,
  hasEnrichment: boolean,
  hasActionPlan: boolean,
): TDRLifecyclePhase {
  // Lifecycle is based on REQUIRED steps only — optional steps don't block completion
  const ratio = requiredTotal > 0 ? requiredCompleted / requiredTotal : 0;
  if (ratio >= 1.0 && hasEnrichment && hasActionPlan) return 'ENRICHED';
  if (ratio >= 1.0) return 'COMPLETE';
  if (ratio >= 0.71) return 'NEAR_COMPLETE';
  if (ratio >= 0.31) return 'IN_PROGRESS';
  if (ratio > 0 || hasSession) return 'EARLY';
  return 'NOT_STARTED';
}

const PRIORITY_CONTEXT: Record<TDRLifecyclePhase, Record<string, { headline: string; description: string }>> = {
  NOT_STARTED: {
    CRITICAL: {
      headline: 'Requires immediate TDR',
      description: 'Multiple high-value signals converging — material ACV, competitive displacement, active cloud partner, and/or greenfield architecture. SE must shape technical strategy now before architecture decisions lock in.',
    },
    HIGH: {
      headline: 'Strong TDR candidate',
      description: 'Significant deal complexity that warrants a full Technical Deal Review. Architecture shaping, partner alignment, and competitive positioning should be actively managed.',
    },
    MEDIUM: {
      headline: 'TDR recommended',
      description: 'Deal has meaningful technical dimensions. A TDR will help validate architecture fit, identify risks early, and ensure the solution aligns with the customer\'s data strategy.',
    },
    LOW: {
      headline: 'Monitor — TDR optional',
      description: 'Standard deal without strong TDR triggers. Consider a lightweight review if deal progresses or new competitive/technical signals emerge.',
    },
  },
  EARLY: {
    CRITICAL: {
      headline: 'TDR underway — high complexity detected',
      description: 'Early-stage TDR on a high-complexity deal. Focus on uncovering competitive landscape, cloud architecture requirements, and key stakeholder alignment. Every input shapes the strategic picture.',
    },
    HIGH: {
      headline: 'TDR underway — continue building the picture',
      description: 'Good start. Continue completing TDR steps to validate architecture fit, competitive positioning, and partner alignment. Enrich with external intelligence to strengthen the analysis.',
    },
    MEDIUM: {
      headline: 'TDR underway — capturing key dimensions',
      description: 'Technical review in progress. Each completed step adds clarity to the risk profile and solution fit. Consider pulling external intelligence for competitive and technology context.',
    },
    LOW: {
      headline: 'TDR underway — lightweight review',
      description: 'Standard deal under review. Complete the key steps to confirm solution alignment and identify any hidden risks or competitive dynamics.',
    },
  },
  IN_PROGRESS: {
    CRITICAL: {
      headline: 'TDR in progress — key risks surfacing',
      description: 'Multiple risk vectors are becoming visible. Continue completing steps to validate all dimensions. Pull external intelligence if not yet done — competitive and technology signals are critical for this deal.',
    },
    HIGH: {
      headline: 'TDR in progress — strategy taking shape',
      description: 'The technical picture is forming. Architecture, competitive, and partner dimensions are becoming clearer. Complete remaining steps and generate an action plan to crystalize the strategy.',
    },
    MEDIUM: {
      headline: 'TDR in progress — good coverage',
      description: 'Solid progress. Continue filling in remaining areas to ensure complete risk awareness. The completed inputs are already informing the readiness assessment.',
    },
    LOW: {
      headline: 'TDR in progress — nearly sufficient',
      description: 'Lightweight review progressing well. Complete the remaining steps to finalize the assessment. No major risk signals detected so far.',
    },
  },
  NEAR_COMPLETE: {
    CRITICAL: {
      headline: 'TDR nearly complete — validate remaining gaps',
      description: 'Almost done. The high-complexity signals on this deal are well-documented. Close out remaining steps, then review the action plan and readiness assessment before proceeding.',
    },
    HIGH: {
      headline: 'TDR nearly complete — finalize strategy',
      description: 'Strong coverage. A few steps remain to complete the picture. Generate or refresh the action plan to capture the latest intelligence in a concrete strategy.',
    },
    MEDIUM: {
      headline: 'TDR nearly complete — wrap up',
      description: 'Most dimensions are covered. Finish the last inputs to finalize the readiness assessment and ensure no blind spots remain.',
    },
    LOW: {
      headline: 'TDR nearly complete — confirm and close',
      description: 'Review is nearly done. Finalize remaining steps and confirm the deal is ready to proceed without further technical intervention.',
    },
  },
  COMPLETE: {
    CRITICAL: {
      headline: 'TDR complete — execute action plan',
      description: 'All required steps completed. Complexity is documented. Next: pull external intelligence (Sumble, Perplexity) to validate competitive positioning and generate the action plan. Share the TDR readout with your manager for review.',
    },
    HIGH: {
      headline: 'TDR complete — refine and share',
      description: 'All required steps completed and the technical picture is clear. Next: enrich with external intelligence to strengthen competitive positioning, then share the readout with your deal team and manager.',
    },
    MEDIUM: {
      headline: 'TDR complete — readiness confirmed',
      description: 'All required steps completed. The solution approach is validated and risks are understood. Enrich with external intelligence if time allows, then proceed with confidence.',
    },
    LOW: {
      headline: 'TDR complete — clear to proceed',
      description: 'All required steps completed. No significant technical risks identified. Proceed through standard execution. Consider enriching only if deal dynamics change.',
    },
  },
  ENRICHED: {
    CRITICAL: {
      headline: 'Fully informed — manage through close',
      description: 'TDR complete with external intelligence. Architecture validated, competitive threats identified, action plan generated. Focus now shifts to execution: align stakeholders, monitor competitive shifts, and revisit the readout before key meetings.',
    },
    HIGH: {
      headline: 'Fully informed — execute and monitor',
      description: 'TDR and intelligence complete. Strategy is well-defined with clear competitive positioning and architecture validation. Execute the action plan, share the readout, and monitor for any shifts in the deal landscape.',
    },
    MEDIUM: {
      headline: 'Fully informed — proceed with confidence',
      description: 'Comprehensive assessment complete. Risk profile understood, solution fit confirmed, intelligence gathered. Share the readout with your team and proceed with the defined approach.',
    },
    LOW: {
      headline: 'Fully informed — standard path confirmed',
      description: 'Full assessment complete. Straightforward technical profile with no significant risks validated by external intelligence. Standard execution path confirmed.',
    },
  },
};

// Pre-TDR scoring component labels (aligned to TDR Framework sections)
const PRE_TDR_FACTOR_LABELS: { key: string; label: string; description: string; max: number }[] = [
  { key: 'acv',       label: 'ACV Significance',       description: 'Material ARR triggers TDR eligibility — larger deals carry higher strategic risk',               max: 20 },
  { key: 'stage',     label: 'Stage TDR Value',         description: 'Stage 2–3 is the architecture shaping window where SE influence is highest',                     max: 15 },
  { key: 'cloud',     label: 'Cloud Partner Alignment',  description: 'Snowflake/Databricks/cloud platform involvement requires architecture validation (TDR §6)',     max: 15 },
  { key: 'comp',      label: 'Competitive Pressure',     description: 'Named competitors create displacement risk requiring differentiation strategy (TDR §8)',        max: 10 },
  { key: 'dealType',  label: 'Deal Type Signal',         description: 'New logos need full architecture review; upsells need expansion validation',                     max: 23 },
  { key: 'forecast',  label: 'Forecast Momentum',        description: 'Probable/Best Case deals are real but still shapeable — the TDR sweet spot',                    max: 10 },
  { key: 'freshness', label: 'Stage Freshness',          description: 'Fresh deals are healthy; stale deals (>180d) indicate blockers and may deprioritize',           max: 5 },
  { key: 'complexity',label: 'Deal Complexity',           description: 'Multi-component, partner architecture, or enterprise deal codes increase coordination needs',  max: 10 },
  { key: 'partner',   label: 'Partner Role Strength',    description: 'Co-sell and reseller motions add integration complexity that needs architecture review',         max: 5 },
];


// ══════════════════════════════════════════════════════════════════════════════
//   MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export function TDRIntelligence({
  deal,
  readinessLevel,
  missingInfo,
  riskFlags,
  sessionId,
  completedStepCount = 0,
  requiredStepCount = 4,
  optionalCompletedCount = 0,
  optionalTotalCount = 1,
  totalStepCount = 5,
}: TDRIntelligenceProps) {

  // ── Section refs for scroll navigation ──
  const kbSectionRef = useRef<HTMLDivElement>(null);
  const kbCollapseRef = useRef<CollapsibleSectionHandle>(null);
  const enrichBarRef = useRef<HTMLDivElement>(null);
  const riskSectionRef = useRef<HTMLDivElement>(null);
  const riskCollapseRef = useRef<CollapsibleSectionHandle>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  // ── Account Intelligence State ──
  const [domain, setDomain] = useState('');
  const [sumbleData, setSumbleData] = useState<SumbleEnrichment | null>(null);
  const [perplexityData, setPerplexityData] = useState<PerplexityResearch | null>(null);
  const [sumbleLoading, setSumbleLoading] = useState(false);
  const [perplexityLoading, setPerplexityLoading] = useState(false);
  const [intelLoaded, setIntelLoaded] = useState(false);
  const [sumbleError, setSumbleError] = useState<string | null>(null);
  const [perplexityError, setPerplexityError] = useState<string | null>(null);
  const [enrichAllLoading, setEnrichAllLoading] = useState(false);
  const [enrichAllProgress, setEnrichAllProgress] = useState('');
  const [screenshotParsing, setScreenshotParsing] = useState(false);
  const [screenshotTechs, setScreenshotTechs] = useState<string[]>([]);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);

  // ── Intel History State ──
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<Record<string, unknown>[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Cortex AI State ──
  const [briefData, setBriefData] = useState<TDRBrief | null>(null);
  const [briefSections, setBriefSections] = useState<BriefSection[]>([]);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefGeneratedAt, setBriefGeneratedAt] = useState<string>('');
  const [briefCacheLoaded, setBriefCacheLoaded] = useState(false);
  const [classifiedFindings, setClassifiedFindings] = useState<ClassifiedFinding[]>([]);
  const [extractedEntities, setExtractedEntities] = useState<ExtractedEntities | null>(null);
  const [cortexProcessing, setCortexProcessing] = useState(false);

  // ── Structured Extraction ──
  const [extractionResult, setExtractionResult] = useState<StructuredExtractResult | null>(null);
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [extractionCacheLoaded, setExtractionCacheLoaded] = useState(false);
  const [, setExtractionDate] = useState<string>('');

  // ── Action Plan ──
  const [actionPlanResult, setActionPlanResult] = useState<ActionPlanResult | null>(null);
  const [actionPlanLoading, setActionPlanLoading] = useState(false);
  const [actionPlanOpen, setActionPlanOpen] = useState(false);
  const [actionPlanCacheLoaded, setActionPlanCacheLoaded] = useState(false);

  // ── Action Brief (Sprint 37 — prescriptive "so what") ──
  const [actionBriefExpanded, setActionBriefExpanded] = useState(true);
  const [scoreDetailExpanded, setScoreDetailExpanded] = useState(false);

  // ── KB Summary Cache ──
  const [kbSummaryCacheLoaded, setKbSummaryCacheLoaded] = useState(false);
  const [kbSummaryDate, setKbSummaryDate] = useState<string>('');

  // ── Deep Intelligence ──
  const [sumbleOrgData, setSumbleOrgData] = useState<SumbleOrgData | null>(null);
  const [sumbleJobData, setSumbleJobData] = useState<SumbleJobData | null>(null);
  const [sumblePeopleData, setSumblePeopleData] = useState<SumblePeopleData | null>(null);

  // ── Sentiment & Similar ──
  const [evolutionText, setEvolutionText] = useState<string>('');
  const [evolutionPullCount, setEvolutionPullCount] = useState(0);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionOpen, setEvolutionOpen] = useState(false);
  const [sentimentTrend, setSentimentTrend] = useState<SentimentDataPoint[]>([]);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentNoInputs, setSentimentNoInputs] = useState(false);
  const [sentimentFetched, setSentimentFetched] = useState(false);
  const [similarDeals, setSimilarDeals] = useState<{ opportunityId: string; accountName: string; similarityScore: number; sessionId?: string }[]>([]);
  const [similarDealsLoading, setSimilarDealsLoading] = useState(false);

  // ── Final Outcome ──
  const [finalOutcome, setFinalOutcome] = useState<string>('');

  // ── Fileset Intelligence ──
  const [filesetResults, setFilesetResults] = useState<FilesetSearchResult | null>(null);
  const [filesetSummary, setFilesetSummary] = useState<FilesetSummary | null>(null);
  const [filesetLoading, setFilesetLoading] = useState(false);
  const [filesetSearched, setFilesetSearched] = useState(false);
  const [filesetCortexAttempted, setFilesetCortexAttempted] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState<Set<number>>(new Set());

  // ── TDR Score context ──
  const [scoreContextOpen, setScoreContextOpen] = useState(false);
  const [shapExpanded, setShapExpanded] = useState(false);

  // ── Perplexity tech extraction ──
  const [perplexityTechNames, setPerplexityTechNames] = useState<string[]>([]);
  const [perplexityTechLoading, setPerplexityTechLoading] = useState(false);

  // ── Pre-fill domain ──
  useEffect(() => {
    if (deal?.websiteDomain) {
      const raw = deal.websiteDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
      setDomain(raw || accountIntel.guessDomain(deal.account));
    } else if (deal?.account) {
      setDomain(accountIntel.guessDomain(deal.account));
    }
  }, [deal?.websiteDomain, deal?.account]);

  // ── Load cached intel ──
  useEffect(() => {
    if (!deal?.id || intelLoaded) return;
    setIntelLoaded(true);
    const loadCachedIntel = async () => {
      try {
        const cached = await accountIntel.getLatestIntel(deal.id);
        if (cached.hasSumble && cached.sumble) setSumbleData(cached.sumble);
        if (cached.hasPerplexity && cached.perplexity) setPerplexityData(cached.perplexity);
        if (cached.hasSumbleOrg && cached.sumbleOrg) setSumbleOrgData(cached.sumbleOrg);
        if (cached.hasSumbleJobs && cached.sumbleJobs) setSumbleJobData(cached.sumbleJobs);
        if (cached.hasSumblePeople && cached.sumblePeople) setSumblePeopleData(cached.sumblePeople);
      } catch (err) { console.warn('[TDRIntelligence] Failed to load cached intel:', err); }
    };
    loadCachedIntel();
  }, [deal?.id, intelLoaded]);

  // ── Load cached brief ──
  useEffect(() => {
    if (!sessionId || briefCacheLoaded) return;
    setBriefCacheLoaded(true);
    const loadCachedBrief = async () => {
      try {
        const cached = await cortexAi.getLatestBrief(sessionId);
        if (cached.hasBrief && cached.brief) {
          setBriefData({ success: true, brief: cached.brief, modelUsed: cached.modelUsed, resultId: cached.resultId });
          setBriefSections(parseBriefSections(cached.brief));
          setBriefGeneratedAt(cached.createdAt || '');
        }
      } catch (err) { console.warn('[TDRIntelligence] Failed to load cached brief:', err); }
    };
    loadCachedBrief();
  }, [sessionId, briefCacheLoaded]);

  // ── Load cached action plan ──
  useEffect(() => {
    if (!sessionId || actionPlanCacheLoaded) return;
    setActionPlanCacheLoaded(true);
    const loadCachedActionPlan = async () => {
      try {
        const cached = await cortexAi.getLatestActionPlan(sessionId);
        const plan = cached.actionPlan?.trim() ?? '';
        const isEmpty = !plan || plan === 'No action plan generated.' || plan.length < 20;
        if (cached.hasPlan && !isEmpty) {
          setActionPlanResult({ success: true, actionPlan: plan, modelUsed: cached.modelUsed, createdAt: cached.createdAt, cached: true });
        }
      } catch (err) { console.warn('[TDRIntelligence] Failed to load cached action plan:', err); }
    };
    loadCachedActionPlan();
  }, [sessionId, actionPlanCacheLoaded]);

  // ── Load cached extraction / auto-extract silently ──
  useEffect(() => {
    if (!sessionId || extractionCacheLoaded) return;
    setExtractionCacheLoaded(true);
    const loadCachedExtraction = async () => {
      try {
        const cached = await cortexAi.getLatestExtraction(sessionId);
        if (cached.hasExtract && cached.structured) {
          setExtractionResult({ success: true, extractId: cached.extractId, structured: cached.structured });
          setExtractionDate(cached.extractedAt || '');
        } else {
          setExtractionLoading(true);
          try {
            const result = await cortexAi.extractStructuredTDR(sessionId);
            setExtractionResult(result);
            if (result.success) setExtractionDate(new Date().toISOString());
          } catch (extractErr) { console.warn('[TDRIntelligence] Auto-extraction failed:', extractErr); }
          setExtractionLoading(false);
        }
      } catch (err) { console.warn('[TDRIntelligence] Failed to load cached extraction:', err); }
    };
    loadCachedExtraction();
  }, [sessionId, extractionCacheLoaded]);

  // ── Auto-search filesets ──
  useEffect(() => {
    if (filesetSearched || !deal) return;
    const settings = getAppSettings();
    if ((settings.filesetIds ?? []).length === 0) return;
    setFilesetSearched(true);
    setFilesetLoading(true);
    const doSearch = async () => {
      try {
        const competitors = deal.competitors ? (Array.isArray(deal.competitors) ? deal.competitors : [deal.competitors]) : [];
        const result = await filesetIntel.searchByDealContext({
          accountName: deal.account, competitors: competitors as string[],
          partnerPlatform: deal.partnersInvolved || undefined, cloudPlatform: deal.snowflakeTeam || undefined,
        });
        setFilesetResults(result);
        if (result.matches.length > 0) {
          const dealContext = `${deal.account} — ${deal.stage} — ACV $${(deal.acv ?? 0).toLocaleString()}`;
          const summary = await filesetIntel.getIntelligenceSummary(result, dealContext, competitors as string[], sessionId);
          setFilesetSummary(summary);
        }
      } catch (err) { console.warn('[FilesetIntel] Auto-search failed:', err); }
      setFilesetLoading(false);
    };
    doSearch();
  }, [deal, filesetSearched, sessionId]);

  // ── Extract tech names from Perplexity signals ──
  useEffect(() => {
    const signals = perplexityData?.technologySignals;
    if (!signals || signals.length === 0 || perplexityTechNames.length > 0 || perplexityTechLoading) return;
    setPerplexityTechLoading(true);
    extractTechFromSignals(signals)
      .then(names => setPerplexityTechNames(names))
      .catch(() => {})
      .finally(() => setPerplexityTechLoading(false));
  }, [perplexityData?.technologySignals, perplexityTechNames.length, perplexityTechLoading]);

  // ── Load or generate KB summary ──
  useEffect(() => {
    if (!sessionId || !filesetResults || filesetResults.matches.length === 0 || !deal) return;
    if (filesetCortexAttempted) return;
    setFilesetCortexAttempted(true);
    const loadOrSummarize = async () => {
      if (!kbSummaryCacheLoaded) {
        try {
          const cached = await cortexAi.getCachedKBSummary(sessionId);
          if (cached.hasSummary && cached.summary) {
            setFilesetSummary(prev => prev ? { ...prev, summary: cached.summary! } : { matchSignal: 'partial' as const, summary: cached.summary!, relevantDocuments: [], competitorInsights: [], partnerInsights: [] });
            setKbSummaryDate(cached.createdAt || '');
            setKbSummaryCacheLoaded(true);
            return;
          }
        } catch (err) { console.warn('[FilesetIntel] Cache check failed:', err); }
        setKbSummaryCacheLoaded(true);
      }
      if (!filesetSummary || filesetSummary.summary === '') return;
      try {
        const competitors = deal.competitors ? (Array.isArray(deal.competitors) ? deal.competitors : [deal.competitors]) : [];
        const dealContext = `${deal.account} — ${deal.stage} — ACV $${(deal.acv ?? 0).toLocaleString()}`;
        const summary = await filesetIntel.getIntelligenceSummary(filesetResults, dealContext, competitors as string[], sessionId);
        setFilesetSummary(summary);
        setKbSummaryDate(new Date().toISOString());
      } catch (err) { console.warn('[FilesetIntel] Cortex summarization failed:', err); }
    };
    loadOrSummarize();
  }, [sessionId, filesetResults, filesetSummary, deal, filesetCortexAttempted, kbSummaryCacheLoaded]);

  // ── Handlers ──
  const handleFilesetSearch = useCallback(async () => {
    if (!deal) return;
    setFilesetLoading(true);
    try {
      const competitors = deal.competitors ? (Array.isArray(deal.competitors) ? deal.competitors : [deal.competitors]) : [];
      const result = await filesetIntel.searchByDealContext({ accountName: deal.account, competitors: competitors as string[], partnerPlatform: deal.partnersInvolved || undefined, cloudPlatform: deal.snowflakeTeam || undefined });
      setFilesetResults(result);
      if (result.matches.length > 0) {
        const dealContext = `${deal.account} — ${deal.stage} — ACV $${(deal.acv ?? 0).toLocaleString()}`;
        const summary = await filesetIntel.getIntelligenceSummary(result, dealContext, competitors as string[], sessionId);
        setFilesetSummary(summary);
      }
    } catch (err) { console.warn('[FilesetIntel] Manual search failed:', err); }
    setFilesetLoading(false);
  }, [deal, sessionId]);

  const handleEnrichAll = useCallback(async () => {
    if (!deal || !domain.trim()) return;
    setEnrichAllLoading(true);
    setEnrichAllProgress('Enriching...');
    setSumbleError(null);
    try {
      const result = await accountIntel.enrichAll(deal.id, deal.account, domain.trim());
      if (result.sumble?.success) setSumbleData(result.sumble);
      if (result.org?.success) setSumbleOrgData(result.org);
      if (result.jobs?.success) setSumbleJobData(result.jobs);
      if (result.people?.success) setSumblePeopleData(result.people);
      if (result.errors.length > 0) setSumbleError(`${result.errors.join('; ')}`);
      setEnrichAllProgress(result.completedCount === 1 ? 'Complete' : 'Failed');
    } catch (err) { setSumbleError(err instanceof Error ? err.message : 'Enrichment failed'); }
    setEnrichAllLoading(false);
  }, [deal, domain]);

  const handleResearchPerplexity = useCallback(async () => {
    if (!deal) return;
    setPerplexityLoading(true);
    setPerplexityError(null);
    try {
      const result = await accountIntel.researchPerplexity(deal.id, deal.account, { acv: deal.acv, stage: deal.stage, partnersInvolved: deal.partnersInvolved || undefined });
      if (result.success) {
        setPerplexityData(result);
        if (result.pullId) {
          setCortexProcessing(true);
          try {
            const [classifyResult, extractResult] = await Promise.allSettled([cortexAi.classifyFindings(result.pullId), cortexAi.extractEntities(result.pullId)]);
            if (classifyResult.status === 'fulfilled' && classifyResult.value.success) setClassifiedFindings(classifyResult.value.findings);
            if (extractResult.status === 'fulfilled' && extractResult.value.success) setExtractedEntities(extractResult.value);
          } catch (cortexErr) { console.warn('[TDRIntelligence] Cortex post-processing error:', cortexErr); }
          setCortexProcessing(false);
        }
      } else { setPerplexityError(typeof result.error === 'string' ? result.error : 'Research failed'); }
    } catch (err) { setPerplexityError(err instanceof Error ? err.message : 'Unexpected error'); }
    setPerplexityLoading(false);
  }, [deal]);

  const processScreenshotBlob = useCallback(async (blob: Blob, mimeType: string) => {
    setScreenshotError(null);
    setScreenshotParsing(true);
    try {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const result = await parseTechStackScreenshot(base64, mimeType);
      if (result.success) {
        setScreenshotTechs(result.technologies);
        if (sumbleData) {
          const merged = new Set([...(sumbleData.technologies || []), ...result.technologies]);
          setSumbleData({ ...sumbleData, technologies: Array.from(merged) });
        } else {
          setSumbleData({ success: true, technologies: result.technologies, orgName: deal?.account || '', industryTags: [] });
        }
      } else {
        setScreenshotError(result.error || 'Failed to parse screenshot');
      }
    } catch (err) {
      setScreenshotError(err instanceof Error ? err.message : 'Failed to process image');
    }
    setScreenshotParsing(false);
    if (screenshotInputRef.current) screenshotInputRef.current.value = '';
  }, [deal, sumbleData]);

  const handleScreenshotFile = useCallback((file: File) => {
    processScreenshotBlob(file, file.type || 'image/png');
  }, [processScreenshotBlob]);

  const handlePasteEvent = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) processScreenshotBlob(blob, items[i].type);
        return;
      }
    }
  }, [processScreenshotBlob]);

  const handleGenerateBrief = useCallback(async () => {
    if (!sessionId) return;
    setBriefLoading(true);
    setBriefOpen(true);
    try {
      const result = await cortexAi.generateTDRBrief(sessionId);
      setBriefData(result);
      if (result.success && result.brief) { setBriefSections(parseBriefSections(result.brief)); setBriefGeneratedAt(new Date().toISOString()); }
    } catch (err) { setBriefData({ success: false, error: String(err) }); }
    setBriefLoading(false);
  }, [sessionId]);

  const handleViewHistory = useCallback(async () => {
    if (!deal) return;
    setHistoryOpen(true);
    if (historyData.length > 0) return;
    setHistoryLoading(true);
    try { const data = await accountIntel.getIntelHistory(deal.id); setHistoryData(data); } catch (err) { console.warn('[TDRIntelligence] Failed to load intel history:', err); }
    setHistoryLoading(false);
  }, [deal, historyData.length]);

  const handleLoadEvolution = useCallback(async () => {
    if (!deal?.id) return;
    setEvolutionOpen(true);
    if (evolutionText) return;
    setEvolutionLoading(true);
    try {
      const result = await cortexAi.summarizeIntelHistory(deal.id);
      if (result.success) { setEvolutionText(result.evolution); setEvolutionPullCount(result.pullCount); }
      else setEvolutionText('Unable to generate evolution summary.');
    } catch { setEvolutionText('Error loading evolution summary.'); }
    setEvolutionLoading(false);
  }, [deal?.id, evolutionText]);

  const handleLoadSentiment = useCallback(async () => {
    if (!deal?.id) return;
    setSentimentLoading(true);
    setSentimentNoInputs(false);
    try {
      const result = await cortexAi.getSentimentTrend(deal.id);
      if (result.success) {
        const validTrend = (result.trend || []).filter((pt) => pt.sentiment != null && !isNaN(pt.sentiment));
        setSentimentTrend(validTrend);
        setSentimentNoInputs(result.noInputs === true || validTrend.length === 0);
      }
    } catch (err) { console.warn('[TDRIntelligence] Failed to load sentiment trend:', err); }
    setSentimentLoading(false);
    setSentimentFetched(true);
  }, [deal?.id]);

  const handleFindSimilarDeals = useCallback(async () => {
    if (!deal?.id) return;
    setSimilarDealsLoading(true);
    try {
      const result = await cortexAi.findSimilarDeals(deal.id);
      if (result.success) setSimilarDeals((result.deals || []).filter((d) => d.similarityScore != null && !isNaN(d.similarityScore)));
    } catch (err) { console.warn('[TDRIntelligence] Failed to find similar deals:', err); }
    setSimilarDealsLoading(false);
  }, [deal?.id]);

  // ── Auto-load Research & Similar when intel is available ──
  const [autoLoadedResearch, setAutoLoadedResearch] = useState(false);
  useEffect(() => {
    if (autoLoadedResearch || !deal?.id) return;
    // Load similar deals, history, and sentiment automatically
    const autoLoad = async () => {
      setAutoLoadedResearch(true);
      // Similar deals
      setSimilarDealsLoading(true);
      try {
        const result = await cortexAi.findSimilarDeals(deal.id);
        if (result.success) setSimilarDeals((result.deals || []).filter((d) => d.similarityScore != null && !isNaN(d.similarityScore)));
      } catch (err) { console.warn('[TDRIntelligence] Auto-load similar deals failed:', err); }
      setSimilarDealsLoading(false);

      // History (only if we have intel data)
      if (sumbleData || perplexityData) {
        setHistoryLoading(true);
        try { const data = await accountIntel.getIntelHistory(deal.id); setHistoryData(data); } catch (err) { console.warn('[TDRIntelligence] Auto-load history failed:', err); }
        setHistoryLoading(false);
      }
    };
    autoLoad();
  }, [deal?.id, autoLoadedResearch, sumbleData, perplexityData]);

  // ── Computed values ──
  const hasIntel = !!(sumbleData || perplexityData);

  // Compute competitive threat level (merges multiple sources)
  const allCompetitors = (() => {
    const set = new Set<string>();
    (extractedEntities?.competitors ?? []).forEach(c => set.add(c));
    (extractionResult?.structured?.NAMED_COMPETITORS ?? []).forEach(c => set.add(c));
    (sumbleJobData?.competitiveTechPosts ?? []).forEach(c => set.add(c));
    return Array.from(set);
  })();

  const competitiveThreatLevel = allCompetitors.length >= 3 ? 'High' : allCompetitors.length >= 1 ? 'Med' : 'Low';
  const hiringVelocity = sumbleJobData?.hiringVelocity ?? null;
  const kbMatchSignal = filesetSummary?.matchSignal ?? 'none';
  const enrichmentLevel = (() => {
    let count = 0;
    if (sumbleData?.success) count++;
    if (perplexityData?.success) count++;
    if (count >= 2) return 'Full';
    if (count >= 1) return 'Partial';
    return 'None';
  })();

  // Merge all technologies from all sources
  const allTechnologies = (() => {
    const map = new Map<string, Set<string>>(); // tech → sources
    (sumbleData?.technologies ?? []).filter(t => typeof t === 'string' && t).forEach(t => {
      const s = map.get(t) ?? new Set();
      s.add('sumble');
      map.set(t, s);
    });
    perplexityTechNames.filter(t => typeof t === 'string' && t).forEach(t => {
      const s = map.get(t) ?? new Set();
      s.add('perplexity');
      map.set(t, s);
    });
    (extractedEntities?.technologies ?? []).filter(t => typeof t === 'string' && t).forEach(t => {
      const s = map.get(t) ?? new Set();
      s.add('cortex');
      map.set(t, s);
    });
    (extractionResult?.structured?.NAMED_TECHNOLOGIES ?? []).forEach(t => {
      const s = map.get(t) ?? new Set();
      s.add('cortex');
      map.set(t, s);
    });
    return map;
  })();

  // Merge all competitive findings
  const competitiveFindings = (() => {
    const items: { text: string; source: 'perplexity' | 'cortex' | 'kb' | 'sumble' }[] = [];
    (perplexityData?.competitiveLandscape ?? []).forEach(f => items.push({ text: f, source: 'perplexity' }));
    classifiedFindings.filter(f => f.category === 'competitive_risk').forEach(f => items.push({ text: f.finding, source: 'cortex' }));
    (filesetSummary?.competitorInsights ?? []).forEach(f => items.push({ text: f, source: 'kb' }));
    return items;
  })();

  // Merge all strategic signals
  const strategicSignals = (() => {
    const items: { text: string; source: 'perplexity' | 'cortex' | 'sumble' }[] = [];
    (perplexityData?.recentInitiatives ?? []).forEach(f => items.push({ text: f, source: 'perplexity' }));
    (perplexityData?.keyInsights ?? []).forEach(f => items.push({ text: f, source: 'perplexity' }));
    classifiedFindings.filter(f => ['strategic_initiative', 'expansion_opportunity'].includes(f.category)).forEach(f => items.push({ text: f.finding, source: 'cortex' }));
    return items;
  })();

  // Merge all people
  const allPeople = (() => {
    const items: { name: string; title?: string; linkedinUrl?: string; technologies: string[]; source: 'sumble' | 'cortex' }[] = [];
    (sumblePeopleData?.peopleSummary ?? []).forEach(p => items.push({ name: p.name, title: p.title, linkedinUrl: p.linkedinUrl, technologies: p.technologies, source: 'sumble' }));
    // Add extracted entities executives (names only)
    (extractedEntities?.executives ?? []).forEach(e => {
      if (typeof e !== 'string' || !e) return;
      if (!items.some(i => i.name.toLowerCase().includes(e.toLowerCase()) || e.toLowerCase().includes(i.name.toLowerCase()))) {
        items.push({ name: e, technologies: [], source: 'cortex' });
      }
    });
    // Add structured extract stakeholders
    (extractionResult?.structured?.NAMED_STAKEHOLDERS ?? []).forEach(s => {
      const sName = String(s?.name ?? '');
      if (!sName) return;
      if (!items.some(i => i.name.toLowerCase().includes(sName.toLowerCase()) || sName.toLowerCase().includes(i.name.toLowerCase()))) {
        items.push({ name: sName, title: s.role, technologies: [], source: 'cortex' });
      }
    });
    return items;
  })();

  return (
    <div className="flex h-full flex-col overflow-y-auto">

      {/* ══════════════════════════════════════════════════════════════
          ZONE A — SITUATION ROOM
          Deal header + TDR Score with context + Signal strip
          ══════════════════════════════════════════════════════════════ */}
      {deal && (() => {
        const preTDRScore = deal.tdrScore ?? calculateTDRScore(deal);
        const settings = getAppSettings();
        const hasAnyPostData = !!sumbleData?.success || !!perplexityData?.success || completedStepCount > 0 || (extractionResult?.success && extractionResult.structured);
        let postBreakdown: PostTDRScoreBreakdown | null = null;
        if (hasAnyPostData) {
          const postCtx = {
            namedCompetitors: extractedEntities?.competitors ?? extractionResult?.structured?.NAMED_COMPETITORS ?? [],
            dangerousCompetitors: settings.dangerousCompetitors,
            hasSumbleEnrichment: !!sumbleData?.success,
            hasPerplexityEnrichment: !!perplexityData?.success,
            riskCategories: extractionResult?.structured?.RISK_CATEGORIES ?? [],
            dealComplexity: extractionResult?.structured?.DEAL_COMPLEXITY,
            domoUseCases: extractionResult?.structured?.DOMO_USE_CASES ?? [],
            completedStepCount,
            totalStepCount: requiredStepCount,
            optionalCompletedCount,
            optionalTotalCount,
            filesetMatchSignal: (filesetSummary?.matchSignal ?? 'none') as 'strong' | 'partial' | 'none',
            hasActionPlan: !!actionPlanResult?.success,
            hasBrief: !!briefData?.success,
          };
          postBreakdown = calculatePostTDRScore(deal, postCtx);
        }
        const displayScore = postBreakdown ? postBreakdown.totalPostTDR : preTDRScore;
        const priority = getPriorityFromScore(displayScore);
        const isPostTDR = !!postBreakdown;

        // Confidence score — how well-informed is the assessment?
        const confidence: TDRConfidenceBreakdown = calculateTDRConfidence({
          completedStepCount,
          totalStepCount: requiredStepCount,
          optionalCompletedCount,
          optionalTotalCount,
          hasSumbleEnrichment: !!sumbleData?.success,
          hasPerplexityEnrichment: !!perplexityData?.success,
          riskCategories: extractionResult?.structured?.RISK_CATEGORIES ?? [],
          filesetMatchSignal: (filesetSummary?.matchSignal ?? 'none') as 'strong' | 'partial' | 'none',
          hasActionPlan: !!actionPlanResult?.success,
          hasBrief: !!briefData?.success,
        });
        const lifecyclePhase = getTDRLifecyclePhase(
          completedStepCount, requiredStepCount,
          !!sessionId,
          !!(sumbleData?.success || perplexityData?.success),
          !!actionPlanResult?.success,
        );
        const context = PRIORITY_CONTEXT[lifecyclePhase][priority];
        const criticalFactors = detectCriticalFactors(deal);
        const topFactors = criticalFactors.slice(0, 3);

        return (
          <div className="border-b border-[#2a2540]">
            {/* Deal header + team */}
            <div className="px-5 pt-4 pb-2">
              <h3 className="text-base font-semibold text-white">{deal.account}</h3>
              <p className="text-sm text-slate-400">{deal.dealName}</p>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className="font-medium tabular-nums text-slate-300">${(deal.acv / 1000).toFixed(0)}K ACV</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">{deal.stage}</span>
                {deal.dealType && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className={cn('text-2xs font-medium px-1.5 py-0.5 rounded',
                      deal.dealType.toLowerCase().includes('new logo') ? 'bg-blue-500/15 text-blue-300' : 'bg-slate-500/10 text-slate-400'
                    )}>{deal.dealType}</span>
                  </>
                )}
              </div>
              {/* Account firmographics */}
              {(deal.accountRevenue || deal.accountEmployees || deal.salesSegment || deal.salesVertical || deal.region) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                  {deal.accountRevenue && <span className="tabular-nums">${deal.accountRevenue >= 1e9 ? `${(deal.accountRevenue / 1e9).toFixed(1)}B` : deal.accountRevenue >= 1e6 ? `${(deal.accountRevenue / 1e6).toFixed(0)}M` : `${(deal.accountRevenue / 1e3).toFixed(0)}K`} rev</span>}
                  {deal.accountEmployees && <span className="tabular-nums">{deal.accountEmployees >= 1000 ? `${(deal.accountEmployees / 1000).toFixed(1)}K` : deal.accountEmployees} emp</span>}
                  {deal.salesSegment && <span>{deal.salesSegment}</span>}
                  {deal.salesVertical && <span>{deal.salesVertical}</span>}
                  {deal.region && <span>{deal.region}</span>}
                  {deal.strategicAccount && <span className="text-violet-400 font-medium">Strategic</span>}
                </div>
              )}
              {/* Deal team — inline with header */}
              <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                {[
                  { label: 'AE', value: deal.accountExecutive || deal.owner },
                  { label: 'SE', value: deal.salesConsultant },
                  { label: 'SE Mgr', value: deal.seManager || 'TBD' },
                ].filter(m => m.value).map((m, i) => (
                  <span key={m.label} className="flex items-center gap-1">
                    {i > 0 && <span className="text-slate-700 mr-1">·</span>}
                    <span className="text-slate-600">{m.label}:</span>
                    <span className="text-slate-400">{m.value}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* ── ACTION BRIEF — the prescriptive "so what" (Sprint 37) ── */}
            {deal.dealQuadrant && (() => {
              const qStyles: Record<string, { bg: string; text: string; bar: string; border: string }> = {
                PRIORITIZE:   { bg: 'bg-purple-600',  text: 'text-white',     bar: 'linear-gradient(90deg, hsl(263, 84%, 55%), hsl(280, 70%, 55%))', border: 'border-l-purple-500' },
                FAST_TRACK:   { bg: 'bg-emerald-600', text: 'text-white',     bar: 'linear-gradient(90deg, hsl(152, 60%, 45%), hsl(160, 55%, 40%))', border: 'border-l-emerald-500' },
                INVESTIGATE:  { bg: 'bg-amber-500',   text: 'text-amber-950', bar: 'linear-gradient(90deg, hsl(38, 65%, 50%), hsl(45, 60%, 55%))', border: 'border-l-amber-500' },
                DEPRIORITIZE: { bg: 'bg-slate-600',   text: 'text-slate-200', bar: 'hsl(260, 10%, 40%)', border: 'border-l-slate-500' },
              };
              const q = qStyles[deal.dealQuadrant] || qStyles.DEPRIORITIZE;
              const winPct = Math.round((deal.propensityScore ?? 0) * 100);
              const tdrPart = Math.round((displayScore) * 0.4);
              const winPart = Math.round(winPct * 0.6);

              const acvVal = deal.acv ?? 0;
              const stageNum = deal.stageNumber ?? 0;
              const numComp = deal.numCompetitors ?? 0;
              const dealType = (deal.dealType ?? '').toLowerCase();
              const partnersInvolved = (deal.partnersInvolved ?? '').toLowerCase();
              const snowflakeTeam = (deal.snowflakeTeam ?? '').toLowerCase();
              const dealCode = (deal.dealCode ?? '').toUpperCase();
              const stageAge = deal.stageAge ?? 0;

              const quadrantGuidance: Record<string, { directive: string; seActions: string[]; aeActions: string[] }> = {
                PRIORITIZE: {
                  directive: `This is a Prioritize deal — technically complex and likely to close. Full TDR investment is warranted. Focus your best architectural work here.`,
                  seActions: [
                    'Build a comprehensive architectural strategy covering data platform, governance, and integration layers',
                    'Prepare a competitive differentiation narrative tailored to the technical evaluation criteria',
                    numComp >= 1 ? `Address ${numComp} competitor(s) with specific technical positioning and battle card evidence` : 'Proactively position against likely alternatives even if unnamed',
                    'Schedule a deep-dive technical workshop with the customer\'s data and engineering teams',
                  ],
                  aeActions: [
                    'Protect this deal — it\'s high value and winnable. Prioritize executive alignment meetings',
                    'Coordinate with SE on technical workshop timing to maintain deal momentum',
                    stageAge > 60 ? `Address the ${stageAge}-day stage age — escalate any blockers to leadership` : 'Keep the deal moving through procurement and legal in parallel',
                  ],
                },
                FAST_TRACK: {
                  directive: `This is a Fast Track deal — likely to close with lower technical complexity. A lightweight technical pass is sufficient. Don't over-invest TDR time here.`,
                  seActions: [
                    'Conduct a focused technical validation — confirm fit without over-architecting',
                    'Prepare a standard deployment guide and success criteria document',
                    'Be available for technical questions but avoid deep custom architecture work',
                  ],
                  aeActions: [
                    'Drive toward close — the technical risk is low and the probability is strong',
                    'Focus on commercial terms and timeline rather than additional technical deep-dives',
                    'Engage procurement and legal early to avoid last-minute delays',
                  ],
                },
                INVESTIGATE: {
                  directive: `This is an Investigate deal — technically complex but facing headwinds on win probability. Diagnose the blockers before investing full TDR time.`,
                  seActions: [
                    'Identify the specific technical or business blockers preventing this deal from progressing',
                    'Conduct a discovery call focused on understanding why momentum has stalled',
                    numComp >= 1 ? `Assess competitive positioning — are we losing on technical merit or commercial terms?` : 'Determine if the low win probability is driven by budget, timing, or fit concerns',
                    'Propose a targeted proof-of-concept if the blocker is technical credibility',
                  ],
                  aeActions: [
                    'Assess whether this deal is worth continued investment given the low win probability',
                    'Engage leadership for a deal review if the opportunity is strategically important',
                    stageAge > 90 ? `This deal has been in stage for ${stageAge} days — consider pipeline hygiene review` : 'Set a clear go/no-go decision point within the next 2 weeks',
                  ],
                },
                DEPRIORITIZE: {
                  directive: `This is a Deprioritize deal — low complexity and low win probability. Monitor only. Redirect your effort to higher-priority deals.`,
                  seActions: [
                    'Minimal investment — respond to technical questions but don\'t proactively prepare materials',
                    'If asked for a demo, use standard content rather than custom preparation',
                  ],
                  aeActions: [
                    'Move this deal to a monitor cadence — check in bi-weekly rather than weekly',
                    'Focus pipeline effort on Prioritize and Fast Track deals instead',
                    'If the deal is genuinely dead, consider removing from the forecast',
                  ],
                },
              };

              const brief = quadrantGuidance[deal.dealQuadrant] || quadrantGuidance.DEPRIORITIZE;

              const complexityDrivers: string[] = [];
              const simplifiers: string[] = [];

              if (acvVal >= 100000) complexityDrivers.push(`$${(acvVal / 1000).toFixed(0)}K ACV — material deal size requires architectural rigor`);
              else if (acvVal < 25000) simplifiers.push(`$${(acvVal / 1000).toFixed(0)}K ACV — smaller deal, lighter technical lift`);
              if (numComp >= 2) complexityDrivers.push(`${numComp} competitors — multi-vendor bake-off demands differentiation`);
              else if (numComp === 1) complexityDrivers.push('1 competitor — head-to-head requires clear technical positioning');
              else simplifiers.push('No named competitors — reduced displacement pressure');
              if (dealType.includes('new logo') || dealType.includes('new business'))
                complexityDrivers.push('New Logo — greenfield architecture, no existing relationship');
              else if (dealType.includes('upsell') || dealType.includes('expansion'))
                simplifiers.push('Expansion — existing footprint reduces discovery burden');
              if (snowflakeTeam || /snowflake|databricks|bigquery|gcp|aws|azure/i.test(partnersInvolved))
                complexityDrivers.push('Cloud partner involved — co-sell architecture alignment needed');
              if (dealCode.startsWith('PA') || (dealCode.includes('-') && !dealCode.endsWith('-A')))
                complexityDrivers.push(`Deal code ${dealCode} — partner/multi-component deal structure`);
              else if (/E0[2-9]|E[1-9]\d/.test(dealCode))
                complexityDrivers.push(`Deal code ${dealCode} — complex enterprise engagement`);
              if (stageAge > 90) complexityDrivers.push(`${stageAge}d in stage — stalled deals often have unresolved blockers`);
              else if (stageAge <= 14) simplifiers.push('Fresh stage entry — deal is moving');
              if (stageNum >= 2 && stageNum <= 3) complexityDrivers.push(`Stage ${stageNum} — prime window where SE shapes the architecture narrative`);
              else if (stageNum >= 4) simplifiers.push(`Stage ${stageNum} — past architecture shaping, confirming/closing`);

              return (
                <>
                {/* Action Brief */}
                <div className={cn('px-5 py-3 border-b border-[#322b4d] border-l-2', q.border)}>
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-medium">What to Do</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', q.bg, q.text)}>
                      {deal.dealQuadrant.replace('_', ' ')}
                    </span>
                    <button onClick={() => setActionBriefExpanded(!actionBriefExpanded)} className="ml-auto text-slate-600 hover:text-slate-300 transition-colors">
                      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !actionBriefExpanded && '-rotate-90')} />
                    </button>
                  </div>

                  <p className="text-[12px] text-slate-300 leading-relaxed font-medium mb-2">{brief.directive}</p>

                  {actionBriefExpanded && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="rounded-md border border-violet-500/15 bg-violet-500/5 px-3 py-2">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <User className="h-3 w-3 text-violet-400" />
                          <span className="text-[9px] uppercase tracking-wider text-violet-400 font-semibold">SE Next Steps</span>
                        </div>
                        <ul className="space-y-1">
                          {brief.seActions.map((a, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[10px] text-slate-400 leading-relaxed">
                              <span className="mt-1.5 h-1 w-1 rounded-full bg-violet-500 shrink-0" />
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-md border border-blue-500/15 bg-blue-500/5 px-3 py-2">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Briefcase className="h-3 w-3 text-blue-400" />
                          <span className="text-[9px] uppercase tracking-wider text-blue-400 font-semibold">AE Next Steps</span>
                        </div>
                        <ul className="space-y-1">
                          {brief.aeActions.map((a, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[10px] text-slate-400 leading-relaxed">
                              <span className="mt-1.5 h-1 w-1 rounded-full bg-blue-500 shrink-0" />
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {actionPlanResult?.success && (
                    <button
                      onClick={() => setActionPlanOpen(true)}
                      className="mt-2 flex items-center gap-1.5 text-[10px] text-violet-400/70 hover:text-violet-300 transition-colors"
                    >
                      <Sparkles className="h-3 w-3" />
                      View full AI-generated Action Plan
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* ── DEAL POSITION CLUSTER — unified score row ── */}
                <div className="px-5 py-3 border-b border-[#322b4d]">
                  <div className="flex items-center gap-4">
                    {/* Deal Priority — hero */}
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold tabular-nums text-white">{deal.dealPriority ?? displayScore}</span>
                      <div>
                        <span className="text-[8px] uppercase tracking-wider text-slate-600 block">Priority</span>
                        <div className="w-16 h-1 rounded-full bg-[#2a2540] overflow-hidden mt-0.5">
                          <div className="h-full rounded-full" style={{ width: `${deal.dealPriority ?? displayScore}%`, background: q.bar }} />
                        </div>
                      </div>
                    </div>

                    <span className="text-slate-700">=</span>

                    {/* TDR Score — subordinate */}
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-sm font-bold tabular-nums',
                        priority === 'CRITICAL' ? 'text-violet-300' : priority === 'HIGH' ? 'text-violet-400' : priority === 'MEDIUM' ? 'text-amber-400' : 'text-slate-400'
                      )}>{displayScore}</span>
                      <div>
                        <span className="text-[8px] uppercase tracking-wider text-slate-600 block">TDR</span>
                        <span className="text-[8px] text-slate-600">× 40%</span>
                      </div>
                    </div>

                    <span className="text-slate-700">+</span>

                    {/* Win Propensity — subordinate */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold tabular-nums text-slate-200">
                        {deal.propensityScore != null ? `${winPct}%` : '—'}
                      </span>
                      <div>
                        <span className="text-[8px] uppercase tracking-wider text-slate-600 block">Win</span>
                        <span className="text-[8px] text-slate-600">× 60%</span>
                      </div>
                    </div>

                    {/* Lifecycle badge */}
                    <span className={cn(
                      'ml-auto rounded-full px-1.5 py-0.5 text-2xs font-medium',
                      lifecyclePhase === 'ENRICHED' ? 'bg-emerald-500/10 text-emerald-300/70 border border-emerald-500/15' :
                      lifecyclePhase === 'COMPLETE' ? 'bg-violet-500/10 text-violet-300/70 border border-violet-500/15' :
                      lifecyclePhase === 'NOT_STARTED' ? 'bg-slate-500/5 text-slate-500 border border-slate-500/15' :
                      'bg-blue-500/10 text-blue-300/70 border border-blue-500/15'
                    )}>
                      {lifecyclePhase === 'ENRICHED' ? 'Fully Informed' :
                       lifecyclePhase === 'COMPLETE' ? 'TDR Complete' :
                       lifecyclePhase === 'IN_PROGRESS' || lifecyclePhase === 'NEAR_COMPLETE' ? `${completedStepCount}/${requiredStepCount} Steps` :
                       lifecyclePhase === 'EARLY' ? 'TDR Started' : 'Pre-TDR'}
                    </span>
                  </div>

                  {/* Expandable score detail */}
                  <button
                    onClick={() => setScoreDetailExpanded(!scoreDetailExpanded)}
                    className="flex items-center gap-1.5 mt-2 text-[9px] uppercase tracking-wider text-slate-600 hover:text-slate-400 transition-colors w-full"
                  >
                    <ChevronRight className={cn('h-3 w-3 transition-transform', scoreDetailExpanded && 'rotate-90')} />
                    Score Detail
                    {lifecyclePhase !== 'NOT_STARTED' && (
                      <span className={cn('ml-1 tabular-nums text-[9px] font-medium',
                        confidence.total >= 80 ? 'text-emerald-400' : confidence.total >= 60 ? 'text-blue-400' :
                        confidence.total >= 40 ? 'text-amber-400' : 'text-slate-500'
                      )}>
                        {confidence.total}% confidence
                      </span>
                    )}
                  </button>
                </div>

                {/* Score Detail accordion — all existing detail collapsed */}
                {scoreDetailExpanded && (
                <div className="px-5 py-3 border-b border-[#322b4d] space-y-3">
                  {/* Complexity drivers */}
                  {(() => {
                    const highComplexity = displayScore >= 50;
                    const drivers = highComplexity ? complexityDrivers : simplifiers;
                    const driverGuidance = highComplexity
                      ? `TDR Score of ${displayScore} signals elevated technical complexity:`
                      : `TDR Score of ${displayScore} signals lower technical complexity:`;
                    return drivers.length > 0 ? (
                      <div>
                        <p className="text-[10px] text-slate-400 mb-1">{driverGuidance}</p>
                        <ul className="space-y-0.5">
                          {drivers.slice(0, 4).map((d, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[10px] text-slate-500">
                              <span className={cn('mt-1 h-1 w-1 rounded-full shrink-0', highComplexity ? 'bg-violet-500' : 'bg-emerald-500')} />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null;
                  })()}

                  {/* TDR Score bar */}
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-slate-600 mb-1">TDR Score</p>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-bold tabular-nums',
                        priority === 'CRITICAL' ? 'text-violet-300' : priority === 'HIGH' ? 'text-violet-400' : priority === 'MEDIUM' ? 'text-amber-400' : 'text-slate-400'
                      )}>{displayScore}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase',
                        priority === 'CRITICAL' ? 'bg-violet-500/15 text-violet-300' : priority === 'HIGH' ? 'bg-violet-500/10 text-violet-400' :
                        priority === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-500/10 text-slate-500'
                      )}>{priority}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-[#2a2540] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{
                          width: `${displayScore}%`,
                          background: priority === 'CRITICAL' ? 'linear-gradient(90deg, hsl(263, 84%, 55%), hsl(280, 70%, 55%))'
                            : priority === 'HIGH' ? 'linear-gradient(90deg, hsl(263, 60%, 50%), hsl(280, 50%, 45%))'
                            : priority === 'MEDIUM' ? 'linear-gradient(90deg, hsl(38, 65%, 50%), hsl(45, 60%, 55%))' : 'hsl(260, 10%, 40%)',
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* Win Propensity bar */}
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-slate-600 mb-1">Win Propensity</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums text-slate-200">{deal.propensityScore != null ? `${winPct}%` : '—'}</span>
                      {deal.propensityQuadrant && (
                        <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase',
                          deal.propensityQuadrant === 'HIGH' ? 'bg-violet-500/15 text-violet-300' :
                          deal.propensityQuadrant === 'MONITOR' ? 'bg-purple-400/15 text-purple-300' : 'bg-fuchsia-400/15 text-fuchsia-300'
                        )}>{deal.propensityQuadrant}</span>
                      )}
                      {deal.propensityScore != null && (
                        <div className="flex-1 h-1.5 rounded-full bg-[#2a2540] overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{
                            width: `${winPct}%`,
                            background: deal.propensityScore >= 0.7 ? 'linear-gradient(90deg, hsl(263, 84%, 55%), hsl(280, 70%, 55%))'
                              : deal.propensityScore >= 0.4 ? 'linear-gradient(90deg, hsl(280, 50%, 50%), hsl(290, 45%, 45%))' : 'hsl(300, 30%, 40%)',
                          }} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SHAP factors */}
                  {deal.propensityFactors && deal.propensityFactors.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShapExpanded(!shapExpanded)}
                        className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors w-full"
                      >
                        <ChevronRight className={cn('h-3 w-3 transition-transform', shapExpanded && 'rotate-90')} />
                        Why this score?
                      </button>
                      {shapExpanded && (
                        <div className="mt-2 space-y-2 pl-1">
                          {deal.propensityFactors.slice(0, 5).map((f, i) => {
                            const displayName = getMLFactorDisplayName(f.name);
                            const explanation = getMLFactorExplanation(f.name, f.value, f.direction);
                            const dirLabel = f.direction === 'helps' ? 'Helps' : f.direction === 'hurts' ? 'Hurts' : 'Neutral';
                          return (
                            <div key={i} className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  'text-[10px] shrink-0 w-3 text-center font-bold',
                                  f.direction === 'helps' ? 'text-emerald-400' :
                                  f.direction === 'hurts' ? 'text-red-400' : 'text-slate-600'
                                )}>
                                  {f.direction === 'helps' ? '↑' : f.direction === 'hurts' ? '↓' : '→'}
                                </span>
                                <span className="text-[10px] font-medium text-slate-300 flex-1">{displayName}</span>
                                <span className={cn(
                                  'text-[8px] font-medium px-1 py-0.5 rounded',
                                  f.direction === 'helps' ? 'bg-emerald-500/10 text-emerald-400' :
                                  f.direction === 'hurts' ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-500'
                                )}>{dirLabel}</span>
                                <div className="w-12 h-1 rounded-full bg-[#2a2540] overflow-hidden shrink-0">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.round(f.magnitude * 100)}%`,
                                      background: f.direction === 'helps'
                                        ? 'hsl(152, 60%, 45%)'
                                        : f.direction === 'hurts'
                                        ? 'hsl(0, 60%, 50%)'
                                        : 'hsl(260, 10%, 45%)',
                                    }}
                                  />
                                </div>
                              </div>
                              <p className="text-[9px] text-slate-500 pl-5 leading-relaxed">{explanation}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                  {deal.propensityScoredAt && (
                    <p className="text-[9px] text-slate-600 mt-2">
                      Scored {(() => {
                        const d = new Date(deal.propensityScoredAt!);
                        if (isNaN(d.getTime())) return deal.propensityScoredAt;
                        const hours = Math.floor((Date.now() - d.getTime()) / 3600000);
                        if (hours < 1) return 'just now';
                        if (hours < 24) return `${hours}h ago`;
                        const days = Math.floor(hours / 24);
                        return days === 1 ? 'yesterday' : `${days}d ago`;
                      })()} · {deal.propensityModelVersion || 'v2'}
                    </p>
                  )}

                  {/* Context */}
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    <span className={cn('font-semibold',
                      priority === 'CRITICAL' ? 'text-violet-300' : priority === 'HIGH' ? 'text-violet-400' :
                      priority === 'MEDIUM' ? 'text-amber-400' : 'text-slate-400'
                    )}>{context.headline}.</span>{' '}
                    <span className="text-slate-500">{context.description}</span>
                  </p>

                  {/* Top TDR triggers */}
                  {topFactors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {topFactors.map(factor => (
                        <TooltipProvider key={factor.id} delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium border',
                                INTEL_FACTOR_PILL_COLORS[factor.color] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                              )}>
                                {factor.shortLabel}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs text-[10px] bg-[#1e1a30] border-[#362f50] text-slate-300 p-2.5">
                              <p className="font-semibold text-slate-200 mb-1">{factor.label}</p>
                              <p className="text-slate-400">{factor.description}</p>
                              {lifecyclePhase === 'COMPLETE' || lifecyclePhase === 'ENRICHED'
                                ? <p className="text-emerald-400/70 mt-1 text-[9px]">Assessed: {factor.strategy.substring(0, 120)}...</p>
                                : <p className="text-violet-400/70 mt-1 text-[9px]">Strategy: {factor.strategy.substring(0, 120)}...</p>
                              }
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  )}

                  {/* Score factor breakdown */}
                  <div className="pt-3 border-t border-[#2a2540]/40">
                    <p className="text-[9px] uppercase tracking-wider text-slate-600 mb-2">
                      {isPostTDR ? 'Score Breakdown' : 'Pre-TDR Scoring Components'}
                    </p>
                    {postBreakdown ? (
                      <div className="space-y-1">
                        {[
                          { label: 'Pre-TDR Base', value: postBreakdown.preTDRScore, max: 100, desc: 'Composite of all 9 pre-TDR scoring components below' },
                          { label: 'Competitor Threat', value: postBreakdown.namedCompetitorThreat, max: 10, desc: 'Named competitors from enrichment matched against dangerous competitors list' },
                          { label: 'Enrichment Depth', value: postBreakdown.enrichmentDepth, max: 5, desc: 'How many external intelligence sources have been pulled' },
                          { label: 'TDR Completeness', value: postBreakdown.tdrInputCompleteness, max: 10, desc: 'Percentage of TDR steps the SE has completed' },
                          { label: 'Risk Awareness', value: postBreakdown.riskAwareness, max: 5, desc: 'Number of risk categories identified through structured extraction' },
                          { label: 'Knowledge Base', value: postBreakdown.filesetMatchSignal, max: 5, desc: 'Match strength against battle cards, playbooks, and reference docs' },
                        ].map((item) => (
                          <TooltipProvider key={item.label} delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2 text-2xs cursor-help">
                                  <span className="text-slate-500 w-28 shrink-0">{item.label}</span>
                                  <div className="flex-1 h-[3px] rounded-full bg-[#2a2540] overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500" style={{
                                      width: `${item.max > 0 ? (item.value / item.max) * 100 : 0}%`,
                                      background: item.value > 0 ? 'linear-gradient(90deg, hsl(263, 70%, 55%), hsl(280, 50%, 50%))' : 'hsl(260, 10%, 30%)',
                                    }} />
                                  </div>
                                  <span className={cn('tabular-nums w-8 text-right text-2xs font-medium', item.value > 0 ? 'text-violet-400' : 'text-slate-600')}>
                                    +{item.value}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs text-[10px] bg-[#1e1a30] border-[#362f50] text-slate-400 p-2">
                                {item.desc}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {PRE_TDR_FACTOR_LABELS.map((factor) => (
                          <TooltipProvider key={factor.key} delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2 text-2xs cursor-help">
                                  <span className="text-slate-500 w-32 shrink-0">{factor.label}</span>
                                  <span className="text-slate-600 text-[9px] ml-auto">0–{factor.max} pts</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs text-[10px] bg-[#1e1a30] border-[#362f50] text-slate-400 p-2">
                                {factor.description}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Confidence breakdown */}
                  {lifecyclePhase !== 'NOT_STARTED' && (
                    <div className="pt-2 border-t border-[#2a2540]/40">
                      <p className="text-[9px] uppercase tracking-wider text-slate-600 mb-1">Assessment Confidence</p>
                      <div className="space-y-1">
                        {[
                          { label: 'Required Steps', value: confidence.requiredSteps, max: 40, desc: `${completedStepCount}/${requiredStepCount} required steps completed`, scrollRef: null as React.RefObject<HTMLDivElement> | null, collapseRef: null as React.RefObject<CollapsibleSectionHandle> | null },
                          { label: 'Optional Depth', value: confidence.optionalSteps, max: 10, desc: `${optionalCompletedCount}/${optionalTotalCount} optional steps completed`, scrollRef: null, collapseRef: null },
                          { label: 'External Intel', value: confidence.externalIntel, max: 15, desc: 'Sumble and Perplexity enrichment — click to jump', scrollRef: enrichBarRef, collapseRef: null },
                          { label: 'AI Analysis', value: confidence.aiOutputs, max: 15, desc: 'Action plan and TDR brief generated by Cortex AI', scrollRef: null, collapseRef: null },
                          { label: 'Knowledge Base', value: confidence.kbMatch, max: 10, desc: 'Battle cards, playbooks, or reference docs — click to jump', scrollRef: kbSectionRef, collapseRef: kbCollapseRef },
                          { label: 'Risk Identified', value: confidence.riskAwareness, max: 10, desc: 'Risk categories surfaced through structured extraction', scrollRef: riskSectionRef, collapseRef: riskCollapseRef },
                        ].map((item) => (
                          <TooltipProvider key={item.label} delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn('flex items-center gap-2 text-2xs', item.scrollRef ? 'cursor-pointer hover:bg-[#221d38] rounded px-1 -mx-1 transition-colors' : 'cursor-help')}
                                  onClick={() => {
                                    if (item.collapseRef?.current) item.collapseRef.current.expand();
                                    if (item.scrollRef?.current) {
                                      setTimeout(() => item.scrollRef!.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                                    }
                                  }}
                                >
                                  <span className={cn('w-28 shrink-0', item.scrollRef ? 'text-slate-400 underline underline-offset-2 decoration-dotted decoration-slate-600' : 'text-slate-500')}>{item.label}</span>
                                  <div className="flex-1 h-[3px] rounded-full bg-[#2a2540] overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500" style={{
                                      width: `${item.max > 0 ? (item.value / item.max) * 100 : 0}%`,
                                      background: item.value > 0 ? 'linear-gradient(90deg, hsl(152, 55%, 45%), hsl(160, 50%, 42%))' : 'hsl(260, 10%, 30%)',
                                    }} />
                                  </div>
                                  <span className={cn('tabular-nums w-8 text-right text-2xs font-medium', item.value > 0 ? 'text-emerald-400' : 'text-slate-600')}>
                                    +{item.value}
                                  </span>
                                  {item.scrollRef && <ChevronRight className="h-2.5 w-2.5 text-slate-600 shrink-0" />}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs text-[10px] bg-[#1e1a30] border-[#362f50] text-slate-400 p-2">
                                {item.desc}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Priority band legend */}
                  <div className="pt-2 border-t border-[#2a2540]/40">
                    <p className="text-[9px] uppercase tracking-wider text-slate-600 mb-1.5">Priority Bands</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(band => (
                        <div key={band} className={cn(
                          'flex items-center gap-1.5 rounded px-2 py-1',
                          band === priority ? 'bg-[#221d38] border border-[#362f50]' : 'opacity-50'
                        )}>
                          <span className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            band === 'CRITICAL' ? 'bg-violet-400' : band === 'HIGH' ? 'bg-violet-500' : band === 'MEDIUM' ? 'bg-amber-400' : 'bg-slate-500'
                          )} />
                          <span className="text-[9px] text-slate-400">
                            <span className="font-semibold">{band}</span>{' '}
                            {band === 'CRITICAL' ? '75–100' : band === 'HIGH' ? '50–74' : band === 'MEDIUM' ? '25–49' : '0–24'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                )}
                </>
              );
            })()}

            {/* Signal strip */}
            <div className="px-5 pb-3 flex gap-2">
              {[
                { label: 'Threat', value: competitiveThreatLevel, color: competitiveThreatLevel === 'High' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : competitiveThreatLevel === 'Med' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
                ...(hiringVelocity ? [{ label: 'Hiring', value: hiringVelocity === 'high' ? 'High' : hiringVelocity === 'moderate' ? 'Mod' : 'Low', color: hiringVelocity === 'high' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : hiringVelocity === 'moderate' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-slate-400 bg-slate-500/10 border-slate-500/20' }] : []),
                { label: 'KB', value: kbMatchSignal === 'strong' ? 'Strong' : kbMatchSignal === 'partial' ? 'Partial' : 'None', color: kbMatchSignal === 'strong' ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' : kbMatchSignal === 'partial' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-slate-500 bg-slate-500/10 border-slate-500/20' },
                { label: 'Intel', value: enrichmentLevel, color: enrichmentLevel === 'Full' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : enrichmentLevel === 'Partial' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : enrichmentLevel === 'Light' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-slate-500 bg-slate-500/10 border-slate-500/20' },
              ].map(chip => (
                <div key={chip.label} className={cn('flex-1 flex flex-col items-center rounded-md border py-1.5 px-1', chip.color)}>
                  <span className="text-[8px] uppercase tracking-wider opacity-70">{chip.label}</span>
                  <span className="text-[10px] font-semibold">{chip.value}</span>
                </div>
              ))}
            </div>

            {/* Readout Workflow — unified actionable steps */}
            <div className="px-5 pb-3">
              <p className="text-[8px] uppercase tracking-wider text-slate-600 mb-2">Prepare Readout — Complete in Order</p>
              <div className="space-y-1.5">
                {/* Step 1: Enrich */}
                <div className={cn('flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors',
                  (sumbleData?.success || perplexityData?.success) ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-500/10 bg-slate-500/5'
                )}>
                  <span className={cn('text-[10px] font-bold tabular-nums w-4 text-center shrink-0',
                    (sumbleData?.success || perplexityData?.success) ? 'text-emerald-400' : 'text-slate-600'
                  )}>{(sumbleData?.success || perplexityData?.success) ? '✓' : '1'}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-medium text-slate-300">Enrich</span>
                    <span className="text-[9px] text-slate-600 ml-1.5">Tech stack & firmographics</span>
                  </div>
                  {!(sumbleData?.success || perplexityData?.success) && (
                    <Button variant="ghost" size="sm" className="h-5 px-2 text-[9px] text-slate-500 hover:text-white hover:bg-[#2d2744]"
                      onClick={handleEnrichAll} disabled={enrichAllLoading || !domain.trim()}>
                      {enrichAllLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : 'Run'}
                    </Button>
                  )}
                </div>
                {/* Step 2: Research */}
                <div className={cn('flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors',
                  perplexityData?.success ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-500/10 bg-slate-500/5'
                )}>
                  <span className={cn('text-[10px] font-bold tabular-nums w-4 text-center shrink-0',
                    perplexityData?.success ? 'text-emerald-400' : 'text-slate-600'
                  )}>{perplexityData?.success ? '✓' : '2'}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-medium text-slate-300">Research</span>
                    <span className="text-[9px] text-slate-600 ml-1.5">Competitive & market intel</span>
                  </div>
                  {!perplexityData?.success && (
                    <Button variant="ghost" size="sm" className="h-5 px-2 text-[9px] text-slate-500 hover:text-white hover:bg-[#2d2744]"
                      onClick={handleResearchPerplexity} disabled={perplexityLoading}>
                      {perplexityLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : 'Run'}
                    </Button>
                  )}
                </div>
                {/* Step 3: Action Plan */}
                <div className={cn('flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors',
                  actionPlanResult?.success ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-500/10 bg-slate-500/5'
                )}>
                  <span className={cn('text-[10px] font-bold tabular-nums w-4 text-center shrink-0',
                    actionPlanResult?.success ? 'text-emerald-400' : 'text-slate-600'
                  )}>{actionPlanResult?.success ? '✓' : '3'}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-medium text-slate-300">Action Plan</span>
                    <span className="text-[9px] text-slate-600 ml-1.5">AI-synthesized next steps</span>
                  </div>
                  {actionPlanResult?.success ? (
                    <button className="text-[9px] text-violet-400/70 hover:text-violet-300 transition-colors"
                      onClick={() => setActionPlanOpen(true)}>View</button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-5 px-2 text-[9px] text-slate-500 hover:text-white hover:bg-[#2d2744]"
                      disabled={actionPlanLoading || !sessionId}
                      onClick={async () => { if (!sessionId) return; setActionPlanLoading(true); try { const result = await cortexAi.regenerateActionPlan(sessionId); const plan = result.actionPlan?.trim() ?? ''; if (result.success && (!plan || plan === 'No action plan generated.' || plan.length < 20)) { result.success = false; result.error = 'Action plan generation returned empty — try again.'; } setActionPlanResult(result); } catch (err) { console.error(err); } setActionPlanLoading(false); }}>
                      {actionPlanLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : 'Run'}
                    </Button>
                  )}
                </div>
                {/* Step 4: TDR Brief */}
                <div className={cn('flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors',
                  briefData?.success ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-500/10 bg-slate-500/5'
                )}>
                  <span className={cn('text-[10px] font-bold tabular-nums w-4 text-center shrink-0',
                    briefData?.success ? 'text-emerald-400' : 'text-slate-600'
                  )}>{briefData?.success ? '✓' : '4'}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-medium text-slate-300">TDR Brief</span>
                    <span className="text-[9px] text-slate-600 ml-1.5">Executive summary → PDF/Slack</span>
                  </div>
                  {briefData?.success ? (
                    <button className="text-[9px] text-cyan-400/70 hover:text-cyan-300 transition-colors"
                      onClick={() => setBriefOpen(true)}>View</button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-5 px-2 text-[9px] text-slate-500 hover:text-white hover:bg-[#2d2744]"
                      disabled={briefLoading || !sessionId || (!sumbleData && !perplexityData)}
                      onClick={handleGenerateBrief}>
                      {briefLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : 'Run'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}


      {/* ══════════════════════════════════════════════════════════════
          ZONE B — INTELLIGENCE DOSSIER
          Themed narrative organized by decision context, not source
          ══════════════════════════════════════════════════════════════ */}

      {/* Enrichment action bar */}
      {deal && (
        <div ref={enrichBarRef} className="border-b border-[#2a2540] px-5 py-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="h-3 w-3 text-slate-500 shrink-0" />
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="domain.com"
              className="h-7 flex-1 text-xs bg-transparent border-[#362f50] text-white placeholder:text-slate-600 focus-visible:ring-[#4a3f6b]"
            />
            <Button
              variant="outline" size="sm"
              className="gap-1 text-[10px] h-7 px-2.5 border-[#362f50] bg-[#1e1a30]/60 text-slate-300 hover:bg-[#2d2744] hover:text-white disabled:opacity-40"
              onClick={handleEnrichAll}
              disabled={enrichAllLoading || !domain.trim()}
            >
              {enrichAllLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <SumbleIcon className="h-2.5 w-2.5" />}
              {enrichAllLoading ? enrichAllProgress : 'Enrich'}
            </Button>
            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleScreenshotFile(file);
              }}
            />
            <Button
              variant="outline" size="sm"
              className="gap-1 text-[10px] h-7 px-2.5 border-[#362f50] bg-[#1e1a30]/60 text-slate-300 hover:bg-[#2d2744] hover:text-white disabled:opacity-40"
              onClick={handleResearchPerplexity}
              disabled={perplexityLoading}
            >
              {perplexityLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <PerplexityIcon className="h-2.5 w-2.5" />}
              Research
            </Button>
          </div>
          {/* Paste zone + Sumble link */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'group/paste flex-1 flex items-center gap-2 rounded border border-dashed px-3 py-1.5 transition-all duration-200 cursor-text',
                'focus:outline-none focus:border-violet-500/50 focus:bg-violet-500/5 focus:ring-1 focus:ring-violet-500/20 focus:shadow-[0_0_8px_rgba(139,92,246,0.15)]',
                screenshotParsing
                  ? 'border-violet-500/40 bg-violet-500/5'
                  : 'border-[#362f50] hover:border-[#4a3f6b] bg-transparent',
              )}
              tabIndex={0}
              onPaste={handlePasteEvent}
            >
              {screenshotParsing ? (
                <Loader2 className="h-3 w-3 animate-spin text-violet-400 shrink-0" />
              ) : (
                <ImageIcon className="h-3 w-3 text-slate-600 group-focus/paste:text-violet-400 transition-colors shrink-0" />
              )}
              <span className="text-[10px] text-slate-600 group-focus/paste:text-violet-300 transition-colors select-none">
                {screenshotParsing ? 'Parsing screenshot with Gemini...' : 'Click here and ⌘V to paste a Sumble screenshot'}
              </span>
              {!screenshotParsing && (
                <button
                  className="ml-auto text-[9px] text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
                  onClick={(e) => { e.stopPropagation(); screenshotInputRef.current?.click(); }}
                >
                  or browse
                </button>
              )}
            </div>
            {screenshotTechs.length > 0 && (
              <span className="text-[10px] text-emerald-400/70 shrink-0">
                {screenshotTechs.length} techs
              </span>
            )}
          </div>
          {domain.trim() && deal?.account && (
            <a
              href={buildSumbleUrl(deal.account, domain.trim())}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              <SumbleIcon className="h-2.5 w-2.5" />
              View on Sumble
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      )}

      {/* Processing / error indicators */}
      {(cortexProcessing || sumbleError || perplexityError || screenshotError) && (
        <div className="px-5 py-1.5 space-y-1">
          {cortexProcessing && (
            <div className="flex items-center gap-1.5 text-2xs text-cyan-400">
              <CortexLogo className="h-3 w-3 animate-pulse" />Classifying findings &amp; extracting entities...
            </div>
          )}
          {sumbleError && !enrichAllLoading && (
            <div className="flex items-start gap-1.5 text-2xs text-amber-400/80 bg-amber-500/5 rounded px-2 py-1">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />{sumbleError.length > 120 ? sumbleError.substring(0, 120) + '…' : sumbleError}
            </div>
          )}
          {perplexityError && !perplexityLoading && (
            <div className="flex items-start gap-1.5 text-2xs text-amber-400/80 bg-amber-500/5 rounded px-2 py-1">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />Perplexity: {perplexityError.length > 100 ? perplexityError.substring(0, 100) + '…' : perplexityError}
            </div>
          )}
          {screenshotError && !screenshotParsing && (
            <div className="flex items-start gap-1.5 text-2xs text-amber-400/80 bg-amber-500/5 rounded px-2 py-1">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />Screenshot: {screenshotError.length > 120 ? screenshotError.substring(0, 120) + '…' : screenshotError}
            </div>
          )}
        </div>
      )}


      {/* ── §B1 Account Profile ── */}
      {(sumbleOrgData?.success || perplexityData?.success) && (
        <CollapsibleSection title="Account Profile" icon={Building2} iconColor="text-blue-400" defaultExpanded={true}>
          {/* Org card */}
          {sumbleOrgData?.success && (
            <div className="flex items-start gap-3 mb-2.5">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-medium text-white">{sumbleData?.orgName || deal?.account}</span>
                  <SourceBadge source="sumble" />
                  {sumbleOrgData.linkedinUrl && (
                    <a href={sumbleOrgData.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300"><Linkedin className="h-3 w-3" /></a>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {sumbleOrgData.industry && <span>{sumbleOrgData.industry}</span>}
                  {sumbleOrgData.totalEmployees && <><span className="text-slate-600">·</span><span>{sumbleOrgData.totalEmployees >= 1000 ? `${(sumbleOrgData.totalEmployees / 1000).toFixed(1)}K` : sumbleOrgData.totalEmployees.toLocaleString()} employees</span></>}
                  {(sumbleOrgData.hqState || sumbleOrgData.hqCountry) && <><span className="text-slate-600">·</span><span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{[sumbleOrgData.hqState, sumbleOrgData.hqCountry].filter(Boolean).join(', ')}</span></>}
                </div>
              </div>
            </div>
          )}

          {/* Perplexity summary */}
          {perplexityData?.success && perplexityData.summary && (
            <div className="flex items-start gap-1.5">
              <SourceBadge source="perplexity" />
              <p className="text-xs text-slate-400 leading-relaxed">{perplexityData.summary}</p>
            </div>
          )}
        </CollapsibleSection>
      )}


      {/* ── §B2 Technical Landscape ── */}
      {(sumbleData?.success || (perplexityData?.technologySignals?.length ?? 0) > 0 || allTechnologies.size > 0) && (
        <CollapsibleSection title="Technical Landscape" icon={Layers} iconColor="text-violet-400" defaultExpanded={true}>
          {/* Tech category grid — categorized client-side from flat tech list */}
          {sumbleData?.technologies && sumbleData.technologies.length > 0 && (() => {
            // Client-side categorization (mirrors Code Engine categorizeTechnologies)
            const CRM_KW = ['salesforce', 'hubspot', 'dynamics'];
            const BI_KW = ['tableau', 'power bi', 'power-bi', 'looker', 'qlik', 'thoughtspot', 'sisense', 'domo', 'metabase', 'mode'];
            const DW_KW = ['snowflake', 'databricks', 'bigquery', 'redshift', 'synapse', 'teradata', 'vertica'];
            const ETL_KW = ['dbt', 'fivetran', 'airflow', 'informatica', 'talend', 'matillion', 'stitch', 'mulesoft', 'kafka', 'spark', 'hadoop'];
            const CLOUD_KW = ['aws', 'azure', 'gcp', 'google cloud'];
            const ML_KW = ['artificial intelligence', 'tensorflow', 'pytorch', 'sagemaker', 'databricks ml', 'vertex ai', 'datarobot', 'mlflow', 'h2o'];
            const ERP_KW = ['netsuite', 'sap', 'workday', 'oracle erp', 'peoplesoft'];
            const DEVOPS_KW = ['kubernetes', 'docker', 'terraform', 'jenkins', 'github', 'gitlab', 'datadog', 'splunk', 'new relic'];
            const cats: Record<string, string[]> = { CRM: [], BI: [], Cloud: [], DW: [], DevOps: [], ERP: [], ETL: [], ML: [], Other: [] };
            for (const tech of sumbleData.technologies) {
              if (typeof tech !== 'string' || !tech) continue;
              const l = tech.toLowerCase();
              if (CRM_KW.some(k => l.includes(k))) cats.CRM.push(tech);
              else if (BI_KW.some(k => l.includes(k))) cats.BI.push(tech);
              else if (DW_KW.some(k => l.includes(k))) cats.DW.push(tech);
              else if (ETL_KW.some(k => l.includes(k))) cats.ETL.push(tech);
              else if (CLOUD_KW.some(k => l.includes(k))) cats.Cloud.push(tech);
              else if (ML_KW.some(k => l.includes(k))) cats.ML.push(tech);
              else if (ERP_KW.some(k => l.includes(k))) cats.ERP.push(tech);
              else if (DEVOPS_KW.some(k => l.includes(k))) cats.DevOps.push(tech);
              else cats.Other.push(tech);
            }
            return (
              <div className="space-y-1.5 mb-3">
                {Object.entries(cats)
                  .filter(([, techs]) => techs.length > 0)
                  .map(([category, techs]) => {
                    const style = TECH_CATEGORY_STYLES[category] || TECH_CATEGORY_STYLES.Other;
                    return (
                      <div key={category} className="flex flex-wrap items-center gap-1.5">
                        <span className="text-2xs text-slate-500 w-16 shrink-0">{style.label}</span>
                        {techs.map((tech) => {
                          const sources = allTechnologies.get(tech);
                          const hasMultipleSources = sources && sources.size > 1;
                          return (
                            <span key={tech} className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-2xs font-medium', style.bg, style.text)}>
                              {tech}
                              <SourceBadge source="sumble" />
                              {hasMultipleSources && <SourceBadge source="cortex" />}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
              </div>
            );
          })()}

          {/* Perplexity tech signals */}
          {perplexityData?.technologySignals && perplexityData.technologySignals.length > 0 && (
            <div className="space-y-1.5">
              {perplexityTechNames.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-2xs text-slate-500 w-16 shrink-0">Perplexity</span>
                  {perplexityTechNames.filter(t => typeof t === 'string' && t).map(tech => {
                    const style = TECH_CATEGORY_STYLES[(() => {
                      const l = tech.toLowerCase();
                      if (['salesforce', 'hubspot', 'dynamics'].some(k => l.includes(k))) return 'CRM';
                      if (['tableau', 'power bi', 'looker', 'qlik', 'domo', 'metabase'].some(k => l.includes(k))) return 'BI';
                      if (['snowflake', 'databricks', 'bigquery', 'redshift'].some(k => l.includes(k))) return 'DW';
                      if (['dbt', 'fivetran', 'airflow', 'informatica', 'kafka'].some(k => l.includes(k))) return 'ETL';
                      if (['aws', 'azure', 'gcp', 'google cloud'].some(k => l.includes(k))) return 'Cloud';
                      if (['tensorflow', 'pytorch', 'sagemaker', 'datarobot'].some(k => l.includes(k))) return 'ML';
                      if (['netsuite', 'sap', 'workday'].some(k => l.includes(k))) return 'ERP';
                      if (['kubernetes', 'docker', 'terraform', 'datadog'].some(k => l.includes(k))) return 'DevOps';
                      return 'Other';
                    })()] || TECH_CATEGORY_STYLES.Other;
                    return (
                      <span key={tech} className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-2xs font-medium', style.bg, style.text)}>
                        {tech}
                        <SourceBadge source="perplexity" />
                      </span>
                    );
                  })}
                </div>
              )}
              {perplexityTechLoading && (
                <p className="text-[9px] text-slate-600 flex items-center gap-1">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> Extracting technologies...
                </p>
              )}
              {perplexityTechNames.length === 0 && !perplexityTechLoading && perplexityData.technologySignals.map((signal, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  <SourceBadge source="perplexity" />
                  <span className="text-slate-400">{signal}</span>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>
      )}


      {/* ── §B3 Competitive Position ── */}
      {(allCompetitors.length > 0 || competitiveFindings.length > 0) && (
        <CollapsibleSection title="Competitive Position" icon={Target} iconColor="text-amber-400" defaultExpanded={true}>
          {/* Named competitors */}
          {allCompetitors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {allCompetitors.filter(c => typeof c === 'string' && c).map((comp, i) => {
                const isDangerous = (getAppSettings().dangerousCompetitors ?? []).some(dc => String(comp).toLowerCase().includes(String(dc).toLowerCase()));
                return (
                  <span key={i} className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-2xs font-medium border',
                    isDangerous ? 'bg-rose-500/15 text-rose-300 border-rose-500/25' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                  )}>
                    {isDangerous && <AlertCircle className="h-2.5 w-2.5" />}
                    {comp}
                  </span>
                );
              })}
            </div>
          )}

          {/* Competitive findings (from all sources) */}
          {competitiveFindings.length > 0 && (
            <div className="space-y-1.5">
              {competitiveFindings.map((cf, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  <SourceBadge source={cf.source} />
                  <span className="text-slate-400 leading-relaxed">{cf.text}</span>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>
      )}


      {/* ── §B4 Key People ── */}
      {allPeople.length > 0 && (
        <CollapsibleSection title="Key People" icon={UserCheck} iconColor="text-purple-400" defaultExpanded={false}>
          <div className="space-y-1.5">
            {allPeople.slice(0, 8).map((person, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-md bg-[#1e1a30] px-2.5 py-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/10 shrink-0 mt-0.5">
                  <User className="h-2.5 w-2.5 text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-200">{person.name}</span>
                    <SourceBadge source={person.source} />
                    {person.linkedinUrl && (
                      <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300"><Linkedin className="h-2.5 w-2.5" /></a>
                    )}
                  </div>
                  {person.title && <p className="text-2xs text-slate-400">{person.title}</p>}
                  {person.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {person.technologies.map((tech, j) => <span key={j} className="rounded px-1 py-0.5 text-2xs bg-blue-500/10 text-blue-300">{tech}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

        </CollapsibleSection>
      )}


      {/* ── §B5 Market Signals ── */}
      {(strategicSignals.length > 0 || sumbleJobData?.success || sentimentTrend.length > 0) && (
        <CollapsibleSection title="Market Signals" icon={TrendingUp} iconColor="text-emerald-400" defaultExpanded={false}>
          {/* Strategic signals / initiatives */}
          {strategicSignals.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {strategicSignals.map((signal, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  <SourceBadge source={signal.source} />
                  <span className="text-slate-400 leading-relaxed">{signal.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Hiring velocity */}
          {sumbleJobData?.success && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Briefcase className="h-3 w-3 text-slate-500" />
                <span className="text-2xs font-medium text-slate-500">Hiring Signals</span>
                <SourceBadge source="sumble" />
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium',
                  sumbleJobData.hiringVelocity === 'high' ? 'bg-emerald-500/15 text-emerald-300' :
                  sumbleJobData.hiringVelocity === 'moderate' ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-500/15 text-slate-400'
                )}>
                  <TrendingUp className="h-2.5 w-2.5" />
                  {sumbleJobData.hiringVelocity === 'high' ? 'High Velocity' : sumbleJobData.hiringVelocity === 'moderate' ? 'Moderate' : 'Low'}
                </span>
                <span className="text-2xs text-slate-500">{sumbleJobData.recentJobCount || 0} recent · {sumbleJobData.jobCount || 0} total</span>
              </div>
              {((sumbleJobData.competitiveTechPosts?.length ?? 0) > 0 || (sumbleJobData.aiPosts?.length ?? 0) > 0) && (
                <div className="flex flex-wrap gap-1">
                  {sumbleJobData.competitiveTechPosts?.map((tech, i) => <span key={`comp-${i}`} className="rounded-md bg-red-500/10 px-2 py-0.5 text-2xs font-medium text-red-300">{tech}</span>)}
                  {sumbleJobData.aiPosts?.map((tech, i) => <span key={`ai-${i}`} className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-2xs font-medium text-emerald-300">{tech}</span>)}
                </div>
              )}
            </div>
          )}

          {/* Sentiment trend (inline mini) */}
          {sessionId && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-2xs font-medium text-slate-500">TDR Sentiment</span>
                <button className="text-slate-600 hover:text-slate-300 transition-colors p-0.5" onClick={handleLoadSentiment} disabled={sentimentLoading}>
                  {sentimentLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
                </button>
              </div>
              {sentimentTrend.length > 0 ? (
                <div className="space-y-1">
                  {sentimentTrend.map((pt, i) => {
                    const score = pt.sentiment ?? 0;
                    const pct = Math.round((score + 1) * 50);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-2xs text-slate-600 w-10 shrink-0">TDR {pt.iteration}</span>
                        <div className="flex-1 h-1 rounded-full bg-[#2a2540] overflow-hidden">
                          <div className={cn('h-full rounded-full', score >= 0 ? 'bg-emerald-500/70' : 'bg-amber-500/70')} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={cn('text-2xs font-medium w-8 text-right tabular-nums', score >= 0 ? 'text-emerald-400' : 'text-amber-400')}>
                          {score > 0 ? '+' : ''}{score.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : sentimentFetched && sentimentNoInputs ? (
                <p className="text-2xs text-slate-500 italic">No TDR inputs to analyze</p>
              ) : !sentimentFetched && (
                <p className="text-2xs text-slate-600 italic">Click chart icon to analyze</p>
              )}
            </div>
          )}
        </CollapsibleSection>
      )}


      {/* ══════════════════════════════════════════════════════════════
          ZONE C — STRATEGIC GUIDANCE
          AI-synthesized strategy from all sources
          ══════════════════════════════════════════════════════════════ */}

      {/* Action Plan Dialog (triggered from workflow step 3) */}
      {actionPlanResult?.success && actionPlanResult.actionPlan && (
        <Dialog open={actionPlanOpen} onOpenChange={setActionPlanOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#1a1528] border-[#362f50] text-slate-200">
            <DialogHeader className="pb-3 border-b border-[#322b4d]">
              <DialogTitle className="flex items-center gap-2.5 text-base">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/15"><Zap className="h-4 w-4 text-violet-400" /></div>
                <div>
                  <span className="text-slate-100">Strategic Action Plan</span>
                  {actionPlanResult.cached && <span className="ml-2 text-[10px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded-full font-normal">cached</span>}
                </div>
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-xs mt-1">{deal?.account} — Synthesized from all intelligence sources</DialogDescription>
            </DialogHeader>
            <div className="mt-4">{renderActionPlan(actionPlanResult.actionPlan)}</div>
            <div className="mt-6 pt-4 border-t border-[#322b4d] flex items-center justify-between">
              <span className="text-[10px] text-slate-600">
                {actionPlanResult.modelUsed && `Model: ${actionPlanResult.modelUsed}`}
                {actionPlanResult.createdAt && ` · ${new Date(actionPlanResult.createdAt).toLocaleString()}`}
              </span>
              <Button variant="outline" size="sm" className="gap-1.5 border-[#362f50] text-slate-400 hover:bg-[#221d38] hover:text-white" disabled={actionPlanLoading}
                onClick={async () => { if (!sessionId) return; setActionPlanLoading(true); try { const result = await cortexAi.regenerateActionPlan(sessionId); const plan = result.actionPlan?.trim() ?? ''; if (result.success && (!plan || plan === 'No action plan generated.' || plan.length < 20)) { result.success = false; result.error = 'Regeneration returned empty — try again.'; } setActionPlanResult(result); } catch (err) { console.error(err); } setActionPlanLoading(false); }}>
                {actionPlanLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Regenerate
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* TDR Brief — Structured Extract chips + Verdict (always visible when data exists) */}
      {sessionId && (extractionResult?.success || briefData?.success) && (
        <div className="border-b border-[#2a2540] px-5 py-3 space-y-2.5">
          {extractionResult?.success && extractionResult.structured && (
            <div className="flex flex-wrap gap-2">
              {extractionResult.structured.VERDICT && (
                <div className="rounded-md bg-[#1e1a30] border border-[#322b4d] px-2.5 py-1">
                  <p className="text-[9px] text-slate-600">Verdict</p>
                  <p className="text-xs font-semibold text-emerald-400">{extractionResult.structured.VERDICT}</p>
                </div>
              )}
              {extractionResult.structured.DEAL_COMPLEXITY && (
                <div className="rounded-md bg-[#1e1a30] border border-[#322b4d] px-2.5 py-1">
                  <p className="text-[9px] text-slate-600">Complexity</p>
                  <p className="text-xs font-semibold text-slate-300">{extractionResult.structured.DEAL_COMPLEXITY}</p>
                </div>
              )}
              {extractionResult.structured.ENTRY_LAYER && (
                <div className="rounded-md bg-[#1e1a30] border border-[#322b4d] px-2.5 py-1">
                  <p className="text-[9px] text-slate-600">Entry Layer</p>
                  <p className="text-xs font-semibold text-slate-300">{extractionResult.structured.ENTRY_LAYER}</p>
                </div>
              )}
              {extractionResult.structured.CLOUD_PLATFORM && (
                <div className="rounded-md bg-[#1e1a30] border border-[#322b4d] px-2.5 py-1">
                  <p className="text-[9px] text-slate-600">Cloud Platform</p>
                  <p className="text-xs font-semibold text-slate-300">{extractionResult.structured.CLOUD_PLATFORM}</p>
                </div>
              )}
            </div>
          )}
          {extractionResult?.structured?.THESIS && (
            <div className="flex items-start gap-1.5">
              <SourceBadge source="cortex" />
              <p className="text-xs text-slate-400 italic leading-relaxed">"{extractionResult.structured.THESIS}"</p>
            </div>
          )}
        </div>
      )}

      {/* Brief Dialog (triggered from workflow step 4) */}
      <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#1e1a30] border-[#362f50] text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2"><CortexLogo className="h-4 w-4" />TDR Brief</DialogTitle>
            <DialogDescription className="text-slate-500 flex items-center gap-1.5">
              <SnowflakeLogo className="h-3 w-3 inline-block shrink-0" />
              {briefData?.modelUsed ? `${briefData.modelUsed}${briefGeneratedAt ? ` · ${formatDate(briefGeneratedAt)}` : ''}` : 'Generating brief...'}
            </DialogDescription>
          </DialogHeader>
          {briefLoading ? (
            <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
              <CortexLogo className="h-8 w-8 animate-pulse" /><p className="text-sm">Analyzing session data, tech stack, and research...</p>
            </div>
          ) : briefData && !briefData.success ? (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4"><p className="text-sm text-red-300">Brief generation failed</p><p className="text-xs text-red-400/70 mt-1">{briefData.error}</p></div>
          ) : briefSections.length > 0 ? (
            <div className="space-y-5">
              {briefSections.map((section, i) => (
                <div key={i}>
                  <h4 className="text-sm font-semibold text-slate-100 mb-2 border-b border-[#322b4d] pb-1.5">{section.heading}</h4>
                  <div className="text-xs text-slate-400 leading-relaxed">{renderMarkdownBlock(section.content, `s${i}`)}</div>
                </div>
              ))}
            </div>
          ) : briefData?.brief ? (
            <div className="text-xs text-slate-400 leading-relaxed">{renderMarkdownBlock(briefData.brief, 'fallback')}</div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Knowledge Base Summary */}
      <div ref={kbSectionRef} />
      {(filesetSummary || filesetLoading) && (
        <CollapsibleSection ref={kbCollapseRef} title="Knowledge Base" icon={BookOpen} iconColor="text-cyan-400" defaultExpanded={false}
          trailing={<button className="text-slate-600 hover:text-slate-300 transition-colors p-0.5" onClick={(e) => { e.stopPropagation(); handleFilesetSearch(); }} disabled={filesetLoading}>
            {filesetLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
          </button>}
        >
          {filesetLoading && <div className="flex items-center gap-2 text-cyan-400"><CortexLogo className="h-3 w-3 animate-pulse" /><span className="text-2xs">Searching knowledge base...</span></div>}

          {filesetSummary && !filesetLoading && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  filesetSummary.matchSignal === 'strong' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
                  filesetSummary.matchSignal === 'partial' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : 'bg-slate-500/15 text-slate-500 border border-slate-500/25'
                )}>{filesetSummary.matchSignal === 'strong' ? '● Strong' : filesetSummary.matchSignal === 'partial' ? '● Partial' : '○ None'}</div>
                <span className="text-[10px] text-slate-600">{filesetResults?.totalMatches ?? 0} docs</span>
              </div>

              {filesetSummary.summary && (
                <div className="rounded-md bg-[#1e1a30] border border-[#322b4d] p-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-medium text-cyan-400 flex items-center gap-1"><CortexLogo className="h-2.5 w-2.5" /> Summary</p>
                    <div className="flex items-center gap-2">
                      {kbSummaryDate && <span className="text-[9px] text-slate-600">{new Date(kbSummaryDate).toLocaleDateString()}</span>}
                      <button className="text-[9px] text-slate-600 hover:text-cyan-400 flex items-center gap-0.5 transition-colors"
                        onClick={async () => {
                          if (!deal || !filesetResults || filesetResults.matches.length === 0) return;
                          setFilesetLoading(true);
                          try {
                            const competitors = deal.competitors ? (Array.isArray(deal.competitors) ? deal.competitors : [deal.competitors]) : [];
                            const dealContext = `${deal.account} — ${deal.stage} — ACV $${(deal.acv ?? 0).toLocaleString()}`;
                            const summary = await filesetIntel.getIntelligenceSummary(filesetResults, dealContext, competitors as string[], sessionId);
                            setFilesetSummary(summary); setKbSummaryDate(new Date().toISOString());
                          } catch (err) { console.warn(err); }
                          setFilesetLoading(false);
                        }}><RefreshCw className="h-2.5 w-2.5" /></button>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 leading-relaxed space-y-2">{formatKBSummary(filesetSummary.summary)}</div>
                </div>
              )}

              {filesetSummary.relevantDocuments.length > 0 && (
                <div className="space-y-0.5">
                  {filesetSummary.relevantDocuments.slice(0, 5).map((doc, i) => {
                    const isExpanded = expandedDocs.has(i);
                    return (
                      <button key={i} className="w-full text-left rounded-md bg-[#221d38] border border-[#322b4d] px-2.5 py-1 hover:border-[#3d3560] transition-colors"
                        onClick={() => setExpandedDocs(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; })}>
                        <div className="flex items-center gap-1.5">
                          <ChevronDown className={cn('h-2.5 w-2.5 shrink-0 text-slate-600 transition-transform', !isExpanded && '-rotate-90')} />
                          <p className="text-2xs font-medium text-slate-300 truncate flex-1">{doc.title}</p>
                          <span className={cn('text-[10px] font-medium tabular-nums shrink-0', doc.relevance >= 80 ? 'text-emerald-400' : doc.relevance >= 50 ? 'text-amber-400' : 'text-slate-500')}>{doc.relevance}%</span>
                        </div>
                        {isExpanded && (
                          <div className="mt-1 ml-4">
                            <p className="text-[10px] text-slate-500 line-clamp-3">{doc.excerpt}</p>
                            <div className="flex items-center justify-between mt-0.5">
                              <p className="text-[9px] text-slate-700">{doc.source}</p>
                              {doc.filesetId && (
                                <a href={`${(() => { try { return document.referrer ? new URL(document.referrer).origin : ''; } catch { return ''; } })()}/datacenter/filesets/${doc.filesetId}/preview/${encodeURIComponent(doc.title)}`}
                                  target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[9px] text-blue-400 hover:text-blue-300 transition-colors"
                                  onClick={(e) => e.stopPropagation()}><ExternalLink className="h-2.5 w-2.5" />View in Domo</a>
                              )}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CollapsibleSection>
      )}


      {/* ══════════════════════════════════════════════════════════════
          ZONE D — EVIDENCE & ADMIN
          Raw data, history, risks, deal admin
          ══════════════════════════════════════════════════════════════ */}

      {/* Risk & Missing */}
      <div ref={riskSectionRef} />
      <CollapsibleSection ref={riskCollapseRef} title="Risk & Readiness" icon={Shield} iconColor="text-amber-400" defaultExpanded={false}
        badge={(riskFlags.length > 0 || missingInfo.length > 0) ? <span className="text-[9px] text-amber-400 font-medium">{riskFlags.length + missingInfo.length}</span> : undefined}
      >
        {riskFlags.length > 0 && (
          <div className="mb-3">
            <p className="text-2xs font-medium text-slate-500 mb-1.5">Risk Flags</p>
            <ul className="space-y-1">
              {riskFlags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-xs"><AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" /><span className="text-slate-400">{flag}</span></li>
              ))}
            </ul>
          </div>
        )}
        {missingInfo.length > 0 && (
          <div className={riskFlags.length > 0 ? 'pt-3 border-t border-[#322b4d]/60' : ''}>
            <p className="text-2xs font-medium text-slate-500 mb-1.5">Missing Information</p>
            <ul className="space-y-1">
              {missingInfo.map((info, i) => (
                <li key={i} className="flex items-start gap-2 text-xs"><div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" /><span className="text-slate-400">{info}</span></li>
              ))}
            </ul>
          </div>
        )}
        {riskFlags.length === 0 && missingInfo.length === 0 && <p className="text-xs text-slate-500 italic">No risks or gaps identified</p>}

        <div className="pt-3 mt-3 border-t border-[#322b4d]/60">
          <div className={cn(
            'inline-flex items-center gap-2 rounded-md border px-3 py-1.5',
            readinessLevel === 'green' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' :
            readinessLevel === 'yellow' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          )}>
            {readinessLevel === 'green' ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            <span className="text-xs font-medium capitalize">{readinessLevel}</span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Research History & Similar Deals — auto-loaded */}
      {deal && (
        <CollapsibleSection title="Research & Similar" icon={History} iconColor="text-slate-500" defaultExpanded={false}>
          <div className="space-y-2">
            {/* History — only shown when intel data exists */}
            {hasIntel && <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
              <DialogTrigger asChild>
                <button onClick={handleViewHistory} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-400 hover:bg-[#221d38] hover:text-slate-200 transition-colors">
                  <History className="h-3 w-3" />Research History
                  {historyData.length > 0 && <span className="ml-auto text-2xs text-slate-600">{historyData.length} pulls</span>}
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-lg bg-[#1e1a30] border-[#362f50] text-white">
                <DialogHeader><DialogTitle className="text-white">Research History — {deal?.account}</DialogTitle><DialogDescription className="text-slate-500">All enrichment pulls, newest first.</DialogDescription></DialogHeader>
                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {historyLoading ? <div className="flex items-center gap-2 py-6 justify-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div> :
                   historyData.length === 0 ? <p className="text-sm text-slate-500 py-6 text-center">No history found.</p> :
                   historyData.map((entry, i) => {
                     const source = (entry.SOURCE as string) || 'unknown';
                     const pulledAt = formatDate(entry.PULLED_AT as string);
                     return (
                       <div key={(entry.PULL_ID as string) || i} className="rounded-md border border-[#322b4d] bg-[#221d38] px-3 py-2 space-y-0.5">
                         <div className="flex items-center gap-2">
                           {source === 'sumble' ? <SumbleIcon className="h-3 w-3" /> : <PerplexityIcon className="h-3 w-3" />}
                           <span className="text-xs font-medium text-slate-200 capitalize">{source === 'sumble' ? 'Sumble Enrichment' : 'Perplexity Research'}</span>
                           <span className="ml-auto text-2xs text-slate-500">{pulledAt}</span>
                         </div>
                       </div>
                     );
                   })}
                </div>
              </DialogContent>
            </Dialog>}

            {/* Evolution — only shown when intel data exists */}
            {hasIntel && <>
            <button onClick={handleLoadEvolution} disabled={evolutionLoading}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-400 hover:bg-[#221d38] hover:text-slate-200 transition-colors">
              {evolutionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}Intelligence Evolution
            </button>
            <Dialog open={evolutionOpen} onOpenChange={setEvolutionOpen}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#1e1a30] border-[#362f50] text-white">
                <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><BookOpen className="h-4 w-4 text-cyan-400" />Intelligence Evolution</DialogTitle>
                <DialogDescription className="text-slate-500">How intel has changed across {evolutionPullCount} pulls</DialogDescription></DialogHeader>
                {evolutionLoading ? <div className="flex items-center gap-2 py-12 justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin text-cyan-400" /></div> :
                 evolutionText ? <div className="space-y-3 py-2">{evolutionText.split('\n\n').map((block, i) => <div key={i}>{renderMarkdownBlock(block, i)}</div>)}</div> :
                 <p className="text-sm text-slate-500 py-6 text-center">Research at least twice to see evolution.</p>}
              </DialogContent>
            </Dialog>
            </>}

            {/* Similar Deals */}
            <div>
              <div className="flex items-center justify-between mb-1.5 px-2">
                <span className="text-xs text-slate-400">Similar Deals</span>
                <button className="text-slate-600 hover:text-slate-300 transition-colors p-0.5" onClick={handleFindSimilarDeals} disabled={similarDealsLoading}>
                  {similarDealsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                </button>
              </div>
              {similarDeals.length > 0 ? (
                <div className="space-y-1 px-2">
                  {similarDeals.map((d, i) => {
                    const scorePct = Math.round((d.similarityScore ?? 0) * 100);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <p className="text-xs text-slate-300 font-medium truncate flex-1">{d.accountName}</p>
                        <span className={cn('text-2xs font-medium tabular-nums', scorePct >= 80 ? 'text-emerald-400' : scorePct >= 60 ? 'text-amber-400' : 'text-slate-500')}>{scorePct}%</span>
                      </div>
                    );
                  })}
                </div>
              ) : similarDealsLoading ? (
                <div className="flex items-center gap-2 px-2 py-1 text-2xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" />Finding similar deals…</div>
              ) : (
                <p className="text-2xs text-slate-600 italic px-2">No similar deals found</p>
              )}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Final Outcome */}
      {deal && (
        <CollapsibleSection title="Final Outcome" icon={CheckCircle} iconColor="text-slate-500" defaultExpanded={false}>
          <Select value={finalOutcome} onValueChange={setFinalOutcome}>
            <SelectTrigger className="h-9 text-sm bg-[#1e1a30] border-[#362f50] text-slate-200 focus:ring-[#4a3f6b] [&>svg]:text-slate-400">
              <SelectValue placeholder="Select outcome..." />
            </SelectTrigger>
            <SelectContent className="bg-[#1e1a30] border-[#362f50] text-slate-200">
              <SelectItem value="approved">Approved for Forecast</SelectItem>
              <SelectItem value="needs-work">Needs More Work</SelectItem>
              <SelectItem value="deferred">Deferred</SelectItem>
              <SelectItem value="at-risk">Flagged At-Risk</SelectItem>
            </SelectContent>
          </Select>
          <div className="mt-3 space-y-0.5">
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-[#221d38] hover:text-slate-200"><Link className="h-3 w-3" /><span>Opportunity in CRM</span></button>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-[#221d38] hover:text-slate-200"><FileText className="h-3 w-3" /><span>Technical Assessment</span></button>
          </div>
        </CollapsibleSection>
      )}

      {/* Powered by footer */}
      <div className="px-5 py-3 flex items-center justify-center gap-3 opacity-40 hover:opacity-70 transition-opacity">
        <span className="text-[9px] text-slate-500 tracking-wide">Powered by</span>
        <SumbleIcon className="h-3 w-3" />
        <PerplexityIcon className="h-3 w-3" />
        <SnowflakeLogo className="h-3.5 w-3.5" />
        <CortexLogo className="h-3.5 w-3.5" />
      </div>

    </div>
  );
}
