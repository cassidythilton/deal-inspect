import { useState, useEffect, useCallback } from 'react';
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
  ChevronRight,
  Zap,
  ClipboardList,
} from 'lucide-react';
import { SumbleIcon } from '@/components/icons/SumbleIcon';
import { PerplexityIcon } from '@/components/icons/PerplexityIcon';
import { accountIntel } from '@/lib/accountIntel';
import type { SumbleEnrichment, PerplexityResearch, SumbleOrgData, SumbleJobData, SumblePeopleData } from '@/lib/accountIntel';
import { cortexAi, parseBriefSections, FINDING_CATEGORY_STYLES } from '@/lib/cortexAi';
import type { TDRBrief, ClassifiedFinding, ExtractedEntities, BriefSection, SentimentDataPoint, StructuredExtractResult, ActionPlanResult } from '@/lib/cortexAi';
import { calculateTDRScore, calculatePostTDRScore, getPriorityFromScore } from '@/lib/tdrCriticalFactors';
import type { PostTDRScoreBreakdown } from '@/lib/tdrCriticalFactors';
import { getAppSettings } from '@/lib/appSettings';
import { filesetIntel } from '@/lib/filesetIntel';
import type { FilesetSearchResult, FilesetSummary } from '@/lib/filesetIntel';
import { CortexLogo, SnowflakeLogo } from '@/components/CortexBranding';

interface TDRIntelligenceProps {
  deal?: Deal;
  readinessLevel: ReadinessLevel;
  missingInfo: string[];
  riskFlags: string[];
  sessionId?: string;
  /** Sprint 18: Number of completed TDR steps for Post-TDR scoring */
  completedStepCount?: number;
  /** Sprint 18: Total number of TDR steps */
  totalStepCount?: number;
}

// ── Tech category badge colors (dark-native, vibrant on dark bg) ──
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

/** Safely format a date string — handles ISO, epoch-seconds, and Snowflake timestamp formats */
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

// ── Lightweight Markdown renderer for TDR Brief ──────────────────────────────
function renderMarkdownBlock(text: string, keyPrefix: string | number = 'md'): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let paraBuffer: string[] = [];

  const flushPara = () => {
    if (paraBuffer.length === 0) return;
    const raw = paraBuffer.join(' ');
    elements.push(
      <p key={`${keyPrefix}-p${elements.length}`} className="mb-2 last:mb-0">
        {renderInline(raw)}
      </p>
    );
    paraBuffer = [];
  };

  const flushList = () => {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul key={`${keyPrefix}-ul${elements.length}`} className="mb-2 list-disc pl-4 space-y-1 last:mb-0">
        {listBuffer.map((item, j) => (
          <li key={j}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      flushPara();
      listBuffer.push(bulletMatch[1]);
    } else if (trimmed === '') {
      flushList();
      flushPara();
    } else {
      flushList();
      paraBuffer.push(trimmed);
    }
  }
  flushList();
  flushPara();
  return <>{elements}</>;
}

/**
 * Format a KB / fileset summary into readable paragraphs.
 */
function formatKBSummary(raw: string): React.ReactNode {
  if (!raw) return null;
  let text = raw.replace(/^["']|["']$/g, '').trim();
  text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  text = text.replace(/([.!?)\d])\s*\n?\s*([A-Z][A-Za-z &/]+:)/g, '$1\n\n$2');
  text = text.replace(/([.!?])\s{1,2}([A-Z][A-Za-z &/]+:)\s/g, '$1\n\n$2 ');

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
                  {bullets.map((b, j) => (
                    <li key={j}>{renderInline(b.replace(/^[+\-•]\s*/, ''))}</li>
                  ))}
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
                {bulletLines.map((b, j) => (
                  <li key={j}>{renderInline(b.replace(/^[+\-•\t]\s*/, ''))}</li>
                ))}
              </ul>
            </div>
          );
        }
        return (
          <p key={i} className="text-slate-400">
            {renderInline(block.replace(/\n/g, ' '))}
          </p>
        );
      })}
    </>
  );
}

// ── Section metadata for Action Plan sections ────────────────────────────────
const AP_SECTION_META: Record<string, { icon: typeof Briefcase; color: string; bg: string }> = {
  'executive summary':           { icon: Briefcase,    color: 'text-violet-400',  bg: 'bg-violet-500/10' },
  'competitive strategy':        { icon: Target,       color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  'technical positioning':       { icon: Cpu,          color: 'text-cyan-400',    bg: 'bg-cyan-500/10' },
  'risk mitigation':             { icon: AlertCircle,  color: 'text-rose-400',    bg: 'bg-rose-500/10' },
  'stakeholder engagement':      { icon: Users,        color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  'demo & poc strategy':         { icon: Layers,       color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  'timeline & next steps':       { icon: ClipboardList, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
};

function getSectionMeta(title: string) {
  const lower = title.toLowerCase();
  for (const key of Object.keys(AP_SECTION_META)) {
    if (lower.includes(key)) return AP_SECTION_META[key];
  }
  return { icon: Sparkles, color: 'text-slate-400', bg: 'bg-slate-500/10' };
}

/** Render a full Action Plan (7-section structured output from Cortex AI) */
function renderActionPlan(raw: string): React.ReactNode {
  if (!raw) return null;
  const normalized = raw.replace(/\\n/g, '\n');
  const sectionHeaderRegex = /^(\d+)\.\s+(.+)/gm;
  const matches = [...normalized.matchAll(sectionHeaderRegex)];
  if (matches.length === 0) return <div className="text-[12px] text-slate-300 leading-[1.7]">{renderMarkdownBlock(normalized, 'ap')}</div>;

  const sections: { num: string; title: string; startIdx: number; content: string }[] = [];
  const endIdx = normalized.length;
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    sections.push({ num: m[1], title: m[2].trim(), startIdx: m.index!, content: '' });
  }
  for (let i = 0; i < sections.length; i++) {
    const nextHeaderStart = i + 1 < sections.length ? sections[i + 1].startIdx : endIdx;
    const headerEnd = normalized.indexOf('\n', sections[i].startIdx);
    sections[i].content = normalized.substring(
      headerEnd > 0 ? headerEnd + 1 : sections[i].startIdx, nextHeaderStart > 0 ? nextHeaderStart : endIdx
    ).trim();
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
              <h3 className={cn('text-[13px] font-semibold tracking-wide', meta.color)}>
                {section.title}
              </h3>
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
    else {
      flushList();
      elements.push(<p key={`app-${elements.length}`}>{renderInline(trimmed)}</p>);
    }
  }
  flushList();
  return <>{elements}</>;
}

/** Inline markdown: **bold**, *italic* */
function renderInline(text: string): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let i = 0;

  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = regex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      parts.push(remaining.substring(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={`b${i++}`} className="font-semibold text-slate-200">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={`i${i++}`} className="italic text-slate-300">{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < remaining.length) {
    parts.push(remaining.substring(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

// ── Collapsible Section Component ────────────────────────────────────────────
function CollapsibleSection({
  title,
  icon: Icon,
  iconColor = 'text-slate-500',
  defaultExpanded = true,
  children,
  badge,
  trailing,
}: {
  title: string;
  icon: typeof Briefcase;
  iconColor?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="border-b border-[#2a2540]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-5 py-3 hover:bg-[#221d38]/30 transition-colors"
      >
        <Icon className={cn('h-3 w-3 shrink-0', iconColor)} />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 flex-1 text-left">
          {title}
        </span>
        {badge}
        {trailing}
        <ChevronDown className={cn(
          'h-3 w-3 text-slate-600 transition-transform duration-200',
          !expanded && '-rotate-90'
        )} />
      </button>
      {expanded && (
        <div className="px-5 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Section header (non-collapsible) ─────────────────────────────────────────
function SectionHeader({ title, icon: Icon, iconColor = 'text-slate-500', children }: {
  title: string;
  icon: typeof Briefcase;
  iconColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={cn('h-3 w-3 shrink-0', iconColor)} />
      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {title}
      </span>
      {children}
    </div>
  );
}


export function TDRIntelligence({
  deal,
  readinessLevel,
  missingInfo,
  riskFlags,
  sessionId,
  completedStepCount = 0,
  totalStepCount = 9,
}: TDRIntelligenceProps) {

  // ── Account Intelligence State ──
  const [domain, setDomain] = useState('');
  const [sumbleData, setSumbleData] = useState<SumbleEnrichment | null>(null);
  const [perplexityData, setPerplexityData] = useState<PerplexityResearch | null>(null);
  const [sumbleLoading, setSumbleLoading] = useState(false);
  const [perplexityLoading, setPerplexityLoading] = useState(false);
  const [intelLoaded, setIntelLoaded] = useState(false);
  const [sumbleError, setSumbleError] = useState<string | null>(null);
  const [perplexityError, setPerplexityError] = useState<string | null>(null);

  // ── Sprint 26: Unified enrichment progress ──
  const [enrichAllLoading, setEnrichAllLoading] = useState(false);
  const [enrichAllProgress, setEnrichAllProgress] = useState('');

  // ── Intel History State ──
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<Record<string, unknown>[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Cortex AI State (Sprint 7) ──
  const [briefData, setBriefData] = useState<TDRBrief | null>(null);
  const [briefSections, setBriefSections] = useState<BriefSection[]>([]);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefGeneratedAt, setBriefGeneratedAt] = useState<string>('');
  const [briefCacheLoaded, setBriefCacheLoaded] = useState(false);
  const [classifiedFindings, setClassifiedFindings] = useState<ClassifiedFinding[]>([]);
  const [extractedEntities, setExtractedEntities] = useState<ExtractedEntities | null>(null);
  const [cortexProcessing, setCortexProcessing] = useState(false);

  // ── Sprint 17.5: Structured Extraction State (runs in background) ──
  const [extractionResult, setExtractionResult] = useState<StructuredExtractResult | null>(null);
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [extractionCacheLoaded, setExtractionCacheLoaded] = useState(false);
  const [, setExtractionDate] = useState<string>('');

  // ── Sprint 21: Action Plan State ──
  const [actionPlanResult, setActionPlanResult] = useState<ActionPlanResult | null>(null);
  const [actionPlanLoading, setActionPlanLoading] = useState(false);
  const [actionPlanOpen, setActionPlanOpen] = useState(false);
  const [actionPlanCacheLoaded, setActionPlanCacheLoaded] = useState(false);

  // ── Sprint 24: KB Summary Cache State ──
  const [kbSummaryCacheLoaded, setKbSummaryCacheLoaded] = useState(false);
  const [kbSummaryDate, setKbSummaryDate] = useState<string>('');

  // ── Sprint 6.5: Deep Intelligence State ──
  const [sumbleOrgData, setSumbleOrgData] = useState<SumbleOrgData | null>(null);
  const [sumbleJobData, setSumbleJobData] = useState<SumbleJobData | null>(null);
  const [sumblePeopleData, setSumblePeopleData] = useState<SumblePeopleData | null>(null);

  // ── Sprint 9: Intelligence Evolution & Sentiment ──
  const [evolutionText, setEvolutionText] = useState<string>('');
  const [evolutionPullCount, setEvolutionPullCount] = useState(0);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionOpen, setEvolutionOpen] = useState(false);
  const [sentimentTrend, setSentimentTrend] = useState<SentimentDataPoint[]>([]);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentNoInputs, setSentimentNoInputs] = useState(false);
  const [sentimentFetched, setSentimentFetched] = useState(false);

  // ── Sprint 11: Similar Deals ──
  const [similarDeals, setSimilarDeals] = useState<{ opportunityId: string; accountName: string; similarityScore: number; sessionId?: string }[]>([]);
  const [similarDealsLoading, setSimilarDealsLoading] = useState(false);

  // ── Sprint 22: Final Outcome (controlled select) ──
  const [finalOutcome, setFinalOutcome] = useState<string>('');

  // ── Sprint 19: Fileset Intelligence ──
  const [filesetResults, setFilesetResults] = useState<FilesetSearchResult | null>(null);
  const [filesetSummary, setFilesetSummary] = useState<FilesetSummary | null>(null);
  const [filesetLoading, setFilesetLoading] = useState(false);
  const [filesetSearched, setFilesetSearched] = useState(false);
  const [filesetCortexAttempted, setFilesetCortexAttempted] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState<Set<number>>(new Set());

  // Pre-fill domain
  useEffect(() => {
    if (deal?.websiteDomain) {
      const raw = deal.websiteDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
      setDomain(raw || accountIntel.guessDomain(deal.account));
    } else if (deal?.account) {
      setDomain(accountIntel.guessDomain(deal.account));
    }
  }, [deal?.websiteDomain, deal?.account]);

  // Load cached intel on mount
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
      } catch (err) {
        console.warn('[TDRIntelligence] Failed to load cached intel:', err);
      }
    };

    loadCachedIntel();
  }, [deal?.id, intelLoaded]);

  // Load cached TDR brief on mount
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
      } catch (err) {
        console.warn('[TDRIntelligence] Failed to load cached brief:', err);
      }
    };

    loadCachedBrief();
  }, [sessionId, briefCacheLoaded]);

  // Load cached action plan on mount
  useEffect(() => {
    if (!sessionId || actionPlanCacheLoaded) return;
    setActionPlanCacheLoaded(true);

    const loadCachedActionPlan = async () => {
      try {
        const cached = await cortexAi.getLatestActionPlan(sessionId);
        if (cached.hasPlan && cached.actionPlan) {
          setActionPlanResult({
            success: true,
            actionPlan: cached.actionPlan,
            modelUsed: cached.modelUsed,
            createdAt: cached.createdAt,
            cached: true,
          });
        }
      } catch (err) {
        console.warn('[TDRIntelligence] Failed to load cached action plan:', err);
      }
    };

    loadCachedActionPlan();
  }, [sessionId, actionPlanCacheLoaded]);

  // Load cached extraction on mount, auto-extract if none (Sprint 26: runs silently in background)
  useEffect(() => {
    if (!sessionId || extractionCacheLoaded) return;
    setExtractionCacheLoaded(true);

    const loadCachedExtraction = async () => {
      try {
        const cached = await cortexAi.getLatestExtraction(sessionId);
        if (cached.hasExtract && cached.structured) {
          setExtractionResult({
            success: true,
            extractId: cached.extractId,
            structured: cached.structured,
          });
          setExtractionDate(cached.extractedAt || '');
        } else {
          // Auto-extract silently in background
          setExtractionLoading(true);
          try {
            const result = await cortexAi.extractStructuredTDR(sessionId);
            setExtractionResult(result);
            if (result.success) setExtractionDate(new Date().toISOString());
          } catch (extractErr) {
            console.warn('[TDRIntelligence] Auto-extraction failed:', extractErr);
          }
          setExtractionLoading(false);
        }
      } catch (err) {
        console.warn('[TDRIntelligence] Failed to load cached extraction:', err);
      }
    };

    loadCachedExtraction();
  }, [sessionId, extractionCacheLoaded]);

  // Sprint 19: Auto-search filesets when deal opens
  useEffect(() => {
    if (filesetSearched || !deal) return;
    const settings = getAppSettings();
    if ((settings.filesetIds ?? []).length === 0) return;

    setFilesetSearched(true);
    setFilesetLoading(true);

    const doSearch = async () => {
      try {
        const competitors = deal.competitors
          ? (Array.isArray(deal.competitors) ? deal.competitors : [deal.competitors])
          : [];
        const result = await filesetIntel.searchByDealContext({
          accountName: deal.account,
          competitors: competitors as string[],
          partnerPlatform: deal.partnersInvolved || undefined,
          cloudPlatform: deal.snowflakeTeam || undefined,
          industry: undefined,
        });
        setFilesetResults(result);

        if (result.matches.length > 0) {
          const dealContext = `${deal.account} — ${deal.stage} — ACV $${(deal.acv ?? 0).toLocaleString()}`;
          const summary = await filesetIntel.getIntelligenceSummary(
            result, dealContext, competitors as string[], sessionId
          );
          setFilesetSummary(summary);
          console.log(`[FilesetIntel] Auto-search complete: ${result.matches.length} matches, signal: ${summary.matchSignal}`);
        }
      } catch (err) {
        console.warn('[FilesetIntel] Auto-search failed:', err);
      }
      setFilesetLoading(false);
    };

    doSearch();
  }, [deal, filesetSearched, sessionId]);

  // Sprint 19.5 + Sprint 24: Load cached KB summary first
  useEffect(() => {
    if (!sessionId || !filesetResults || filesetResults.matches.length === 0 || !deal) return;
    if (filesetCortexAttempted) return;
    setFilesetCortexAttempted(true);

    const loadOrSummarize = async () => {
      if (!kbSummaryCacheLoaded) {
        try {
          const cached = await cortexAi.getCachedKBSummary(sessionId);
          if (cached.hasSummary && cached.summary) {
            setFilesetSummary(prev => prev ? {
              ...prev,
              summary: cached.summary!,
              cortexModelUsed: cached.modelUsed || prev.cortexModelUsed,
            } : {
              matchSignal: 'partial' as const,
              summary: cached.summary!,
              keyInsights: [],
              cortexModelUsed: cached.modelUsed || '',
            });
            setKbSummaryDate(cached.createdAt || '');
            setKbSummaryCacheLoaded(true);
            return;
          }
        } catch (err) {
          console.warn('[FilesetIntel] Cache check failed:', err);
        }
        setKbSummaryCacheLoaded(true);
      }

      if (!filesetSummary || filesetSummary.summary === '') return;
      try {
        const competitors = deal.competitors
          ? (Array.isArray(deal.competitors) ? deal.competitors : [deal.competitors])
          : [];
        const dealContext = `${deal.account} — ${deal.stage} — ACV $${(deal.acv ?? 0).toLocaleString()}`;
        const summary = await filesetIntel.getIntelligenceSummary(
          filesetResults, dealContext, competitors as string[], sessionId
        );
        setFilesetSummary(summary);
        setKbSummaryDate(new Date().toISOString());
      } catch (err) {
        console.warn('[FilesetIntel] Cortex summarization failed:', err);
      }
    };

    loadOrSummarize();
  }, [sessionId, filesetResults, filesetSummary, deal, filesetCortexAttempted, kbSummaryCacheLoaded]);

  // Manual fileset re-search
  const handleFilesetSearch = useCallback(async () => {
    if (!deal) return;
    setFilesetLoading(true);
    try {
      const competitors = deal.competitors
        ? (Array.isArray(deal.competitors) ? deal.competitors : [deal.competitors])
        : [];
      const result = await filesetIntel.searchByDealContext({
        accountName: deal.account,
        competitors: competitors as string[],
        partnerPlatform: deal.partnersInvolved || undefined,
        cloudPlatform: deal.snowflakeTeam || undefined,
      });
      setFilesetResults(result);

      if (result.matches.length > 0) {
        const dealContext = `${deal.account} — ${deal.stage} — ACV $${(deal.acv ?? 0).toLocaleString()}`;
        const summary = await filesetIntel.getIntelligenceSummary(
          result, dealContext, competitors as string[], sessionId
        );
        setFilesetSummary(summary);
      }
    } catch (err) {
      console.warn('[FilesetIntel] Manual search failed:', err);
    }
    setFilesetLoading(false);
  }, [deal, sessionId]);

  // ── Sprint 26: Unified Enrich Account handler ──
  const handleEnrichAll = useCallback(async () => {
    if (!deal || !domain.trim()) return;
    setEnrichAllLoading(true);
    setEnrichAllProgress('Enriching...');
    setSumbleError(null);

    try {
      const result = await accountIntel.enrichAll(deal.id, deal.account, domain.trim());
      
      // Populate individual states from unified result
      if (result.sumble?.success) setSumbleData(result.sumble);
      if (result.org?.success) setSumbleOrgData(result.org);
      if (result.jobs?.success) setSumbleJobData(result.jobs);
      if (result.people?.success) setSumblePeopleData(result.people);
      
      if (result.errors.length > 0) {
        setSumbleError(`${result.completedCount}/4 enrichments succeeded. ${result.errors.join('; ')}`);
      }
      setEnrichAllProgress(`${result.completedCount}/4 complete`);
    } catch (err) {
      setSumbleError(err instanceof Error ? err.message : 'Enrichment failed');
    }
    setEnrichAllLoading(false);
  }, [deal, domain]);

  // ── Perplexity Research (auto-triggers Cortex classify + extract) ──
  const handleResearchPerplexity = useCallback(async () => {
    if (!deal) return;
    setPerplexityLoading(true);
    setPerplexityError(null);
    try {
      const result = await accountIntel.researchPerplexity(
        deal.id, deal.account,
        { acv: deal.acv, stage: deal.stage, partnersInvolved: deal.partnersInvolved || undefined }
      );
      if (result.success) {
        setPerplexityData(result);
        setPerplexityError(null);

        // Auto-trigger Cortex AI classification + entity extraction
        if (result.pullId) {
          setCortexProcessing(true);
          try {
            const [classifyResult, extractResult] = await Promise.allSettled([
              cortexAi.classifyFindings(result.pullId),
              cortexAi.extractEntities(result.pullId),
            ]);
            if (classifyResult.status === 'fulfilled' && classifyResult.value.success) {
              setClassifiedFindings(classifyResult.value.findings);
            }
            if (extractResult.status === 'fulfilled' && extractResult.value.success) {
              setExtractedEntities(extractResult.value);
            }
          } catch (cortexErr) {
            console.warn('[TDRIntelligence] Cortex post-processing error:', cortexErr);
          }
          setCortexProcessing(false);
        }
      } else {
        setPerplexityError(typeof result.error === 'string' ? result.error : 'Research failed');
      }
    } catch (err) {
      setPerplexityError(err instanceof Error ? err.message : 'Unexpected error');
    }
    setPerplexityLoading(false);
  }, [deal]);

  // Generate TDR Brief
  const handleGenerateBrief = useCallback(async () => {
    if (!sessionId) return;
    setBriefLoading(true);
    setBriefOpen(true);
    try {
      const result = await cortexAi.generateTDRBrief(sessionId);
      setBriefData(result);
      if (result.success && result.brief) {
        setBriefSections(parseBriefSections(result.brief));
        setBriefGeneratedAt(new Date().toISOString());
      }
    } catch (err) {
      setBriefData({ success: false, error: String(err) });
    }
    setBriefLoading(false);
  }, [sessionId]);

  const handleOpenCachedBrief = useCallback(() => { setBriefOpen(true); }, []);

  // Intel History
  const handleViewHistory = useCallback(async () => {
    if (!deal) return;
    setHistoryOpen(true);
    if (historyData.length > 0) return;
    setHistoryLoading(true);
    try {
      const data = await accountIntel.getIntelHistory(deal.id);
      setHistoryData(data);
    } catch (err) {
      console.warn('[TDRIntelligence] Failed to load intel history:', err);
    }
    setHistoryLoading(false);
  }, [deal, historyData.length]);

  // Intelligence Evolution
  const handleLoadEvolution = useCallback(async () => {
    if (!deal?.id) return;
    setEvolutionOpen(true);
    if (evolutionText) return;
    setEvolutionLoading(true);
    try {
      const result = await cortexAi.summarizeIntelHistory(deal.id);
      if (result.success) {
        setEvolutionText(result.evolution);
        setEvolutionPullCount(result.pullCount);
      } else {
        setEvolutionText('Unable to generate evolution summary.');
      }
    } catch (err) {
      setEvolutionText('Error loading evolution summary.');
    }
    setEvolutionLoading(false);
  }, [deal?.id, evolutionText]);

  // Sentiment Trend
  const handleLoadSentiment = useCallback(async () => {
    if (!deal?.id) return;
    setSentimentLoading(true);
    setSentimentNoInputs(false);
    try {
      const result = await cortexAi.getSentimentTrend(deal.id);
      if (result.success) {
        const validTrend = (result.trend || []).filter(
          (pt) => pt.sentiment != null && !isNaN(pt.sentiment)
        );
        setSentimentTrend(validTrend);
        setSentimentNoInputs(result.noInputs === true || validTrend.length === 0);
      }
    } catch (err) {
      console.warn('[TDRIntelligence] Failed to load sentiment trend:', err);
    }
    setSentimentLoading(false);
    setSentimentFetched(true);
  }, [deal?.id]);

  // Find Similar Deals
  const handleFindSimilarDeals = useCallback(async () => {
    if (!deal?.id) return;
    setSimilarDealsLoading(true);
    try {
      const result = await cortexAi.findSimilarDeals(deal.id);
      if (result.success) {
        const validDeals = (result.deals || []).filter(
          (d) => d.similarityScore != null && !isNaN(d.similarityScore)
        );
        setSimilarDeals(validDeals);
      }
    } catch (err) {
      console.warn('[TDRIntelligence] Failed to find similar deals:', err);
    }
    setSimilarDealsLoading(false);
  }, [deal?.id]);

  // Get short stage name
  const getShortStage = (stage: string) => {
    const lower = stage.toLowerCase();
    if (lower.includes('validation')) return 'Validation';
    if (lower.includes('discovery')) return 'Discovery';
    if (lower.includes('closing')) return 'Closing';
    if (lower.includes('proposal')) return 'Proposal';
    return stage.split(' ').slice(0, 1).join(' ');
  };

  // ── Computed values ──
  const hasIntel = !!(sumbleData || perplexityData);

  return (
    <div className="flex h-full flex-col overflow-y-auto">

      {/* ══════════════════════════════════════════════════════════════
          §1  DEAL HEADER — always visible
          ══════════════════════════════════════════════════════════════ */}
      {deal && (
        <div className="border-b border-[#2a2540] px-5 py-4">
          <h3 className="text-base font-semibold text-white">{deal.account}</h3>
          <p className="text-sm text-slate-400">{deal.dealName}</p>
          <div className="mt-1.5 flex items-center gap-2 text-sm">
            <span className="font-medium tabular-nums text-slate-300">
              ${(deal.acv / 1000).toFixed(0)}K ACV
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{getShortStage(deal.stage)}</span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          §2  TDR SCORE — quick signal
          ══════════════════════════════════════════════════════════════ */}
      {deal && (() => {
        const preTDRScore = deal.tdrScore ?? calculateTDRScore(deal);
        const settings = getAppSettings();
        const hasAnyPostData = !!sumbleData?.success || !!perplexityData?.success || completedStepCount > 0 || (extractionResult?.success && extractionResult.structured);
        let postBreakdown: PostTDRScoreBreakdown | null = null;

        if (hasAnyPostData) {
          postBreakdown = calculatePostTDRScore(deal, {
            namedCompetitors: extractedEntities?.competitors
              ?? extractionResult?.structured?.NAMED_COMPETITORS ?? [],
            dangerousCompetitors: settings.dangerousCompetitors,
            hasSumbleEnrichment: !!sumbleData?.success,
            hasPerplexityEnrichment: !!perplexityData?.success,
            riskCategories: extractionResult?.structured?.RISK_CATEGORIES ?? [],
            dealComplexity: extractionResult?.structured?.DEAL_COMPLEXITY,
            domoUseCases: extractionResult?.structured?.DOMO_USE_CASES ?? [],
            completedStepCount,
            totalStepCount,
            filesetMatchSignal: filesetSummary?.matchSignal ?? 'none',
          });
        }

        const displayScore = postBreakdown ? postBreakdown.totalPostTDR : preTDRScore;
        const priority = getPriorityFromScore(displayScore);
        const isPostTDR = !!postBreakdown;

        return (
          <div className="border-b border-[#2a2540] px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3 w-3 text-slate-500" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">TDR Score</span>
              </div>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-2xs font-medium',
                isPostTDR
                  ? 'bg-violet-500/15 text-violet-300 border border-violet-500/25'
                  : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
              )}>
                {isPostTDR ? 'Post-TDR' : 'Pre-TDR'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className={cn(
                'text-xl font-bold tabular-nums',
                priority === 'CRITICAL' ? 'text-violet-300' :
                priority === 'HIGH' ? 'text-violet-400' :
                priority === 'MEDIUM' ? 'text-amber-400' : 'text-slate-400'
              )}>
                {displayScore}
              </span>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
                priority === 'CRITICAL' ? 'bg-violet-500/15 text-violet-300' :
                priority === 'HIGH' ? 'bg-violet-500/10 text-violet-400' :
                priority === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-500/10 text-slate-500'
              )}>
                {priority}
              </span>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-[#2a2540] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${displayScore}%`,
                      background: priority === 'CRITICAL'
                        ? 'linear-gradient(90deg, hsl(263, 84%, 55%), hsl(280, 70%, 55%))'
                        : priority === 'HIGH'
                        ? 'linear-gradient(90deg, hsl(263, 60%, 50%), hsl(280, 50%, 45%))'
                        : priority === 'MEDIUM'
                        ? 'linear-gradient(90deg, hsl(38, 65%, 50%), hsl(45, 60%, 55%))'
                        : 'hsl(260, 10%, 40%)',
                    }}
                  />
                </div>
                <span className="text-2xs text-slate-600 tabular-nums shrink-0">/100</span>
              </div>
            </div>

            {postBreakdown && (
              <div className="mt-3 pt-3 border-t border-[#2a2540]/60 space-y-1">
                <p className="text-[9px] uppercase tracking-wider text-slate-600 mb-1.5">Breakdown</p>
                {[
                  { label: 'Pre-TDR Base', value: postBreakdown.preTDRScore, max: 100 },
                  { label: 'Competitor Threat', value: postBreakdown.namedCompetitorThreat, max: 10 },
                  { label: 'Enrichment Depth', value: postBreakdown.enrichmentDepth, max: 5 },
                  { label: 'TDR Completeness', value: postBreakdown.tdrInputCompleteness, max: 10 },
                  { label: 'Risk Awareness', value: postBreakdown.riskAwareness, max: 5 },
                  { label: 'Knowledge Base', value: postBreakdown.filesetMatchSignal, max: 5 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-2xs">
                    <span className="text-slate-500 w-28 shrink-0">{item.label}</span>
                    <div className="flex-1 h-[3px] rounded-full bg-[#2a2540] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.max > 0 ? (item.value / item.max) * 100 : 0}%`,
                          background: item.value > 0
                            ? 'linear-gradient(90deg, hsl(263, 70%, 55%), hsl(280, 50%, 50%))'
                            : 'hsl(260, 10%, 30%)',
                        }}
                      />
                    </div>
                    <span className={cn(
                      'tabular-nums w-8 text-right text-2xs font-medium',
                      item.value > 0 ? 'text-violet-400' : 'text-slate-600'
                    )}>
                      +{item.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════
          §3  STRATEGIC ACTION PLAN — most actionable
          ══════════════════════════════════════════════════════════════ */}
      {sessionId && (
        <CollapsibleSection
          title="Strategic Action Plan"
          icon={Zap}
          iconColor="text-violet-400"
          defaultExpanded={true}
          badge={actionPlanResult?.success ? (
            <span className="text-[9px] text-emerald-400 font-medium">
              {actionPlanResult.cached ? 'cached' : 'ready'}
            </span>
          ) : undefined}
        >
          {actionPlanResult?.success && actionPlanResult.actionPlan ? (
            <div className="space-y-2">
              {/* Preview: first 3 lines */}
              <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">
                {actionPlanResult.actionPlan
                  .replace(/\\n/g, ' ')
                  .replace(/\*\*/g, '')
                  .replace(/^\d+\.\s*[A-Za-z &]+/m, '')
                  .trim()
                  .substring(0, 200)}...
              </p>

              {/* View full action plan dialog */}
              <Dialog open={actionPlanOpen} onOpenChange={setActionPlanOpen}>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-1 text-[10px] text-violet-400/80 hover:text-violet-300 transition-colors mt-1">
                    <ClipboardList className="h-2.5 w-2.5" />
                    View full plan
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#1a1528] border-[#362f50] text-slate-200">
                  <DialogHeader className="pb-3 border-b border-[#322b4d]">
                    <DialogTitle className="flex items-center gap-2.5 text-base">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/15">
                        <Zap className="h-4 w-4 text-violet-400" />
                      </div>
                      <div>
                        <span className="text-slate-100">Strategic Action Plan</span>
                        {actionPlanResult.cached && (
                          <span className="ml-2 text-[10px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded-full font-normal align-middle">cached</span>
                        )}
                      </div>
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 text-xs mt-1">
                      {deal?.account} — Synthesized from all TDR data sources
                    </DialogDescription>
                  </DialogHeader>

                  <div className="mt-4">
                    {renderActionPlan(actionPlanResult.actionPlan)}
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#322b4d] flex items-center justify-between">
                    <span className="text-[10px] text-slate-600">
                      {actionPlanResult.modelUsed && `Model: ${actionPlanResult.modelUsed}`}
                      {actionPlanResult.createdAt && ` · ${new Date(actionPlanResult.createdAt).toLocaleString()}`}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-[#362f50] text-slate-400 hover:bg-[#221d38] hover:text-white"
                      disabled={actionPlanLoading}
                      onClick={async () => {
                        setActionPlanLoading(true);
                        try {
                          const result = await cortexAi.regenerateActionPlan(sessionId);
                          setActionPlanResult(result);
                        } catch (err) {
                          console.error('[TDRIntelligence] Action plan regeneration failed:', err);
                        }
                        setActionPlanLoading(false);
                      }}
                    >
                      {actionPlanLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Regenerate
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ) : actionPlanResult && !actionPlanResult.success ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Generation failed</span>
              </div>
              <p className="text-[10px] text-slate-600 break-all">{actionPlanResult.error}</p>
              <button
                className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-300 transition-colors"
                disabled={actionPlanLoading}
                onClick={async () => {
                  setActionPlanLoading(true);
                  try {
                    const result = await cortexAi.generateActionPlan(sessionId);
                    setActionPlanResult(result);
                  } catch (err) {
                    console.error('[TDRIntelligence] Action plan retry failed:', err);
                  }
                  setActionPlanLoading(false);
                }}
              >
                {actionPlanLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
                Retry
              </button>
            </div>
          ) : (
            <button
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-md text-[11px] font-medium text-violet-300 border border-violet-500/25 bg-violet-500/5 hover:bg-violet-500/10 hover:text-violet-200 transition-all disabled:opacity-40"
              disabled={actionPlanLoading}
              onClick={async () => {
                setActionPlanLoading(true);
                try {
                  const result = await cortexAi.generateActionPlan(sessionId);
                  setActionPlanResult(result);
                } catch (err) {
                  console.error('[TDRIntelligence] Action plan generation failed:', err);
                }
                setActionPlanLoading(false);
              }}
            >
              {actionPlanLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Synthesizing...
                </>
              ) : (
                <>
                  <Zap className="h-3 w-3" />
                  Generate Action Plan
                </>
              )}
            </button>
          )}
        </CollapsibleSection>
      )}

      {/* ══════════════════════════════════════════════════════════════
          §4  CORTEX TDR BRIEF — AI-synthesized narrative
          ══════════════════════════════════════════════════════════════ */}
      {sessionId && (
        <CollapsibleSection
          title="Cortex TDR Brief"
          icon={Sparkles}
          iconColor="text-cyan-400"
          defaultExpanded={true}
          badge={briefData?.success ? (
            <span className="text-[9px] text-cyan-400 font-medium">
              {formatDate(briefGeneratedAt)}
            </span>
          ) : undefined}
        >
          <div className="flex gap-2">
            {briefData?.success ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs h-8 border-cyan-500/20 bg-cyan-500/5 text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-200"
                  onClick={handleOpenCachedBrief}
                >
                  <CortexLogo className="h-3 w-3" />
                  View Brief
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-8 border-[#362f50] bg-transparent text-slate-500 hover:bg-[#221d38] hover:text-white"
                  onClick={handleGenerateBrief}
                  disabled={briefLoading}
                >
                  {briefLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs h-8 border-cyan-500/20 bg-cyan-500/5 text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-200"
                onClick={handleGenerateBrief}
                disabled={briefLoading || (!sumbleData && !perplexityData)}
              >
                {briefLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CortexLogo className="h-3 w-3" />}
                Generate TDR Brief
              </Button>
            )}
          </div>

          {/* Brief Dialog */}
          <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#1e1a30] border-[#362f50] text-white">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <CortexLogo className="h-4 w-4" />
                  TDR Brief
                </DialogTitle>
                <DialogDescription className="text-slate-500 flex items-center gap-1.5">
                  <SnowflakeLogo className="h-3 w-3 inline-block shrink-0" />
                  {briefData?.modelUsed
                    ? `${briefData.modelUsed}${briefGeneratedAt ? ` · ${formatDate(briefGeneratedAt)}` : ''}`
                    : 'Generating brief...'}
                </DialogDescription>
              </DialogHeader>

              {briefLoading ? (
                <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
                  <CortexLogo className="h-8 w-8 animate-pulse" />
                  <p className="text-sm">Analyzing session data, tech stack, and research...</p>
                  <p className="text-2xs text-slate-600">This may take 15–30 seconds</p>
                </div>
              ) : briefData && !briefData.success ? (
                <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4">
                  <p className="text-sm text-red-300">Brief generation failed</p>
                  <p className="text-xs text-red-400/70 mt-1">{briefData.error}</p>
                </div>
              ) : briefSections.length > 0 ? (
                <div className="space-y-5">
                  {briefSections.map((section, i) => (
                    <div key={i}>
                      <h4 className="text-sm font-semibold text-slate-100 mb-2 border-b border-[#322b4d] pb-1.5">
                        {section.heading}
                      </h4>
                      <div className="text-xs text-slate-400 leading-relaxed">
                        {renderMarkdownBlock(section.content, `s${i}`)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : briefData?.brief ? (
                <div className="text-xs text-slate-400 leading-relaxed">
                  {renderMarkdownBlock(briefData.brief, 'fallback')}
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        </CollapsibleSection>
      )}

      {/* ══════════════════════════════════════════════════════════════
          §5  KNOWLEDGE BASE — fileset intelligence
          ══════════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Knowledge Base"
        icon={BookOpen}
        iconColor="text-cyan-400"
        defaultExpanded={true}
        trailing={
          <button
            className="text-slate-600 hover:text-slate-300 transition-colors p-0.5"
            onClick={(e) => { e.stopPropagation(); handleFilesetSearch(); }}
            disabled={filesetLoading}
          >
            {filesetLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
          </button>
        }
      >
        {filesetLoading && (
          <div className="flex items-center gap-2 text-cyan-400">
            <CortexLogo className="h-3 w-3 animate-pulse" />
            <span className="text-2xs">Searching knowledge base...</span>
          </div>
        )}

        {filesetSummary && !filesetLoading && (
          <div className="space-y-2">
            {/* Match signal */}
            <div className="flex items-center gap-1.5">
              <div className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                filesetSummary.matchSignal === 'strong'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                  : filesetSummary.matchSignal === 'partial'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                    : 'bg-slate-500/15 text-slate-500 border border-slate-500/25'
              )}>
                {filesetSummary.matchSignal === 'strong' ? '● Strong Match' :
                 filesetSummary.matchSignal === 'partial' ? '● Partial Match' : '○ No Match'}
              </div>
              <span className="text-[10px] text-slate-600">{filesetResults?.totalMatches ?? 0} docs</span>
            </div>

            {/* AI Summary */}
            {filesetSummary.summary && (
              <div className="rounded-md bg-[#1e1a30] border border-[#322b4d] p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-medium text-cyan-400 flex items-center gap-1">
                    <CortexLogo className="h-2.5 w-2.5" /> Summary
                  </p>
                  <div className="flex items-center gap-2">
                    {kbSummaryDate && (
                      <span className="text-[9px] text-slate-600">{new Date(kbSummaryDate).toLocaleDateString()}</span>
                    )}
                    <button
                      className="text-[9px] text-slate-600 hover:text-cyan-400 flex items-center gap-0.5 transition-colors"
                      title="Refresh KB summary"
                      onClick={async () => {
                        if (!deal || !filesetResults || filesetResults.matches.length === 0) return;
                        setFilesetLoading(true);
                        try {
                          const competitors = deal.competitors
                            ? (Array.isArray(deal.competitors) ? deal.competitors : [deal.competitors])
                            : [];
                          const dealContext = `${deal.account} — ${deal.stage} — ACV $${(deal.acv ?? 0).toLocaleString()}`;
                          const summary = await filesetIntel.getIntelligenceSummary(
                            filesetResults, dealContext, competitors as string[], sessionId
                          );
                          setFilesetSummary(summary);
                          setKbSummaryDate(new Date().toISOString());
                        } catch (err) {
                          console.warn('[FilesetIntel] Manual refresh failed:', err);
                        }
                        setFilesetLoading(false);
                      }}
                    >
                      <RefreshCw className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 leading-relaxed space-y-2">
                  {formatKBSummary(filesetSummary.summary)}
                </div>
              </div>
            )}

            {/* Insights */}
            {(filesetSummary.competitorInsights.length > 0 || filesetSummary.partnerInsights.length > 0) && (
              <div className="flex flex-wrap gap-1 mt-1">
                {filesetSummary.competitorInsights.slice(0, 3).map((ins, i) => (
                  <span key={`c${i}`} className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20" title={ins}>
                    <Target className="h-2 w-2 shrink-0" />
                    {ins.length > 28 ? ins.substring(0, 28) + '…' : ins}
                  </span>
                ))}
                {filesetSummary.partnerInsights.slice(0, 3).map((ins, i) => (
                  <span key={`p${i}`} className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20" title={ins}>
                    <Users className="h-2 w-2 shrink-0" />
                    {ins.length > 28 ? ins.substring(0, 28) + '…' : ins}
                  </span>
                ))}
              </div>
            )}

            {/* Documents */}
            {filesetSummary.relevantDocuments.length > 0 && (
              <div className="space-y-0.5">
                {filesetSummary.relevantDocuments.slice(0, 6).map((doc, i) => {
                  const isExpanded = expandedDocs.has(i);
                  return (
                    <button
                      key={i}
                      className="w-full text-left rounded-md bg-[#221d38] border border-[#322b4d] px-2.5 py-1 hover:border-[#3d3560] transition-colors"
                      onClick={() => {
                        setExpandedDocs((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        });
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <ChevronDown className={cn('h-2.5 w-2.5 shrink-0 text-slate-600 transition-transform', !isExpanded && '-rotate-90')} />
                        <p className="text-2xs font-medium text-slate-300 truncate flex-1">{doc.title}</p>
                        <span className={cn(
                          'text-[10px] font-medium tabular-nums shrink-0',
                          doc.relevance >= 80 ? 'text-emerald-400' : doc.relevance >= 50 ? 'text-amber-400' : 'text-slate-500'
                        )}>
                          {doc.relevance}%
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="mt-1 ml-4">
                          <p className="text-[10px] text-slate-500 line-clamp-3">{doc.excerpt}</p>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-[9px] text-slate-700">{doc.source}</p>
                            {doc.filesetId && (
                              <a
                                href={`${(() => { try { return document.referrer ? new URL(document.referrer).origin : ''; } catch { return ''; } })()}/datacenter/filesets/${doc.filesetId}/preview/${encodeURIComponent(doc.title)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[9px] text-blue-400 hover:text-blue-300 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                                View in Domo
                              </a>
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

        {!filesetLoading && !filesetSummary && filesetSearched && (
          <p className="text-2xs text-slate-600 italic">
            {(getAppSettings().filesetIds ?? []).length === 0
              ? 'No filesets configured — add filesets in Settings'
              : 'No relevant documents found'}
          </p>
        )}

        {!filesetLoading && !filesetSearched && (
          <p className="text-2xs text-slate-600 italic">
            {(getAppSettings().filesetIds ?? []).length === 0
              ? 'Add filesets in Settings to enable knowledge base'
              : 'Click refresh to search knowledge base'}
          </p>
        )}
      </CollapsibleSection>

      {/* ══════════════════════════════════════════════════════════════
          §6  ACCOUNT INTELLIGENCE — consolidated enrichment
          ══════════════════════════════════════════════════════════════ */}
      {deal && (
        <CollapsibleSection
          title="Account Intelligence"
          icon={Globe}
          iconColor="text-blue-400"
          defaultExpanded={false}
          badge={hasIntel ? (
            <span className="text-[9px] text-emerald-400 font-medium">enriched</span>
          ) : undefined}
        >
          {/* Domain Input */}
          <div className="mb-3 space-y-1">
            <Label className="text-2xs text-slate-500">Account Domain</Label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="acme.com"
              className="h-8 text-xs bg-[#1e1a30] border-[#362f50] text-white placeholder:text-slate-500 focus-visible:ring-[#4a3f6b]"
            />
          </div>

          {/* Sprint 26: Unified Enrich + Perplexity buttons */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-9 border-[#362f50] bg-[#1e1a30]/80 text-slate-300 hover:bg-[#2d2744] hover:text-white disabled:opacity-40"
              onClick={handleEnrichAll}
              disabled={enrichAllLoading || !domain.trim()}
            >
              {enrichAllLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <SumbleIcon className="h-3.5 w-3.5" />
              )}
              <span className="flex flex-col items-start leading-none">
                <span className="font-medium">{hasIntel ? 'Refresh' : 'Enrich Account'}</span>
                <span className="text-2xs text-slate-500 font-normal">
                  {enrichAllLoading ? enrichAllProgress : 'All 4 enrichments'}
                </span>
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-9 border-[#362f50] bg-[#1e1a30]/80 text-slate-300 hover:bg-[#2d2744] hover:text-white disabled:opacity-40"
              onClick={handleResearchPerplexity}
              disabled={perplexityLoading}
            >
              {perplexityLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <PerplexityIcon className="h-3.5 w-3.5" />
              )}
              <span className="flex flex-col items-start leading-none">
                <span className="font-medium">{perplexityData ? 'Re-research' : 'Web Research'}</span>
                <span className="text-2xs text-slate-500 font-normal">Web intel & competition</span>
              </span>
            </Button>
          </div>

          {/* Processing indicators */}
          {cortexProcessing && (
            <div className="flex items-center gap-1.5 text-2xs text-cyan-400 mb-2">
              <CortexLogo className="h-3 w-3 animate-pulse" />
              Classifying findings &amp; extracting entities...
            </div>
          )}
          {sumbleError && !enrichAllLoading && (
            <div className="flex items-start gap-1.5 text-2xs text-amber-400/80 bg-amber-500/5 rounded px-2 py-1.5 mb-2">
              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="break-all">{sumbleError.length > 140 ? sumbleError.substring(0, 140) + '…' : sumbleError}</span>
            </div>
          )}
          {perplexityError && !perplexityLoading && (
            <div className="flex items-start gap-1.5 text-2xs text-amber-400/80 bg-amber-500/5 rounded px-2 py-1.5 mb-2">
              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="break-all">Perplexity: {perplexityError.length > 120 ? perplexityError.substring(0, 120) + '…' : perplexityError}</span>
            </div>
          )}

          {/* View History */}
          {hasIntel && (
            <div className="mb-3">
              <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogTrigger asChild>
                  <button
                    onClick={handleViewHistory}
                    className="flex items-center gap-1.5 text-2xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <History className="h-3 w-3" />
                    Research History
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-lg bg-[#1e1a30] border-[#362f50] text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white">Research History — {deal?.account}</DialogTitle>
                    <DialogDescription className="text-slate-500">
                      All enrichment pulls for this account, newest first.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                    {historyLoading ? (
                      <div className="flex items-center gap-2 py-6 justify-center text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading history…
                      </div>
                    ) : historyData.length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center">No research history found.</p>
                    ) : (
                      historyData.map((entry, i) => {
                        const source = (entry.SOURCE as string) || 'unknown';
                        const pulledAt = formatDate(entry.PULLED_AT as string);
                        const pulledBy = (entry.PULLED_BY as string) || '—';
                        const accountName = (entry.ACCOUNT_NAME as string) || '—';
                        const summary = source === 'perplexity'
                          ? (entry.SUMMARY as string)?.substring(0, 150) + '…'
                          : null;
                        return (
                          <div key={(entry.PULL_ID as string) || i} className="rounded-md border border-[#322b4d] bg-[#221d38] px-3 py-2.5 space-y-1">
                            <div className="flex items-center gap-2">
                              {source === 'sumble' ? <SumbleIcon className="h-3.5 w-3.5" /> : <PerplexityIcon className="h-3.5 w-3.5" />}
                              <span className="text-xs font-medium capitalize text-slate-200">
                                {source === 'sumble' ? 'Sumble Enrichment' : 'Perplexity Research'}
                              </span>
                              <span className="ml-auto text-2xs text-slate-500">{pulledAt}</span>
                            </div>
                            <div className="flex items-center gap-3 text-2xs text-slate-500">
                              <span>Account: {accountName}</span>
                              <span>By: {pulledBy}</span>
                            </div>
                            {summary && <p className="text-2xs text-slate-400 leading-relaxed">{summary}</p>}
                          </div>
                        );
                      })
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* ── Sumble Technographic Results ── */}
          {sumbleData?.success && (
            <div className="space-y-2.5 mb-3">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3 w-3 text-slate-500" />
                <span className="text-2xs font-medium text-slate-500">Tech Stack</span>
                <span className="ml-auto text-2xs text-slate-600">{sumbleData.technologiesCount ?? 0} techs · {formatDate(sumbleData.pulledAt)}</span>
              </div>

              {sumbleData.orgName && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-white">{sumbleData.orgName}</span>
                  {sumbleData.sourceDataUrl && (
                    <a href={sumbleData.sourceDataUrl} target="_blank" rel="noopener noreferrer"
                       className="text-blue-400 hover:text-blue-300 flex items-center gap-0.5">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}

              {sumbleData.techCategories && Object.entries(sumbleData.techCategories).some(([, techs]) => techs.length > 0) && (
                <div className="space-y-1.5">
                  {Object.entries(sumbleData.techCategories)
                    .filter(([, techs]) => techs.length > 0)
                    .map(([category, techs]) => {
                      const style = TECH_CATEGORY_STYLES[category] || TECH_CATEGORY_STYLES.Other;
                      return (
                        <div key={category} className="flex flex-wrap items-center gap-1.5">
                          <span className="text-2xs text-slate-500 w-16 shrink-0">{style.label}</span>
                          {techs.map((tech) => (
                            <span key={tech} className={cn('rounded-md px-2 py-0.5 text-2xs font-medium', style.bg, style.text)}>
                              {tech}
                            </span>
                          ))}
                        </div>
                      );
                    })}
                </div>
              )}

              {sumbleData.techDetails && sumbleData.techDetails.length > 0 && (
                <div className="space-y-1">
                  {sumbleData.techDetails
                    .filter(t => t.jobs_count > 0 || t.people_count > 0)
                    .slice(0, 6)
                    .map((tech) => (
                      <div key={tech.name} className="flex items-center justify-between text-2xs">
                        <span className="font-medium text-slate-200">{tech.name}</span>
                        <div className="flex gap-3 text-slate-500">
                          {tech.jobs_count > 0 && <span>{tech.jobs_count} jobs</span>}
                          {tech.people_count > 0 && <span>{tech.people_count} people</span>}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* ── Org Profile ── */}
          {sumbleOrgData?.success && (
            <div className="pt-3 border-t border-[#322b4d]/60 space-y-2 mb-3">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-slate-500" />
                <span className="text-2xs font-medium text-slate-500">Org Profile</span>
                <span className="ml-auto text-2xs text-slate-600">{formatDate(sumbleOrgData.pulledAt)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {sumbleOrgData.industry && (
                  <div className="rounded-md bg-[#1e1a30] px-2.5 py-1.5">
                    <p className="text-2xs text-slate-600">Industry</p>
                    <p className="text-xs font-medium text-slate-200">{sumbleOrgData.industry}</p>
                  </div>
                )}
                {sumbleOrgData.totalEmployees && (
                  <div className="rounded-md bg-[#1e1a30] px-2.5 py-1.5">
                    <p className="text-2xs text-slate-600">Employees</p>
                    <p className="text-xs font-medium text-slate-200">
                      {sumbleOrgData.totalEmployees >= 1000
                        ? `${(sumbleOrgData.totalEmployees / 1000).toFixed(1)}K`
                        : sumbleOrgData.totalEmployees.toLocaleString()}
                    </p>
                  </div>
                )}
                {(sumbleOrgData.hqState || sumbleOrgData.hqCountry) && (
                  <div className="rounded-md bg-[#1e1a30] px-2.5 py-1.5">
                    <p className="text-2xs text-slate-600">Headquarters</p>
                    <p className="text-xs font-medium text-slate-200 flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5 text-slate-500" />
                      {[sumbleOrgData.hqState, sumbleOrgData.hqCountry].filter(Boolean).join(', ')}
                    </p>
                  </div>
                )}
                {sumbleOrgData.linkedinUrl && (
                  <div className="rounded-md bg-[#1e1a30] px-2.5 py-1.5">
                    <p className="text-2xs text-slate-600">LinkedIn</p>
                    <a href={sumbleOrgData.linkedinUrl} target="_blank" rel="noopener noreferrer"
                       className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      <Linkedin className="h-2.5 w-2.5" /> View
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Hiring Signals ── */}
          {sumbleJobData?.success && (
            <div className="pt-3 border-t border-[#322b4d]/60 space-y-2 mb-3">
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-3 w-3 text-slate-500" />
                <span className="text-2xs font-medium text-slate-500">Hiring Signals</span>
              </div>

              <div className="flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium',
                  sumbleJobData.hiringVelocity === 'high' && 'bg-emerald-500/15 text-emerald-300',
                  sumbleJobData.hiringVelocity === 'moderate' && 'bg-amber-500/15 text-amber-300',
                  sumbleJobData.hiringVelocity === 'low' && 'bg-slate-500/15 text-slate-400',
                )}>
                  <TrendingUp className="h-2.5 w-2.5" />
                  {sumbleJobData.hiringVelocity === 'high' ? 'High' : sumbleJobData.hiringVelocity === 'moderate' ? 'Moderate' : 'Low'}
                </span>
                <span className="text-2xs text-slate-500">
                  {sumbleJobData.recentJobCount || 0} recent · {sumbleJobData.jobCount || 0} total
                </span>
              </div>

              {((sumbleJobData.competitiveTechPosts?.length ?? 0) > 0 || (sumbleJobData.aiPosts?.length ?? 0) > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {sumbleJobData.competitiveTechPosts?.map((tech, i) => (
                    <span key={`comp-${i}`} className="rounded-md bg-red-500/10 px-2 py-0.5 text-2xs font-medium text-red-300">{tech}</span>
                  ))}
                  {sumbleJobData.aiPosts?.map((tech, i) => (
                    <span key={`ai-${i}`} className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-2xs font-medium text-emerald-300">{tech}</span>
                  ))}
                </div>
              )}

              {sumbleJobData.jobsSummary && sumbleJobData.jobsSummary.length > 0 && (
                <div className="space-y-1.5">
                  {sumbleJobData.jobsSummary.slice(0, 5).map((job, i) => (
                    <div key={i} className="rounded-md bg-[#1e1a30] px-2.5 py-1.5 space-y-0.5">
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-medium text-slate-200">{job.title}</span>
                        {job.location && (
                          <span className="text-2xs text-slate-500 flex items-center gap-0.5 shrink-0 ml-2">
                            <MapPin className="h-2 w-2" />{job.location}
                          </span>
                        )}
                      </div>
                      {job.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {job.technologies.map((tech, j) => (
                            <span key={j} className="rounded px-1.5 py-0.5 text-2xs bg-violet-500/10 text-violet-300">{tech}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Key People ── */}
          {sumblePeopleData?.success && (
            <div className="pt-3 border-t border-[#322b4d]/60 space-y-2 mb-3">
              <div className="flex items-center gap-1.5">
                <UserCheck className="h-3 w-3 text-slate-500" />
                <span className="text-2xs font-medium text-slate-500">Key People</span>
                <span className="ml-auto text-2xs text-slate-600">{sumblePeopleData.peopleCount || 0} matched</span>
              </div>

              {sumblePeopleData.peopleSummary && sumblePeopleData.peopleSummary.length > 0 && (
                <div className="space-y-1.5">
                  {sumblePeopleData.peopleSummary.slice(0, 6).map((person, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-md bg-[#1e1a30] px-2.5 py-1.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/10 shrink-0 mt-0.5">
                        <User className="h-2.5 w-2.5 text-purple-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-slate-200">{person.name}</span>
                          {person.linkedinUrl && (
                            <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                              <Linkedin className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                        {person.title && <p className="text-2xs text-slate-400">{person.title}</p>}
                        {person.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {person.technologies.map((tech, j) => (
                              <span key={j} className="rounded px-1 py-0.5 text-2xs bg-blue-500/10 text-blue-300">{tech}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Perplexity Web Research Results ── */}
          {perplexityData?.success && (
            <div className="pt-3 border-t border-[#322b4d]/60 space-y-2.5 mb-3">
              <div className="flex items-center gap-1.5">
                <Globe className="h-3 w-3 text-slate-500" />
                <span className="text-2xs font-medium text-slate-500">Web Research</span>
                <span className="ml-auto text-2xs text-slate-600">{formatDate(perplexityData.pulledAt)}</span>
              </div>

              {perplexityData.summary && (
                <p className="text-xs text-slate-300 leading-relaxed">{perplexityData.summary}</p>
              )}

              {perplexityData.technologySignals && perplexityData.technologySignals.length > 0 && (
                <div>
                  <p className="text-2xs font-medium text-slate-500 mb-1">Technology Signals</p>
                  <ul className="space-y-1">
                    {perplexityData.technologySignals.map((signal, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs">
                        <Cpu className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
                        <span className="text-slate-400">{signal}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {perplexityData.competitiveLandscape && perplexityData.competitiveLandscape.length > 0 && (
                <div>
                  <p className="text-2xs font-medium text-slate-500 mb-1">Competitive Landscape</p>
                  <ul className="space-y-1">
                    {perplexityData.competitiveLandscape.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs">
                        <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                        <span className="text-slate-400">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {perplexityData.keyInsights && perplexityData.keyInsights.length > 0 && (
                <div>
                  <p className="text-2xs font-medium text-slate-500 mb-1">Key Insights</p>
                  <ul className="space-y-1">
                    {perplexityData.keyInsights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs">
                        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-blue-400" />
                        <span className="text-slate-400">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {perplexityData.citations && perplexityData.citations.length > 0 && (
                <div>
                  <p className="text-2xs font-medium text-slate-500 mb-1">Sources</p>
                  <div className="space-y-0.5">
                    {perplexityData.citations.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-1 text-2xs text-blue-400 hover:text-blue-300 truncate">
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{url.replace(/^https?:\/\//, '').split('/')[0]}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!hasIntel && !enrichAllLoading && !perplexityLoading && (
            <p className="text-xs text-slate-600 italic">
              Click Enrich Account or Web Research to pull intelligence.
            </p>
          )}
        </CollapsibleSection>
      )}

      {/* ══════════════════════════════════════════════════════════════
          §7  AI ANALYSIS — classified findings + extracted entities
          ══════════════════════════════════════════════════════════════ */}
      {(classifiedFindings.length > 0 || (extractedEntities?.success)) && (
        <CollapsibleSection
          title="AI Analysis"
          icon={Sparkles}
          iconColor="text-violet-400"
          defaultExpanded={false}
          badge={
            <span className="text-[9px] text-slate-500">
              {classifiedFindings.length} findings
            </span>
          }
        >
          {/* Classified Findings */}
          {classifiedFindings.length > 0 && (
            <div className="mb-3">
              <p className="text-2xs font-medium text-slate-500 mb-2">Classified Insights</p>
              <div className="space-y-1.5">
                {classifiedFindings.map((cf, i) => {
                  const style = FINDING_CATEGORY_STYLES[cf.category] || {
                    label: cf.category, bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/20',
                  };
                  return (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={cn('mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-2xs font-medium', style.bg, style.text)}>
                        {style.label}
                      </span>
                      <span className="text-slate-400 leading-relaxed">{cf.finding}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Extracted Entities */}
          {extractedEntities?.success && (
            <div>
              <p className="text-2xs font-medium text-slate-500 mb-2">Extracted Entities</p>
              <div className="space-y-2">
                {extractedEntities.competitors.length > 0 && (
                  <div>
                    <p className="text-2xs text-slate-600 mb-0.5">Competitors</p>
                    <div className="flex flex-wrap gap-1">
                      {extractedEntities.competitors.map((c, i) => (
                        <span key={i} className="rounded-md bg-red-500/10 px-2 py-0.5 text-2xs font-medium text-red-300">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
                {extractedEntities.technologies.length > 0 && (
                  <div>
                    <p className="text-2xs text-slate-600 mb-0.5">Technologies</p>
                    <div className="flex flex-wrap gap-1">
                      {extractedEntities.technologies.map((t, i) => (
                        <span key={i} className="rounded-md bg-blue-500/10 px-2 py-0.5 text-2xs font-medium text-blue-300">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {extractedEntities.executives.length > 0 && (
                  <div>
                    <p className="text-2xs text-slate-600 mb-0.5">Key People</p>
                    <div className="flex flex-wrap gap-1">
                      {extractedEntities.executives.map((e, i) => (
                        <span key={i} className="rounded-md bg-purple-500/10 px-2 py-0.5 text-2xs font-medium text-purple-300">{e}</span>
                      ))}
                    </div>
                  </div>
                )}
                {extractedEntities.timelines.length > 0 && (
                  <div>
                    <p className="text-2xs text-slate-600 mb-0.5">Timelines</p>
                    <div className="flex flex-wrap gap-1">
                      {extractedEntities.timelines.map((t, i) => (
                        <span key={i} className="rounded-md bg-amber-500/10 px-2 py-0.5 text-2xs font-medium text-amber-300">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* ══════════════════════════════════════════════════════════════
          §8  SENTIMENT & SIMILAR DEALS — supplementary
          ══════════════════════════════════════════════════════════════ */}
      {(sessionId || hasIntel) && (
        <CollapsibleSection
          title="Sentiment & Similar"
          icon={TrendingUp}
          iconColor="text-emerald-400"
          defaultExpanded={false}
        >
          {/* Sentiment */}
          {sessionId && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-2xs font-medium text-slate-500">TDR Sentiment</p>
                <button
                  className="text-slate-600 hover:text-slate-300 transition-colors p-0.5"
                  onClick={handleLoadSentiment}
                  disabled={sentimentLoading}
                >
                  {sentimentLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
                </button>
              </div>

              {sentimentTrend.length > 0 ? (
                <div className="space-y-1.5">
                  {sentimentTrend.map((pt, i) => {
                    const score = pt.sentiment ?? 0;
                    const pct = Math.round((score + 1) * 50);
                    const isPositive = score >= 0;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-2xs text-slate-600 w-12 shrink-0">TDR {pt.iteration}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-[#2a2540] overflow-hidden">
                          <div className={cn('h-full rounded-full', isPositive ? 'bg-emerald-500/70' : 'bg-amber-500/70')}
                               style={{ width: `${pct}%` }} />
                        </div>
                        <span className={cn('text-2xs font-medium w-8 text-right tabular-nums',
                          isPositive ? 'text-emerald-400' : 'text-amber-400')}>
                          {score > 0 ? '+' : ''}{score.toFixed(2)}
                        </span>
                        {i === sentimentTrend.length - 1 && (
                          isPositive ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-amber-400" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : sentimentFetched && sentimentNoInputs ? (
                <p className="text-2xs text-slate-500 italic">No TDR inputs to analyze</p>
              ) : !sentimentLoading && !sentimentFetched && (
                <p className="text-2xs text-slate-600 italic">Click chart icon to analyze</p>
              )}
            </div>
          )}

          {/* Intelligence Evolution */}
          {hasIntel && (
            <div className="mb-3 pt-3 border-t border-[#322b4d]/60">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs h-7 border-[#362f50] bg-transparent text-slate-400 hover:bg-[#221d38] hover:text-white"
                onClick={handleLoadEvolution}
                disabled={evolutionLoading}
              >
                {evolutionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
                Intelligence Evolution
              </Button>

              <Dialog open={evolutionOpen} onOpenChange={setEvolutionOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#1e1a30] border-[#362f50] text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-cyan-400" />
                      Intelligence Evolution
                    </DialogTitle>
                    <DialogDescription className="text-slate-500">
                      How account intelligence has changed across {evolutionPullCount} pulls
                    </DialogDescription>
                  </DialogHeader>
                  {evolutionLoading ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                      <p className="text-sm">Analyzing research history...</p>
                    </div>
                  ) : evolutionText ? (
                    <div className="space-y-3 py-2">
                      {evolutionText.split('\n\n').map((block, i) => (
                        <div key={i}>{renderMarkdownBlock(block, i)}</div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 py-6 text-center">Research the account at least twice to see evolution.</p>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Similar Deals */}
          {hasIntel && (
            <div className="pt-3 border-t border-[#322b4d]/60">
              <div className="flex items-center justify-between mb-2">
                <p className="text-2xs font-medium text-slate-500">Similar Deals</p>
                <button
                  className="text-slate-600 hover:text-slate-300 transition-colors p-0.5"
                  onClick={handleFindSimilarDeals}
                  disabled={similarDealsLoading}
                  title="Find deals with similar tech profiles"
                >
                  {similarDealsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                </button>
              </div>

              {similarDealsLoading && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
                  <span className="text-2xs">Finding similar deals...</span>
                </div>
              )}

              {similarDeals.length > 0 && (
                <div className="space-y-1.5">
                  {similarDeals.map((d, i) => {
                    const scorePct = Math.round((d.similarityScore ?? 0) * 100);
                    return (
                      <div key={i} className="flex items-center gap-2 group">
                        <p className="text-xs text-slate-300 font-medium truncate flex-1">{d.accountName}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-12 h-1.5 rounded-full bg-[#2a2540] overflow-hidden">
                            <div className={cn('h-full rounded-full',
                              scorePct >= 80 ? 'bg-emerald-500/70' : scorePct >= 60 ? 'bg-amber-500/70' : 'bg-slate-500/50'
                            )} style={{ width: `${scorePct}%` }} />
                          </div>
                          <span className={cn('text-2xs font-medium w-8 text-right tabular-nums',
                            scorePct >= 80 ? 'text-emerald-400' : scorePct >= 60 ? 'text-amber-400' : 'text-slate-500'
                          )}>
                            {scorePct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-2xs text-slate-600 mt-1">Based on tech stack, initiatives & competitive overlap</p>
                </div>
              )}

              {!similarDealsLoading && similarDeals.length === 0 && (
                <p className="text-2xs text-slate-600 italic">Click search icon to find similar deals</p>
              )}
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* ══════════════════════════════════════════════════════════════
          §9  RISK & MISSING — deal hygiene
          ══════════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Risk & Missing Info"
        icon={AlertCircle}
        iconColor="text-amber-400"
        defaultExpanded={false}
        badge={
          (riskFlags.length > 0 || missingInfo.length > 0) ? (
            <span className="text-[9px] text-amber-400 font-medium">
              {riskFlags.length + missingInfo.length} items
            </span>
          ) : undefined
        }
      >
        {/* Risk Flags */}
        <div className="mb-3">
          <p className="text-2xs font-medium text-slate-500 mb-1.5">Risk Flags</p>
          {riskFlags.length > 0 ? (
            <ul className="space-y-1.5">
              {riskFlags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                  <span className="text-slate-400">{flag}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 italic">No significant risks identified</p>
          )}
        </div>

        {/* Missing Info */}
        <div className="pt-3 border-t border-[#322b4d]/60">
          <p className="text-2xs font-medium text-slate-500 mb-1.5">Missing Information</p>
          {missingInfo.length > 0 ? (
            <ul className="space-y-1.5">
              {missingInfo.map((info, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                  <span className="text-slate-400">{info}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 italic">All required information collected</p>
          )}
        </div>

        {/* Readiness badge */}
        <div className="pt-3 mt-3 border-t border-[#322b4d]/60">
          <p className="text-2xs font-medium text-slate-500 mb-1.5">Readiness</p>
          <div className={cn(
            'inline-flex items-center gap-2 rounded-md border px-3 py-1.5',
            readinessLevel === 'green' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
            readinessLevel === 'yellow' && 'border-amber-500/30 bg-amber-500/10 text-amber-400',
            readinessLevel === 'red' && 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          )}>
            {readinessLevel === 'green' ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            <span className="text-xs font-medium capitalize">{readinessLevel}</span>
          </div>
        </div>
      </CollapsibleSection>

      {/* ══════════════════════════════════════════════════════════════
          §10  DEAL TEAM & FINAL OUTCOME — administrative
          ══════════════════════════════════════════════════════════════ */}
      {deal && (
        <CollapsibleSection
          title="Deal Team & Outcome"
          icon={Users}
          iconColor="text-blue-400"
          defaultExpanded={false}
        >
          {/* Deal Type */}
          {deal.dealType && (
            <div className={`mb-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
              deal.dealType.toLowerCase().includes('new logo')
                ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
            }`}>
              <Tag className="h-3 w-3" />
              {deal.dealType}
            </div>
          )}

          {/* Team members */}
          <div className="space-y-2.5 mb-4">
            {[
              { label: 'Account Executive', value: deal.accountExecutive || deal.owner, icon: Briefcase, color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { label: 'Sales Consultant (SE)', value: deal.salesConsultant, icon: User, color: 'text-violet-400', bg: 'bg-violet-500/10' },
              { label: 'SE Manager', value: deal.seManager || 'TBD', icon: Users, color: 'text-teal-400', bg: 'bg-teal-500/10' },
              { label: 'Forecast Manager', value: deal.owner, icon: Building2, color: 'text-slate-400', bg: 'bg-[#221d38]' },
            ].map((member) => (
              <div key={member.label} className="flex items-center gap-3">
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-full', member.bg)}>
                  <member.icon className={cn('h-3 w-3', member.color)} />
                </div>
                <div>
                  <p className="text-2xs text-slate-500">{member.label}</p>
                  <p className="text-xs font-medium text-slate-200">{member.value || 'Not assigned'}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Evidence links */}
          <div className="pt-3 border-t border-[#322b4d]/60 mb-3">
            <p className="text-2xs font-medium text-slate-500 mb-1.5">Evidence</p>
            <div className="space-y-0.5">
              <button className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-[#221d38] hover:text-slate-200">
                <Link className="h-3 w-3" />
                <span>Opportunity in CRM</span>
              </button>
              <button className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-[#221d38] hover:text-slate-200">
                <FileText className="h-3 w-3" />
                <span>Technical Assessment</span>
              </button>
            </div>
          </div>

          {/* Final Outcome */}
          <div className="pt-3 border-t border-[#322b4d]/60">
            <p className="text-2xs font-medium text-slate-500 mb-1.5">Final Outcome</p>
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
          </div>
        </CollapsibleSection>
      )}

      {/* ══════════════════════════════════════════════════════════════
          POWERED BY footer
          ══════════════════════════════════════════════════════════════ */}
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
