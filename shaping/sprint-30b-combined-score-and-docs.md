---
shaping: true
status: draft
appetite: medium (3–5 days)
---

# Sprint 30b: Combined Deal Priority Score + Documentation Overhaul

## Source

> "the combination of the tdr and win propensity is critical to identifying deals to focus on in the tdr process. we've now done this in the scatter plot e.g. fast track, prioritize, etc. but in the table view it's a very 'serial' experience e.g. sort by win %, tdr score, etc. is there a combined score or denotation of some sort that allows me to see/sort similar to the way the scatter does?"

> "we have completely overlooked the documentation section of the app. we will need to update the documentation per all the changes we've made across sprints 28+."

---

## Problem

**Problem 1 — Serial table sorting vs. quadrant insight.** The Deal Positioning scatter plot produces the app's most actionable insight: the intersection of TDR complexity and ML win probability yields four distinct action categories (Prioritize, Fast Track, Investigate, Deprioritize). But the table — where users spend most of their time — can only sort by one axis at a time. A user who wants "deals I should prioritize" must mentally cross-reference two columns. The scatter solves this visually but isn't scannable for 100+ deals. **The table needs the same composite intelligence the scatter provides, but in a sortable, filterable, inline format.**

**Problem 2 — Stale documentation.** The Documentation Hub hasn't been updated since the pre-ML era. It documents 8 Snowflake tables but not `TDR_APP.ML_MODELS` (3+ objects). The Architecture Diagram has no ML layer. The Capabilities Guide describes 9 TDR steps (now being consolidated to 5). The Data Model Reference knows nothing about `DEAL_PREDICTIONS`, `ML_FEATURE_STORE`, `DEAL_CLOSE_PROPENSITY`, `SCORE_PIPELINE_DEALS()`, or `RETRAIN_PROPENSITY_MODEL()`. The AI Models Reference doesn't mention `SNOWFLAKE.ML.CLASSIFICATION`. The Scoring Reference doesn't explain how TDR Score and Win Propensity interact. **Users arriving at the Documentation Hub get an outdated picture of the system — one that doesn't mention the ML pipeline, propensity scoring, or any Sprint 28+ capabilities.**

---

## Requirements

### R0: Composite deal priority in the table view

The table must surface the same quadrant-based prioritization that the scatter plot provides, in a sortable, filterable column that collapses TDR complexity × win propensity into a single actionable signal.

- R0.1: A "Priority" column (or equivalent) that combines TDR score and propensity into a single sortable value
- R0.2: A visual badge showing the deal's quadrant action (PRIORITIZE / FAST TRACK / INVESTIGATE / DEPRIORITIZE)
- R0.3: Sortable — sorting by this column should surface "Prioritize" deals first, then "Fast Track", etc.
- R0.4: Filterable — users can filter the table to show only a specific quadrant
- R0.5: Tooltip explaining what the quadrant means and what drove the classification

### R1: Composite score formula must be transparent

The combined score should have a clear, documented formula so users trust it. Not a black box.

### R2: Graceful degradation when ML score is absent

Deals without ML scores (unscored pipeline) should still get a meaningful priority based on TDR score alone, with a visual indicator that ML data is missing.

### R3: Documentation Hub reflects Sprint 28+ changes

All documentation sections must be updated to reflect the current state of the system, including ML pipeline, propensity model, new charts, new columns, and new capabilities.

- R3.1: Architecture Diagram includes ML pipeline layer (Snowflake ML → DEAL_PREDICTIONS → Domo sync → frontend)
- R3.2: Data Model Reference documents `TDR_APP.ML_MODELS` schema (DEAL_PREDICTIONS, ML_FEATURE_STORE view, ML_MODEL_METADATA, stored procedures, tasks)
- R3.3: Capabilities Guide reflects current Command Center (5 stat cards, 3 charts including scatter, Win % column, icon pills), Intelligence Panel (propensity card, SHAP factors), and new filtering
- R3.4: AI Models Reference includes SNOWFLAKE.ML.CLASSIFICATION and the propensity model details (19 features, AUC, F1)
- R3.5: Scoring Reference explains how TDR Score and Win Propensity interact (the two-axis model) and documents the composite Priority Score
- R3.6: Integrations Reference reflects the Domo dataset join (DEAL_PREDICTIONS → Magic ETL → opportunities dataset)
- R3.7: Glossary adds new terms (Win Propensity, Propensity Quadrant, SHAP Factors, Deal Priority, ML Pipeline, Batch Scoring)

### R4: Version bump

Documentation version should reflect current state (not v1.53.0).

---

## Solution Shape [A: Composite Priority + Doc Overhaul]

### A1: Composite Priority Score & Column [Cursor]

| Part | Mechanism |
|------|-----------|
| **A1.1** | **Composite Priority Score formula.** Compute a `dealPriority` number (0–100) combining TDR score and propensity: `priority = (tdrScore * 0.4) + (propensityScore * 100 * 0.6)`. When propensity is absent, fall back to TDR score alone (scaled). Store as a derived field on `Deal` in `useDomo.ts` `transformOpportunityToDeal()`. |
| **A1.2** | **Quadrant assignment in code.** Map every deal to one of 4 quadrants based on thresholds already in `PropensityQuadrantChart.tsx` (`COMPLEXITY_THRESHOLD = 50`, `WIN_THRESHOLD = 40`): tdrScore ≥ 50 + propensity ≥ 40% = PRIORITIZE, tdrScore < 50 + propensity ≥ 40% = FAST_TRACK, tdrScore ≥ 50 + propensity < 40% = INVESTIGATE, tdrScore < 50 + propensity < 40% = DEPRIORITIZE. Add `dealQuadrant` field to `Deal` type in `src/types/tdr.ts`. |
| **A1.3** | **Priority column in DealsTable.** New AG Grid column "Priority" with `cellRenderer: PriorityCell`. Renders a color-coded badge (purple = Prioritize, emerald = Fast Track, amber = Investigate, slate = Deprioritize). Sortable by `dealPriority` (numeric). Column placed after "Win %" or before "TDR Score". |
| **A1.4** | **Filter by quadrant.** Add a quadrant filter dropdown to `TopBar` (or inline AG Grid column filter) — "All", "Prioritize", "Fast Track", "Investigate", "Deprioritize". |
| **A1.5** | **Graceful degradation.** When `propensityScore` is null/0, compute priority from TDR score alone: `dealPriority = tdrScore`. Badge shows "Unscored" in muted style. Tooltip explains "ML score not yet available — priority based on TDR complexity only." |
| **A1.6** | **Tooltip on badge.** Hover shows: quadrant name, composite score breakdown (TDR: X, Win %: Y%), and the prescriptive action (same text as scatter quadrant labels: "Complex & likely to close — TDR maximizes value", etc.). |

### A2: Documentation Hub Overhaul [Cursor]

| Part | Mechanism |
|------|-----------|
| **A2.1** | **Architecture Diagram — ML layer.** Add a new node group "ML Pipeline" to `ArchitectureDiagram.tsx` Layer 1 (System Overview): `ML_FEATURE_STORE → DEAL_CLOSE_PROPENSITY → DEAL_PREDICTIONS → Domo Sync → Command Center`. Add to Layer 2 (Data Model): `DEAL_PREDICTIONS` table node with edges to `Domo Dataset` and `Command Center`. |
| **A2.2** | **Data Model Reference — ML schema.** Add `TDR_APP.ML_MODELS` section to `DataModelReference.tsx` with 3 objects: `DEAL_PREDICTIONS` (OPPORTUNITY_ID, PREDICTION, PROPENSITY_SCORE, QUADRANT, FACTOR_1..5_NAME/VALUE/DIRECTION/MAGNITUDE, SCORED_AT, MODEL_VERSION), `ML_FEATURE_STORE` (view — 19 derived features), `ML_MODEL_METADATA` (MODEL_NAME, AUC, F1, PRECISION, RECALL, TRAINED_AT, FEATURE_COUNT, TRAINING_ROWS). Plus 2 stored procedures (`SCORE_PIPELINE_DEALS`, `RETRAIN_PROPENSITY_MODEL`) and 2 tasks (`TASK_NIGHTLY_SCORE`, `TASK_WEEKLY_RETRAIN`). |
| **A2.3** | **Capabilities Guide update.** Update Command Center card: mention 5 stat cards (TDR Queue, Competitive, Partner, Stale, **Win Propensity**), 3 charts (TDR Coverage, Propensity Distribution, **Deal Positioning scatter**), Win % column, icon-only Why TDR pills, Priority column. Update Intelligence Panel card: add propensity card (score, quadrant, SHAP factors, freshness). Update TDR Workspace card: gap indicator, auto-save status. |
| **A2.4** | **AI Models Reference — SNOWFLAKE.ML.CLASSIFICATION.** Add entry for `DEAL_CLOSE_PROPENSITY` model: type = Snowflake native ML, algorithm = classification, features = 19 derived from ML_FEATURE_STORE, training data = 14,303 closed deals, metrics = AUC 0.887, F1 92.3%, scoring = nightly batch (6,500+ pipeline deals), retraining = weekly. |
| **A2.5** | **Scoring Reference — two-axis model.** Add section explaining how TDR Score (complexity/need) and Win Propensity (ML-predicted close probability) combine into the composite Priority Score. Document the formula, thresholds, quadrant mapping, and how this drives the scatter plot and Priority column. |
| **A2.6** | **Integrations Reference — Domo dataset join.** Add entry for Magic ETL join: `DEAL_PREDICTIONS` (Snowflake) → Domo dataset sync → Magic ETL join with `Forecast_Page_Opportunities_Magic_SNFv2` on `OPPORTUNITY_ID` → unified dataset with propensity columns as regular fields. |
| **A2.7** | **Glossary — new terms.** Add: Win Propensity, Propensity Quadrant, SHAP Factors, Deal Priority Score, ML Feature Store, Batch Scoring, Nightly Score Task, Weekly Retrain Task, Deal Positioning (scatter), Gap Indicator, Close-Date Proximity Override. |
| **A2.8** | **Version bump.** Update version from `v1.53.0` to `v2.0.0` — the ML pipeline integration represents a major version milestone. |

---

## Fit Check: R × A

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | Composite deal priority in the table view | Core goal | ✅ (A1.1, A1.2, A1.3) |
| R0.1 | Combined sortable column | Must-have | ✅ (A1.1, A1.3) |
| R0.2 | Visual badge showing quadrant action | Must-have | ✅ (A1.3) |
| R0.3 | Sortable by composite score | Must-have | ✅ (A1.3) |
| R0.4 | Filterable by quadrant | Must-have | ✅ (A1.4) |
| R0.5 | Tooltip explaining classification | Must-have | ✅ (A1.6) |
| R1 | Transparent composite score formula | Must-have | ✅ (A1.1, A2.5) |
| R2 | Graceful degradation without ML score | Must-have | ✅ (A1.5) |
| R3 | Documentation Hub reflects Sprint 28+ | Must-have | ✅ (A2.1–A2.7) |
| R3.1 | Architecture Diagram includes ML layer | Must-have | ✅ (A2.1) |
| R3.2 | Data Model documents ML_MODELS schema | Must-have | ✅ (A2.2) |
| R3.3 | Capabilities Guide reflects current UI | Must-have | ✅ (A2.3) |
| R3.4 | AI Models includes SNOWFLAKE.ML.CLASSIFICATION | Must-have | ✅ (A2.4) |
| R3.5 | Scoring Reference explains two-axis model | Must-have | ✅ (A2.5) |
| R3.6 | Integrations reflects Domo dataset join | Must-have | ✅ (A2.6) |
| R3.7 | Glossary adds new terms | Must-have | ✅ (A2.7) |
| R4 | Version bump | Nice-to-have | ✅ (A2.8) |

---

## Resolved Questions

1. **What weight should TDR Score vs Propensity get in the composite?** → **40% TDR, 60% Propensity.** Win probability is the harder signal to get (ML-derived) and more directly predicts outcomes. TDR complexity is expert-derived but subjective. The 40/60 split ensures ML intelligence drives priority while TDR complexity still matters.

2. **Should the Priority column replace Win % or TDR Score columns?** → **No, add alongside.** Users who want to drill into either axis individually should still be able to. Priority is a synthesis column, not a replacement.

3. **Should the composite formula be configurable?** → **Not now.** Start with fixed weights. If users request tuning, add to Settings in a future sprint.

4. **What version number for the doc update?** → **v2.0.0.** The ML pipeline is the single largest capability addition since launch. Warrants a major version.

5. **Should quadrant thresholds match the scatter exactly?** → **Yes.** Same constants (`COMPLEXITY_THRESHOLD = 50`, `WIN_THRESHOLD = 40`) ensure table and scatter tell the same story.

---

## Rabbit Holes

- **Don't build a custom weighting UI.** Configurable weights sound reasonable but add complexity with minimal value — the formula is transparent and documented. If needed later, it's a Settings addition.
- **Don't try to make the Priority column replace the scatter.** They serve different purposes: scatter is for visual pattern recognition across the portfolio; Priority column is for individual deal triage and sorting. Both should coexist.
- **Don't rewrite the entire Documentation Hub.** Update existing components in-place. The structure (7 accordion sections) is good — the content is just stale.

---

## No-Gos

- No removing the existing TDR Score or Win % columns
- No changes to the scatter plot thresholds or behavior
- No new Snowflake tables or views for this feature
- No interactive documentation (no live API explorers, no playground)
- No auto-generated documentation from code comments

---

## CURRENT State Reference

### Table Columns (DealsTable.tsx)

| # | Column | Sortable | Source |
|---|--------|----------|--------|
| 1 | Deal / Account | ✓ | `account`, `dealName` |
| 2 | AE Manager | ✓ | `owner` |
| 3 | AE | ✓ | `accountExecutive` |
| 4 | SE Manager | ✓ | `seManager` |
| 5 | SE Team | ✓ | `salesConsultant` |
| 6 | Stage | ✓ | `stage` |
| 7 | Age | ✓ | `stageAge` |
| 8 | ACV | ✓ | `acv` |
| 9 | Win % | ✓ | `propensityScore` |
| 10 | TDR Score | ✓ | `tdrScore` |
| 11 | TDRs | ✗ | `tdrSessions` |
| 12 | Partner | ✗ | `partnerSignal` |
| 13 | Why TDR? | ✗ | factors + ML pills |
| 14 | Action | ✗ | pin button |

**Gap:** No combined score. Sorting by Win % or TDR Score is serial — users can't sort by both simultaneously.

### Documentation Hub (Documentation.tsx)

| Section | Component | Last Updated | Sprint 28+ Gaps |
|---------|-----------|--------------|-----------------|
| Architecture | ArchitectureDiagram.tsx (437 lines) | Pre-28 | No ML pipeline layer, no DEAL_PREDICTIONS |
| Scoring | ScoringReference.tsx (206 lines) | Pre-28 | No two-axis model, no composite priority |
| Capabilities | CapabilitiesGuide.tsx (294 lines) | Pre-28 | No scatter, no propensity card, no icon pills, no gap indicator, no 5th stat card |
| Integrations | IntegrationsReference.tsx (231 lines) | Pre-28 | No Domo Magic ETL join, no dataset swap |
| Data Model | DataModelReference.tsx (259 lines) | Pre-28 | No ML_MODELS schema, no DEAL_PREDICTIONS |
| AI Models | AIModelsReference.tsx (238 lines) | Pre-28 | No SNOWFLAKE.ML.CLASSIFICATION |
| Glossary | GlossaryReference.tsx (112 lines) | Pre-28 | Missing 10+ ML/UX terms |
