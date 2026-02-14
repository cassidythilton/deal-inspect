/**
 * DataModelReference — Documents the Snowflake data model.
 *
 * Sprint 25: Documentation Hub
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Database, Eye } from 'lucide-react';

/* ── Shared table ──────────────────────────────────────────────────────────── */

function DocTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#2a2540]/60">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#2a2540]/60 bg-[#1B1630]/60">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-slate-300 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-[#2a2540]/30 last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-slate-300 whitespace-pre-line font-mono text-[11px]">
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

function TableCard({ icon: Icon, name, description, purpose, keyColumns }: {
  icon: React.ElementType;
  name: string;
  description: string;
  purpose: string;
  keyColumns: string[][];
}) {
  return (
    <AccordionItem value={name} className="border border-[#2a2540]/40 rounded-lg overflow-hidden">
      <AccordionTrigger className="px-4 py-3 hover:bg-[#1B1630]/40 [&[data-state=open]]:bg-[#1B1630]/60">
        <div className="flex items-center gap-3 text-left">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-500/10 border border-blue-500/20">
            <Icon className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200 font-mono">{name}</p>
            <p className="text-[10px] text-slate-400 font-sans">{description}</p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 space-y-3">
        <p className="text-xs text-slate-300 leading-relaxed">{purpose}</p>
        <DocTable
          headers={['Column', 'Type', 'Notes']}
          rows={keyColumns}
        />
      </AccordionContent>
    </AccordionItem>
  );
}

/* ── Main export ───────────────────────────────────────────────────────────── */

export function DataModelReference() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-300 leading-relaxed">
        All persistent state lives in Snowflake under <code className="text-blue-400 bg-blue-500/10 px-1 rounded">TDR_APP.TDR_DATA</code>.
        The schema includes 8 tables and 2 views. Code Engine functions handle all reads/writes via the Snowflake SQL API with JWT authentication.
      </p>

      <div className="rounded-lg border border-[#2a2540]/40 bg-[#1B1630]/30 px-4 py-3 space-y-1">
        <p className="text-xs font-medium text-slate-300">Schema: TDR_APP.TDR_DATA</p>
        <p className="text-[10px] text-slate-400">Warehouse: COMPUTE_WH · Role: TDR_APP_ROLE · Auth: JWT (RSA-256 key pair)</p>
      </div>

      <Accordion type="multiple" className="space-y-2">
        <TableCard
          icon={Database}
          name="TDR_SESSIONS"
          description="Core session table — one row per TDR review"
          purpose="Stores the metadata for each TDR session: which deal, which SE, current status, iteration count, thesis, and outcome. Created when an SE opens a deal in the Workspace."
          keyColumns={[
            ['SESSION_ID', 'VARCHAR', 'Primary key (UUID)'],
            ['OPPORTUNITY_ID', 'VARCHAR', 'SFDC opportunity ID'],
            ['ACCOUNT_NAME', 'VARCHAR', 'Account name from SFDC'],
            ['ACV', 'NUMBER', 'Annual contract value'],
            ['STAGE', 'VARCHAR', 'Deal stage at TDR creation'],
            ['STATUS', 'VARCHAR', 'active / completed / archived'],
            ['OUTCOME', 'VARCHAR', 'proceed / caution / pause / not-ready'],
            ['ITERATION', 'NUMBER', 'TDR iteration count (re-reviews)'],
            ['THESIS', 'VARCHAR', 'SE\'s free-form thesis statement'],
            ['CREATED_BY', 'VARCHAR', 'SE who created the session'],
            ['CREATED_AT / UPDATED_AT', 'TIMESTAMP', 'Auto-managed timestamps'],
          ]}
        />

        <TableCard
          icon={Database}
          name="TDR_STEP_INPUTS"
          description="All SE inputs from the 9-step TDR workflow"
          purpose="Stores every field value entered by the SE during the TDR. Each row is a single field within a step. Supports history via versioning — the latest input per (session, step, field) tuple is displayed."
          keyColumns={[
            ['INPUT_ID', 'VARCHAR', 'Primary key (UUID)'],
            ['SESSION_ID', 'VARCHAR', 'FK → TDR_SESSIONS'],
            ['STEP_ID', 'VARCHAR', 'Step identifier (context, decision, etc.)'],
            ['FIELD_ID', 'VARCHAR', 'Field within the step'],
            ['FIELD_VALUE', 'VARCHAR', 'The SE\'s input text'],
            ['VERSION', 'NUMBER', 'Auto-incrementing for history'],
            ['CREATED_BY', 'VARCHAR', 'SE who entered the value'],
          ]}
        />

        <TableCard
          icon={Database}
          name="TDR_CHAT_MESSAGES"
          description="Multi-provider chat history"
          purpose="Persists every chat message from the TDR Inline Chat. Includes both user and assistant messages with provider/model metadata and token usage for cost tracking."
          keyColumns={[
            ['MESSAGE_ID', 'VARCHAR', 'Primary key (UUID)'],
            ['SESSION_ID', 'VARCHAR', 'FK → TDR_SESSIONS'],
            ['ROLE', 'VARCHAR', 'user / assistant'],
            ['CONTENT', 'VARCHAR', 'Message text'],
            ['PROVIDER', 'VARCHAR', 'cortex / perplexity / domo'],
            ['MODEL_USED', 'VARCHAR', 'Specific model ID'],
            ['TOKENS_IN / TOKENS_OUT', 'NUMBER', 'Token consumption'],
            ['CONTEXT_STEP', 'VARCHAR', 'Which TDR step was active when sent'],
            ['CITED_SOURCES', 'VARIANT', 'Array of citation URLs (Perplexity)'],
          ]}
        />

        <TableCard
          icon={Database}
          name="ACCOUNT_INTEL_SUMBLE"
          description="Sumble enrichment results (tech, org, jobs, people)"
          purpose="Stores the raw and parsed results from all 4 Sumble API endpoints. Keyed by opportunity ID — one row per enrichment pull. Supports history for seeing how intelligence evolves over time."
          keyColumns={[
            ['PULL_ID', 'VARCHAR', 'Primary key (UUID)'],
            ['OPPORTUNITY_ID', 'VARCHAR', 'FK → deal'],
            ['ACCOUNT_NAME', 'VARCHAR', 'Account enriched'],
            ['TECHNOLOGIES', 'VARIANT', 'Array of detected technologies'],
            ['TECH_CATEGORIES', 'VARIANT', 'Technologies grouped by category'],
            ['ORG_PROFILE', 'VARIANT', 'Revenue, employees, industry, HQ'],
            ['HIRING_SIGNALS', 'VARIANT', 'Open positions, departments'],
            ['KEY_PEOPLE', 'VARIANT', 'Contacts, titles, LinkedIn URLs'],
            ['CREDITS_USED', 'NUMBER', 'Sumble API credits consumed'],
            ['PULLED_AT', 'TIMESTAMP', 'When enrichment was executed'],
          ]}
        />

        <TableCard
          icon={Database}
          name="ACCOUNT_INTEL_PERPLEXITY"
          description="Perplexity web research results"
          purpose="Stores Perplexity Sonar research results including key insights, citations, and the raw research narrative."
          keyColumns={[
            ['PULL_ID', 'VARCHAR', 'Primary key (UUID)'],
            ['OPPORTUNITY_ID', 'VARCHAR', 'FK → deal'],
            ['ACCOUNT_NAME', 'VARCHAR', 'Account researched'],
            ['KEY_INSIGHTS', 'VARIANT', 'Array of key insight strings'],
            ['CITATIONS', 'VARIANT', 'Array of {url, title} citation objects'],
            ['SUMMARY', 'VARCHAR', 'Full research narrative'],
            ['MODEL_USED', 'VARCHAR', 'sonar / sonar-pro'],
            ['PULLED_AT', 'TIMESTAMP', 'When research was executed'],
          ]}
        />

        <TableCard
          icon={Database}
          name="CORTEX_ANALYSIS_RESULTS"
          description="Cached AI outputs (brief, action plan, classification, extraction)"
          purpose="Stores all Cortex AI function outputs so they can be loaded without re-running expensive LLM calls. One row per (session, analysis_type) pair. Supports regeneration by deleting and re-inserting."
          keyColumns={[
            ['RESULT_ID', 'VARCHAR', 'Primary key (UUID)'],
            ['SESSION_ID', 'VARCHAR', 'FK → TDR_SESSIONS'],
            ['ANALYSIS_TYPE', 'VARCHAR', 'brief / action_plan / classification / extraction / structured_extract / kb_summary'],
            ['CONTENT', 'VARCHAR', 'The AI output (markdown text or JSON)'],
            ['MODEL_USED', 'VARCHAR', 'Which Cortex model was used'],
            ['CREATED_AT', 'TIMESTAMP', 'When the analysis was generated'],
          ]}
        />

        <TableCard
          icon={Database}
          name="API_USAGE_LOG"
          description="API call tracking for cost and audit"
          purpose="Logs every external API call made by Code Engine — Sumble credits, Perplexity tokens, Cortex model usage. Used by the Settings page for usage statistics."
          keyColumns={[
            ['LOG_ID', 'VARCHAR', 'Primary key (UUID)'],
            ['SERVICE', 'VARCHAR', 'sumble / perplexity / cortex / domo'],
            ['ENDPOINT', 'VARCHAR', 'Specific API endpoint called'],
            ['TOKENS_IN / TOKENS_OUT', 'NUMBER', 'Token consumption (LLM calls)'],
            ['CREDITS_USED', 'NUMBER', 'Credits consumed (Sumble)'],
            ['DURATION_MS', 'NUMBER', 'Call duration in milliseconds'],
            ['CALLED_BY', 'VARCHAR', 'User who initiated the call'],
            ['CREATED_AT', 'TIMESTAMP', 'When the call was made'],
          ]}
        />

        <TableCard
          icon={Database}
          name="TDR_READOUTS / TDR_DISTRIBUTIONS"
          description="PDF readout and Slack distribution logs"
          purpose="TDR_READOUTS stores generated readout metadata. TDR_DISTRIBUTIONS logs each Slack share with channel, message ID, and delivery status."
          keyColumns={[
            ['READOUT_ID / DISTRIBUTION_ID', 'VARCHAR', 'Primary key'],
            ['SESSION_ID', 'VARCHAR', 'FK → TDR_SESSIONS'],
            ['CHANNEL_NAME / CHANNEL_ID', 'VARCHAR', 'Slack channel target'],
            ['MESSAGE_TS', 'VARCHAR', 'Slack message timestamp (for threading)'],
            ['FILE_ID', 'VARCHAR', 'Uploaded PDF file ID in Slack'],
            ['SUMMARY_TEXT', 'VARCHAR', 'AI-generated Slack message text'],
            ['DISTRIBUTED_AT', 'TIMESTAMP', 'When share was sent'],
          ]}
        />

        {/* ── Views ────────────────────────────────────────────────────────── */}
        <TableCard
          icon={Eye}
          name="V_TDR_ANALYTICS"
          description="Flattened view for portfolio analytics and NLQ"
          purpose="Joins TDR_SESSIONS + TDR_STEP_INPUTS + CORTEX_ANALYSIS_RESULTS (structured_extract) into a flat, queryable view. Powers the Analytics page charts and the NLQ bar. Columns include competitors, platforms, entry layers, risk categories, verdicts, and use cases extracted by Cortex AI."
          keyColumns={[
            ['SESSION_ID', 'VARCHAR', 'Primary key'],
            ['ACCOUNT_NAME / ACV / STAGE', 'various', 'From TDR_SESSIONS'],
            ['COMPETITORS', 'VARCHAR', 'Comma-separated competitor list (from Cortex extract)'],
            ['PLATFORMS', 'VARCHAR', 'Cloud platforms mentioned'],
            ['ENTRY_LAYER', 'VARCHAR', 'How Domo enters the architecture'],
            ['RISK_CATEGORIES', 'VARCHAR', 'Classified risk types'],
            ['VERDICT', 'VARCHAR', 'proceed / caution / pause / not-ready'],
            ['USE_CASES', 'VARCHAR', 'Domo use cases identified'],
          ]}
        />
      </Accordion>
    </div>
  );
}

