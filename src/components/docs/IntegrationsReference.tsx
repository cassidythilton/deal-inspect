/**
 * IntegrationsReference — Documents all external system integrations.
 *
 * Sprint 25: Documentation Hub
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { SnowflakeLogo, CortexLogo } from '@/components/CortexBranding';
import { SumbleIcon } from '@/components/icons/SumbleIcon';
import { PerplexityIcon } from '@/components/icons/PerplexityIcon';
import { DomoIcon } from '@/components/icons/DomoIcon';
import { SlackIcon } from '@/components/icons/SlackIcon';

/* ── Shared table ──────────────────────────────────────────────────────────── */

function DocTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.04]">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-slate-200 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-white/[0.04] last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-slate-300 whitespace-pre-line">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntegrationHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 text-left">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/15 border border-violet-500/25">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-[10px] text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

/* ── Main export ───────────────────────────────────────────────────────────── */

export function IntegrationsReference() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-200 leading-relaxed">
        DealInspect integrates with five external systems. All API keys are kept server-side in
        Domo Code Engine — the React frontend never touches secrets directly.
      </p>

      <Accordion type="multiple" className="space-y-2">
        {/* ── Snowflake Cortex AI ──────────────────────────────────────────── */}
        <AccordionItem value="cortex" className="border border-white/[0.08] rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:bg-white/[0.03] [&[data-state=open]]:bg-white/[0.04]">
            <IntegrationHeader
              icon={<CortexLogo size={16} />}
              title="Snowflake Cortex AI"
              subtitle="In-database LLM functions — 8 SQL functions + Analyst + Search"
            />
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-sm text-slate-200 leading-relaxed">
              Cortex AI functions run directly inside Snowflake — data never leaves the account.
              Called via Code Engine functions that execute parameterized SQL.
            </p>
            <DocTable
              headers={['Function', 'Used For', 'Model']}
              rows={[
                ['AI_COMPLETE', 'TDR Brief generation, Action Plan synthesis, Chat responses, Portfolio insights, NLQ \u2192 SQL', 'claude-4-sonnet (default), claude-4-opus, gpt-4.1, o4-mini'],
                ['AI_CLASSIFY', 'Categorize Perplexity findings into TDR categories (competitive_threat, technology_adoption, etc.)', 'llama3.1-8b'],
                ['AI_EXTRACT', 'Extract competitors, technologies, executives, timelines from unstructured text', 'llama3.1-8b'],
                ['AI_EMBED', 'Generate semantic embeddings for similar deal matching', 'snowflake-arctic-embed-l-v2.0'],
                ['AI_SIMILARITY', 'Cosine similarity for finding analogous deals in the portfolio', '(built-in)'],
                ['AI_SENTIMENT', 'Sentiment trend across intel history for an account', 'llama3.1-8b'],
                ['AI_SUMMARIZE_AGG', 'Summarize intel evolution over time', 'llama3.1-70b'],
                ['AI_AGG', 'Aggregate analysis across multiple data points', 'llama3.1-70b'],
                ['Cortex Analyst', 'Natural language \u2192 SQL for portfolio analytics (NLQ bar)', 'AI_COMPLETE (routing)'],
                ['Cortex Search', 'Hybrid semantic + keyword search over KB filesets', '(built-in)'],
              ]}
            />
            <p className="text-[11px] text-slate-400 italic">
              All Cortex calls are routed through Domo Code Engine \u2192 Snowflake SQL API with JWT auth.
              Results cached in CORTEX_ANALYSIS_RESULTS to avoid redundant token consumption.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* ── Sumble ──────────────────────────────────────────────────────── */}
        <AccordionItem value="sumble" className="border border-white/[0.08] rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:bg-white/[0.03] [&[data-state=open]]:bg-white/[0.04]">
            <IntegrationHeader
              icon={<SumbleIcon className="h-4 w-4" />}
              title="Sumble"
              subtitle="Firmographic & technographic enrichment — 4 API endpoints"
            />
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-sm text-slate-200 leading-relaxed">
              Sumble provides real-time firmographic, technographic, and people intelligence.
              The "Enrich All" button calls all 4 endpoints in parallel, each persisted independently to Snowflake.
            </p>
            <DocTable
              headers={['Endpoint', 'Data Returned', 'Use Case']}
              rows={[
                ['Tech Stack (/enrich)', 'Technologies, categories, data URLs, credit usage', 'Identify incumbent tools (Tableau, Power BI), cloud platforms, data stack components'],
                ['Organizations (/organizations)', 'Revenue, employee count, industry, sub-industry, HQ, description', 'Firmographic context for deal sizing and stakeholder mapping'],
                ['Jobs (/jobs)', 'Open positions, departments, seniority, posting dates', 'Hiring signals: "hiring 3 data engineers" = active investment in data infrastructure'],
                ['People (/people)', 'Key contacts, titles, departments, LinkedIn profiles', 'Identify decision makers, champions, and technical evaluators'],
              ]}
            />
            <p className="text-[11px] text-slate-400 italic">
              Results stored in ACCOUNT_INTEL_SUMBLE. Credit-based API — usage tracked in API_USAGE_LOG.
              Domain auto-derived from account name (e.g., "Acme Corp" \u2192 "acme.com").
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* ── Perplexity ──────────────────────────────────────────────────── */}
        <AccordionItem value="perplexity" className="border border-white/[0.08] rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:bg-white/[0.03] [&[data-state=open]]:bg-white/[0.04]">
            <IntegrationHeader
              icon={<PerplexityIcon className="h-4 w-4" />}
              title="Perplexity"
              subtitle="Web-grounded research with citations — Sonar & Sonar Pro"
            />
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-sm text-slate-200 leading-relaxed">
              Perplexity Sonar provides real-time web research grounded in citations. Used for
              strategic context, competitive intelligence, and technology trend analysis.
            </p>
            <DocTable
              headers={['Model', 'Capability', 'When Used']}
              rows={[
                ['sonar', 'Fast web search with source citations', 'Quick research queries, general context gathering'],
                ['sonar-pro', 'Deeper multi-step research with more sources', 'Comprehensive competitive landscape analysis, strategic intelligence'],
              ]}
            />
            <p className="text-sm text-slate-200 leading-relaxed mt-2">
              <strong className="text-white">Research prompt structure:</strong> Account name + key insights request + competitive landscape +
              technology signals + strategic initiatives. Results include key insights (array), citations with URLs,
              and a summary narrative. All persisted to ACCOUNT_INTEL_PERPLEXITY.
            </p>
            <p className="text-[11px] text-slate-400 italic">
              Also available as a chat provider — "Perplexity" mode in TDR Chat returns cited answers from the live web.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* ── Domo Platform ───────────────────────────────────────────────── */}
        <AccordionItem value="domo" className="border border-white/[0.08] rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:bg-white/[0.03] [&[data-state=open]]:bg-white/[0.04]">
            <IntegrationHeader
              icon={<DomoIcon className="h-4 w-4 text-violet-400" />}
              title="Domo Platform"
              subtitle="Code Engine, Datasets, Filesets, AI, App Studio"
            />
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-sm text-slate-200 leading-relaxed">
              The app runs inside Domo App Studio and leverages multiple Domo platform services.
            </p>
            <DocTable
              headers={['Service', 'Purpose', 'Detail']}
              rows={[
                ['Code Engine', 'Server-side function execution', '25 functions across 4 groups (Persistence, Intel, Cortex, Chat). Keeps API keys server-side.'],
                ['Datasets', 'SFDC deal data pipeline', 'dealdetails dataset maps SFDC opportunities with ACV, stage, forecast, partners, etc.'],
                ['Filesets', 'Knowledge Base document store', 'PDF battle cards, playbooks, competitive docs. Queried via /domo/files/v1/filesets/{id}/query.'],
                ['Domo AI', 'Native AI model', 'Used as chat provider and fallback summarizer. No Code Engine needed — client-side calls.'],
                ['App Studio', 'Hosting & iframe container', 'React SPA deployed as a Domo App. Uses ryuu.js SDK for data, proxy, and auth.'],
              ]}
            />
          </AccordionContent>
        </AccordionItem>

        {/* ── Slack ───────────────────────────────────────────────────────── */}
        <AccordionItem value="slack" className="border border-white/[0.08] rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:bg-white/[0.03] [&[data-state=open]]:bg-white/[0.04]">
            <IntegrationHeader
              icon={<SlackIcon className="h-4 w-4 text-violet-400" />}
              title="Slack"
              subtitle="TDR Readout distribution with AI summary"
            />
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-sm text-slate-200 leading-relaxed">
              The TDR Share dialog distributes readout PDFs to Slack channels. The flow: assemble readout \u2192
              generate PDF \u2192 generate AI summary \u2192 post to Slack with PDF attachment.
            </p>
            <DocTable
              headers={['Feature', 'Detail']}
              rows={[
                ['Channel Discovery', 'Lists available Slack channels via Domo\'s Slack integration. Shows channel name, privacy, member count.'],
                ['AI Summary', 'Cortex AI generates a Slack-formatted message summarizing the TDR outcome, key risks, and next steps.'],
                ['PDF Attachment', 'The full TDR Readout PDF is attached to the Slack message as a downloadable file.'],
                ['Deal Team Mention', 'Optionally @mentions the AE, SE, and manager in the Slack message.'],
                ['Distribution Log', 'Each share is persisted to TDR_DISTRIBUTIONS with channel, timestamp, and message ID.'],
              ]}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
