/**
 * ScoringReference — Deep-dive documentation for the TDR Index Score.
 *
 * Covers Pre-TDR Score, Post-TDR Score, Confidence Score,
 * Priority Bands, Confidence Bands, and Lifecycle Phases.
 *
 * Sprint 25: Documentation Hub
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
      <p className="text-xs text-slate-300 leading-relaxed">
        The TDR Index Score is a composite metric that quantifies both the <em>intrinsic complexity</em> of a deal
        and the <em>quality of the SE's assessment</em>. It operates in two phases — Pre-TDR (before the SE starts
        the review) and Post-TDR (after enrichment and inputs are gathered). A separate Confidence Score measures
        how well-informed the assessment is, independent of deal complexity.
      </p>

      <Accordion type="multiple" className="space-y-2">
        {/* ── Pre-TDR Score ────────────────────────────────────────────────── */}
        <AccordionItem value="pre-tdr" className="border border-[#2a2540]/40 rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium text-slate-200 hover:bg-[#1B1630]/40 [&[data-state=open]]:bg-[#1B1630]/60">
            Pre-TDR Score (0–100) — Deal Complexity & Risk
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              Calculated automatically from SFDC deal data before the SE touches the TDR. Measures how much
              a deal <em>needs</em> a Technical Deal Review based on its inherent characteristics.
            </p>
            <DocTable
              headers={['Factor', 'Weight', 'How It\u2019s Scored']}
              rows={[
                ['ACV Significance', '0–20 pts', '≥$250K → 20 · ≥$100K → 15 · ≥$50K → 10 · ≥$25K → 5 · ≥$10K → 2'],
                ['Stage TDR Value', '0–15 pts', 'Stage 2 (Determine Needs) → 15 · Stage 3 → 12 · Stage 1 → 8 · Stage 4 → 4'],
                ['Cloud Partner Alignment', '0–15 pts', 'Snowflake/Databricks/AWS/GCP/Azure partner → 15 · Co-sell partner → 8 · Other partner → 4'],
                ['Competitive Pressure', '0–10 pts', '≥2 competitors → 10 · 1 competitor → 5'],
                ['Deal Type Signal', '0–23 pts', 'New Logo base → 10 (+3 competitive, +2 early stage, +8 risk) · Acquisition → 8 · Upsell ≥$100K → 6'],
                ['Forecast Momentum', '0–10 pts', 'Commit → 10 · Best Case → 7 · Pipeline → 4 · Omit → 2'],
                ['Stage Stall Detection', '0–7 pts', 'Stage 2 >45d → 7 · Stage 3 >60d → 5 · Stage 1 >90d → 4 · Stage 4 >30d → 3'],
              ]}
            />
            <p className="text-[10px] text-slate-400 italic">
              Closed deals always return 0. The theoretical max is 100, but typical high-priority deals score 45–75.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* ── Post-TDR Score ───────────────────────────────────────────────── */}
        <AccordionItem value="post-tdr" className="border border-[#2a2540]/40 rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium text-slate-200 hover:bg-[#1B1630]/40 [&[data-state=open]]:bg-[#1B1630]/60">
            Post-TDR Score — Enrichment Bonuses
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              Once the SE begins the TDR, additional scoring components are layered on top of the Pre-TDR base.
              These reward deeper investigation and external intelligence gathering.
            </p>
            <DocTable
              headers={['Component', 'Weight', 'Trigger']}
              rows={[
                ['Pre-TDR Base', 'varies', 'Carried forward from the Pre-TDR calculation above'],
                ['Named Competitor Threat', '0–10 pts', '2+ dangerous competitors → 10 · 1 dangerous → 7 · Named but not dangerous → 3'],
                ['Enrichment Depth', '0–5 pts', 'Sumble → +2 · Perplexity → +2 · Both → +1 bonus'],
                ['TDR Input Completeness', '0–10 pts', '≥90% steps → 10 · ≥70% → 7 · ≥50% → 5 · ≥20% → 2'],
                ['Risk Awareness', '0–5 pts', '≥3 risk categories → 5 · 2 → 3 · 1 → 2'],
                ['Fileset Match Signal', '0–5 pts', 'Strong KB match → 5 · Partial → 2'],
              ]}
            />
            <p className="text-[10px] text-slate-400 italic">
              Post-TDR Score = Pre-TDR + all bonuses, capped at 100.
              "Dangerous competitors" are configured in Settings → Dangerous Competitors.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* ── Confidence Score ─────────────────────────────────────────────── */}
        <AccordionItem value="confidence" className="border border-[#2a2540]/40 rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium text-slate-200 hover:bg-[#1B1630]/40 [&[data-state=open]]:bg-[#1B1630]/60">
            Confidence Score (0–100) — Assessment Quality
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              While the TDR Index measures deal <em>complexity</em>, the Confidence Score measures how much work
              the SE has done to <em>understand</em> that complexity. A high-complexity deal with low confidence
              means the SE has more investigation to do.
            </p>
            <DocTable
              headers={['Dimension', 'Weight', 'How It\u2019s Measured']}
              rows={[
                ['Required Steps Completed', '0–40 pts', 'Proportional: (completed / total) × 40'],
                ['Optional Steps Completed', '0–10 pts', 'Proportional: (completed / total) × 10'],
                ['External Intelligence', '0–15 pts', 'Sumble → +6 · Perplexity → +6 · Both bonus → +3'],
                ['AI Outputs Generated', '0–15 pts', 'Action Plan → +8 · TDR Brief → +7'],
                ['Knowledge Base Match', '0–10 pts', 'Strong match → 10 · Partial → 5'],
                ['Risk Awareness', '0–10 pts', '≥3 risks identified → 10 · 2 → 7 · 1 → 4'],
              ]}
            />

            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-slate-300">Confidence Bands:</p>
              <div className="flex flex-wrap gap-2">
                <ScoreBadge color="#22c55e" label="Comprehensive ≥ 80" />
                <ScoreBadge color="#3b82f6" label="High ≥ 60" />
                <ScoreBadge color="#a855f7" label="Solid ≥ 40" />
                <ScoreBadge color="#f59e0b" label="Developing ≥ 20" />
                <ScoreBadge color="#ef4444" label="Insufficient < 20" />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── Priority Bands ───────────────────────────────────────────────── */}
        <AccordionItem value="priority" className="border border-[#2a2540]/40 rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium text-slate-200 hover:bg-[#1B1630]/40 [&[data-state=open]]:bg-[#1B1630]/60">
            Priority Bands & Lifecycle Phases
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              The TDR Score maps to a priority label that drives triage decisions. Priority interpretation
              changes based on the TDR lifecycle phase — the same score means different things at different stages.
            </p>

            <p className="text-xs font-medium text-slate-300 mt-2">Priority Thresholds:</p>
            <DocTable
              headers={['Priority', 'Score Range', 'Meaning']}
              rows={[
                ['CRITICAL', '≥ 50', 'Requires immediate TDR attention — high-value, complex, competitive'],
                ['HIGH', '≥ 35', 'Should be reviewed this sprint — significant risk or opportunity'],
                ['MEDIUM', '≥ 25', 'Worth a TDR when bandwidth allows — moderate signals'],
                ['LOW', '< 25', 'Low urgency — renewal, small ACV, or late-stage with minimal risk'],
              ]}
            />

            <p className="text-xs font-medium text-slate-300 mt-4">Lifecycle Phases:</p>
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

