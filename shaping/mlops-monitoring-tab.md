---
shaping: true
status: draft
type: feature
appetite: medium (3–4 sprints)
---

# MLOps: Monitoring Tab + Model Calibration

## Problem

The propensity model runs inside Snowflake — nightly scoring, weekly retraining — but there's zero visibility into its health from the app. When the model broke (feature schema mismatch → all predictions "Lost"), it took a manual debugging session with Cortex CLI to diagnose. A user looking at "Win Propensity: 0%" had no way to know whether that was a data problem, a model problem, or reality.

Today the only way to check model health is to run raw SQL:
- `SHOW_EVALUATION_METRICS()` for fit metrics
- `SHOW_FEATURE_IMPORTANCE()` for feature ranking
- `SELECT * FROM ML_MODEL_METADATA` for training history
- `INFORMATION_SCHEMA.TASK_HISTORY()` for pipeline execution
- Manual comparison of predictions vs. actual outcomes

An SE Manager or Snowflake SA should be able to open a tab and immediately answer:
1. Is the model healthy? (metrics in expected range)
2. When did it last train and score? (pipeline recency)
3. What features drive predictions? (importance ranking)
4. How accurate are its predictions against reality? (ground truth comparison)
5. Is there drift? (score distributions shifting over time)

## Requirements

### R0: Dedicated MLOps tab accessible from main navigation

A new page at `/mlops` (or a tab within existing Settings/Analytics) that surfaces model health, pipeline status, and prediction quality. Must be accessible to the same user roles that see the Command Center.

### R1: Pipeline execution history

Show when the nightly scoring task and weekly retrain task last ran, their status (success/fail/scheduled), duration, and error messages if any. Source: `INFORMATION_SCHEMA.TASK_HISTORY()`.

Must answer: "Did the pipeline run last night? Did it succeed?"

### R2: Model version registry

Show all trained model versions with:
- Version ID and timestamp
- Training row count (positive/negative class split)
- Which version is currently in production
- Notes (auto-retrained vs. manual)

Source: `ML_MODEL_METADATA` table (already exists, needs metrics populated).

### R3: Fit metrics per model version

For the production model (and optionally historical versions), display:
- Per-class precision, recall, F1, support
- Macro/weighted averages
- Confusion matrix visualization (optional but high-value)

Source: `SHOW_EVALUATION_METRICS()` — already returns per-class metrics. The retrain procedure should persist these to `ML_MODEL_METADATA.EVALUATION_METRICS` (currently NULL).

### R4: Feature importance ranking

Interactive bar chart of all 32 features ranked by importance score. Color-code by feature category (deal economics, account firmographics, engagement, etc.). Show the importance score and rank.

Source: `SHOW_FEATURE_IMPORTANCE()` — already returns ranked scores.

### R5: Prediction accuracy vs. ground truth

For deals that have closed since being scored, compare:
- Predicted outcome (Won/Lost) vs. actual outcome
- Predicted propensity score vs. actual result
- Accuracy rate, false positive rate, false negative rate

This requires joining `DEAL_PREDICTIONS` (scored at time T) against `ML_FEATURE_STORE` or the raw opportunities table (actual outcome at time T+N). Only meaningful for deals that were scored while open and have since closed.

Must answer: "Of the deals the model predicted would close, how many actually did?"

### R6: Score distribution over time

Show the distribution of propensity scores across the portfolio:
- Current distribution (histogram or density plot)
- Shift over time if multiple scoring runs are retained (optional — requires storing historical scores)

Must answer: "Is the model producing a healthy spread, or is it degenerate (all 0s, all 1s)?"

### R7: SHAP factor aggregation

Beyond the per-deal SHAP factors already displayed in the Intelligence Panel, show aggregated factor patterns:
- Which factors most frequently appear as "helps" vs. "hurts" across all scored deals
- Average magnitude per factor
- Factor distribution by quadrant (do HIGH deals have different factor profiles than AT_RISK?)

Source: `DEAL_PREDICTIONS` factor columns (Factor1–5 × Name/Value/Direction/Magnitude).

### R8: Alert indicators

Surface clear visual alerts when something is wrong:
- Model hasn't been retrained in > 14 days
- Scoring task failed
- Score distribution is degenerate (>90% in one bucket)
- Prediction accuracy drops below threshold

These don't need to be push notifications — just visible status indicators on the MLOps tab and optionally a badge on the nav icon.

## What Exists Today (Snowflake Inventory)

| Asset | Location | Status | Notes |
|-------|----------|--------|-------|
| `ML_MODEL_METADATA` table | `TDR_APP.ML_MODELS` | Exists, metrics NULL | Retrain procedure doesn't populate AUC, F1, etc. |
| `SHOW_EVALUATION_METRICS()` | Model method | Works | Returns per-class precision/recall/F1/support |
| `SHOW_FEATURE_IMPORTANCE()` | Model method | Works | Returns 32 ranked features with scores |
| `DEAL_PREDICTIONS` table | `TDR_APP.ML_MODELS` | Works | 6,408 rows with scores, factors, model_version |
| `TASK_NIGHTLY_SCORE` | `TDR_APP.ML_MODELS` | Running | CRON 0 2 * * * UTC |
| `TASK_WEEKLY_RETRAIN` | `TDR_APP.ML_MODELS` | Running | CRON 0 3 * * 0 UTC |
| Task execution history | `INFORMATION_SCHEMA.TASK_HISTORY()` | Available | Last 7 days queryable |
| Ground truth data | `ML_FEATURE_STORE` | Available | `IS_CLOSED` + `IS_WON` columns |

## Solution Shape

### A: Code Engine + Frontend (consistent with existing architecture)

#### A1: Code Engine functions (Snowflake domain)

| Function | Source | Returns |
|----------|--------|---------|
| `getMLModelMetadata` | `ML_MODEL_METADATA` | All model versions with metrics |
| `getMLEvaluationMetrics` | `SHOW_EVALUATION_METRICS()` | Per-class precision/recall/F1/support |
| `getMLFeatureImportance` | `SHOW_FEATURE_IMPORTANCE()` | Ranked feature list with scores |
| `getMLPipelineHistory` | `INFORMATION_SCHEMA.TASK_HISTORY()` | Last 30 days of task executions |
| `getMLPredictionAccuracy` | `DEAL_PREDICTIONS` JOIN `ML_FEATURE_STORE` | Predicted vs. actual for closed deals |
| `getMLScoreDistribution` | `DEAL_PREDICTIONS` | Histogram buckets with counts |
| `getMLFactorAggregation` | `DEAL_PREDICTIONS` | Factor frequency, direction, magnitude aggregates |

#### A2: Retrain procedure enhancement

Update `RETRAIN_PROPENSITY_MODEL()` to:
1. After training, call `SHOW_EVALUATION_METRICS()` and `SHOW_FEATURE_IMPORTANCE()`
2. Persist metrics to `ML_MODEL_METADATA.EVALUATION_METRICS` (VARIANT/JSON)
3. Persist feature importance to `ML_MODEL_METADATA.FEATURE_IMPORTANCE` (VARIANT/JSON)
4. Populate `POSITIVE_CLASS_COUNT` and `NEGATIVE_CLASS_COUNT`

#### A3: Frontend — MLOps page

| Section | Visual | Data Source |
|---------|--------|-------------|
| **Pipeline Status** | Two status cards (Scoring, Retraining) with last-run time, status badge, next scheduled | `getMLPipelineHistory` |
| **Model Registry** | Table of model versions, production badge, training stats | `getMLModelMetadata` |
| **Fit Metrics** | Stat cards (Precision, Recall, F1) + optional confusion matrix | `getMLEvaluationMetrics` |
| **Feature Importance** | Horizontal bar chart, color-coded by category | `getMLFeatureImportance` |
| **Prediction Accuracy** | Accuracy %, false positive/negative rates, calibration curve | `getMLPredictionAccuracy` |
| **Score Distribution** | Histogram of current scores by bucket | `getMLScoreDistribution` |
| **Factor Patterns** | Aggregated factor frequency + direction heatmap | `getMLFactorAggregation` |
| **Alerts** | Status badges at top of page (healthy/warning/critical) | Derived from all above |

#### A4: Navigation

Add "MLOps" to the sidebar navigation (icon: `Activity` or `BarChart3` from Lucide). Badge shows alert count if any warnings/criticals.

## Fit Check

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | Dedicated MLOps tab | Must-have | ✅ |
| R1 | Pipeline execution history | Must-have | ✅ |
| R2 | Model version registry | Must-have | ✅ |
| R3 | Fit metrics per model version | Must-have | ✅ |
| R4 | Feature importance ranking | Must-have | ✅ |
| R5 | Prediction accuracy vs. ground truth | Must-have | ✅ |
| R6 | Score distribution | Must-have | ✅ |
| R7 | SHAP factor aggregation | Nice-to-have | ✅ |
| R8 | Alert indicators | Nice-to-have | ✅ |

## Sprint Breakdown (Proposed)

### Sprint 32a — Snowflake Infrastructure + Code Engine (1–2 days)
*[Cortex CLI for Snowflake, Cursor for Code Engine]*
- Update `RETRAIN_PROPENSITY_MODEL()` to persist evaluation metrics and feature importance
- Create 7 Code Engine functions
- Add manifest mappings
- Manually backfill current model's metrics into `ML_MODEL_METADATA`

### Sprint 32b — Frontend MLOps Page (2–3 days)
*[Cursor]*
- New page component at `/mlops`
- Pipeline status cards
- Model registry table
- Fit metrics display (stat cards + optional confusion matrix)
- Feature importance bar chart (Recharts)
- Score distribution histogram
- Prediction accuracy section
- Factor aggregation visualization
- Alert badges
- Navigation update

### Sprint 32c — Polish + Alerts (1 day)
*[Cursor]*
- Alert threshold logic
- Nav badge for warnings
- Documentation Hub updates
- Historical score retention (optional — for drift detection)

## Rabbit Holes

- Don't build a retrain button in v1 — the Snowflake Task handles this automatically. Manual retrain can be a future addition.
- Don't build real-time monitoring — this is a dashboard, not an alerting system. Check it when you want to, not push notifications.
- Don't store full prediction history for drift detection in v1 — just show the current snapshot. Drift requires storing scores over time, which is a schema change.
- Don't over-engineer the confusion matrix — a simple 2x2 table is enough; no need for interactive ROC curves in v1.

## No-Gos

- No model training from the UI — training happens via Snowflake Tasks
- No feature engineering from the UI — features are defined in SQL views
- No A/B model comparison in v1 — one production model at a time
- No external MLOps platform integration (MLflow, Weights & Biases, etc.)

---

## Model Calibration & Distribution Health (Sprint 32d)

### Problem

The current model produces a **bimodal, overconfident distribution**:

| Bucket | % of 6,408 Deals | Concern |
|--------|-------------------|---------|
| 0–5% | 34.9% (2,234) | Over a third at near-zero — false certainty |
| 5–95% | 50.4% (3,234) | Only half get nuanced scores |
| 95–100% | 14.7% (940) | 1 in 6 at near-certain — implausible for sales |

616 deals scored above 97%. 2,148 below 3%. In sales, almost nothing is 97% certain.

**Root cause: covariate shift on the #1 feature.**

`DAYS_IN_PIPELINE` (14.6% importance — most influential feature) has a 3.5x distribution gap:

| Dataset | Avg Days | Median Days |
|---------|----------|-------------|
| Training (closed deals) | 153 | 90 |
| Scoring (open pipeline) | 532 | 365 |

Long pipeline = losing in training data. Current pipeline deals are naturally older → model over-predicts "Lost" for older deals and over-predicts "Won" for newer ones. This is feature drift, not signal.

Training data also spans many years (DAYS_IN_PIPELINE from -2,360 to 2,758), including deals from very different market/process eras.

### Requirements (Calibration-specific)

#### R9: Score capping to eliminate false certainty

Raw GBT probabilities should be capped to a credible range. No sales deal is 99.8% certain or 0.02% certain. Cap to [3%, 97%] (or configurable bounds). This is applied in the scoring procedure, not the UI.

Must answer: "Are extreme scores real signal or model overconfidence?"
Answer: They're overconfidence. Cap them.

#### R10: Training recency filter

Training on all-time historical deals introduces distributional mismatch. Deals from 2020 had different ACV ranges, sales processes, and market conditions than 2026 pipeline. Filter training data to the last 3 years (configurable) to reduce covariate shift.

#### R11: DAYS_IN_PIPELINE normalization

Cap raw days at 730 (2 years) in both training and scoring views. Beyond 730 days, additional pipeline time has diminishing predictive signal and introduces extreme feature values. Alternatively, use log-transform or percentile rank.

#### R12: Ground truth tracking

When a deal that was previously scored closes (won or lost), preserve its pre-close prediction so we can measure real-world accuracy. This enables:
- Calibration curves (predicted % vs actual win rate by bucket)
- Brier score
- Time-lagged accuracy reports

Implementation: Add a `PREDICTION_SNAPSHOTS` table that stores `(OPPORTUNITY_ID, PROPENSITY_SCORE, PREDICTION, SNAPSHOT_DATE)`. The scoring procedure appends a snapshot before overwriting. When deals close, their historical snapshots remain for comparison.

#### R13: Distribution health check (feeds R8 alerts)

Automated check after each scoring run:
- If >30% of scores fall in any single 10% bucket → warning
- If >50% of scores fall in the top or bottom 10% → critical
- If mean predicted win rate deviates from training base rate by >15 percentage points → warning

These feed the alert indicators (R8) on the MLOps tab.

### Calibration Fit Check

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R9 | Score capping [3%, 97%] | Must-have | ✅ |
| R10 | Training recency filter (3 years) | Must-have | ✅ |
| R11 | DAYS_IN_PIPELINE normalization (cap at 730) | Must-have | ✅ |
| R12 | Ground truth tracking (prediction snapshots) | Must-have | ✅ |
| R13 | Distribution health check (alert feed) | Nice-to-have | ✅ |

### Updated Sprint Breakdown

#### Sprint 32a — Model Calibration & Retrain (1–2 days)
*[Cortex CLI for Snowflake]*

This sprint runs FIRST — it fixes the model quality before building the monitoring UI.

- [ ] Update `ML_TRAINING_DATA_CLEAN` to filter for deals closed within the last 3 years
- [ ] Cap `DAYS_IN_PIPELINE` at 730 in both `ML_TRAINING_DATA_CLEAN` and `ML_PIPELINE_FEATURES`
- [ ] Add score capping to `SCORE_PIPELINE_DEALS()`: `GREATEST(0.03, LEAST(0.97, score))`
- [ ] Create `PREDICTION_SNAPSHOTS` table
- [ ] Update `SCORE_PIPELINE_DEALS()` to append snapshots before overwriting
- [ ] Retrain model on recency-filtered, normalized data
- [ ] Re-score all pipeline deals
- [ ] Verify score distribution is less bimodal (target: <25% in any single 10% bucket)
- [ ] Update `RETRAIN_PROPENSITY_MODEL()` to persist evaluation metrics and feature importance to `ML_MODEL_METADATA`
- [ ] Backfill current model's metrics into `ML_MODEL_METADATA`

#### Sprint 32b — Code Engine Functions (1 day)
*[Cursor for Code Engine JS]*

- [ ] Create 7 Code Engine functions (metadata, eval metrics, feature importance, pipeline history, prediction accuracy, score distribution, factor aggregation)
- [ ] Add manifest mappings

#### Sprint 32c — Frontend MLOps Page (2–3 days)
*[Cursor]*

- [ ] New page component at `/mlops`
- [ ] Pipeline status cards (scoring + retraining)
- [ ] Model registry table
- [ ] Fit metrics display (precision/recall/F1 stat cards)
- [ ] Feature importance bar chart (Recharts, color-coded by category)
- [ ] Score distribution histogram
- [ ] Prediction accuracy section (calibration curve when ground truth data accumulates)
- [ ] Factor aggregation visualization
- [ ] Alert badges + nav badge
- [ ] Navigation update

#### Sprint 32d — Polish + Documentation (1 day)
*[Cursor]*

- [ ] Alert threshold logic and visual indicators
- [ ] Distribution health check integration
- [ ] Documentation Hub updates (new MLOps section)
- [ ] IMPLEMENTATION_STRATEGY.md update (Pillar 18)

## Open Questions

1. Should this be a top-level nav item or a sub-tab within Settings/Analytics?
2. Should prediction accuracy auto-refresh, or is it a manual "Calculate" action (the ground truth join could be expensive)?
3. Score capping bounds: [3%, 97%] is proposed. Should these be configurable in Settings?
4. Training recency: 3 years is proposed. Should this be configurable, or is it a fixed engineering decision?
