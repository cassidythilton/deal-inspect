/**
 * GlossaryReference — Key terms and FAQ for the app.
 *
 * Sprint 25: Documentation Hub
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

/* ── Glossary data ─────────────────────────────────────────────────────────── */

interface GlossaryTerm {
  term: string;
  definition: string;
}

const GLOSSARY: GlossaryTerm[] = [
  { term: 'TDR', definition: 'Technical Deal Review — a structured framework for SEs to inspect the technical landscape, risks, and strategic positioning of a deal. The core workflow of DealInspect.' },
  { term: 'Pre-TDR Score', definition: 'The initial TDR Index Score calculated purely from SFDC deal data (ACV, stage, competitors, partner alignment, etc.) before the SE begins the review.' },
  { term: 'Post-TDR Score', definition: 'The enriched TDR Index Score that includes bonuses from SE inputs, enrichment data, risk identification, and KB matches. Layered on top of the Pre-TDR base.' },
  { term: 'Confidence Score', definition: 'A separate 0–100 metric measuring how well-informed the TDR assessment is. High confidence = the SE has done thorough investigation. Independent from deal complexity.' },
  { term: 'Priority Band', definition: 'A label derived from the TDR score: CRITICAL (≥50), HIGH (≥35), MEDIUM (≥25), LOW (<25). Drives triage and attention allocation.' },
  { term: 'Lifecycle Phase', definition: 'The stage of the TDR review: Not Started → Early → In Progress → Near Complete → Fully Assessed. Affects how the priority band is interpreted.' },
  { term: 'Enrichment', definition: 'External data gathered to inform the TDR. Includes Sumble (firmographic/tech) and Perplexity (web research). Stored in Snowflake and reused across sessions.' },
  { term: 'Structured Extract', definition: 'Cortex AI (AI_EXTRACT + AI_CLASSIFY) parsing of unstructured TDR data into structured fields: competitors, platforms, risk categories, entry layer, use cases, verdict.' },
  { term: 'Knowledge Base (KB)', definition: 'A collection of Domo filesets (PDFs) containing battle cards, playbooks, competitive docs, and reference material. Searchable and summarizable via Cortex AI.' },
  { term: 'Action Plan', definition: 'A 7-section strategic plan synthesized by Cortex AI from all TDR data: SE inputs, Sumble, Perplexity, KB, chat, and Cortex analysis results.' },
  { term: 'TDR Brief', definition: 'An AI-generated narrative summary of the TDR, including deal context, architecture assessment, risk analysis, and recommendations. Uses claude-4-sonnet via AI_COMPLETE.' },
  { term: 'Readout', definition: 'The executive-ready PDF document capturing the entire TDR lifecycle. Can be downloaded or distributed to Slack with an AI-generated summary.' },
  { term: 'NLQ', definition: 'Natural Language Query — the ability to ask questions in plain English and get structured data back. Powers the Analytics page via Cortex Analyst (AI_COMPLETE → SQL → results).' },
  { term: 'Cortex Analyst', definition: 'A Snowflake Cortex capability that translates natural language questions into SQL queries, executes them, and returns tabular results with a narrative answer.' },
  { term: 'Code Engine', definition: 'Domo\'s serverless function runtime. DealInspect uses 25 Code Engine functions organized into 4 groups: Persistence (8), Account Intel (5), Cortex AI (8), Chat (4).' },
  { term: 'Session', definition: 'A TDR session represents one review of one deal. Stored in TDR_SESSIONS. Supports multiple iterations (re-reviews) and status tracking (active/completed/archived).' },
  { term: 'Fileset', definition: 'A Domo document store containing uploaded files (PDFs). DealInspect queries filesets for knowledge base content using the /domo/files/v1/filesets/{id}/query endpoint.' },
  { term: 'Dangerous Competitor', definition: 'A competitor configured in Settings that triggers elevated Post-TDR scoring when named in a deal. Examples: Sigma Computing, Fivetran, ThoughtSpot.' },
  { term: 'Critical Factor', definition: 'A specific deal characteristic that drives the TDR score — e.g., "High ACV" or "Multi-Competitor" or "Stage 2 Sweet Spot." Displayed as tags on the deal grid.' },
  { term: 'Thesis', definition: 'A free-form statement by the SE summarizing their hypothesis about the deal. Editable in the TDR Workspace header. Saved to TDR_SESSIONS.' },
  { term: 'Verdict', definition: 'The final TDR outcome: Proceed (green light), Caution (proceed with flags), Pause (needs more info), Not Ready (do not proceed). Set in the Risk & Verdict step.' },
];

/* ── FAQ data ──────────────────────────────────────────────────────────────── */

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ: FAQItem[] = [
  { question: 'How is the TDR Score different from SFDC scoring?', answer: 'SFDC scoring (e.g., Einstein Score) predicts close probability. The TDR Index Score measures deal complexity and SE preparation quality — it tells you which deals NEED a technical review, not which deals will close.' },
  { question: 'Does the app modify any SFDC data?', answer: 'No. DealInspect is read-only for SFDC data. Deal data flows from SFDC → Domo dataset → app. All TDR data (sessions, inputs, intel, chat) is written to Snowflake only.' },
  { question: 'How are API keys secured?', answer: 'All external API keys (Snowflake, Sumble, Perplexity, Slack) are stored in Domo Code Engine\'s environment. The React frontend never sees or handles secrets — all calls go through Code Engine proxy functions.' },
  { question: 'What happens if Cortex AI is unavailable?', answer: 'The app degrades gracefully. TDR scoring works without Cortex (it\'s calculated client-side from deal data). Enrichment falls back to cached results. Chat can use Domo AI as a fallback. KB summarization falls back to Domo AI text generation.' },
  { question: 'Can I re-run a TDR on the same deal?', answer: 'Yes. Opening a deal that already has a session creates a new iteration (ITERATION column increments). Previous session data is preserved in history.' },
  { question: 'How much do the AI calls cost?', answer: 'Cortex runs inside your Snowflake account using your existing compute credits. Results are cached in CORTEX_ANALYSIS_RESULTS, so repeated loads cost nothing. Sumble uses a credit-based model. Perplexity uses token-based pricing. Usage is logged in API_USAGE_LOG.' },
  { question: 'What file formats does the Knowledge Base support?', answer: 'The KB supports PDFs uploaded to Domo filesets. The fileset query endpoint extracts text content, which is then summarized by Cortex AI. Non-PDF files in filesets are ignored.' },
  { question: 'Can multiple SEs work on the same deal?', answer: 'Yes. Sessions are not locked to a single user. The CREATED_BY field tracks who created the session, but any user with app access can view and edit inputs.' },
];

/* ── Main export ───────────────────────────────────────────────────────────── */

export function GlossaryReference() {
  return (
    <div className="space-y-6">
      {/* ── Glossary ───────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Key Terms</h4>
        <div className="grid grid-cols-1 gap-px rounded-lg border border-[#2a2540]/40 overflow-hidden">
          {GLOSSARY.map((item, i) => (
            <div
              key={i}
              className="flex gap-4 px-4 py-2.5 bg-[#1B1630]/20 hover:bg-[#1B1630]/40 transition-colors"
            >
              <span className="text-xs font-semibold text-violet-400 shrink-0 w-40 pt-px">
                {item.term}
              </span>
              <span className="text-xs text-slate-300 leading-relaxed">
                {item.definition}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Frequently Asked Questions</h4>
        <Accordion type="multiple" className="space-y-2">
          {FAQ.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border border-[#2a2540]/40 rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-xs font-medium text-slate-200 hover:bg-[#1B1630]/40 [&[data-state=open]]:bg-[#1B1630]/60 text-left">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3 text-xs text-slate-300 leading-relaxed">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}

