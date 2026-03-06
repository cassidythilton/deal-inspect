/**
 * AIModelsReference — Documents which AI models power which features.
 *
 * Sprint 25: Documentation Hub
 */

import { SnowflakeLogo, CortexLogo } from '@/components/CortexBranding';
import { PerplexityIcon } from '@/components/icons/PerplexityIcon';
import { DomoIcon } from '@/components/icons/DomoIcon';

/* ── Model card component ──────────────────────────────────────────────────── */

interface ModelInfo {
  model: string;
  provider: string;
  costTier: 'low' | 'medium' | 'high';
  usedFor: string[];
}

const COST_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};

function ModelCard({ model, provider, costTier, usedFor }: ModelInfo) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white font-mono">{model}</p>
          <p className="text-[10px] text-slate-400">{provider}</p>
        </div>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: COST_COLORS[costTier] + '20',
            color: COST_COLORS[costTier],
            border: `1px solid ${COST_COLORS[costTier]}40`,
          }}
        >
          {costTier} cost
        </span>
      </div>
      <ul className="space-y-1">
        {usedFor.map((use, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-300">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400/60" />
            {use}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Main export ───────────────────────────────────────────────────────────── */

export function AIModelsReference() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-200 leading-relaxed">
        DealInspect uses multiple AI models across three providers. Model selection is optimized
        for each task — frontier models for generation and reasoning, smaller models for classification
        and extraction, specialized models for embeddings.
      </p>

      {/* ── Cortex Models ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <SnowflakeLogo className="h-3.5 w-3.5 shrink-0" />
          <CortexLogo className="h-3.5 w-3.5 shrink-0" />
          Snowflake Cortex — Server-side via Code Engine
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ModelCard
            model="claude-4-sonnet"
            provider="Anthropic via Snowflake Cortex"
            costTier="medium"
            usedFor={[
              'TDR Brief generation (primary)',
              'Action Plan synthesis (primary)',
              'TDR Chat default model',
              'Structured TDR extraction',
              'Portfolio insights generation',
              'NLQ \u2192 SQL translation',
            ]}
          />
          <ModelCard
            model="claude-4-opus"
            provider="Anthropic via Snowflake Cortex"
            costTier="high"
            usedFor={[
              'TDR Chat (user-selectable)',
              'Deep reasoning for complex questions',
              'Most capable model available',
            ]}
          />
          <ModelCard
            model="openai-gpt-4.1"
            provider="OpenAI via Snowflake Cortex"
            costTier="high"
            usedFor={[
              'TDR Chat (user-selectable)',
              'Strong general-purpose reasoning',
              'Alternative to Claude for comparison',
            ]}
          />
          <ModelCard
            model="openai-o4-mini"
            provider="OpenAI via Snowflake Cortex"
            costTier="medium"
            usedFor={[
              'TDR Chat (user-selectable)',
              'Reasoning-optimized, efficient',
              'Good for structured analysis tasks',
            ]}
          />
          <ModelCard
            model="llama3.1-8b"
            provider="Meta via Snowflake Cortex"
            costTier="low"
            usedFor={[
              'AI_CLASSIFY — finding categorization',
              'AI_EXTRACT — entity extraction',
              'AI_SENTIMENT — sentiment analysis',
              'Fast, cheap — ideal for classification tasks',
            ]}
          />
          <ModelCard
            model="llama3.1-70b"
            provider="Meta via Snowflake Cortex"
            costTier="medium"
            usedFor={[
              'AI_SUMMARIZE_AGG — intel history summarization',
              'AI_AGG — aggregated analysis',
              'Balanced quality and cost for summarization',
            ]}
          />
          <ModelCard
            model="snowflake-arctic-embed-l-v2.0"
            provider="Snowflake via Cortex"
            costTier="low"
            usedFor={[
              'AI_EMBED — generate semantic vectors',
              'Similar deal matching (cosine similarity)',
              'High-quality 1024-dim embeddings',
            ]}
          />
          <ModelCard
            model="e5-base-v2"
            provider="Microsoft via Snowflake Cortex"
            costTier="low"
            usedFor={[
              'Secondary embedding model',
              'Used for general-purpose text similarity',
            ]}
          />
        </div>
      </div>

      {/* ── Perplexity Models ──────────────────────────────────────────────── */}
      <div className="space-y-2 mt-6">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <PerplexityIcon className="h-3.5 w-3.5 shrink-0" />
          Perplexity — Server-side via Code Engine
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ModelCard
            model="sonar"
            provider="Perplexity API"
            costTier="low"
            usedFor={[
              'TDR Chat — web-grounded answers',
              'Quick competitive research queries',
              'Fast search with citations',
            ]}
          />
          <ModelCard
            model="sonar-pro"
            provider="Perplexity API"
            costTier="medium"
            usedFor={[
              'Account research enrichment',
              'Deep competitive landscape analysis',
              'Multi-step research with comprehensive citations',
            ]}
          />
        </div>
      </div>

      {/* ── Domo AI ────────────────────────────────────────────────────────── */}
      <div className="space-y-2 mt-6">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <DomoIcon className="h-3.5 w-3.5 shrink-0 text-slate-300" />
          Domo AI — Client-side (no Code Engine)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ModelCard
            model="domo-default"
            provider="Domo Native AI"
            costTier="low"
            usedFor={[
              'TDR Chat — quick answers without Cortex',
              'Fallback summarization when Cortex is unavailable',
              'No API key required — built into Domo platform',
            ]}
          />
        </div>
      </div>

      {/* ── ML & Enhancement Models (Sprint 28–30) ────────────────────────── */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <SnowflakeLogo className="h-5 w-5 shrink-0" />
          <h3 className="text-base font-semibold text-white">ML & Enhancement Models</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModelCard
            model="SNOWFLAKE.ML.CLASSIFICATION"
            provider="Snowflake ML (in-database)"
            costTier="low"
            usedFor={[
              'Propensity-to-close prediction — classifies deals as WIN / LOSS',
              'AUC 0.997, F1 97.7% on historical data',
              'Features: STAGE_NUMBER, DEAL_AGE_DAYS, ACV, NUM_COMPETITORS, FORECAST_CATEGORY + 8 more',
              'Nightly scoring (2 AM UTC), weekly retraining (Sun 3 AM UTC)',
              'Outputs stored in DEAL_PREDICTIONS table with 5 SHAP factors per deal',
            ]}
          />
          <ModelCard
            model="Domo AI (text/chat)"
            provider="Domo Platform — /domo/ai/v1/text/chat"
            costTier="low"
            usedFor={[
              'TDR field enhancement — expands SE input with 8 context layers',
              'Tech extraction — parses Perplexity narrative signals into product names',
              'TDR candidate recommendations — 17-factor scoring prompt',
              'Temperature 0.1–0.3, JSON output parsing',
            ]}
          />
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 space-y-2">
          <p className="text-sm font-medium text-white">SHAP Factor Display Names</p>
          <p className="text-[10px] text-slate-400 mb-1">ML model features mapped to human-readable names in tooltips and Intelligence Panel</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm text-slate-300">
            {[
              ['STAGE_NUMBER', 'Stage'], ['DEAL_AGE_DAYS', 'Deal Age'], ['STAGE_AGE_DAYS', 'Stage Age'],
              ['ACV', 'Deal Size'], ['NUM_COMPETITORS', 'Competition'], ['HAS_PARTNER', 'Partner Involved'],
              ['DEAL_TYPE', 'Deal Type'], ['FORECAST_CATEGORY', 'Forecast Category'], ['ACCOUNT_WIN_RATE', 'Account History'],
              ['QUARTER_END_PROXIMITY', 'Quarter Timing'], ['SALES_SEGMENT', 'Segment'], ['SALES_VERTICAL', 'Vertical'],
              ['SALES_PROCESS', 'Sales Process'],
            ].map(([raw, display]) => (
              <div key={raw} className="flex gap-2">
                <span className="text-slate-500 font-mono text-[10px] w-36 shrink-0">{raw}</span>
                <span>{display}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Model Selection Philosophy ─────────────────────────────────────── */}
      <div className="mt-6 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 space-y-2">
        <p className="text-sm font-medium text-white">Model Selection Philosophy</p>
        <ul className="space-y-1 text-sm text-slate-300">
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400/60" />
            <span><strong className="text-slate-200">Generation tasks</strong> (briefs, action plans, chat): Use frontier models (Claude 4 Sonnet/Opus, GPT-4.1) for best quality reasoning.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400/60" />
            <span><strong className="text-slate-200">Classification & extraction</strong>: Use smaller models (llama3.1-8b) for speed and cost. These tasks don't need deep reasoning.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400/60" />
            <span><strong className="text-slate-200">Summarization</strong>: Use mid-tier models (llama3.1-70b) for balanced quality.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400/60" />
            <span><strong className="text-slate-200">Embeddings</strong>: Use purpose-built embedding models (Arctic, e5-base) — not LLMs.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400/60" />
            <span><strong className="text-slate-200">All results cached</strong>: CORTEX_ANALYSIS_RESULTS stores outputs so subsequent loads cost zero tokens.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
