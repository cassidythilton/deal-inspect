/**
 * ScoringReference — Deep-dive documentation for the TDR Index Score.
 *
 * Covers Pre-TDR Score, Post-TDR Score, Confidence Score,
 * Win Propensity Score, Deal Priority composite, Priority Bands,
 * Confidence Bands, and Lifecycle Phases.
 *
 * Sprint 25: Documentation Hub
 * Sprints 28–30: Win Propensity, Deal Priority composite
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

/* ── Shared table wrapper ──────────────────────────────────────────────────── */

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

function ScoreBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: color + '20', color, border: `1px solid ${color}40` }}
    >
      {label}
    </span>
  );
}

/* ── Main export ───────────────────────────────────────────────────────────── */

export function ScoringReference() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-200 leading-relaxed">
        The TDR Index Score is a composite metric that quantifies both the <em className="text-violet-300">intrinsic complexity</em> of a deal
        and the <em className="text-violet-300">quality of the SE's assessment</em>. It operates in two phases — Pre-TDR (before the SE starts
        the review) and Post-TDR (after enrichment and inputs are gathered). A separate Confidence Score measures
        how well-informed the assessment is, independent of deal complexity.
      </p>

      <Accordion type="multiple" className="space-y-2">
        {/* ── Pre-TDR Score ────────────────────────────────────────────────── */}
        <AccordionItem value="pre-tdr" className="border border-white/[0.08] rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.03] [&[data-state=open]]:bg-white/[0.04]">
            Pre-TDR Score (0-100) — Deal Complexity & Risk
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-sm text-slate-200 leading-relaxed">
              Calculated automatically from SFDC deal data before the SE touches the TDR. Measures how much
              a deal <em className="text-violet-300">needs</em> a Technical Deal Review based on its inherent characteristics.
            </p>
            <DocTable
              headers={['Factor', 'Weight', 'How It\u2019s Scored']}
              rows={[
                ['ACV Significance', '0-20 pts', '\u2265$250K \u2192 20 | \u2265$100K \u2192 15 | \u2265$50K \u2192 10 | \u2265$25K \u2192 5 | \u2265$10K \u2192 2'],
                ['Stage TDR Value', '0-15 pts', 'Stage 2 (Determine Needs) \u2192 15 | Stage 3 \u2192 12 | Stage 1 \u2192 8 | Stage 4 \u2192 4'],
                ['Cloud Partner Alignment', '0-15 pts', 'Snowflake/Databricks/AWS/GCP/Azure partner \u2192 15 | Co-sell partner \u2192 8 | Other partner \u2192 4'],
                ['Competitive Pressure', '0-10 pts', '\u22652 competitors \u2192 10 | 1 competitor \u2192 5'],
                ['Deal Type Signal', '0-23 pts', 'New Logo base \u2192 10 (+3 competitive, +2 early stage, +8 risk) | Acquisition \u2192 8 | Upsell \u2265$100K \u2192 6'],
                ['Forecast Momentum', '0-10 pts', 'Commit \u2192 10 | Best Case \u2192 7 | Pipeline \u2192 4 | Omit \u2192 2'],
                ['Stage Stall Detection', '0-7 pts', 'Stage 2 >45d \u2192 7 | Stage 3 >60d \u2192 5 | Stage 1 >90d \u2192 4 | Stage 4 >30d \u2192 3'],
              ]}
            />
            <p className="text-[11px] text-slate-400 italic">
              Closed deals always return 0. The theoretical max is 100, but typical high-priority deals score 45-75.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* ── Post-TDR Score ───────────────────────────────────────────────── */}
        <AccordionItem value="post-tdr" className="border border-white/[0.08] rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.03] [&[data-state=open]]:bg-white/[0.04]">
            Post-TDR Score — Enrichment Bonuses
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-sm text-slate-200 leading-relaxed">
              Once the SE begins the TDR, additional scoring components are layered on top of the Pre-TDR base.
              These reward deeper investigation and external intelligence gathering.
            </p>
            <DocTable
              headers={['Component', 'Weight', 'Trigger']}
              rows={[
                ['Pre-TDR Base', 'varies', 'Carried forward from the Pre-TDR calculation above'],
                ['Named Competitor Threat', '0-10 pts', '2+ dangerous competitors \u2192 10 | 1 dangerous \u2192 7 | Named but not dangerous \u2192 3'],
                ['Enrichment Depth', '0-5 pts', 'Sumble \u2192 +2 | Perplexity \u2192 +2 | Both \u2192 +1 bonus'],
                ['TDR Input Completeness', '0-10 pts', '\u226590% steps \u2192 10 | \u226570% \u2192 7 | \u226550% \u2192 5 | \u226520% \u2192 2'],
                ['Risk Awareness', '0-5 pts', '\u22653 risk categories \u2192 5 | 2 \u2192 3 | 1 \u2192 2'],
                ['Fileset Match Signal', '0-5 pts', 'Strong KB match \u2192 5 | Partial \u2192 2'],
              ]}
            />
            <p className="text-[11px] text-slate-400 italic">
              Post-TDR Score = Pre-TDR + all bonuses, capped at 100.
              "Dangerous competitors" are configured in Settings.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* ── Confidence Score ─────────────────────────────────────────────── */}
        <AccordionItem value="confidence" className="border border-white/[0.08] rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.03] [&[data-state=open]]:bg-white/[0.04]">
            Confidence Score (0-100) — Assessment Quality
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-sm text-slate-200 leading-relaxed">
              While the TDR Index measures deal <em className="text-violet-300">complexity</em>, the Confidence Score measures how much work
              the SE has done to <em className="text-violet-300">understand</em> that complexity. A high-complexity deal with low confidence
              means the SE has more investigation to do.
            </p>
            <DocTable
              headers={['Dimension', 'Weight', 'How It\u2019s Measured']}
              rows={[
                ['Required Steps Completed', '0-40 pts', 'Proportional: (completed / total) x 40'],
                ['Optional Steps Completed', '0-10 pts', 'Proportional: (completed / total) x 10'],
                ['External Intelligence', '0-15 pts', 'Sumble \u2192 +6 | Perplexity \u2192 +6 | Both bonus \u2192 +3'],
                ['AI Outputs Generated', '0-15 pts', 'Action Plan \u2192 +8 | TDR Brief \u2192 +7'],
                ['Knowledge Base Match', '0-10 pts', 'Strong match \u2192 10 | Partial \u2192 5'],
                ['Risk Awareness', '0-10 pts', '\u22653 risks identified \u2192 10 | 2 \u2192 7 | 1 \u2192 4'],
              ]}
            />

            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-slate-200">Confidence Bands:</p>
              <div className="flex flex-wrap gap-2">
                <ScoreBadge color="#22c55e" label="Comprehensive \u2265 80" />
                <ScoreBadge color="#3b82f6" label="High \u2265 60" />
                <ScoreBadge color="#a855f7" label="Solid \u2265 40" />
                <ScoreBadge color="#f59e0b" label="Developing \u2265 20" />
                <ScoreBadge color="#ef4444" label="Insufficient < 20" />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── Win Propensity Score ─────────────────────────────────────────── */}
        <AccordionItem value="win-propensity" className="border border-white/[0.08] rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.03] [&[data-state=open]]:bg-white/[0.04]">
            Win Propensity Score (0–100%) — ML Win Probability
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-sm text-slate-200 leading-relaxed">
              A Snowflake ML Classification model predicts the probability that a deal will close (win).
              The score is expressed as 0–100% and comes from the <em className="text-violet-300">DEAL_PREDICTIONS</em> table,
              joined to the main dataset in Domo.
            </p>
            <p className="text-xs font-medium text-slate-200">Propensity Quadrants:</p>
            <div className="flex flex-wrap gap-2">
              <ScoreBadge color="#22c55e" label="HIGH" />
              <ScoreBadge color="#3b82f6" label="MONITOR" />
              <ScoreBadge color="#f59e0b" label="AT_RISK" />
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">
              <strong>SHAP Factors</strong> explain why the model assigned a given score. Each factor has a name,
              value, direction (positive/negative), and magnitude. Up to 5 SHAP factors are shown in the workspace
              and Why TDR pills, with display names aligned to ML factor definitions.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* ── Deal Priority Composite ──────────────────────────────────────── */}
        <AccordionItem value="deal-priority" className="border border-white/[0.08] rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.03] [&[data-state=open]]:bg-white/[0.04]">
            Deal Priority — Composite Score (60% Propensity + 40% TDR)
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-sm text-slate-200 leading-relaxed">
              A composite score combining <em className="text-violet-300">Win Propensity</em> (60%) and <em className="text-violet-300">TDR Score</em> (40%)
              to drive portfolio prioritization. Thresholds: TDR ≥ 50, Win ≥ 40%.
            </p>
            <p className="text-xs font-medium text-slate-200">Deal Quadrants:</p>
            <DocTable
              headers={['Quadrant', 'Criteria', 'Meaning']}
              rows={[
                ['PRIORITIZE', 'High TDR + High Win', 'High complexity and high win probability — top focus'],
                ['FAST_TRACK', 'Low TDR + High Win', 'Lower complexity but strong win signal — move quickly'],
                ['INVESTIGATE', 'High TDR + Low Win', 'Complex deal with lower win probability — needs attention'],
                ['DEPRIORITIZE', 'Low TDR + Low Win', 'Lower complexity and lower win — lower urgency'],
              ]}
            />
          </AccordionContent>
        </AccordionItem>

        {/* ── Priority Bands ───────────────────────────────────────────────── */}
        <AccordionItem value="priority" className="border border-white/[0.08] rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.03] [&[data-state=open]]:bg-white/[0.04]">
            Priority Bands & Lifecycle Phases
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-sm text-slate-200 leading-relaxed">
              The TDR Score maps to a priority label that drives triage decisions. Priority interpretation
              changes based on the TDR lifecycle phase — the same score means different things at different stages.
            </p>

            <p className="text-xs font-medium text-slate-200 mt-2">Priority Thresholds:</p>
            <DocTable
              headers={['Priority', 'Score Range', 'Meaning']}
              rows={[
                ['CRITICAL', '\u2265 50', 'Requires immediate TDR attention — high-value, complex, competitive'],
                ['HIGH', '\u2265 35', 'Should be reviewed this sprint — significant risk or opportunity'],
                ['MEDIUM', '\u2265 25', 'Worth a TDR when bandwidth allows — moderate signals'],
                ['LOW', '< 25', 'Low urgency — renewal, small ACV, or late-stage with minimal risk'],
              ]}
            />

            <p className="text-xs font-medium text-slate-200 mt-4">Lifecycle Phases:</p>
            <DocTable
              headers={['Phase', 'When', 'Contextual Guidance']}
              rows={[
                ['Not Started', 'No session created', 'Score reflects raw deal data only — purely predictive'],
                ['Early', '< 40% steps complete, no enrichment', 'High scores = urgent need to investigate further'],
                ['In Progress', '40%+ steps OR enrichment started', 'Scoring factors are being validated by real data'],
                ['Near Complete', '80%+ steps, enrichments done', 'Score is well-informed — ready for verdict'],
                ['Fully Assessed', 'Action plan generated', 'Score is definitive — use for final prioritization'],
              ]}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
