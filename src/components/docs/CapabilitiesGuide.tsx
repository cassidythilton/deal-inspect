/**
 * CapabilitiesGuide — Documents every feature surface of the app.
 *
 * Sprint 25: Documentation Hub
 */

import {
  LayoutDashboard,
  FileSearch,
  MessageSquare,
  BarChart3,
  FileText,
  History,
  Settings,
  Brain,
  Target,
  Zap,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

/* ── Feature card ──────────────────────────────────────────────────────────── */

interface FeatureItem {
  name: string;
  description: string;
}

function FeatureList({ items }: { items: FeatureItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400/70" />
          <div>
            <span className="font-medium text-slate-200">{item.name}</span>
            <span className="text-slate-400"> — {item.description}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CapabilityCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={title} className="border border-white/[0.08] rounded-lg overflow-hidden">
      <AccordionTrigger className="px-4 py-3 hover:bg-white/[0.03] [&[data-state=open]]:bg-white/[0.04]">
        <div className="flex items-center gap-3 text-left">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/15 border border-violet-500/25">
            <Icon className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{title}</p>
            <p className="text-[10px] text-slate-400">{subtitle}</p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

/* ── Main export ───────────────────────────────────────────────────────────── */

export function CapabilitiesGuide() {
  return (
    <Accordion type="multiple" className="space-y-2">
      <CapabilityCard
        icon={LayoutDashboard}
        title="Command Center"
        subtitle="Deal grid, hero metrics, AI recommendations"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-200 leading-relaxed">
            The entry point for the app. Displays all active deals in an interactive AG Grid table
            with TDR scoring, priority badges, and one-click navigation to the TDR Workspace.
          </p>
          <FeatureList items={[
            { name: 'AG Grid Deal Table', description: 'Sortable, filterable grid with custom cell renderers for TDR Score, ACV, Stage, and Priority.' },
            { name: 'Deal Priority Column', description: 'Composite score (60% propensity + 40% TDR) with color-coded quadrant badges for prioritization.' },
            { name: 'Stage Column', description: 'Compressed to number-only display for compact table layout.' },
            { name: 'Hero Metrics', description: 'Five stat cards including Active TDRs, Average TDR Score, Critical Deals, and Win Propensity — updated from Snowflake session data.' },
            { name: 'Win Propensity Stat Card', description: 'Fifth stat card showing portfolio-level win probability from ML model predictions.' },
            { name: 'TDR Score Rendering', description: 'Color-coded score badge with priority label (CRITICAL/HIGH/MEDIUM/LOW) and critical factor tags.' },
            { name: 'Smart Search', description: 'Full-text search across account name, opportunity name, deal code, and owner.' },
            { name: 'Manager Filter', description: 'Filter deals by SE manager hierarchy (configurable in Settings).' },
            { name: 'Quarter Filter', description: 'Optional default-to-current-quarter filtering for close dates.' },
          ]} />
        </div>
      </CapabilityCard>

      <CapabilityCard
        icon={FileSearch}
        title="TDR Workspace"
        subtitle="5-step guided review with auto-save"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-200 leading-relaxed">
            The core of the app. A three-panel layout for conducting Technical Deal Reviews:
            Steps (left), Inputs (center), Intelligence + Chat (right). Sprint 31 consolidated
            the framework from 9 steps to 5 streamlined steps.
          </p>
          <p className="text-xs font-medium text-slate-200">Required Steps (4):</p>
          <FeatureList items={[
            { name: 'Deal Context', description: 'Strategic value, timing, business decision, and why this deal matters now.' },
            { name: 'Technical Architecture', description: 'Current state \u2192 Target state, Domo layers (multi-select), and composable role.' },
            { name: 'Risk & Verdict', description: 'Top risks, key assumptions, and the final go/no-go verdict.' },
            { name: 'AI & ML Opportunity Assessment', description: 'Required 5-field step with value continuum framework, AI level, problem/value, signals, and data readiness.' },
          ]} />
          <p className="text-xs font-medium text-slate-200 mt-2">Optional Step (1):</p>
          <FeatureList items={[
            { name: 'Adoption & Success', description: 'User adoption plan, success metrics, and rollout timeline.' },
          ]} />
          <p className="text-xs font-medium text-slate-200 mt-2">Sprint 31 UX Enhancements:</p>
          <FeatureList items={[
            { name: 'Pill/Tag Inputs', description: 'Multi-select pills for Domo Layers, AI Signals, and AI Data Readiness.' },
            { name: 'Dynamic AI Hints', description: 'AI problem/value field hints change based on selected AI level; hidden when "No AI Opportunity Identified" is selected.' },
            { name: 'Semi-Auto Completion', description: 'Steps auto-mark complete when required fields have substantive content via isStepAutoComplete().' },
            { name: 'TDR Versioning', description: '"Start New Iteration" button, previousSessions tracking, and iteration count display.' },
            { name: 'AI Enhancement Diff View', description: 'Word-level inline diff — additions in emerald green, removals in red strikethrough. Falls back to plain text if no changes.' },
            { name: 'Context-Source Badges', description: 'Color-coded pills (slate/blue/violet/amber/cyan/emerald) show which context layer contributed to AI enhancement.' },
            { name: 'Gap Indicators', description: 'Visual indicators on TDR inputs showing which fields need attention or completion.' },
            { name: 'Icon-Only Why TDR Pills', description: 'Compact icon-only pills with rich tooltips explaining TDR rationale.' },
            { name: 'resize: vertical', description: 'All textareas support vertical resizing for better content editing.' },
          ]} />
          <p className="text-[11px] text-slate-400 mt-2 italic">
            All inputs auto-save to Snowflake via Code Engine. Step completion status persists across sessions.
            PDF readout supports both new 5-step and legacy 9-step session structures.
          </p>
        </div>
      </CapabilityCard>

      <CapabilityCard
        icon={Brain}
        title="Intelligence Panel"
        subtitle="4-zone layout: Score, Enrichment, AI, Knowledge Base"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-200 leading-relaxed">
            The right panel of the TDR Workspace. Organized into four logical zones that provide
            contextual intelligence as the SE works through the review.
          </p>
          <FeatureList items={[
            { name: 'Deal Priority Hero', description: 'Hero section displaying composite Deal Priority score with quadrant context.' },
            { name: 'SHAP "Why this score?"', description: 'Expandable section explaining model predictions via SHAP feature importance.' },
            { name: 'Unified Readout Workflow', description: '"Prepare Readout — Complete in Order" with 4 numbered steps: Enrich → Research → Action Plan → TDR Brief. Each has Run button, status indicator (✓ when done), and View link. Action Plan and Brief are standalone dialogs.' },
            { name: 'Account Firmographics Display', description: 'Firmographic data (revenue, employees, industry) surfaced from enrichment.' },
            { name: 'Perplexity Tech Pill Extraction', description: 'Domo AI extracts technology signals from Perplexity research into pill badges.' },
            { name: 'Zone 1: TDR Score & Priority', description: 'Live-updating Pre-TDR or Post-TDR score with breakdown chart, priority band, confidence meter, and lifecycle phase context.' },
            { name: 'Zone 2: Account Enrichment', description: 'One-click "Enrich All" button triggers 4 Sumble endpoints (Tech Stack, Org, Jobs, People) + Perplexity research in parallel. Results cached in Snowflake.' },
            { name: 'Zone 3: AI Artifacts', description: 'Action Plan (7-section synthesis), TDR Brief (AI-generated narrative), Structured Extract (competitors, risks, use cases), Classified Findings, Entity Extraction.' },
            { name: 'Zone 4: Knowledge Base', description: 'Fileset search results with Cortex-powered summarization. Shows battle cards, playbooks, and reference docs relevant to the deal.' },
          ]} />
        </div>
      </CapabilityCard>

      <CapabilityCard
        icon={MessageSquare}
        title="TDR Inline Chat"
        subtitle="Multi-provider AI with deal context"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-200 leading-relaxed">
            A conversational AI experience embedded in the right panel of the TDR Workspace.
            Context-aware: assembles system prompts from deal info, TDR inputs, cached intel,
            and the current TDR step.
          </p>
          <FeatureList items={[
            { name: 'Snowflake Cortex', description: 'Claude 4 Sonnet, Claude 4 Opus, GPT-4.1, o4-mini — server-side via Code Engine \u2192 AI_COMPLETE.' },
            { name: 'Perplexity', description: 'Sonar and Sonar Pro — web-grounded answers with citations. Great for competitive research.' },
            { name: 'Domo AI', description: 'Domo\'s native AI model — no Code Engine needed, runs client-side.' },
            { name: 'Knowledge Base Toggle', description: 'When enabled, injects relevant fileset context into the system prompt for KB-grounded answers.' },
            { name: 'Message Persistence', description: 'All messages saved to TDR_CHAT_MESSAGES in Snowflake with provider, model, token counts.' },
          ]} />
        </div>
      </CapabilityCard>

      <CapabilityCard
        icon={Zap}
        title="Action Plan Synthesis"
        subtitle="7-section strategic plan from all data sources"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-200 leading-relaxed">
            The capstone AI feature. Generates a comprehensive action plan by synthesizing every
            piece of data gathered during the TDR — SE inputs, Sumble enrichment, Perplexity research,
            Knowledge Base matches, Cortex AI analysis, and chat history.
          </p>
          <p className="text-xs font-medium text-slate-200">Action Plan Sections:</p>
          <FeatureList items={[
            { name: '1. Executive Summary', description: 'Deal snapshot and key takeaway in 2-3 sentences.' },
            { name: '2. Competitive Strategy', description: 'Per-competitor positioning based on Sumble tech stack and Perplexity research.' },
            { name: '3. Partner Alignment Actions', description: 'Snowflake/cloud partner co-sell strategy with specific next steps.' },
            { name: '4. Technical Next Steps', description: 'Prioritized list of technical validations, demos, and POC items.' },
            { name: '5. Stakeholder Engagement', description: 'Key people to engage, based on Sumble people data and org signals.' },
            { name: '6. Risk Mitigation', description: 'Per-risk mitigation strategies tied to classified findings.' },
            { name: '7. Timeline & Urgency', description: 'Week-by-week action plan aligned to the close date.' },
          ]} />
        </div>
      </CapabilityCard>

      <CapabilityCard
        icon={FileText}
        title="TDR Readout & Slack Distribution"
        subtitle="Executive PDF + one-click Slack sharing"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-200 leading-relaxed">
            Generates a branded, multi-page PDF readout that captures the entire TDR lifecycle.
            The PDF can be downloaded directly or distributed to Slack channels with an AI-generated
            summary message.
          </p>
          <FeatureList items={[
            { name: 'Cover Page', description: 'Account name, ACV, stage, status, iteration number, reviewer.' },
            { name: 'Executive Summary', description: 'AI-generated narrative from the TDR Brief (Cortex AI_COMPLETE).' },
            { name: 'Prescribed Action Plan', description: 'The full 7-section action plan with quick-action cards for SE/AE.' },
            { name: 'Deal Context & SE Inputs', description: 'All TDR step inputs organized by section with human-readable labels.' },
            { name: 'Account Intelligence', description: 'Sumble tech stack, org profile, hiring signals, key people. Perplexity research with citations.' },
            { name: 'TDR Score & Factors', description: 'Visual score breakdown showing which factors fired and why.' },
            { name: 'Slack Distribution', description: 'Channel picker, editable AI summary, PDF attached. Persisted to TDR_DISTRIBUTIONS.' },
            { name: 'Slack Share Caching', description: 'Session-level cache for readout payload and PDF to avoid redundant regeneration.' },
          ]} />
        </div>
      </CapabilityCard>

      <CapabilityCard
        icon={BarChart3}
        title="Portfolio Analytics + NLQ"
        subtitle="Charts, stats, and natural language queries"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-200 leading-relaxed">
            A portfolio-level view of all Technical Deal Reviews. Powered by the <code className="text-violet-300 bg-violet-500/15 px-1 rounded">V_TDR_ANALYTICS</code> view
            in Snowflake, which flattens structured extractions from Cortex AI into queryable columns.
          </p>
          <FeatureList items={[
            { name: 'NLQ Hero Bar', description: '"Ask Your TDR Data" — type a natural language question, Cortex generates SQL, executes it, returns a table + narrative answer.' },
            { name: 'Win Propensity Distribution', description: 'Chart showing distribution of ML-predicted win probability across the portfolio.' },
            { name: 'Deal Positioning Scatter Plot', description: 'TDR complexity vs Win probability in 4 quadrants for strategic deal placement.' },
            { name: 'Competitor Distribution', description: 'Which competitors appear most across the portfolio.' },
            { name: 'Platform Distribution', description: 'Cloud platforms mentioned in TDR data (Snowflake, AWS, Azure, etc.).' },
            { name: 'Entry Layer Analysis', description: 'How Domo is positioned across deals (BI, ETL, Apps, etc.).' },
            { name: 'Risk Category Breakdown', description: 'Most common risk types identified by Cortex AI classification.' },
            { name: 'Verdict Distribution', description: 'Proceed / Caution / Pause / Not Ready proportions.' },
            { name: 'Use Case Analysis', description: 'Most common Domo use cases across the portfolio.' },
          ]} />
        </div>
      </CapabilityCard>

      <CapabilityCard
        icon={Target}
        title="Similar Deals"
        subtitle="Semantic similarity via Cortex AI_EMBED"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-200 leading-relaxed">
            Finds semantically similar deals in the portfolio using Snowflake Cortex embeddings.
            Embeds deal context (account, industry, tech stack, competitive landscape) and computes
            cosine similarity to surface analogous deals for reference.
          </p>
          <FeatureList items={[
            { name: 'Embedding Model', description: 'snowflake-arctic-embed-l-v2.0 for high-quality semantic vectors.' },
            { name: 'Similarity Score', description: 'Cosine similarity from 0-1, rendered as a percentage match.' },
            { name: 'Cross-Reference', description: 'Click similar deals to view their TDR sessions and learn from past reviews.' },
          ]} />
        </div>
      </CapabilityCard>

      <CapabilityCard
        icon={History}
        title="History & Settings"
        subtitle="Session management and app configuration"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-200 leading-relaxed">
            The History page lists all TDR sessions with status, date, and quick navigation.
            The Settings page configures app-level preferences and integrations.
          </p>
          <FeatureList items={[
            { name: 'Session History', description: 'Browse all TDR sessions with account name, stage, status, and date. Resume or view completed TDRs.' },
            { name: 'Manager Filter Config', description: 'Define which SE managers to filter by in Command Center.' },
            { name: 'TDR Eligibility', description: 'Set minimum ACV threshold for TDR candidacy.' },
            { name: 'Dangerous Competitors', description: 'Configure competitor names that trigger elevated Post-TDR scoring.' },
            { name: 'Knowledge Base Filesets', description: 'Discover and configure Domo filesets for the Knowledge Base (battle cards, playbooks).' },
            { name: 'Feature Toggles', description: 'Enable/disable AI Recommendations and Snowflake Persistence.' },
            { name: 'API Health Check', description: 'Test connectivity to Sumble, Perplexity, and Code Engine with live ping results.' },
          ]} />
        </div>
      </CapabilityCard>
    </Accordion>
  );
}
