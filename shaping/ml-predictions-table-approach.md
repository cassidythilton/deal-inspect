---
shaping: true
status: draft
appetite: medium (2–3 sprints)
supersedes: Parts 3–5 of shaping/dataset-swap-and-propensity-model.md (Sprint 28c–28e)
---

# ML Predictions Table Approach

## Problem

The original Sprint 28c–28e plan calls for **4 new Code Engine functions** (`getWinProbability`, `batchScoreDeals`, `getModelMetrics`, `retrainModel`), each requiring manifest `packageMapping` entries, a new frontend service layer (`mlPredictions.ts`), and a dual data path (batch predictions + real-time inference fallback). This is a significant amount of plumbing for what is ultimately a single output: a propensity score per deal.

The Code Engine path also introduces:
- **Latency at deal open.** Real-time `getWinProbability` adds 50–200ms per deal load via Code Engine → Snowflake SQL API round-trip.
- **Error surface.** Four new Code Engine functions = four new failure modes. If any CE function fails, the frontend must handle graceful degradation per function.
- **Maintenance burden.** Code Engine functions are JavaScript files that proxy SQL. Every time a feature column changes, both the Snowflake view AND the Code Engine function must be updated in lockstep.
- **Dual data path complexity.** Batch scores are the default, but real-time is the fallback — the frontend must know which path produced the score and show freshness metadata.

Meanwhile, the predictions are fundamentally **batch data**. Propensity doesn't change minute-to-minute — it changes when deal metadata changes, which flows through SFDC → Snowflake → Domo on a regular sync cadence. A score computed nightly (or more frequently) is perfectly fresh for the use case.

---

## Proposed Simplification

**Create a Snowflake predictions table. Join it with the opportunities data. Let the predictions flow through the existing Domo data pipeline as columns on the deal.**

The app reads propensity score, quadrant label, and top contributing factors as regular fields — exactly like ACV, Stage, or Forecast Category. No Code Engine. No real-time inference. No new API layer.

### What This Means Architecturally

```
BEFORE (Original Plan):
  Snowflake ML Model
       ↓ (real-time inference via Code Engine)
  Code Engine: getWinProbability()
       ↓ (API call from frontend)
  Frontend: mlPredictions.ts → Intelligence Panel

AFTER (Predictions Table):
  Snowflake ML Model
       ↓ (batch scoring via Snowflake Task)
  DEAL_PREDICTIONS table
       ↓ (JOIN in Snowflake view)
  Opportunities dataset (Domo sync)
       ↓ (existing /data/v2/ fetch — no new API)
  Frontend: predictions are columns on the Deal object
```

---

## Requirements (revised from original R1–R7)

### R1–R5, R7: Unchanged
All original requirements hold — propensity predicts close, two-axis composition, primary metric visibility, graceful degradation. These are about *what* the user sees, not *how* predictions get there.

### R6 (revised): Model trains and scores in Snowflake; predictions flow through Domo data pipeline
Use `SNOWFLAKE.ML.CLASSIFICATION` for training (unchanged). Batch-score all pipeline deals into a `DEAL_PREDICTIONS` table via Snowflake Task. A Snowflake view joins predictions with the opportunities table. Domo syncs this view (or the joined output) as the dataset the app already reads. **No Code Engine functions for ML inference.**

### R8 (new): SHAP-like factors must be pre-computed and stored
Since there's no real-time inference call to return `topFactors[]`, the batch scoring process must also compute and store per-deal factor contributions. These are additional columns on the predictions table (or a compact JSON column) that the frontend can parse and display.

---

## Solution Shape

### Part 1: Snowflake Infrastructure (replaces 28c + 28d)

**What stays from the original 28c:**
- `ML_FEATURE_STORE` view — 19 derived features, exactly as designed
- `ML_TRAINING_DATA` view — closed deals + `IS_WON` label, exactly as designed
- `DEAL_CLOSE_PROPENSITY` model via `CREATE SNOWFLAKE.ML.CLASSIFICATION`
- `ML_MODEL_METADATA` table — accuracy, precision, recall, feature importance, sample count, last trained

**What changes:**

#### 1A. `DEAL_PREDICTIONS` table — the core output

```sql
CREATE TABLE IF NOT EXISTS TDR_APP.TDR_DATA.DEAL_PREDICTIONS (
  OPPORTUNITY_ID VARCHAR NOT NULL,
  PROPENSITY_SCORE FLOAT,          -- 0.0–1.0 (displayed as 0–100%)
  PREDICTION VARCHAR,              -- 'Won' or 'Lost'
  QUADRANT VARCHAR,                -- 'CRITICAL' | 'STANDARD' | 'MONITOR' | 'SKIP'
  FACTOR_1_NAME VARCHAR,           -- Top contributing factor, plain English
  FACTOR_1_VALUE VARCHAR,          -- e.g. '0.78'
  FACTOR_1_DIRECTION VARCHAR,      -- 'helps' | 'hurts' | 'neutral'
  FACTOR_1_MAGNITUDE FLOAT,        -- Relative importance 0.0–1.0
  FACTOR_2_NAME VARCHAR,
  FACTOR_2_VALUE VARCHAR,
  FACTOR_2_DIRECTION VARCHAR,
  FACTOR_2_MAGNITUDE FLOAT,
  FACTOR_3_NAME VARCHAR,
  FACTOR_3_VALUE VARCHAR,
  FACTOR_3_DIRECTION VARCHAR,
  FACTOR_3_MAGNITUDE FLOAT,
  FACTOR_4_NAME VARCHAR,
  FACTOR_4_VALUE VARCHAR,
  FACTOR_4_DIRECTION VARCHAR,
  FACTOR_4_MAGNITUDE FLOAT,
  FACTOR_5_NAME VARCHAR,
  FACTOR_5_VALUE VARCHAR,
  FACTOR_5_DIRECTION VARCHAR,
  FACTOR_5_MAGNITUDE FLOAT,
  SCORED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  MODEL_VERSION VARCHAR,
  PRIMARY KEY (OPPORTUNITY_ID)
);
```

**Design decision: flat columns vs. JSON for factors.** Flat columns (Factor 1–5 × 4 fields = 20 columns) are more verbose but avoid JSON parsing in the Domo data pipeline and the frontend. Domo datasets don't natively parse JSON fields — flat columns flow through cleanly. 5 factors × 4 attributes = 20 columns, which is manageable.

**Alternative: JSON column.** If the column count feels heavy, a single `FACTORS_JSON` column could hold `[{name, value, direction, magnitude}, ...]`. But this requires frontend JSON parsing per deal and may not flow cleanly through Domo dataset joins. **Recommend flat columns for simplicity.**

#### 1B. Batch scoring stored procedure

```sql
CREATE OR REPLACE PROCEDURE TDR_APP.TDR_DATA.SCORE_PIPELINE_DEALS()
RETURNS VARCHAR
LANGUAGE SQL
AS
$$
BEGIN
  -- Score all open pipeline deals
  MERGE INTO TDR_APP.TDR_DATA.DEAL_PREDICTIONS dp
  USING (
    SELECT
      f.OPPORTUNITY_ID,
      DEAL_CLOSE_PROPENSITY!PREDICT(
        OBJECT_CONSTRUCT(/* ... all feature columns from ML_FEATURE_STORE ... */)
      ) AS pred
    FROM TDR_APP.TDR_DATA.ML_FEATURE_STORE f
    WHERE f.IS_CLOSED IS NULL OR f.IS_CLOSED = FALSE
  ) src
  ON dp.OPPORTUNITY_ID = src.OPPORTUNITY_ID
  WHEN MATCHED THEN UPDATE SET
    PROPENSITY_SCORE = src.pred:probability:1::FLOAT,
    PREDICTION = src.pred:class::VARCHAR,
    SCORED_AT = CURRENT_TIMESTAMP(),
    -- Factor extraction from prediction detail (approach TBD based on model output)
    ...
  WHEN NOT MATCHED THEN INSERT (...)
    VALUES (...);

  RETURN 'Scored ' || (SELECT COUNT(*) FROM TDR_APP.TDR_DATA.DEAL_PREDICTIONS) || ' deals';
END;
$$;
```

#### 1C. Retraining stored procedure

Same as original `RETRAIN_PROPENSITY_MODEL`. Drops and recreates the classification model from latest training data. Logs metadata. No change.

#### 1D. Snowflake Tasks

| Task | Schedule | Calls |
|------|----------|-------|
| `NIGHTLY_SCORE_DEALS` | Every 6 hours (or nightly) | `SCORE_PIPELINE_DEALS()` |
| `WEEKLY_RETRAIN_MODEL` | Weekly (Sunday 2 AM) | `RETRAIN_PROPENSITY_MODEL()` |

#### 1E. Joined view — predictions + opportunities

```sql
CREATE OR REPLACE VIEW TDR_APP.TDR_DATA.V_OPPORTUNITIES_WITH_PREDICTIONS AS
SELECT
  o.*,
  p.PROPENSITY_SCORE,
  p.PREDICTION AS ML_PREDICTION,
  p.QUADRANT AS PROPENSITY_QUADRANT,
  p.FACTOR_1_NAME, p.FACTOR_1_VALUE, p.FACTOR_1_DIRECTION, p.FACTOR_1_MAGNITUDE,
  p.FACTOR_2_NAME, p.FACTOR_2_VALUE, p.FACTOR_2_DIRECTION, p.FACTOR_2_MAGNITUDE,
  p.FACTOR_3_NAME, p.FACTOR_3_VALUE, p.FACTOR_3_DIRECTION, p.FACTOR_3_MAGNITUDE,
  p.FACTOR_4_NAME, p.FACTOR_4_VALUE, p.FACTOR_4_DIRECTION, p.FACTOR_4_MAGNITUDE,
  p.FACTOR_5_NAME, p.FACTOR_5_VALUE, p.FACTOR_5_DIRECTION, p.FACTOR_5_MAGNITUDE,
  p.SCORED_AT AS PROPENSITY_SCORED_AT,
  p.MODEL_VERSION AS PROPENSITY_MODEL_VERSION
FROM TDR_APP.PUBLIC.FORECAST_PAGE_OPPORTUNITIES_MAGIC_SNFV2 o
LEFT JOIN TDR_APP.TDR_DATA.DEAL_PREDICTIONS p
  ON o."Opportunity Id" = p.OPPORTUNITY_ID;
```

**The app can consume this joined view as its dataset**, OR the join can be done at the Domo level (Domo Magic ETL or dataflow joining the two datasets). Either way, predictions arrive as columns on the deal.

### Part 2: Domo Integration (replaces 28d Code Engine)

Two options for getting predictions into the app:

**Option A: Snowflake view → Domo dataset (preferred)**
- Point the existing Domo dataset connector at `V_OPPORTUNITIES_WITH_PREDICTIONS` instead of the raw table
- Predictions arrive as columns on the existing `opportunitiesmagic` dataset
- No manifest changes beyond adding field mappings for the new prediction columns
- **Pro:** Single data source, zero new APIs, predictions refresh with the regular dataset sync
- **Con:** Requires changing the Snowflake connector's source query in Domo

**Option B: Separate predictions dataset + Domo join**
- Create a second Domo dataset from `DEAL_PREDICTIONS`
- Join in Domo via Magic ETL or dataflow, keyed on `Opportunity Id`
- Add joined dataset to manifest
- **Pro:** Keeps raw opportunities untouched
- **Con:** Second dataset to manage, join logic in Domo, potential sync timing issues

**Recommendation: Option A.** One source of truth. One dataset. Predictions are just more columns.

### Part 3: Frontend Integration (28e — simplified)

The frontend changes are the same as originally planned, but the data source is simpler:

- **No `mlPredictions.ts` service layer.** Predictions are fields on the `Deal` object.
- **No Code Engine calls.** Propensity score comes from the same `fetchOpportunities()` call that fetches everything else.
- **No dual data path.** One path: dataset → deal. If `propensityScore` is null, show "—".

#### 3A. New fields in manifest + TypeScript types

Add to `manifest.json` field mappings:
```
PropensityScore       → Propensity Score (alias: PROPENSITY_SCORE)
MlPrediction          → ML Prediction
PropensityQuadrant    → Propensity Quadrant
Factor1Name           → Factor 1 Name
Factor1Value          → Factor 1 Value
Factor1Direction      → Factor 1 Direction
Factor1Magnitude      → Factor 1 Magnitude
... (through Factor 5)
PropensityScoredAt    → Propensity Scored At
PropensityModelVersion → Propensity Model Version
```

~24 new field mappings (1 score + 1 prediction + 1 quadrant + 5×4 factors + 1 scored_at + 1 model_version).

#### 3B. `Deal` interface expansion

```typescript
// ML Predictions (from Snowflake predictions table, joined at dataset level)
propensityScore?: number;       // 0–100 (converted from 0.0–1.0)
mlPrediction?: string;          // 'Won' | 'Lost'
propensityQuadrant?: string;    // 'CRITICAL' | 'STANDARD' | 'MONITOR' | 'SKIP'
propensityFactors?: Array<{
  name: string;
  value: string;
  direction: 'helps' | 'hurts' | 'neutral';
  magnitude: number;
}>;
propensityScoredAt?: string;    // ISO timestamp
propensityModelVersion?: string;
```

The `transformOpportunityToDeal()` function assembles `propensityFactors[]` from the flat Factor 1–5 columns.

#### 3C. UI surfaces (unchanged scope)

All originally planned surfaces remain:
- Command Center: propensity column (sortable, color-coded)
- Command Center: quadrant scatter tab
- Intelligence Panel: propensity card with SHAP factor bars
- Why TDR? pills: propensity factor pills
- Portfolio analytics: weighted propensity metrics
- Graceful degradation: "—" when `propensityScore` is null

---

## What's Eliminated

| Original Plan | Predictions Table Approach | Savings |
|--------------|--------------------------|---------|
| `getWinProbability()` Code Engine function | ❌ Eliminated | ~100 lines JS + manifest entry |
| `batchScoreDeals()` Code Engine function | ❌ Eliminated (replaced by Snowflake stored procedure) | ~80 lines JS + manifest entry |
| `getModelMetrics()` Code Engine function | ❌ Eliminated (query `ML_MODEL_METADATA` directly or via view) | ~60 lines JS + manifest entry |
| `retrainModel()` Code Engine function | ❌ Eliminated (Snowflake Task handles this) | ~60 lines JS + manifest entry |
| `src/lib/mlPredictions.ts` frontend service | ❌ Eliminated | ~150 lines TS |
| 4 new `packageMapping` entries in manifest | ❌ Eliminated | Manifest complexity |
| Real-time inference fallback logic | ❌ Eliminated | Frontend complexity |
| Dual data path (batch vs. real-time) | ❌ Eliminated → single path | Debugging simplicity |
| **Total Code Engine lines eliminated** | | **~300 lines JS** |
| **Total frontend service eliminated** | | **~150 lines TS** |

---

## What's Added (net new vs. original)

| Item | Why |
|------|-----|
| `V_OPPORTUNITIES_WITH_PREDICTIONS` view | Joins predictions with opportunities — the dataset source |
| ~24 new manifest field mappings for prediction columns | Predictions flow as regular dataset columns |
| `transformOpportunityToDeal()` factor assembly | Flat Factor 1–5 columns → `propensityFactors[]` array |

---

## Revised Sprint Breakdown

### Sprint 28c — ML Infrastructure & Predictions Table (2–3 days)
*[Cortex CLI — all Snowflake domain]*

**Prerequisite:** 28b EDA notebook executed against live Snowflake — go/no-go gate.

- [ ] Create `ML_FEATURE_STORE` view (19 derived features from raw opportunity data)
- [ ] Create `ML_TRAINING_DATA` view (closed deals only, with `IS_WON` label)
- [ ] Create `DEAL_PREDICTIONS` table (score + quadrant + 5 factors × 4 fields + metadata)
- [ ] Grants: `TDR_APP_ROLE` needs `CREATE SNOWFLAKE.ML.CLASSIFICATION`, `CORTEX_USER`
- [ ] Train model: `CREATE SNOWFLAKE.ML.CLASSIFICATION DEAL_CLOSE_PROPENSITY`
- [ ] Validate: `SHOW_EVALUATION_METRICS()` — target AUC-ROC ≥ 0.70
- [ ] Extract: `SHOW_FEATURE_IMPORTANCE()` — verify top features make business sense
- [ ] Log metadata to `ML_MODEL_METADATA`
- [ ] Create `SCORE_PIPELINE_DEALS()` stored procedure (batch scoring with factor extraction)
- [ ] Create `RETRAIN_PROPENSITY_MODEL()` stored procedure
- [ ] Create Snowflake Tasks: nightly scoring + weekly retrain
- [ ] Create `V_OPPORTUNITIES_WITH_PREDICTIONS` joined view
- [ ] **Decision:** Confirm Domo dataset connector points at joined view (Option A) or separate dataset (Option B)
- [ ] Run first batch scoring — verify predictions populate for all open pipeline deals

### Sprint 28d — Domo Integration & Manifest (0.5–1 day)
*[Cursor — application domain]*

This sprint shrinks from 1–2 days to half a day. No Code Engine functions.

- [ ] Update Domo dataset connector to source from joined view (if Option A) or create second dataset (if Option B)
- [ ] Add ~24 new field mappings to `manifest.json` (both `dist/` and `public/`)
- [ ] Expand `DomoOpportunity` interface with prediction fields
- [ ] Expand `OPPORTUNITY_FIELD_MAP` with prediction aliases
- [ ] Expand `Deal` interface with `propensityScore`, `propensityQuadrant`, `propensityFactors[]`, etc.
- [ ] Extend `transformOpportunityToDeal()` — assemble flat Factor 1–5 columns into `propensityFactors[]` array
- [ ] Update `fetchOpportunities()` — add prediction field names to the `fields` param in `/data/v2/` call
- [ ] Verify predictions appear in console log when deals load

### Sprint 28e — Frontend ML Surfaces (2–3 days)
*[Cursor — application domain]*

Unchanged in scope, simplified in implementation (no CE calls, no service layer).

- [ ] Add "Win Propensity" column to Command Center AG Grid — %, color-coded, sortable
- [ ] Build quadrant scatter plot as Command Center tab — propensity (Y) × TDR score (X), click-to-navigate
- [ ] Add propensity card to Intelligence Panel with SHAP-like factor bars
- [ ] Extend Why TDR? pills with propensity factor pills
- [ ] Add portfolio-level propensity metrics (weighted avg, CRITICAL count, <20% risk count)
- [ ] Graceful degradation: "—" when `propensityScore` is null/undefined
- [ ] "Last scored: 6 hours ago" freshness indicator from `propensityScoredAt`
- [ ] Update Documentation Hub sections

---

## SHAP Factor Approach

**Challenge:** `SNOWFLAKE.ML.CLASSIFICATION` provides global feature importance via `SHOW_FEATURE_IMPORTANCE()`, but per-prediction factor decomposition (true SHAP values) requires additional computation.

**Approach for batch scoring:**

1. **Global feature importance** from `SHOW_FEATURE_IMPORTANCE()` gives us the ranked list of which features matter most across all deals.
2. **Per-deal factor derivation:** For each scored deal, compare its feature values to the population baseline. A deal with Account Win Rate = 0.78 (vs. population mean 0.45) and high global importance for that feature → "Account Win Rate ↑ Helps close." This isn't true SHAP but is a practical, explainable approximation that works for the batch model.
3. **Factor direction logic:**
   - Numeric features: deal value > population mean + 0.5 SD → ↑ helps; < mean - 0.5 SD → ↓ hurts; else → neutral
   - Boolean features: TRUE when global importance shows positive correlation → ↑ helps
   - For `prediction = 'Won'` deals: features aligned with winning → ↑; against → ↓
4. **Top 5 selection:** Rank by `global_importance × |deal_deviation|` and take top 5.

This computation happens inside the `SCORE_PIPELINE_DEALS()` stored procedure, so factors are pre-computed and stored — no runtime cost.

**Future upgrade path:** If true per-prediction SHAP values are needed, a Snowpark Python UDF can compute them using the `shap` library. This is an optimization, not a launch requirement.

---

## Fit Check

| Requirement | Covered? | Notes |
|-------------|----------|-------|
| **R1: Swap without breaking** | ✅ Already done (28a) | — |
| **R2: New columns for ML** | ✅ Already done (28a) | — |
| **R3: Propensity predicts close** | ✅ Same model, same target | `IS_WON` label unchanged |
| **R4: Two-axis composition** | ✅ Quadrant pre-computed and stored | `QUADRANT` column on predictions table |
| **R5: Primary metric** | ✅ Same surfaces | Propensity column, quadrant view, intelligence panel, portfolio |
| **R6: Trains in Snowflake** | ✅ Same | `SNOWFLAKE.ML.CLASSIFICATION`, pure SQL |
| **R7: Graceful degradation** | ✅ Simpler | `propensityScore` is null → show "—". No CE failure modes. |
| **R8: Factors pre-computed** | ✅ New | Flat columns on predictions table, assembled in transform |

---

## Rabbit Holes

- **Don't try to do real-time inference "just in case."** The whole point of this approach is that batch is sufficient. If a deal was updated 2 hours ago and scored 6 hours ago, the score is still useful — propensity doesn't swing wildly on minor edits. Show the freshness timestamp and move on.
- **Don't build a model metrics admin page for v1.** The `ML_MODEL_METADATA` table exists for future use. If needed, query it directly in Snowflake. The app doesn't need a retrain button — Snowflake Tasks handle this automatically.
- **Don't over-engineer factor extraction.** The global-importance × per-deal-deviation heuristic is good enough. True SHAP is an optimization for later.
- **Don't create a separate "predictions" page.** Predictions are columns on deals. They surface everywhere deals surface. No new navigation.

---

## No-Gos

- No Code Engine functions for ML inference
- No real-time scoring fallback
- No frontend service layer for ML API calls
- No JSON columns in the predictions table (flat columns only)
- No admin retrain button at launch (automated via Snowflake Task)
- No separate predictions page in the app

---

## Open Questions

1. **Domo connector reconfiguration (Option A vs. B):** Does the existing Domo dataset connector support pointing at a Snowflake view? If so, Option A is strictly better. If the connector is locked to a specific table, Option B (second dataset + Domo join) is the fallback. **User to confirm.**

2. **Factor extraction from SNOWFLAKE.ML.CLASSIFICATION:** The exact output format of `!PREDICT()` determines how we extract per-prediction factor contributions. Need to test during 28c to confirm whether the prediction output includes per-feature probabilities or only the aggregate score. **Resolved during implementation.**

3. **Scoring frequency:** Nightly vs. every 6 hours. Depends on how often the source data refreshes from SFDC. If SFDC syncs every 6 hours, scoring every 6 hours makes sense. If daily, nightly is fine. **User to confirm.**

---

## Revised Effort Estimate

| Sprint | Original Effort | Revised Effort | Delta |
|--------|----------------|---------------|-------|
| **28c** | 2–3 days (ML infra only) | 2–3 days (ML infra + predictions table + stored procedures + tasks + joined view) | Flat — same effort, different shape |
| **28d** | 1–2 days (4 CE functions + manifest) | 0.5–1 day (manifest field mappings + TS types + transform logic) | **-1 day** |
| **28e** | 3–4 days (frontend + CE integration) | 2–3 days (frontend only, simpler data path) | **-1 day** |
| **Total** | 6–9 days | **4.5–7 days** | **-1.5 to -2 days saved** |
