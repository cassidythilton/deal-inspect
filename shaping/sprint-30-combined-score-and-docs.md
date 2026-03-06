---
shaping: true
status: draft
appetite: medium (3–5 days)
---

# Combined Deal Priority Score + Documentation Overhaul

## Source

> "the combination of the tdr and win propensity is critical to identifying deals to focus on in the tdr process. we've now done this in the scatter plot e.g. fast track, prioritize, etc. but in the table view it's a very 'serial' experience e.g. sort by win %, tdr score, etc. is there a combined score or denotation of some sort that allows me to see/sort similar to the way the scatter does?"

> "we have completely overlooked the documentation section of the app. we will need to update the documentation per all the changes we've made across sprints 28+."

---

## Problem

**The table tells a serial story; the scatter tells a strategic one.** The Deal Positioning scatter plot synthesizes TDR complexity and win propensity into four actionable quadrants — PRIORITIZE, FAST TRACK, INVESTIGATE, DEPRIORITIZE. But the table, where SEs spend most of their time, can only sort by one axis at a time. A deal with a 72 TDR score and 85% win probability should scream "PRIORITIZE" — instead it appears in a different row depending on which column you sort by. The two most important signals in the app are not combined anywhere a user can sort, filter, or scan linearly.

**The documentation is stale by 4+ sprints.** The Documentation Hub (7 sections, 7 component files) was last meaningfully updated around Sprint 27. Since then: an entire ML pipeline was built (Snowflake ML Classification → batch scoring → Domo join → frontend), the dataset was swapped (`opportunitiesmagic` → joined `Forecast_Page_Opportunities_Magic_SNFv2 + DEAL_PREDICTIONS`), new chart components were added (Propensity Distribution, Deal Positioning scatter), the Intelligence Panel gained a propensity card with SHAP factors, the table gained Win % and icon-only Why TDR? badges, stat cards expanded to 5, stage age filtering was overhauled, and deduplication was added. None of this is reflected in the Architecture Diagram, Data Model, Capabilities Guide, Scoring Reference, AI Models Reference, or Integrations Reference. A new user opening the Docs page gets a picture of an app that no longer exists.

---

## Requirements

### R0: The table must convey the same strategic signal as the scatter plot — which deals to focus on — in a single sortable column.

- R0.1: A combined score or quadrant label must be visible per-deal in the table.
- R0.2: The column must be sortable so the user can rank deals by strategic priority.
- R0.3: The logic must match the scatter plot's quadrant assignment (same thresholds, same labels).

### R1: The combined signal must be intuitive to a naive user without requiring explanation.

The labels PRIORITIZE, FAST TRACK, INVESTIGATE, DEPRIORITIZE are already learned from the scatter. Reuse them.

### R2: Documentation must accurately reflect the current state of the app as of Sprint 30.

Every section — Architecture, Data Model, Capabilities, Integrations, AI Models, Scoring, Glossary — must be updated or verified against the actual codebase.

### R3: The ML pipeline must be documented end-to-end in the Architecture Diagram and Data Model.

Users and maintainers need to understand: where the model lives, how scoring works, how predictions flow into Domo, and how the frontend consumes them.

### R4: New UI surfaces (propensity charts, propensity card, icon pills, gap indicator, stat cards) must appear in Capabilities.

### R5: The Scoring Reference must document the composite Deal Priority score alongside the existing TDR Index Score.

---

## Solution Shape [A: Composite Priority Column + Documentation Refresh]

### A1: Deal Priority Column in Table

| Part | Mechanism |
|------|-----------|
| **A1.1** | **Compute `dealPriority` in `useDomo.ts` transform.** After TDR score and propensity score are set, compute a composite: `dealPriority = (normalizedTDR * 0.4) + (propensity * 0.6)` scaled 0–100. The 60/40 weighting reflects that propensity (data-driven ML) is a stronger signal than TDR complexity (heuristic). Store on the `Deal` object. |
| **A1.2** | **Assign `dealQuadrant` label.** Using the same thresholds as `PropensityQuadrantChart.tsx` (`WIN_THRESHOLD = 40`, `COMPLEXITY_THRESHOLD = 50`): map each deal to `'PRIORITIZE' \| 'FAST_TRACK' \| 'INVESTIGATE' \| 'DEPRIORITIZE'`. Deals without ML scores get `null`. |
| **A1.3** | **Add `Deal Priority` column to `DealsTable.tsx`.** Render a color-coded badge showing the quadrant label (e.g., purple "PRIORITIZE", emerald "FAST TRACK"). Sortable by `dealPriority` numeric score. Tooltip shows the composite breakdown: "TDR: 72 × 0.4 = 28.8 · Win%: 85 × 0.6 = 51.0 · Priority: 79.8". |
| **A1.4** | **Update `Deal` type in `src/types/tdr.ts`.** Add `dealPriority?: number` and `dealQuadrant?: 'PRIORITIZE' \| 'FAST_TRACK' \| 'INVESTIGATE' \| 'DEPRIORITIZE'`. |
| **A1.5** | **Default sort.** When the Deal Priority column is present (ML scores available), default table sort to `dealPriority` descending. PRIORITIZE deals surface first. |

### A2: Documentation Refresh

| Part | Mechanism |
|------|-----------|
| **A2.1** | **Architecture Diagram (`ArchitectureDiagram.tsx`).** Add ML pipeline nodes: `ML_MODELS` schema (DEAL_CLOSE_PROPENSITY model, DEAL_PREDICTIONS table, ML_FEATURE_STORE view), nightly scoring task, weekly retrain task. Add edge from `DEAL_PREDICTIONS` → Domo sync → joined dataset → Command Center. Update layer 1 (System Overview) to include Propensity Distribution chart, Deal Positioning scatter, Win Propensity stat card. |
| **A2.2** | **Data Model (`DataModelReference.tsx`).** Add `TDR_APP.ML_MODELS` schema with tables: `DEAL_PREDICTIONS` (OPPORTUNITY_ID, PROPENSITY_SCORE, PREDICTION, QUADRANT, FACTOR_1–5_NAME/VALUE/DIRECTION/MAGNITUDE, SCORED_AT, MODEL_VERSION), `ML_MODEL_METADATA`, `ML_FEATURE_STORE` (view). Document the Domo Magic ETL join that merges predictions with the opportunities dataset. |
| **A2.3** | **Scoring Reference (`ScoringReference.tsx`).** Add section for Deal Priority composite score (formula, weighting rationale, quadrant thresholds). Document ML propensity score (SNOWFLAKE.ML.CLASSIFICATION, 19 features, AUC 0.93 / F1 0.92). Add SHAP factor explanation. |
| **A2.4** | **Capabilities Guide (`CapabilitiesGuide.tsx`).** Update Command Center card: 5 stat cards (add Win Propensity), 3 charts (TDR Coverage, Propensity Distribution, Deal Positioning scatter), Deal Priority column, icon-only Why TDR? badges. Update Intelligence Panel card: propensity card with score, quadrant, SHAP factor bars. Add gap indicator to TDR Workspace card. |
| **A2.5** | **Integrations Reference (`IntegrationsReference.tsx`).** Add `SNOWFLAKE.ML.CLASSIFICATION` to Snowflake Cortex AI section — model training, batch scoring, feature importance. Document the nightly/weekly task schedule. |
| **A2.6** | **AI Models Reference (`AIModelsReference.tsx`).** Add `SNOWFLAKE.ML.CLASSIFICATION` as a model entry — input features (19), output (probability + class), training data (historical closed deals), evaluation metrics (AUC, F1, precision, recall). Document SHAP-like feature importance output. |
| **A2.7** | **Glossary (`GlossaryReference.tsx`).** Add terms: Deal Priority, Win Propensity, Propensity Quadrant (PRIORITIZE/FAST TRACK/INVESTIGATE/DEPRIORITIZE), SHAP Factors, Deal Positioning, Gap Indicator, Close-Date Proximity Override. Update existing TDR Score entry to mention composite priority. |
| **A2.8** | **Version bump.** Update version in `Documentation.tsx` header from `v1.53.0` to reflect Sprint 30 completion. Update sprint reference. |

### A3: Perplexity Tech Pill Extraction

| Part | Mechanism |
|------|-----------|
| **A3.1** | **Extract tech names from Perplexity signals via Domo AI.** `perplexityData.technologySignals` are narrative strings (e.g., "Heavy Snowflake investment (Enterprise tier)"). Call `/domo/ai/v1/text/chat` with a structured prompt: "Extract technology/product names from these signals. Return JSON array of `{name, category}`." Use the same categories as `TECH_CATEGORY_STYLES` (CRM, BI, DW, ETL, Cloud, ML, ERP, DevOps, Other). |
| **A3.2** | **Merge extracted tech into `allTechnologies` map.** In `TDRIntelligence.tsx` lines 941–943, replace the skip comment with actual extraction. Each tech gets `source: 'perplexity'`. |
| **A3.3** | **Render Perplexity tech pills with provenance icon.** In the Technical Landscape section, Perplexity-sourced tech renders with `SourceBadge source="perplexity"` (the Perplexity icon already exists as `PerplexityIcon`). Same `TECH_CATEGORY_STYLES` color coding as Sumble pills. |
| **A3.4** | **Cache extraction results.** Store the extracted tech array in component state alongside `perplexityData` to avoid re-calling the LLM on every render. Only re-extract when `perplexityData.technologySignals` changes. |

---

## Fit Check: R × A

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | Table must convey same strategic signal as scatter — single sortable column | Core goal | ✅ (A1.1, A1.2, A1.3) |
| R0.1 | Combined score or quadrant label visible per-deal | Must-have | ✅ (A1.3) |
| R0.2 | Column must be sortable | Must-have | ✅ (A1.3, A1.5) |
| R0.3 | Logic matches scatter quadrant assignment | Must-have | ✅ (A1.2) |
| R1 | Combined signal intuitive to naive user | Must-have | ✅ (A1.3 — reuses PRIORITIZE/FAST TRACK labels) |
| R2 | Documentation reflects current app state (Sprint 30) | Must-have | ✅ (A2.1–A2.8) |
| R3 | ML pipeline documented end-to-end | Must-have | ✅ (A2.1, A2.2, A2.5, A2.6) |
| R4 | New UI surfaces in Capabilities | Must-have | ✅ (A2.4) |
| R5 | Scoring Reference documents composite Deal Priority | Must-have | ✅ (A2.3) |

---

## Resolved Questions

1. **What weighting for the composite score?** → **60% propensity, 40% TDR.** Propensity is ML-driven on 19 features with validated accuracy (AUC 0.93). TDR score is a heuristic that signals *where SE effort helps*, not *whether the deal will close*. Both matter, but propensity carries more predictive weight.

2. **Should the quadrant column replace Win % or TDR Score?** → **No, add alongside.** Power users want granular control (sort by Win % alone). The composite column is additive — it doesn't remove existing columns.

3. **How should deals without ML scores display in the Priority column?** → **Show "—" with a muted tooltip: "No ML score available."** Sort order places unscored deals last.

4. **Should Perplexity tech extraction happen client-side or server-side?** → **Client-side via Domo AI endpoint.** The extraction is lightweight (short prompt, small payload). Server-side would require a new Code Engine function. Client-side keeps it simple and cacheable in component state.

5. **Should the docs be auto-generated from code?** → **No.** The documentation is hand-authored React components. Auto-generation would be a large architectural change for marginal benefit at this scale.

---

## Rabbit Holes

- **Don't over-engineer the composite formula.** A simple weighted average is sufficient. Introducing non-linear blending, dynamic weighting, or "smart" normalization adds complexity without measurable user benefit. The quadrant labels are the primary UX — the numeric score is secondary.

- **Don't try to make the Architecture Diagram auto-update.** React Flow nodes are hand-positioned with dagre layout. Adding nodes is straightforward; building a system that auto-discovers components is a multi-sprint project with no user value.

- **Don't extract tech from Perplexity on every render.** The LLM call should happen once per research pull and be cached in state. If the user clicks Research again, re-extract.

---

## No-Gos

- No removal of existing Win % or TDR Score columns
- No changes to the ML model or scoring pipeline
- No auto-generated documentation
- No new Snowflake tables or views for the composite score (computed client-side)
- No changes to the scatter plot thresholds — the table must match exactly

---

## CURRENT State Reference

### Table Columns (DealsTable.tsx)

| # | Column | Source | Sortable |
|---|--------|--------|----------|
| 1 | Deal / Account | `account`, `dealName` | ✅ |
| 2 | AE Manager | `owner` | ✅ |
| 3 | AE | `accountExecutive` | ✅ |
| 4 | SE Manager | `seManager` | ✅ |
| 5 | SE Team | `salesConsultant` | ✅ |
| 6 | Stage | `stage` | ✅ |
| 7 | Age | `stageAge` | ✅ |
| 8 | ACV | `acv` | ✅ |
| 9 | Win % | `propensityScore` | ✅ |
| 10 | TDR Score | `tdrScore` | ✅ |
| 11 | TDRs | `tdrSessions` | ✅ |
| 12 | Partner | `partnerSignal` | ✅ |
| 13 | Why TDR? | factors (icon-only) | ❌ |
| 14 | Action | pin button | ❌ |

**Missing:** No combined priority column. No quadrant label.

### Scatter Plot Thresholds (PropensityQuadrantChart.tsx)

| Quadrant | TDR Score | Win % | Action |
|----------|-----------|-------|--------|
| PRIORITIZE | ≥ 50 | ≥ 40% | Complex & likely to close — TDR maximizes value |
| FAST TRACK | < 50 | ≥ 40% | Likely to close, low complexity — light-touch TDR |
| INVESTIGATE | ≥ 50 | < 40% | Complex but unlikely — diagnose blockers first |
| DEPRIORITIZE | < 50 | < 40% | Low complexity & probability — monitor only |

### Documentation Components (as of Sprint 27)

| Component | File | Last Updated | Gap |
|-----------|------|-------------|-----|
| Architecture Diagram | `ArchitectureDiagram.tsx` | Sprint 27 | Missing ML pipeline, predictions flow, new charts |
| Data Model | `DataModelReference.tsx` | Sprint 27 | Missing `ML_MODELS` schema, `DEAL_PREDICTIONS` table |
| Scoring Reference | `ScoringReference.tsx` | Sprint 27 | Missing composite priority, ML propensity, SHAP |
| Capabilities | `CapabilitiesGuide.tsx` | Sprint 27 | Missing 5th stat card, scatter, propensity card, icon pills, gap indicator |
| Integrations | `IntegrationsReference.tsx` | Sprint 27 | Missing SNOWFLAKE.ML.CLASSIFICATION, nightly/weekly tasks |
| AI Models | `AIModelsReference.tsx` | Sprint 27 | Missing ML Classification model entry |
| Glossary | `GlossaryReference.tsx` | Sprint 27 | Missing ~7 terms added in Sprints 28–30 |

### Perplexity Tech Signals (TDRIntelligence.tsx lines 941–943)

```typescript
(perplexityData?.technologySignals ?? []).forEach(signal => {
  // Tech signals are sentences, not bare names — skip merging into tech grid
});
```

Signal format: `"Heavy Snowflake investment (Enterprise tier)"`, `"Using dbt for transformation layer"` — narrative strings, not bare tech names. Requires LLM extraction to produce pill-ready `{name, category}` pairs.
