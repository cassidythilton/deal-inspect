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

// ── Tech category icons & colors ──
const TECH_CATEGORY_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  CRM:    { label: 'CRM',             bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  BI:     { label: 'BI/Analytics',     bg: 'bg-blue-100 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-300' },
  DW:     { label: 'Data Warehouse',   bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300' },
  ETL:    { label: 'Data Engineering', bg: 'bg-amber-100 dark:bg-amber-900/30',  text: 'text-amber-700 dark:text-amber-300' },
  Cloud:  { label: 'Cloud',            bg: 'bg-cyan-100 dark:bg-cyan-900/30',    text: 'text-cyan-700 dark:text-cyan-300' },
  ML:     { label: 'AI/ML',            bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
  DevOps: { label: 'DevOps',           bg: 'bg-rose-100 dark:bg-rose-900/30',    text: 'text-rose-700 dark:text-rose-300' },
  Other:  { label: 'Other',            bg: 'bg-slate-100 dark:bg-slate-800',     text: 'text-slate-600 dark:text-slate-300' },
};

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

  // Pre-fill domain: prefer real data from Webiste Domain field, fall back to heuristic
  useEffect(() => {
    if (deal?.websiteDomain) {
      // Clean the domain: strip protocol/path, lowercase
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
      {/* Deal Info Header */}
      {deal && (
        <div className="border-b border-border/60 p-4">
          <h3 className="text-base font-semibold">{deal.account}</h3>
          <p className="text-sm text-muted-foreground">{deal.dealName}</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium tabular-nums">${(deal.acv / 1000).toFixed(0)}K ACV</span>
            <span>·</span>
            <span>{getShortStage(deal.stage)}</span>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ACCOUNT INTELLIGENCE — Sumble + Perplexity
          ═══════════════════════════════════════════════════════════ */}
      {deal && (
        <div className="border-b border-border/60 p-4">
          <p className="section-header mb-3">ACCOUNT INTELLIGENCE</p>

          {/* Domain Input */}
          <div className="mb-3 space-y-1">
            <Label className="text-2xs text-muted-foreground">Account Domain</Label>
            <div className="flex gap-1.5">
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acme.com"
                className="h-8 flex-1 text-xs"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1.5 mb-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs h-8"
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
              className="flex-1 gap-1.5 text-xs h-8"
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

          {/* ── Sumble Results ── */}
          {sumbleData && sumbleData.success && (
            <div className="space-y-2 mb-3">
              <p className="text-2xs font-medium text-muted-foreground flex items-center gap-1">
                <SumbleIcon className="h-3.5 w-3.5" />
                TECHNOGRAPHIC SIGNALS
                <span className="ml-auto text-2xs text-muted-foreground/60">
                  {sumbleData.pulledAt ? new Date(sumbleData.pulledAt).toLocaleDateString() : ''}
                </span>
              </p>

              {/* Organization identity + summary */}
              {sumbleData.orgName && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium">{sumbleData.orgName}</span>
                  {sumbleData.sourceDataUrl && (
                    <a
                      href={sumbleData.sourceDataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 flex items-center gap-0.5"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="text-2xs">Sumble</span>
                    </a>
                  )}
                  <span className="ml-auto text-2xs text-muted-foreground">
                    {sumbleData.technologiesCount ?? 0} techs found
                  </span>
                </div>
              )}

              {/* No techs found message */}
              {sumbleData.technologiesCount === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  No technology signals found for this company in Sumble.
                </p>
              )}

              {/* Tech Stack Badges */}
              {sumbleData.techCategories && Object.entries(sumbleData.techCategories).some(([, techs]) => techs.length > 0) && (
                <div>
                  <p className="text-2xs font-medium text-muted-foreground flex items-center gap-1 mb-1.5">
                    <Layers className="h-3 w-3" />
                    TECH STACK
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(sumbleData.techCategories)
                      .filter(([, techs]) => techs.length > 0)
                      .map(([category, techs]) => {
                        const style = TECH_CATEGORY_STYLES[category] || TECH_CATEGORY_STYLES.Other;
                        return (
                          <div key={category} className="flex flex-wrap items-center gap-1">
                            <span className="text-2xs text-muted-foreground w-16 shrink-0">{style.label}</span>
                            {techs.map((tech) => (
                              <span
                                key={tech}
                                className={cn(
                                  'rounded px-1.5 py-0.5 text-2xs font-medium',
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

              {/* Tech detail signals (jobs/people/teams) for top techs */}
              {sumbleData.techDetails && sumbleData.techDetails.length > 0 && (
                <div className="mt-1.5">
                  <p className="text-2xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                    <Cpu className="h-3 w-3" />
                    HIRING SIGNALS
                  </p>
                  <div className="space-y-1">
                    {sumbleData.techDetails
                      .filter(t => t.jobs_count > 0 || t.people_count > 0)
                      .slice(0, 8)
                      .map((tech) => (
                        <div key={tech.name} className="flex items-center justify-between text-2xs">
                          <span className="font-medium text-foreground">{tech.name}</span>
                          <div className="flex gap-2 text-muted-foreground">
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

          {/* ── Perplexity Results ── */}
          {perplexityData && perplexityData.success && (
            <div className="space-y-2">
              <p className="text-2xs font-medium text-muted-foreground flex items-center gap-1">
                <PerplexityIcon className="h-3.5 w-3.5" />
                WEB RESEARCH
                <span className="ml-auto text-2xs text-muted-foreground/60">
                  {perplexityData.pulledAt ? new Date(perplexityData.pulledAt).toLocaleDateString() : ''}
                </span>
              </p>

              {perplexityData.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {perplexityData.summary}
                </p>
              )}

              {perplexityData.technologySignals && perplexityData.technologySignals.length > 0 && (
                <div>
                  <p className="text-2xs font-medium text-muted-foreground mb-1">Technology Signals</p>
                  <ul className="space-y-1">
                    {perplexityData.technologySignals.map((signal, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs">
                        <Cpu className="mt-0.5 h-3 w-3 shrink-0 text-violet-500" />
                        <span className="text-muted-foreground">{signal}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {perplexityData.competitiveLandscape && perplexityData.competitiveLandscape.length > 0 && (
                <div>
                  <p className="text-2xs font-medium text-muted-foreground mb-1">Competitive Landscape</p>
                  <ul className="space-y-1">
                    {perplexityData.competitiveLandscape.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs">
                        <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {perplexityData.keyInsights && perplexityData.keyInsights.length > 0 && (
                <div>
                  <p className="text-2xs font-medium text-muted-foreground mb-1">Key Insights</p>
                  <ul className="space-y-1">
                    {perplexityData.keyInsights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs">
                        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" />
                        <span className="text-muted-foreground">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {perplexityData.citations && perplexityData.citations.length > 0 && (
                <div>
                  <p className="text-2xs font-medium text-muted-foreground mb-1">Sources</p>
                  <div className="space-y-0.5">
                    {perplexityData.citations.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-2xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 truncate"
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
            <p className="text-xs text-muted-foreground/60 italic">
              Click Enrich or Research to pull account intelligence.
            </p>
          )}
        </div>
      )}

      {/* Deal Team Section */}
      {deal && (
        <div className="border-b border-border/60 p-4">
          <p className="section-header mb-3">DEAL TEAM</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Building2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account Executive</p>
                <p className="text-sm font-medium">{deal.owner || 'Not assigned'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
                <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">SE Manager</p>
                <p className="text-sm font-medium">{deal.seManager || 'Not assigned'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
                <User className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sales Consultant (SE)</p>
                <p className="text-sm font-medium">{deal.salesConsultant || 'Not assigned'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Readiness Score */}
      <div className="border-b border-border/60 p-4">
        <p className="section-header mb-2">READINESS SCORE</p>
        <div
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-3 py-2',
            readinessLevel === 'green' && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400',
            readinessLevel === 'yellow' && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
            readinessLevel === 'red' && 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400'
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

      {/* Risk Flags */}
      <div className="border-b border-border/60 p-4">
        <p className="section-header mb-2">RISK FLAGS</p>
        {riskFlags.length > 0 ? (
          <ul className="space-y-1.5">
            {riskFlags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span className="text-muted-foreground">{flag}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span>No significant risks identified</span>
          </div>
        )}
      </div>

      {/* Missing Information */}
      <div className="border-b border-border/60 p-4">
        <p className="section-header mb-2">MISSING INFORMATION</p>
        {missingInfo.length > 0 ? (
          <ul className="space-y-1.5">
            {missingInfo.map((info, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">{info}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">All required information collected</p>
        )}
      </div>

      {/* Evidence Links */}
      <div className="border-b border-border/60 p-4">
        <p className="section-header mb-2">EVIDENCE</p>
        <div className="space-y-1">
          <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Link className="h-3.5 w-3.5" />
            <span>Opportunity in CRM</span>
          </button>
          <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span>Technical Assessment</span>
          </button>
        </div>
      </div>

      {/* Outcome Selector */}
      <div className="border-b border-border/60 p-4">
        <p className="section-header mb-2">FINAL OUTCOME</p>
        <Select>
          <SelectTrigger className="h-10 text-sm">
            <SelectValue placeholder="Select outcome..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="approved">Approved for Forecast</SelectItem>
            <SelectItem value="needs-work">Needs More Work</SelectItem>
            <SelectItem value="deferred">Deferred</SelectItem>
            <SelectItem value="at-risk">Flagged At-Risk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Action Buttons */}
      <div className="mt-auto p-4">
        <div className="space-y-2">
          <Button variant="outline" className="w-full gap-2" size="sm">
            <Save className="h-3.5 w-3.5" />
            Save Draft
          </Button>
          <Button variant="outline" className="w-full gap-2" size="sm">
            <CheckCircle className="h-3.5 w-3.5" />
            Finalize TDR
          </Button>
          <Button className="w-full gap-2" size="sm" onClick={() => setShowSummary(true)}>
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
