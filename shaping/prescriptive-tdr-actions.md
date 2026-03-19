---
shaping: true
status: draft
appetite: medium (3–5 days)
---

# Prescriptive TDR Actions — "So What?" Sprint

## Source

> "before proceeding to the mlops related work in sprints 32c-e i want to pause and address something that is massively important before we roll this out to a broader user base: PRESCRIPTIVE ACTIONS FOR USERS/TDR PARTICIPANTS."

> "when a tdr is completed, the user should have a very clear 'so what' or action path in terms of what needs to be done to 1-execute a successful and proper technical/architectural strategy and 2-win the deal."

> "the section at right (two screenshot examples provided) is busy and can be overwhelming. all three scores are needed but a-the level of detail across the scores may hinder the users ability to affirm a clear plan of action (how important is each score.. should they be grouped together? simplified organization? etc.?) b-may still be difficult for a naive user to understand the differences of each metric."

> "The prescriptive action or 'so what' should be very clear and concise e.g. first section in the pdf and very obvious in the UI of the app."

---

## Problem

The Intelligence panel currently **leads with metrics and defers action**. A user opening a deal sees a Deal Priority number (83), a TDR Score (63), and a Win Propensity percentage (97%) — three distinct scores with three distinct visual treatments, three expandable detail sections, and three separate mental models. For the SE who built the system, this hierarchy is natural. For a naive user — an SE seeing the app for the first time during team rollout — it's a wall of numbers without a clear directive.

The **action plan exists** but it's buried. It lives behind a "Run" button in the "Prepare Readout" workflow (step 3 of 4), rendered in a dialog. A user must explicitly generate it, wait for Cortex AI, then read it in a modal. Meanwhile, the PDF readout gets it right: the "Prescribed Action Plan" with SE/AE Quick Actions is section 2, front and center. **The UI and PDF have opposite information hierarchies** — the PDF leads with "what to do," the UI leads with "what the numbers are."

The three-score layout compounds the problem. Deal Priority, TDR Score, and Win Propensity are **conceptually nested** (Deal Priority = f(TDR Score, Win Propensity)), but they're presented as three peer-level sections with equal visual weight. A naive user doesn't know which score matters most, whether they conflict, or what the relationship between them is. The prescriptive complexity drivers (bullets under Deal Priority) help but they explain *why the number is what it is* — not *what to do about it*. The score component bars, SHAP factors, and confidence breakdowns add depth for power users but obscure the signal for everyone else.

**The core tension:** the Intelligence panel is optimized for *understanding the deal* when it should be optimized for *acting on the deal*. Metrics should serve the action, not precede it.

---

## Requirements

### R0: Surface a clear, prescriptive "What to Do" directive as the first thing users see in the Intelligence panel

- R0.1: The directive must be visible without scrolling, clicking, or generating anything — it appears automatically when sufficient TDR data exists
- R0.2: The directive must answer two questions: (1) What is the technical/architectural strategy? (2) What actions win this deal?
- R0.3: The directive must be role-specific where possible (SE actions vs AE actions)

### R1: Simplify the three-score presentation so a naive user immediately grasps the deal's position

- R1.1: Make the parent-child relationship between Deal Priority, TDR Score, and Win Propensity visually obvious
- R1.2: Reduce the default visual footprint of score detail (expandable depth, not inline depth)
- R1.3: Retain all existing detail for power users — nothing is removed, only reorganized

### R2: The prescriptive action must be generated automatically, not require manual trigger

- R2.1: When a TDR reaches sufficient completion (e.g., ≥3 required steps done), the action brief should auto-generate
- R2.2: Users can regenerate/refresh the action brief at any time
- R2.3: The action brief leverages all available context: TDR inputs, enrichment data, Gong transcripts, KB matches, ML predictions

### R3: The UI and PDF must share the same information hierarchy

- R3.1: The PDF already leads with Executive Summary → Prescribed Action Plan. The UI should mirror this flow.
- R3.2: The same action content should appear in both surfaces (not two different generation paths)

### R4: The solution must work for deals at every stage of TDR completion

- R4.1: Pre-TDR (no inputs): show quadrant + score-derived guidance only (already exists)
- R4.2: In-progress TDR: show auto-generated brief based on available inputs, with "incomplete" indicator
- R4.3: Complete TDR: show full prescriptive action brief with role-specific next steps

---

## Solution Shape [A: Action-First Intelligence Panel]

### A1: Action Brief — the new hero section

| Part | Mechanism |
|------|-----------|
| **A1.1** | **Auto-generated Action Brief.** When `confidence.total >= 40` (roughly: 3+ required steps complete), automatically call the existing `generateActionPlan` Code Engine function (or a lighter variant) and cache the result in component state. The brief is a 3–5 sentence synthesis: one sentence on the deal's position (quadrant + priority), one on the technical strategy, one on competitive/partner dynamics (if applicable), and 1–2 on specific next steps. Displayed in `TDRIntelligence.tsx` as the **first section** after the deal header, above all scores. |
| **A1.2** | **SE / AE Action Cards.** Below the brief text, two compact cards: "SE Next Steps" and "AE Next Steps." Each contains 2–4 bullet-pointed actions extracted from the brief (reuse `extractQuickActions` logic from `TDRReadoutDocument.tsx`). If only SE actions are identifiable, show one card. Visual: colored left border (violet for SE, blue for AE), compact typography. |
| **A1.3** | **Completion-aware states.** Three states: (a) *Pre-TDR* — no brief, fall through to the existing quadrant guidance under Deal Priority; (b) *In-progress* — brief generated from partial inputs, shown with an amber "Partial — complete more steps for a comprehensive plan" indicator; (c) *Complete* — full brief with green "Complete" badge. State derived from `lifecyclePhase` and `confidence.total`. |
| **A1.4** | **Regenerate control.** Small "Refresh" button in the Action Brief header. Clicking re-calls the Code Engine function with the latest inputs. Timestamp shows when the brief was last generated. |
| **A1.5** | **Cache and persist.** Store the generated action brief in `CORTEX_ANALYSIS_RESULTS` (existing table, `analysis_type = 'tdr_action_brief'`). On re-entry, load the cached brief immediately. Regenerate only overwrites after success. |

### A2: Unified Score Cluster — collapsing three scores into one visual unit

| Part | Mechanism |
|------|-----------|
| **A2.1** | **Score Cluster layout.** Replace the current three stacked score sections (Deal Priority → TDR Score → Win Propensity) with a single compact "Deal Position" cluster. The cluster shows Deal Priority as the hero number (already the case), with TDR Score and Win Propensity as two smaller contributing metrics on the same row, visually subordinate. The parent-child relationship is explicit: `Priority 83 = TDR 63 × 40% + Win 97% × 60%`. |
| **A2.2** | **Collapsed detail by default.** The complexity drivers (bullets), SHAP factors ("Why this score?"), and Assessment Confidence are collapsed by default into a single expandable "Score Detail" accordion. Power users click to expand; naive users see only the cluster and the Action Brief above it. |
| **A2.3** | **Quadrant color as the unifying visual.** The entire Score Cluster section uses the quadrant color (purple for Prioritize, green for Fast Track, amber for Investigate, slate for Deprioritize) as a left-border accent. This creates instant pattern recognition: purple = this deal needs your best work; green = lightweight pass; amber = investigate first; slate = deprioritize. |
| **A2.4** | **Plain-English label.** Below the score cluster, a single sentence in plain English: "This is a **Prioritize** deal — technically complex and likely to close. Full TDR investment is warranted." Pulled from a static map keyed on `dealQuadrant`. No jargon, no formula. |

### A3: Auto-generation pipeline

| Part | Mechanism |
|------|-----------|
| **A3.1** | **Trigger logic.** In `TDRIntelligence.tsx`, a `useEffect` watches `confidence.total` and `session.id`. When confidence crosses the threshold (40) and no cached brief exists for this session, auto-fire `generateActionBrief`. Debounced to avoid rapid re-fires during step completion. |
| **A3.2** | **Lightweight brief endpoint.** Create a new Code Engine function `generateActionBrief` (or reuse `generateActionPlan` with a `format: 'brief'` flag). The brief prompt emphasizes: concise (200 words max), role-specific (SE vs AE), action-oriented (verbs, not descriptions), grounded in the deal's quadrant and TDR inputs. Returns `{ brief: string, seActions: string[], aeActions: string[], generatedAt: string }`. `[Cursor for Code Engine JS]` |
| **A3.3** | **Shared content with PDF.** The `assembleTDRReadout` function already returns `actionPlan`. Wire it to also return `actionBrief` (the shorter version). The PDF's Quick Actions card and the UI's Action Cards draw from the same data. If the full action plan exists, the brief is derived from it; if only the brief exists, the PDF falls back to it. |

### A4: Section reorder in TDRIntelligence.tsx

| Part | Mechanism |
|------|-----------|
| **A4.1** | **New section order.** After the deal header: (1) **Action Brief** (A1), (2) **Deal Position cluster** (A2), (3) Signal strip, (4) Prepare Readout workflow, (5) Intelligence Dossier, (6) Strategic Guidance, (7) Evidence & Admin. The Action Brief replaces nothing — it's new. The Score Cluster replaces the current three-section layout but retains all content behind the expandable accordion. |
| **A4.2** | **Scroll-to from Command Center.** When a user clicks "Click to open TDR" from the quadrant chart, the workspace opens with the Intelligence panel scrolled to the Action Brief. This reinforces the action-first hierarchy. |

---

## Fit Check: R × A

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | Surface a clear, prescriptive "What to Do" directive as the first thing users see | Core goal | ✅ (A1.1, A4.1) |
| R0.1 | Visible without scrolling, clicking, or generating | Must-have | ✅ (A1.1, A3.1) |
| R0.2 | Answer: what is the technical strategy + what actions win the deal | Must-have | ✅ (A1.1, A3.2) |
| R0.3 | Role-specific where possible (SE vs AE) | Must-have | ✅ (A1.2) |
| R1 | Simplify three-score presentation for naive users | Must-have | ✅ (A2.1, A2.4) |
| R1.1 | Make parent-child relationship visually obvious | Must-have | ✅ (A2.1) |
| R1.2 | Reduce default visual footprint of score detail | Must-have | ✅ (A2.2) |
| R1.3 | Retain all detail for power users | Must-have | ✅ (A2.2) |
| R2 | Auto-generate, not manual trigger | Must-have | ✅ (A3.1) |
| R2.1 | Auto-generate at sufficient completion | Must-have | ✅ (A3.1) |
| R2.2 | Allow manual regeneration | Must-have | ✅ (A1.4) |
| R2.3 | Leverage all context sources | Must-have | ✅ (A3.2) |
| R3 | UI and PDF share same hierarchy | Must-have | ✅ (A3.3) |
| R3.1 | UI mirrors PDF flow (summary → action → detail) | Must-have | ✅ (A4.1) |
| R3.2 | Same action content in both surfaces | Must-have | ✅ (A3.3) |
| R4 | Work at every TDR completion stage | Must-have | ✅ (A1.3) |
| R4.1 | Pre-TDR: quadrant guidance only | Must-have | ✅ (A1.3) |
| R4.2 | In-progress: partial brief with indicator | Must-have | ✅ (A1.3) |
| R4.3 | Complete: full brief with role-specific steps | Must-have | ✅ (A1.1, A1.2) |

**Notes:** All requirements satisfied by Shape A. No flags.

---

## Resolved Questions

1. **Should the Action Brief replace the existing Action Plan dialog?** → **No.** The Action Brief is a concise (200-word) always-visible summary. The full Action Plan (with its 7 detailed sections: Executive Summary, Competitive Strategy, etc.) remains available via the Prepare Readout workflow for users who want depth. They complement each other: brief for the glance, plan for the deep dive.

2. **Should we remove any of the three scores?** → **No.** All three scores (Deal Priority, TDR Score, Win Propensity) are retained. The change is organizational: they're consolidated into a single "Deal Position" cluster with the parent-child hierarchy made explicit, and detail is collapsed by default.

3. **Where does the Action Brief live in Snowflake?** → **`CORTEX_ANALYSIS_RESULTS` table**, with `analysis_type = 'tdr_action_brief'`. Same pattern as the existing action plan. Keyed by `session_id`.

4. **What if the user hasn't completed enough steps to generate a useful brief?** → **Show quadrant-derived guidance only** (the existing complexity drivers). The brief doesn't appear until `confidence.total >= 40`, which requires roughly 3 completed required steps. Below that threshold, the prescriptive value of AI-generated guidance is too low to be trustworthy.

5. **Should the Score Cluster still show the formula?** → **Yes, but subtly.** The `TDR 63 × 40% = 25 | Win 97% × 60% = 58` breakdown is useful for understanding but should be de-emphasized (smaller text, muted color) rather than removed. Power users appreciate it; naive users can ignore it.

6. **What quadrant labels should the plain-English sentence use?** → **The four established quadrants:** Prioritize ("full TDR investment warranted"), Fast Track ("lightweight technical pass, focus on closing"), Investigate ("diagnose blockers before investing TDR time"), Deprioritize ("monitor only, redirect effort to higher-priority deals").

---

## Rabbit Holes

- **Don't build a separate "recommendations engine."** The Action Brief is a prompt variation on the existing `generateActionPlan` Code Engine function, not a new ML model or rule engine. The AI already has all the context (TDR inputs, enrichment, Gong, KB); we're just asking it to be concise and role-specific. Adding a custom rules engine would duplicate logic and diverge from the AI-generated action plan.

- **Don't make the Score Cluster interactive/filterable.** The quadrant chart on the Command Center already handles filtering. The Score Cluster in the Intelligence panel is read-only — it tells you where this deal sits, period. Adding click-to-filter or drill-down within the cluster would compete with existing navigation patterns.

- **Don't try to auto-scroll the Intelligence panel to the Action Brief on every render.** Only scroll-to on initial navigation from the Command Center quadrant chart. Subsequent renders (e.g., completing a step) should not yank the scroll position — that's jarring.

- **Don't over-engineer the "partial brief" state.** A simple amber badge and a note ("Complete more steps for a comprehensive plan") is sufficient. Don't build a progress ring or animated fill indicator — that's visual noise for a transient state.

---

## No-Gos

- No removal of any existing score, metric, or detail section — reorganize, don't delete
- No new Snowflake tables — use existing `CORTEX_ANALYSIS_RESULTS`
- No blocking the UI on brief generation — show a skeleton/loading state, don't prevent interaction
- No auto-regeneration on every step save — debounce and only trigger on meaningful completion transitions

---

## CURRENT State Reference

### Intelligence Panel Section Order (TDRIntelligence.tsx)

| # | Section | Visual Weight | Current Position |
|---|---------|--------------|-----------------|
| 1 | Deal header (account, ACV, stage, team) | Medium | Top |
| 2 | **Deal Priority** (hero metric, 83) | High — 3xl font, quadrant badge, bullets | 2nd |
| 3 | **TDR Score** (Score Components, 63) | High — lg font, priority band, lifecycle badge, progress bar | 3rd |
| 4 | **Win Propensity** (97%) | High — lg font, quadrant badge, progress bar | 4th |
| 5 | Confidence meter | Medium | 5th |
| 6 | Context text | Low | 6th |
| 7 | Top TDR triggers (pills) | Medium | 7th |
| 8 | Expandable score breakdown | Low (collapsed) | 8th |
| 9 | Signal strip (Threat/Hiring/KB/Intel) | Low | 9th |
| 10 | Prepare Readout workflow (4 steps) | Medium | 10th |
| 11 | Enrichment action bar | Medium | 11th |
| 12+ | Intelligence Dossier, Strategic Guidance, Evidence | Variable | Below fold |

### Proposed Section Order

| # | Section | Visual Weight | Position |
|---|---------|--------------|----------|
| 1 | Deal header (account, ACV, stage, team) | Medium | Top |
| 2 | **ACTION BRIEF** (prescriptive "so what") | **High — new hero** | **2nd (new)** |
| 3 | **Deal Position cluster** (Priority + TDR + Win in one row) | Medium — consolidated | 3rd |
| 4 | Score Detail accordion (complexity drivers, SHAP, confidence) | Low (collapsed) | 4th |
| 5 | Signal strip | Low | 5th |
| 6 | Prepare Readout workflow | Medium | 6th |
| 7+ | Intelligence Dossier, Strategic Guidance, Evidence | Variable | Below fold |

### Key Files

| File | Role |
|------|------|
| `src/components/TDRIntelligence.tsx` | Main Intelligence panel — all score display, action plan dialog, enrichment |
| `src/components/pdf/TDRReadoutDocument.tsx` | PDF readout — `ActionPlanQuickActions`, `extractQuickActions` |
| `src/lib/tdrReadout.ts` | Readout assembly — `assembleReadout`, `ReadoutPayload` |
| `codeengine/consolidated-sprint4-5.js` | Code Engine — `generateActionPlan`, `assembleTDRReadout` |
| `src/hooks/useTDRSession.ts` | Session lifecycle — completion state, confidence computation |

### Existing Action Plan Generation

The current `generateActionPlan` Code Engine function accepts a session ID, queries all TDR inputs, enrichment data, and Gong context, then calls `AI_COMPLETE` with a comprehensive prompt. The result is stored in `CORTEX_ANALYSIS_RESULTS` with `analysis_type = 'tdr_action_plan'`. The new `generateActionBrief` function will follow the same pattern but with a prompt optimized for brevity and role-specific actions.
