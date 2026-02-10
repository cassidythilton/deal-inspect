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
  Save,
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
  Database,
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
} from 'lucide-react';
import { TDRSummaryModal } from './TDRSummaryModal';
import { SumbleIcon } from '@/components/icons/SumbleIcon';
import { PerplexityIcon } from '@/components/icons/PerplexityIcon';
import { accountIntel } from '@/lib/accountIntel';
import type { SumbleEnrichment, PerplexityResearch, SumbleOrgData, SumbleJobData, SumblePeopleData } from '@/lib/accountIntel';
import { cortexAi, parseBriefSections, FINDING_CATEGORY_STYLES } from '@/lib/cortexAi';
import type { TDRBrief, ClassifiedFinding, ExtractedEntities, BriefSection, SentimentDataPoint, StructuredExtractResult } from '@/lib/cortexAi';

interface TDRIntelligenceProps {
  deal?: Deal;
  readinessLevel: ReadinessLevel;
  missingInfo: string[];
  riskFlags: string[];
  sessionId?: string;
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
/**
 * Renders a block of markdown-ish text to React elements.
 * Handles: **bold**, *italic*, `- list items`, blank-line paragraph breaks.
 */
function renderMarkdownBlock(text: string, keyPrefix = 'md'): React.ReactNode {
  if (!text) return null;

  // Split into paragraphs (double-newline) or bullet clusters
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

/** Render inline markdown: **bold** and *italic* */
function renderInline(text: string): React.ReactNode {
  // Split on **bold** and *italic* markers
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let m;
  let idx = 0;

  while ((m = regex.exec(text)) !== null) {
    // Push text before match
    if (m.index > lastIndex) {
      parts.push(text.slice(lastIndex, m.index));
    }
    if (m[2]) {
      // **bold**
      parts.push(<strong key={`b${idx++}`} className="font-semibold text-slate-200">{m[2]}</strong>);
    } else if (m[3]) {
      // *italic*
      parts.push(<em key={`i${idx++}`} className="italic text-slate-300">{m[3]}</em>);
    }
    lastIndex = m.index + m[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

export function TDRIntelligence({
  deal,
  readinessLevel,
  missingInfo,
  riskFlags,
  sessionId,
}: TDRIntelligenceProps) {
  const [showSummary, setShowSummary] = useState(false);

  // ── Account Intelligence State ──
  const [domain, setDomain] = useState('');
  const [sumbleData, setSumbleData] = useState<SumbleEnrichment | null>(null);
  const [perplexityData, setPerplexityData] = useState<PerplexityResearch | null>(null);
  const [sumbleLoading, setSumbleLoading] = useState(false);
  const [perplexityLoading, setPerplexityLoading] = useState(false);
  const [intelLoaded, setIntelLoaded] = useState(false);
  const [sumbleError, setSumbleError] = useState<string | null>(null);
  const [perplexityError, setPerplexityError] = useState<string | null>(null);

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

  // ── Sprint 17.5: Structured Extraction State ──
  const [extractionResult, setExtractionResult] = useState<StructuredExtractResult | null>(null);
  const [extractionLoading, setExtractionLoading] = useState(false);

  // ── Sprint 6.5: Deep Intelligence State ──
  const [sumbleOrgData, setSumbleOrgData] = useState<SumbleOrgData | null>(null);
  const [sumbleJobData, setSumbleJobData] = useState<SumbleJobData | null>(null);
  const [sumblePeopleData, setSumblePeopleData] = useState<SumblePeopleData | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [peopleLoading, setPeopleLoading] = useState(false);

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

  // Pre-fill domain: prefer real data from Webiste Domain field, fall back to heuristic
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
        if (cached.hasSumble && cached.sumble) {
          setSumbleData(cached.sumble);
        }
        if (cached.hasPerplexity && cached.perplexity) {
          setPerplexityData(cached.perplexity);
        }
        // Sprint 6.5: Load cached deep intelligence
        if (cached.hasSumbleOrg && cached.sumbleOrg) {
          setSumbleOrgData(cached.sumbleOrg);
        }
        if (cached.hasSumbleJobs && cached.sumbleJobs) {
          setSumbleJobData(cached.sumbleJobs);
        }
        if (cached.hasSumblePeople && cached.sumblePeople) {
          setSumblePeopleData(cached.sumblePeople);
        }
      } catch (err) {
        console.warn('[TDRIntelligence] Failed to load cached intel:', err);
      }
    };

    loadCachedIntel();
  }, [deal?.id, intelLoaded]);

  // Load cached TDR brief on mount (saves API tokens)
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
          console.log('[TDRIntelligence] Loaded cached TDR brief from', cached.createdAt);
        }
      } catch (err) {
        console.warn('[TDRIntelligence] Failed to load cached brief:', err);
      }
    };

    loadCachedBrief();
  }, [sessionId, briefCacheLoaded]);

  // ── Sumble Enrichment ──
  const handleEnrichSumble = useCallback(async () => {
    if (!deal || !domain.trim()) return;
    setSumbleLoading(true);
    setSumbleError(null);
    try {
      const result = await accountIntel.enrichSumble(deal.id, deal.account, domain.trim());
      if (result.success) {
        setSumbleData(result);
        setSumbleError(null);
      } else {
        const msg = typeof result.error === 'string' ? result.error : 'Enrichment failed';
        setSumbleError(msg);
        console.error('[TDRIntelligence] Sumble enrichment failed:', result.error);
      }
    } catch (err) {
      setSumbleError(err instanceof Error ? err.message : 'Unexpected error');
      console.error('[TDRIntelligence] Sumble enrichment error:', err);
    }
    setSumbleLoading(false);
  }, [deal, domain]);

  // ── Perplexity Research (auto-triggers Cortex classify + extract) ──
  const handleResearchPerplexity = useCallback(async () => {
    if (!deal) return;
    setPerplexityLoading(true);
    setPerplexityError(null);
    try {
      const result = await accountIntel.researchPerplexity(
        deal.id,
        deal.account,
        {
          acv: deal.acv,
          stage: deal.stage,
          partnersInvolved: deal.partnersInvolved || undefined,
        }
      );
      if (result.success) {
        setPerplexityData(result);
        setPerplexityError(null);

        // Auto-trigger Cortex AI classification + entity extraction (Sprint 7)
        if (result.pullId) {
          setCortexProcessing(true);
          try {
            const [classifyResult, extractResult] = await Promise.allSettled([
              cortexAi.classifyFindings(result.pullId),
              cortexAi.extractEntities(result.pullId),
            ]);

            if (classifyResult.status === 'fulfilled' && classifyResult.value.success) {
              setClassifiedFindings(classifyResult.value.findings);
              console.log('[TDRIntelligence] Classified', classifyResult.value.findings.length, 'findings');
            } else {
              console.warn('[TDRIntelligence] Classify findings failed:', classifyResult);
            }

            if (extractResult.status === 'fulfilled' && extractResult.value.success) {
              setExtractedEntities(extractResult.value);
              console.log('[TDRIntelligence] Extracted entities:', extractResult.value);
            } else {
              console.warn('[TDRIntelligence] Extract entities failed:', extractResult);
            }
          } catch (cortexErr) {
            console.warn('[TDRIntelligence] Cortex AI post-processing error:', cortexErr);
          }
          setCortexProcessing(false);
        }
      } else {
        const msg = typeof result.error === 'string' ? result.error : 'Research failed';
        setPerplexityError(msg);
        console.error('[TDRIntelligence] Perplexity research failed:', result.error);
      }
    } catch (err) {
      setPerplexityError(err instanceof Error ? err.message : 'Unexpected error');
      console.error('[TDRIntelligence] Perplexity research error:', err);
    }
    setPerplexityLoading(false);
  }, [deal]);

  // ── Sprint 6.5: Deep Intelligence Handlers ──
  const handleEnrichOrg = useCallback(async () => {
    if (!deal || !domain.trim()) return;
    setOrgLoading(true);
    try {
      const result = await accountIntel.enrichSumbleOrg(deal.id, deal.account, domain.trim());
      if (result.success) {
        setSumbleOrgData(result);
      } else {
        console.error('[TDRIntelligence] Sumble Org enrichment failed:', result.error);
      }
    } catch (err) {
      console.error('[TDRIntelligence] Sumble Org enrichment error:', err);
    }
    setOrgLoading(false);
  }, [deal, domain]);

  const handleEnrichJobs = useCallback(async () => {
    if (!deal || !domain.trim()) return;
    setJobsLoading(true);
    try {
      const result = await accountIntel.enrichSumbleJobs(deal.id, deal.account, domain.trim());
      if (result.success) {
        setSumbleJobData(result);
      } else {
        console.error('[TDRIntelligence] Sumble Jobs enrichment failed:', result.error);
      }
    } catch (err) {
      console.error('[TDRIntelligence] Sumble Jobs enrichment error:', err);
    }
    setJobsLoading(false);
  }, [deal, domain]);

  const handleEnrichPeople = useCallback(async () => {
    if (!deal || !domain.trim()) return;
    setPeopleLoading(true);
    try {
      const result = await accountIntel.enrichSumblePeople(deal.id, deal.account, domain.trim());
      if (result.success) {
        setSumblePeopleData(result);
      } else {
        console.error('[TDRIntelligence] Sumble People enrichment failed:', result.error);
      }
    } catch (err) {
      console.error('[TDRIntelligence] Sumble People enrichment error:', err);
    }
    setPeopleLoading(false);
  }, [deal, domain]);

  // ── Generate TDR Brief (Sprint 7) ──
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
      console.error('[TDRIntelligence] Generate TDR Brief error:', err);
      setBriefData({ success: false, error: String(err) });
    }
    setBriefLoading(false);
  }, [sessionId]);

  // ── Open cached brief (no API call) ──
  const handleOpenCachedBrief = useCallback(() => {
    setBriefOpen(true);
  }, []);

  // ── Intel History ──
  const handleViewHistory = useCallback(async () => {
    if (!deal) return;
    setHistoryOpen(true);
    if (historyData.length > 0) return; // already loaded
    setHistoryLoading(true);
    try {
      const data = await accountIntel.getIntelHistory(deal.id);
      setHistoryData(data);
    } catch (err) {
      console.warn('[TDRIntelligence] Failed to load intel history:', err);
    }
    setHistoryLoading(false);
  }, [deal, historyData.length]);

  // ── Sprint 9: Intelligence Evolution ──
  const handleLoadEvolution = useCallback(async () => {
    if (!deal?.id) return;
    setEvolutionOpen(true);
    if (evolutionText) return; // already loaded
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
      console.warn('[TDRIntelligence] Failed to load intel evolution:', err);
      setEvolutionText('Error loading evolution summary.');
    }
    setEvolutionLoading(false);
  }, [deal?.id, evolutionText]);

  // ── Sprint 9: Sentiment Trend ──
  const handleLoadSentiment = useCallback(async () => {
    if (!deal?.id) return;
    setSentimentLoading(true);
    setSentimentNoInputs(false);
    try {
      const result = await cortexAi.getSentimentTrend(deal.id);
      console.log('[TDRIntelligence] Sentiment trend result:', result);
      if (result.success) {
        // Filter out entries where sentiment is null/NaN (e.g. sessions with no inputs)
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

  // ── Sprint 11: Find Similar Deals ──
  const handleFindSimilarDeals = useCallback(async () => {
    if (!deal?.id) return;
    setSimilarDealsLoading(true);
    try {
      const result = await cortexAi.findSimilarDeals(deal.id);
      console.log('[TDRIntelligence] Similar deals result:', result);
      if (result.success) {
        // Filter out entries with null/NaN similarity scores
        const validDeals = (result.deals || []).filter(
          (d) => d.similarityScore != null && !isNaN(d.similarityScore)
        );
        setSimilarDeals(validDeals);
      } else if (result.error) {
        console.warn('[TDRIntelligence] Similar deals error from CE:', result.error);
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

  return (
    <div className="flex h-full flex-col">
      {/* ────────────────────────────────────────────────────────────
          Deal Info Header
          ──────────────────────────────────────────────────────────── */}
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

      {/* ────────────────────────────────────────────────────────────
          ACCOUNT INTELLIGENCE — elevated inner card
          ──────────────────────────────────────────────────────────── */}
      {deal && (
        <div className="mx-3 my-3 rounded-lg bg-[#221d38] p-4 ring-1 ring-[#322b4d]">
          <p className="mb-3 text-2xs font-semibold uppercase tracking-widest text-slate-400">
            Account Intelligence
          </p>

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

          {/* Action Buttons — explicitly labeled */}
          <div className="space-y-2 mb-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-9 border-[#362f50] bg-[#1e1a30]/80 text-slate-300 hover:bg-[#2d2744] hover:text-white disabled:opacity-40"
                onClick={handleEnrichSumble}
                disabled={sumbleLoading || !domain.trim()}
              >
                {sumbleLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <SumbleIcon className="h-3.5 w-3.5" />
                )}
                <span className="flex flex-col items-start leading-none">
                  <span className="font-medium">{sumbleData ? 'Refresh Sumble' : 'Sumble Enrich'}</span>
                  <span className="text-2xs text-slate-500 font-normal">Tech stack & hiring</span>
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
                  <span className="font-medium">{perplexityData ? 'Re-research' : 'Perplexity Research'}</span>
                  <span className="text-2xs text-slate-500 font-normal">Web intel & competition</span>
                </span>
              </Button>
            </div>
            {cortexProcessing && (
              <div className="flex items-center gap-1.5 text-2xs text-violet-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                AI classifying findings &amp; extracting entities…
              </div>
            )}
            {sumbleError && !sumbleLoading && (
              <div className="flex items-start gap-1.5 text-2xs text-amber-400/80 bg-amber-500/5 rounded px-2 py-1.5">
                <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="break-all">Sumble: {sumbleError.length > 120 ? sumbleError.substring(0, 120) + '…' : sumbleError}</span>
              </div>
            )}
            {perplexityError && !perplexityLoading && (
              <div className="flex items-start gap-1.5 text-2xs text-amber-400/80 bg-amber-500/5 rounded px-2 py-1.5">
                <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="break-all">Perplexity: {perplexityError.length > 120 ? perplexityError.substring(0, 120) + '…' : perplexityError}</span>
              </div>
            )}
          </div>

          {/* View History button */}
          {(sumbleData || perplexityData) && (
            <div className="mb-3">
              <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogTrigger asChild>
                  <button
                    onClick={handleViewHistory}
                    className="flex items-center gap-1.5 text-2xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <History className="h-3 w-3" />
                    View Research History
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-lg bg-[#1e1a30] border-[#362f50] text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white">Research History — {deal?.account}</DialogTitle>
                    <DialogDescription className="text-slate-500">
                      All Sumble and Perplexity pulls for this account, newest first.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                    {historyLoading ? (
                      <div className="flex items-center gap-2 py-6 justify-center text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading history…
                      </div>
                    ) : historyData.length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center">
                        No research history found for this account.
                      </p>
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
                          <div
                            key={(entry.PULL_ID as string) || i}
                            className="rounded-md border border-[#322b4d] bg-[#221d38] px-3 py-2.5 space-y-1"
                          >
                            <div className="flex items-center gap-2">
                              {source === 'sumble' ? (
                                <SumbleIcon className="h-3.5 w-3.5" />
                              ) : (
                                <PerplexityIcon className="h-3.5 w-3.5" />
                              )}
                              <span className="text-xs font-medium capitalize text-slate-200">
                                {source === 'sumble' ? 'Sumble Enrichment' : 'Perplexity Research'}
                              </span>
                              <span className="ml-auto text-2xs text-slate-500">{pulledAt}</span>
                            </div>
                            <div className="flex items-center gap-3 text-2xs text-slate-500">
                              <span>Account: {accountName}</span>
                              <span>By: {pulledBy}</span>
                            </div>
                            {summary && (
                              <p className="text-2xs text-slate-400 leading-relaxed">{summary}</p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* ── Sumble Results ── */}
          {sumbleData && sumbleData.success && (
            <div className="space-y-2.5 mb-3">
              <div className="flex items-center gap-1.5">
                <SumbleIcon className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
                  Technographic Signals
                </span>
                <span className="ml-auto text-2xs text-slate-600">
                  {formatDate(sumbleData.pulledAt)}
                </span>
              </div>

              {/* Organization identity */}
              {sumbleData.orgName && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-white">{sumbleData.orgName}</span>
                  {sumbleData.sourceDataUrl && (
                    <a
                      href={sumbleData.sourceDataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="text-2xs">Sumble</span>
                    </a>
                  )}
                  <span className="ml-auto text-2xs text-slate-500">
                    {sumbleData.technologiesCount ?? 0} techs found
                  </span>
                </div>
              )}

              {/* No techs found */}
              {sumbleData.technologiesCount === 0 && (
                <p className="text-xs text-slate-500 italic">
                  No technology signals found for this company.
                </p>
              )}

              {/* Tech Stack Badges */}
              {sumbleData.techCategories && Object.entries(sumbleData.techCategories).some(([, techs]) => techs.length > 0) && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Layers className="h-3 w-3 text-slate-500" />
                    <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
                      Tech Stack
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(sumbleData.techCategories)
                      .filter(([, techs]) => techs.length > 0)
                      .map(([category, techs]) => {
                        const style = TECH_CATEGORY_STYLES[category] || TECH_CATEGORY_STYLES.Other;
                        return (
                          <div key={category} className="flex flex-wrap items-center gap-1.5">
                            <span className="text-2xs text-slate-500 w-16 shrink-0">{style.label}</span>
                            {techs.map((tech) => (
                              <span
                                key={tech}
                                className={cn(
                                  'rounded-md px-2 py-0.5 text-2xs font-medium',
                                  style.bg,
                                  style.text
                                )}
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Hiring signals */}
              {sumbleData.techDetails && sumbleData.techDetails.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Cpu className="h-3 w-3 text-slate-500" />
                    <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
                      Hiring Signals
                    </span>
                  </div>
                  <div className="space-y-1">
                    {sumbleData.techDetails
                      .filter(t => t.jobs_count > 0 || t.people_count > 0)
                      .slice(0, 8)
                      .map((tech) => (
                        <div key={tech.name} className="flex items-center justify-between text-2xs">
                          <span className="font-medium text-slate-200">{tech.name}</span>
                          <div className="flex gap-3 text-slate-500">
                            {tech.jobs_count > 0 && <span>{tech.jobs_count} jobs</span>}
                            {tech.people_count > 0 && <span>{tech.people_count} people</span>}
                            {tech.teams_count > 0 && <span>{tech.teams_count} teams</span>}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Sprint 6.5: Deep Intelligence Tier Buttons ── */}
          {sumbleData?.success && (
            <div className="mt-3 pt-3 border-t border-[#322b4d]">
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="h-3 w-3 text-slate-500" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
                  Deep Intelligence
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-2xs h-7 border-[#362f50] bg-[#1e1a30]/80 text-slate-300 hover:bg-[#2d2744] hover:text-white disabled:opacity-40"
                  onClick={handleEnrichOrg}
                  disabled={orgLoading || !domain.trim()}
                >
                  {orgLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Building2 className="h-2.5 w-2.5" />}
                  <span>{sumbleOrgData ? 'Refresh' : 'Profile'}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-2xs h-7 border-[#362f50] bg-[#1e1a30]/80 text-slate-300 hover:bg-[#2d2744] hover:text-white disabled:opacity-40"
                  onClick={handleEnrichJobs}
                  disabled={jobsLoading || !domain.trim()}
                >
                  {jobsLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Briefcase className="h-2.5 w-2.5" />}
                  <span>{sumbleJobData ? 'Refresh' : 'Hiring'}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-2xs h-7 border-[#362f50] bg-[#1e1a30]/80 text-slate-300 hover:bg-[#2d2744] hover:text-white disabled:opacity-40"
                  onClick={handleEnrichPeople}
                  disabled={peopleLoading || !domain.trim()}
                >
                  {peopleLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <UserCheck className="h-2.5 w-2.5" />}
                  <span>{sumblePeopleData ? 'Refresh' : 'People'}</span>
                </Button>
              </div>
              <p className="mt-1 text-2xs text-slate-600">
                Tier 2–4 · Each call uses Sumble credits
              </p>
            </div>
          )}

          {/* ── Sprint 6.5: Organization Profile (Tier 2) ── */}
          {sumbleOrgData?.success && (
            <div className="mt-3 pt-3 border-t border-[#322b4d] space-y-2">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-indigo-400" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
                  Organization Profile
                </span>
                <span className="ml-auto text-2xs text-slate-600">
                  {formatDate(sumbleOrgData.pulledAt)}
                </span>
              </div>

              {/* Key firmographic stats */}
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
                    <a
                      href={sumbleOrgData.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <Linkedin className="h-2.5 w-2.5" />
                      View Profile
                    </a>
                  </div>
                )}
              </div>

              {/* Tech adoption depth */}
              <div className="flex items-center gap-4 text-2xs text-slate-400">
                <span><strong className="text-slate-200">{sumbleOrgData.matchingPeople || 0}</strong> people</span>
                <span><strong className="text-slate-200">{sumbleOrgData.matchingTeams || 0}</strong> teams</span>
                <span><strong className="text-slate-200">{sumbleOrgData.matchingJobs || 0}</strong> job posts</span>
              </div>

              {/* Matching entities (tech depth) */}
              {sumbleOrgData.matchingEntities && sumbleOrgData.matchingEntities.length > 0 && (
                <div className="space-y-1">
                  <p className="text-2xs text-slate-600">Tech Adoption Depth</p>
                  {sumbleOrgData.matchingEntities.slice(0, 6).map((entity, i) => (
                    <div key={i} className="flex items-center justify-between text-2xs">
                      <span className="font-medium text-slate-200">{entity.name}</span>
                      <div className="flex gap-3 text-slate-500">
                        {(entity.people_count ?? 0) > 0 && <span>{entity.people_count} people</span>}
                        {(entity.team_count ?? 0) > 0 && <span>{entity.team_count} teams</span>}
                        {(entity.job_post_count ?? 0) > 0 && <span>{entity.job_post_count} jobs</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Credit display */}
              {sumbleOrgData.creditsUsed != null && (
                <p className="text-2xs text-slate-600">
                  Used {sumbleOrgData.creditsUsed} credits · {sumbleOrgData.creditsRemaining ?? '?'} remaining
                </p>
              )}
            </div>
          )}

          {/* ── Sprint 6.5: Hiring Signals (Tier 3) ── */}
          {sumbleJobData?.success && (
            <div className="mt-3 pt-3 border-t border-[#322b4d] space-y-2">
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-3 w-3 text-amber-400" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
                  Hiring Signals
                </span>
                <span className="ml-auto text-2xs text-slate-600">
                  {formatDate(sumbleJobData.pulledAt)}
                </span>
              </div>

              {/* Velocity indicator */}
              <div className="flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium',
                  sumbleJobData.hiringVelocity === 'high' && 'bg-emerald-500/15 text-emerald-300',
                  sumbleJobData.hiringVelocity === 'moderate' && 'bg-amber-500/15 text-amber-300',
                  sumbleJobData.hiringVelocity === 'low' && 'bg-slate-500/15 text-slate-400',
                )}>
                  <TrendingUp className="h-2.5 w-2.5" />
                  {sumbleJobData.hiringVelocity === 'high' ? 'High Velocity' : sumbleJobData.hiringVelocity === 'moderate' ? 'Moderate' : 'Low'} 
                </span>
                <span className="text-2xs text-slate-500">
                  {sumbleJobData.recentJobCount || 0} posts in last 90 days · {sumbleJobData.jobCount || 0} total
                </span>
              </div>

              {/* Competitive and AI signals */}
              {((sumbleJobData.competitiveTechPosts?.length ?? 0) > 0 || (sumbleJobData.aiPosts?.length ?? 0) > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {sumbleJobData.competitiveTechPosts?.map((tech, i) => (
                    <span key={`comp-${i}`} className="rounded-md bg-red-500/10 px-2 py-0.5 text-2xs font-medium text-red-300">
                      ⚠ {tech}
                    </span>
                  ))}
                  {sumbleJobData.aiPosts?.map((tech, i) => (
                    <span key={`ai-${i}`} className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-2xs font-medium text-emerald-300">
                      {tech}
                    </span>
                  ))}
                </div>
              )}

              {/* Job listing summary */}
              {sumbleJobData.jobsSummary && sumbleJobData.jobsSummary.length > 0 && (
                <div className="space-y-1.5">
                  {sumbleJobData.jobsSummary.slice(0, 5).map((job, i) => (
                    <div key={i} className="rounded-md bg-[#1e1a30] px-2.5 py-1.5 space-y-0.5">
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-medium text-slate-200">{job.title}</span>
                        {job.location && (
                          <span className="text-2xs text-slate-500 flex items-center gap-0.5 shrink-0 ml-2">
                            <MapPin className="h-2 w-2" />
                            {job.location}
                          </span>
                        )}
                      </div>
                      {job.function && (
                        <p className="text-2xs text-slate-500">{job.function}</p>
                      )}
                      {job.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {job.technologies.map((tech, j) => (
                            <span key={j} className="rounded px-1.5 py-0.5 text-2xs bg-violet-500/10 text-violet-300">
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                      {job.projectDescription && (
                        <p className="text-2xs text-slate-400 leading-relaxed">{job.projectDescription}</p>
                      )}
                    </div>
                  ))}
                  {(sumbleJobData.jobsSummary?.length ?? 0) > 5 && (
                    <p className="text-2xs text-slate-600 italic">
                      + {(sumbleJobData.jobsSummary?.length ?? 0) - 5} more positions
                    </p>
                  )}
                </div>
              )}

              {sumbleJobData.creditsUsed != null && (
                <p className="text-2xs text-slate-600">
                  Used {sumbleJobData.creditsUsed} credits · {sumbleJobData.creditsRemaining ?? '?'} remaining
                </p>
              )}
            </div>
          )}

          {/* ── Sprint 6.5: Key People (Tier 4) ── */}
          {sumblePeopleData?.success && (
            <div className="mt-3 pt-3 border-t border-[#322b4d] space-y-2">
              <div className="flex items-center gap-1.5">
                <UserCheck className="h-3 w-3 text-purple-400" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
                  Key People
                </span>
                <span className="ml-auto text-2xs text-slate-600">
                  {sumblePeopleData.peopleCount || 0} matched · {formatDate(sumblePeopleData.pulledAt)}
                </span>
              </div>

              {sumblePeopleData.peopleSummary && sumblePeopleData.peopleSummary.length > 0 && (
                <div className="space-y-1.5">
                  {sumblePeopleData.peopleSummary.slice(0, 8).map((person, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-md bg-[#1e1a30] px-2.5 py-1.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/10 shrink-0 mt-0.5">
                        <User className="h-3 w-3 text-purple-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-slate-200">{person.name}</span>
                          {person.linkedinUrl && (
                            <a
                              href={person.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              <Linkedin className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                        {person.title && (
                          <p className="text-2xs text-slate-400">{person.title}</p>
                        )}
                        {person.department && (
                          <p className="text-2xs text-slate-500">{person.department}{person.seniority ? ` · ${person.seniority}` : ''}</p>
                        )}
                        {person.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {person.technologies.map((tech, j) => (
                              <span key={j} className="rounded px-1 py-0.5 text-2xs bg-blue-500/10 text-blue-300">
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sumblePeopleData.creditsUsed != null && (
                <p className="text-2xs text-slate-600">
                  Used {sumblePeopleData.creditsUsed} credits · {sumblePeopleData.creditsRemaining ?? '?'} remaining
                </p>
              )}
            </div>
          )}

          {/* Divider between Sumble and Perplexity */}
          {sumbleData?.success && perplexityData?.success && (
            <div className="my-3 border-t border-[#322b4d]" />
          )}

          {/* ── Perplexity Results ── */}
          {perplexityData && perplexityData.success && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5">
                <PerplexityIcon className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
                  Web Research
                </span>
                <span className="ml-auto text-2xs text-slate-600">
                  {formatDate(perplexityData.pulledAt)}
                </span>
              </div>

              {perplexityData.summary && (
                <p className="text-xs text-slate-300 leading-relaxed">
                  {perplexityData.summary}
                </p>
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
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-2xs text-blue-400 hover:text-blue-300 truncate"
                      >
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{url.replace(/^https?:\/\//, '').split('/')[0]}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Classified Findings (Sprint 7 — auto after Perplexity) ── */}
          {classifiedFindings.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#322b4d]">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3 w-3 text-violet-400" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
                  AI-Classified Insights
                </span>
                {cortexProcessing && <Loader2 className="h-3 w-3 animate-spin text-slate-500 ml-auto" />}
              </div>
              <div className="space-y-1.5">
                {classifiedFindings.map((cf, i) => {
                  const style = FINDING_CATEGORY_STYLES[cf.category] || {
                    label: cf.category,
                    bg: 'bg-slate-500/15',
                    text: 'text-slate-400',
                    border: 'border-slate-500/20',
                  };
                  return (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span
                        className={cn(
                          'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-2xs font-medium',
                          style.bg,
                          style.text
                        )}
                      >
                        {style.label}
                      </span>
                      <span className="text-slate-400 leading-relaxed">{cf.finding}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Extracted Entities (Sprint 7 — auto after Perplexity) ── */}
          {extractedEntities && extractedEntities.success && (
            <div className="mt-3 pt-3 border-t border-[#322b4d]">
              <div className="flex items-center gap-1.5 mb-2">
                <Search className="h-3 w-3 text-cyan-400" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
                  Extracted Entities
                </span>
              </div>
              <div className="space-y-2">
                {extractedEntities.competitors.length > 0 && (
                  <div>
                    <p className="text-2xs text-slate-600 mb-0.5">Competitors</p>
                    <div className="flex flex-wrap gap-1">
                      {extractedEntities.competitors.map((c, i) => (
                        <span key={i} className="rounded-md bg-red-500/10 px-2 py-0.5 text-2xs font-medium text-red-300">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {extractedEntities.technologies.length > 0 && (
                  <div>
                    <p className="text-2xs text-slate-600 mb-0.5">Technologies</p>
                    <div className="flex flex-wrap gap-1">
                      {extractedEntities.technologies.map((t, i) => (
                        <span key={i} className="rounded-md bg-blue-500/10 px-2 py-0.5 text-2xs font-medium text-blue-300">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {extractedEntities.executives.length > 0 && (
                  <div>
                    <p className="text-2xs text-slate-600 mb-0.5">Key People</p>
                    <div className="flex flex-wrap gap-1">
                      {extractedEntities.executives.map((e, i) => (
                        <span key={i} className="rounded-md bg-purple-500/10 px-2 py-0.5 text-2xs font-medium text-purple-300">
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {extractedEntities.timelines.length > 0 && (
                  <div>
                    <p className="text-2xs text-slate-600 mb-0.5">Timelines</p>
                    <div className="flex flex-wrap gap-1">
                      {extractedEntities.timelines.map((t, i) => (
                        <span key={i} className="rounded-md bg-amber-500/10 px-2 py-0.5 text-2xs font-medium text-amber-300">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TDR Brief Section (Sprint 7) — cached or generate ── */}
          {sessionId && (
            <div className="mt-3 pt-3 border-t border-[#322b4d]">
              {/* Show "View Brief" if cached, else "Generate" */}
              <div className="flex gap-2">
                {briefData?.success ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs h-8 border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:text-violet-200"
                      onClick={handleOpenCachedBrief}
                    >
                      <FileText className="h-3 w-3" />
                      View TDR Brief
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-8 border-[#362f50] bg-[#1e1a30]/80 text-slate-400 hover:bg-[#2d2744] hover:text-white"
                      onClick={handleGenerateBrief}
                      disabled={briefLoading}
                    >
                      {briefLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Regenerate
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-xs h-8 border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:text-violet-200"
                    onClick={handleGenerateBrief}
                    disabled={briefLoading || (!sumbleData && !perplexityData)}
                  >
                    {briefLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Generate TDR Brief
                  </Button>
                )}
              </div>
              {briefGeneratedAt && (
                <p className="mt-1 text-2xs text-slate-600">
                  Last generated {formatDate(briefGeneratedAt)}
                  {briefData?.modelUsed ? ` · ${briefData.modelUsed}` : ''}
                </p>
              )}

              {/* Brief Dialog (controlled — no DialogTrigger needed) */}
              <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#1e1a30] border-[#362f50] text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-400" />
                      AI-Generated TDR Brief
                    </DialogTitle>
                    <DialogDescription className="text-slate-500">
                      {briefData?.modelUsed
                        ? `Generated by Snowflake Cortex · ${briefData.modelUsed}${briefGeneratedAt ? ` · ${formatDate(briefGeneratedAt)}` : ''}`
                        : 'Generating brief using Snowflake Cortex AI...'}
                    </DialogDescription>
                  </DialogHeader>

                  {briefLoading ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
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
            </div>
          )}

          {/* Empty state */}
          {!sumbleData && !perplexityData && !sumbleLoading && !perplexityLoading && (
            <p className="text-xs text-slate-600 italic">
              Click Enrich or Research to pull account intelligence.
            </p>
          )}

          {/* ── Sprint 9: Intelligence Evolution (visible when intel exists) ── */}
          {(sumbleData || perplexityData) && (
            <div className="mt-3 pt-3 border-t border-[#322b4d]">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs h-8 border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200"
                onClick={handleLoadEvolution}
                disabled={evolutionLoading}
              >
                {evolutionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
                Intelligence Evolution
              </Button>

              {/* Evolution Dialog */}
              <Dialog open={evolutionOpen} onOpenChange={setEvolutionOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#1e1a30] border-[#362f50] text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-cyan-400" />
                      Intelligence Evolution
                    </DialogTitle>
                    <DialogDescription className="text-slate-500">
                      AI-generated summary of how account intelligence has changed across {evolutionPullCount} research {evolutionPullCount === 1 ? 'pull' : 'pulls'}
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
                        <div key={i}>
                          {renderMarkdownBlock(block, i)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 py-6 text-center">No evolution data available yet. Research the account at least twice to see how intelligence changes.</p>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* ── Sprint 9: Sentiment Trend (visible when sessions exist) ── */}
          {sessionId && (
            <div className="mt-3 pt-3 border-t border-[#322b4d]">
              <div className="flex items-center justify-between">
                <p className="text-2xs font-semibold uppercase tracking-wider text-slate-500">TDR Sentiment</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-2xs text-slate-500 hover:text-slate-300 hover:bg-[#221d38]"
                  onClick={handleLoadSentiment}
                  disabled={sentimentLoading}
                >
                  {sentimentLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
                </Button>
              </div>

              {sentimentTrend.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {sentimentTrend.map((pt, i) => {
                    const score = pt.sentiment ?? 0;
                    const pct = Math.round((score + 1) * 50); // -1..+1 → 0..100
                    const isPositive = score >= 0;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-2xs text-slate-600 w-12 shrink-0">TDR {pt.iteration}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-[#2a2540] overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              isPositive ? 'bg-emerald-500/70' : 'bg-amber-500/70'
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={cn(
                          'text-2xs font-medium w-8 text-right tabular-nums',
                          isPositive ? 'text-emerald-400' : 'text-amber-400'
                        )}>
                          {score > 0 ? '+' : ''}{score.toFixed(2)}
                        </span>
                        {i === sentimentTrend.length - 1 && (
                          isPositive
                            ? <TrendingUp className="h-3 w-3 text-emerald-400" />
                            : <TrendingDown className="h-3 w-3 text-amber-400" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : sentimentFetched && sentimentNoInputs ? (
                <p className="mt-1 text-2xs text-slate-500 italic">No TDR inputs to analyze — complete some TDR steps first</p>
              ) : !sentimentLoading && !sentimentFetched && (
                <p className="mt-1 text-2xs text-slate-600 italic">Click the chart icon to analyze sentiment</p>
              )}
            </div>
          )}

          {/* ── Sprint 11: Similar Deals (visible when intel exists) ── */}
          {(sumbleData || perplexityData) && (
            <div className="mt-3 pt-3 border-t border-[#322b4d]">
              <div className="flex items-center justify-between">
                <p className="text-2xs font-semibold uppercase tracking-wider text-slate-500">Similar Deals</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-2xs text-slate-500 hover:text-slate-300 hover:bg-[#221d38]"
                  onClick={handleFindSimilarDeals}
                  disabled={similarDealsLoading}
                  title="Find deals with similar tech profiles and competitive landscapes"
                >
                  {similarDealsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                </Button>
              </div>

              {similarDealsLoading && (
                <div className="flex items-center gap-2 mt-2 text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
                  <span className="text-2xs">Finding similar deals via AI embeddings...</span>
                </div>
              )}

              {similarDeals.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {similarDeals.map((d, i) => {
                    const scorePct = Math.round((d.similarityScore ?? 0) * 100);
                    return (
                      <div key={i} className="flex items-center gap-2 group">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-300 font-medium truncate">{d.accountName}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-12 h-1.5 rounded-full bg-[#2a2540] overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                scorePct >= 80 ? 'bg-emerald-500/70' : scorePct >= 60 ? 'bg-amber-500/70' : 'bg-slate-500/50'
                              )}
                              style={{ width: `${scorePct}%` }}
                            />
                          </div>
                          <span className={cn(
                            'text-2xs font-medium w-8 text-right tabular-nums',
                            scorePct >= 80 ? 'text-emerald-400' : scorePct >= 60 ? 'text-amber-400' : 'text-slate-500'
                          )}>
                            {scorePct}%
                          </span>
                          {d.sessionId && (
                            <Target className="h-3 w-3 text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Has TDR session" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-2xs text-slate-600 mt-1">Based on tech stack, initiatives & competitive overlap</p>
                </div>
              )}

              {!similarDealsLoading && similarDeals.length === 0 && (
                <p className="mt-1 text-2xs text-slate-600 italic">Click the search icon to find similar deals</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────
          DEAL TEAM
          ──────────────────────────────────────────────────────────── */}
      {deal && (
        <div className="border-b border-[#2a2540] px-5 py-4">
          <p className="mb-3 text-2xs font-semibold uppercase tracking-wider text-slate-500">
            Deal Team
          </p>
          {/* Deal Type badge */}
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

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10">
                <Briefcase className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xs text-slate-500">Account Executive</p>
                <p className="text-sm font-medium text-slate-200">{deal.accountExecutive || deal.owner || 'Not assigned'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#221d38]">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <div>
                <p className="text-2xs text-slate-500">Forecast Manager</p>
                <p className="text-sm font-medium text-slate-200">{deal.owner || 'Not assigned'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-500/10">
                <Users className="h-3.5 w-3.5 text-teal-400" />
              </div>
              <div>
                <p className="text-2xs text-slate-500">SE Manager</p>
                <p className="text-sm font-medium text-slate-200">{deal.seManager || 'TBD'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/10">
                <User className="h-3.5 w-3.5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xs text-slate-500">Sales Consultant (SE)</p>
                <p className="text-sm font-medium text-slate-200">{deal.salesConsultant || 'Not assigned'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────
          READINESS SCORE
          ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-[#2a2540] px-5 py-4">
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-slate-500">
          Readiness Score
        </p>
        <div
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-3 py-1.5',
            readinessLevel === 'green' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
            readinessLevel === 'yellow' && 'border-amber-500/30 bg-amber-500/10 text-amber-400',
            readinessLevel === 'red' && 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          )}
        >
          {readinessLevel === 'green' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-sm font-medium capitalize">{readinessLevel}</span>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────
          RISK FLAGS
          ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-[#2a2540] px-5 py-4">
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-slate-500">
          Risk Flags
        </p>
        {riskFlags.length > 0 ? (
          <ul className="space-y-1.5">
            {riskFlags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span className="text-slate-400">{flag}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Info className="h-3.5 w-3.5 text-slate-600" />
            <span>No significant risks identified</span>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────
          MISSING INFORMATION
          ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-[#2a2540] px-5 py-4">
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-slate-500">
          Missing Information
        </p>
        {missingInfo.length > 0 ? (
          <ul className="space-y-1.5">
            {missingInfo.map((info, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                <span className="text-slate-400">{info}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">All required information collected</p>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────
          EVIDENCE
          ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-[#2a2540] px-5 py-4">
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-slate-500">
          Evidence
        </p>
        <div className="space-y-0.5">
          <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-400 transition-colors hover:bg-[#221d38] hover:text-slate-200">
            <Link className="h-3.5 w-3.5" />
            <span>Opportunity in CRM</span>
          </button>
          <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-400 transition-colors hover:bg-[#221d38] hover:text-slate-200">
            <FileText className="h-3.5 w-3.5" />
            <span>Technical Assessment</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────
          FINAL OUTCOME
          ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-[#2a2540] px-5 py-4">
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-slate-500">
          Final Outcome
        </p>
        <Select>
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

      {/* ────────────────────────────────────────────────────────────
          ANALYTICS EXTRACTION (Sprint 17.5)
          ──────────────────────────────────────────────────────────── */}
      {sessionId && (
        <div className="border-b border-[#2a2540] px-5 py-4">
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-slate-500">
            Analytics Extraction
          </p>
          {extractionResult?.success ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Extracted successfully</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500">
                {extractionResult.structured?.NAMED_COMPETITORS && extractionResult.structured.NAMED_COMPETITORS.length > 0 && (
                  <span>Competitors: {extractionResult.structured.NAMED_COMPETITORS.length}</span>
                )}
                {extractionResult.structured?.RISK_CATEGORIES && extractionResult.structured.RISK_CATEGORIES.length > 0 && (
                  <span>Risks: {extractionResult.structured.RISK_CATEGORIES.length}</span>
                )}
                {extractionResult.structured?.DOMO_USE_CASES && extractionResult.structured.DOMO_USE_CASES.length > 0 && (
                  <span>Use cases: {extractionResult.structured.DOMO_USE_CASES.length}</span>
                )}
                {extractionResult.structured?.DEAL_COMPLEXITY && (
                  <span>Complexity: {extractionResult.structured.DEAL_COMPLEXITY}</span>
                )}
              </div>
              <Button
                variant="outline"
                className="w-full gap-2 border-[#362f50] text-slate-400 hover:bg-[#221d38] hover:text-white"
                size="sm"
                disabled={extractionLoading}
                onClick={async () => {
                  setExtractionLoading(true);
                  try {
                    const result = await cortexAi.extractStructuredTDR(sessionId);
                    setExtractionResult(result);
                  } catch (err) {
                    console.error('[TDRIntelligence] Re-extraction failed:', err);
                  }
                  setExtractionLoading(false);
                }}
              >
                {extractionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Re-extract
              </Button>
            </div>
          ) : extractionResult && !extractionResult.success ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Extraction failed</span>
              </div>
              <p className="text-[10px] text-slate-600 break-all">{extractionResult.error}</p>
              <Button
                variant="outline"
                className="w-full gap-2 border-[#362f50] text-slate-400 hover:bg-[#221d38] hover:text-white"
                size="sm"
                disabled={extractionLoading}
                onClick={async () => {
                  setExtractionLoading(true);
                  try {
                    const result = await cortexAi.extractStructuredTDR(sessionId);
                    setExtractionResult(result);
                  } catch (err) {
                    console.error('[TDRIntelligence] Retry extraction failed:', err);
                  }
                  setExtractionLoading(false);
                }}
              >
                {extractionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Retry
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full gap-2 border-[#362f50] text-slate-300 hover:bg-[#221d38] hover:text-white"
              size="sm"
              disabled={extractionLoading}
              onClick={async () => {
                setExtractionLoading(true);
                try {
                  const result = await cortexAi.extractStructuredTDR(sessionId);
                  setExtractionResult(result);
                } catch (err) {
                  console.error('[TDRIntelligence] Extraction failed:', err);
                }
                setExtractionLoading(false);
              }}
            >
              {extractionLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Database className="h-3.5 w-3.5" />
                  Extract Analytics
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────
          ACTION BUTTONS
          ──────────────────────────────────────────────────────────── */}
      <div className="mt-auto px-5 py-4">
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full gap-2 border-[#362f50] text-slate-300 hover:bg-[#221d38] hover:text-white"
            size="sm"
          >
            <Save className="h-3.5 w-3.5" />
            Save Draft
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 border-[#362f50] text-slate-300 hover:bg-[#221d38] hover:text-white"
            size="sm"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Finalize TDR
          </Button>
          <Button
            className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-500"
            size="sm"
            onClick={() => setShowSummary(true)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate Summary
          </Button>
        </div>
      </div>

      {/* Summary Modal */}
      {deal && (
        <TDRSummaryModal
          deal={deal}
          isOpen={showSummary}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}
