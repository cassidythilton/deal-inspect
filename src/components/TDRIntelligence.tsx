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
} from 'lucide-react';
import { TDRSummaryModal } from './TDRSummaryModal';
import { SumbleIcon } from '@/components/icons/SumbleIcon';
import { PerplexityIcon } from '@/components/icons/PerplexityIcon';
import { accountIntel } from '@/lib/accountIntel';
import type { SumbleEnrichment, PerplexityResearch } from '@/lib/accountIntel';

interface TDRIntelligenceProps {
  deal?: Deal;
  readinessLevel: ReadinessLevel;
  missingInfo: string[];
  riskFlags: string[];
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

export function TDRIntelligence({
  deal,
  readinessLevel,
  missingInfo,
  riskFlags,
}: TDRIntelligenceProps) {
  const [showSummary, setShowSummary] = useState(false);

  // ── Account Intelligence State ──
  const [domain, setDomain] = useState('');
  const [sumbleData, setSumbleData] = useState<SumbleEnrichment | null>(null);
  const [perplexityData, setPerplexityData] = useState<PerplexityResearch | null>(null);
  const [sumbleLoading, setSumbleLoading] = useState(false);
  const [perplexityLoading, setPerplexityLoading] = useState(false);
  const [intelLoaded, setIntelLoaded] = useState(false);

  // ── Intel History State ──
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<Record<string, unknown>[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
      } catch (err) {
        console.warn('[TDRIntelligence] Failed to load cached intel:', err);
      }
    };

    loadCachedIntel();
  }, [deal?.id, intelLoaded]);

  // ── Sumble Enrichment ──
  const handleEnrichSumble = useCallback(async () => {
    if (!deal || !domain.trim()) return;
    setSumbleLoading(true);
    try {
      const result = await accountIntel.enrichSumble(deal.id, deal.account, domain.trim());
      if (result.success) {
        setSumbleData(result);
      } else {
        console.error('[TDRIntelligence] Sumble enrichment failed:', result.error);
      }
    } catch (err) {
      console.error('[TDRIntelligence] Sumble enrichment error:', err);
    }
    setSumbleLoading(false);
  }, [deal, domain]);

  // ── Perplexity Research ──
  const handleResearchPerplexity = useCallback(async () => {
    if (!deal) return;
    setPerplexityLoading(true);
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
      } else {
        console.error('[TDRIntelligence] Perplexity research failed:', result.error);
      }
    } catch (err) {
      console.error('[TDRIntelligence] Perplexity research error:', err);
    }
    setPerplexityLoading(false);
  }, [deal]);

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

          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs h-8 border-[#362f50] bg-[#1e1a30]/80 text-slate-300 hover:bg-[#2d2744] hover:text-white disabled:opacity-40"
              onClick={handleEnrichSumble}
              disabled={sumbleLoading || !domain.trim()}
            >
              {sumbleLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <SumbleIcon className="h-3.5 w-3.5" />
              )}
              {sumbleData ? 'Refresh' : 'Enrich'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs h-8 border-[#362f50] bg-[#1e1a30]/80 text-slate-300 hover:bg-[#2d2744] hover:text-white disabled:opacity-40"
              onClick={handleResearchPerplexity}
              disabled={perplexityLoading}
            >
              {perplexityLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <PerplexityIcon className="h-3.5 w-3.5" />
              )}
              {perplexityData ? 'Re-research' : 'Research'}
            </Button>
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

          {/* Empty state */}
          {!sumbleData && !perplexityData && !sumbleLoading && !perplexityLoading && (
            <p className="text-xs text-slate-600 italic">
              Click Enrich or Research to pull account intelligence.
            </p>
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
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#221d38]">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <div>
                <p className="text-2xs text-slate-500">Account Executive</p>
                <p className="text-sm font-medium text-slate-200">{deal.owner || 'Not assigned'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-500/10">
                <Users className="h-3.5 w-3.5 text-teal-400" />
              </div>
              <div>
                <p className="text-2xs text-slate-500">SE Manager</p>
                <p className="text-sm font-medium text-slate-200">{deal.seManager || 'Not assigned'}</p>
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
