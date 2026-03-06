---
shaping: true
status: draft
appetite: large (3–4 sprints)
---

# Dataset Swap & Propensity-to-Close Model

## Problem

The app currently runs on a thin slice of the available deal data. The `opportunitiesmagic` dataset in `manifest.json` maps only 33 columns, but the underlying SFDC data (`forecast_page_opportunities_c`) contains 300+ fields — including historical win/loss counts, sales process milestones, account firmographics, engagement signals, and unstructured text fields that are invisible to the app today.

This creates two gaps:

**Gap 1: The app can't answer "Will this deal close?"** The deterministic TDR score answers "Is this deal technically complex enough for a TDR?" — but says nothing about close probability. An SE Manager looking at a 90-point TDR score deal has no idea if it's a 15% long-shot or an 85% near-certainty. Both get the same "CRITICAL" treatment. The data to build a propensity model exists in SFDC, but the app doesn't ingest it.

**Gap 2: The deterministic score uses 9 hand-coded factors, but the real predictive features might be different.** Maybe People AI Engagement Level matters more than ACV. Maybe Historical Account Win Rate is the single strongest predictor. Maybe Services Ratio correlates with close probability in ways nobody hand-coded. The app can't discover these patterns because it doesn't have the columns.

**The solution is two-part:** (1) swap the dataset to include all columns needed for both the app and the ML model, and (2) build a propensity-to-close model that produces a 0–100% score for every deal, composing with the existing TDR score to create a two-axis prioritization system.

---

## Requirements

### R1: Dataset swap — expand without breaking

The new dataset must include every column the app currently uses (all 33 mapped in `manifest.json`) plus all columns required for ML feature engineering. The swap must not break any existing functionality — every page, component, hook, and Code Engine function that reads from `opportunitiesmagic` must continue working after the swap.

### R2: New columns for ML features

The expanded dataset must include (at minimum) these field groups not currently mapped:

| Category | Fields Needed | Why |
|----------|--------------|-----|
| **Account firmographics** | Account Revenue USD, Account Employees, Strategic Account, Region, Sales Segment, Sales Vertical | Core ML features — account-level predictors |
| **Deal economics (extended)** | Platform Price, Professional Services Price, Line Items, Contract Type, Pricing Type, CPQ | Deal complexity signals |
| **Sales process milestones** | Discovery Call Completed, Demo Completed Date, Pricing Call Date, Gate Call Completed, Has Pre-Call Plan, Has ADM/AE Sync Agenda | Sales process completeness feature |
| **Engagement signals** | People AI Engagement Level | Engagement proxy |
| **Historical outcomes** | Is Closed, Total Closed Won Count, Total Closed Lost Count, New Logo Won Count, New Logo Lost Count, Upsell Won Count, Upsell Lost Count, Total Opty Count | Training labels + derived win-rate features |
| **Unstructured text** | Forecast Comments, Next Step, Why Do Anything, Why Domo, Why Now, Manager Comments, Business Challenge | Phase 2 AI-enriched features |
| **Deal flags** | Is Partner, Is Pipeline, Non-Competitive Deal | Direct ML features |
| **Dates** | Created Date | Time-in-pipeline feature |

### R3: Propensity model predicts close probability

The model answers: "How likely is this deal to close?" — not "Should this deal get a TDR?" The target variable is `Is Won` (binary: Won = 1, Lost = 0) from historically closed deals. The deterministic TDR score continues to answer the technical complexity question independently.

### R4: Two-axis composition

The propensity score (Y-axis, 0–100%) composes with the deterministic TDR score (X-axis, 0–100) into a quadrant:

| | Low Technical Complexity | High Technical Complexity |
|---|---|---|
| **High Close Propensity** | Standard Process — TDR not needed | **CRITICAL TDR** — closeable + technically complex |
| **Low Close Propensity** | Skip | Monitor / Rescue |

The CRITICAL quadrant is the TDR priority queue. SE Managers should focus TDR time on deals that are both winnable AND technically complex.

### R5: Propensity score is a primary metric

The propensity score must surface in the core app experience — not buried in a settings page. It should be as visible and actionable as ACV, Stage, and TDR Score are today. Specific surfaces: Command Center table, deal detail, TDR Workspace intelligence panel, portfolio analytics.

### R6: Model trains and infers in Snowflake

Use `SNOWFLAKE.ML.CLASSIFICATION` — native, GA, pure SQL. No Python runtime, no UDFs, no external compute. Training and inference happen through the same Code Engine → Snowflake SQL API pattern as every other function. Model persists as a schema object with built-in feature importance and evaluation metrics.

### R7: Graceful degradation

If the model hasn't been trained yet, or training data is insufficient (<100 closed deals), or inference fails — the app must still work. The propensity column shows "—" or "Not available." The TDR score continues to function independently. No hard dependency.

---

## Solution Shape

### Part 0: Exploratory Data Analysis (prerequisite)

The existing notebook (`notebooks/01_data_exploration.ipynb`) needs overhauling. It currently targets the old Snowflake table (`Forecast_Page_Opportunities_Magic_SNF`). The revised EDA must:

1. Connect to `TDR_APP.PUBLIC.Forecast_Page_Opportunities_Magic_SNFv2`
2. Validate label distribution: count of Won, Lost, Open deals; class balance
3. Feature completeness: null rates for all candidate ML features across closed AND open deals
4. Distribution analysis: ACV, Stage Age, Stage, Type, Forecast Category — split by Won vs Lost
5. Univariate predictive power: mean-diff analysis for key numeric features between Won and Lost
6. Correlation analysis: identify multicollinear features to avoid redundancy
7. Derived feature preview: account win rate, stage velocity, services ratio, sales process completeness
8. Data quality: detect outliers, validate date parsing, check categorical cardinality
9. Output: clear go/no-go recommendation on whether the dataset has sufficient labeled data for training

This must run successfully before any model training begins. If labeled data is insufficient (<100 closed deals), the model degrades gracefully and the EDA documents why.

### Part 1: Dataset Swap

#### 1A. New manifest mapping

Swap the `dataSetId` in all manifest files from `6f12ec25-0018-4ed3-adfe-93ebdfad41fe` to `6ae5896e-e13d-48ac-a9fb-c6e9116b4bb4`. Keep the alias `opportunitiesmagic` unchanged to avoid a codebase-wide rename. Add ~40 new field mappings for ML features.

**Files requiring the dataset ID swap:**
- `dist/manifest.json`
- `public/manifest.json`
- `manifest.json` (root)

#### Column Reconciliation — Existing Fields (must all survive)

Verified against actual v2 sample (`samples/forecast_page_opportunities_cv2.json` — 500 records, 506 columns).

**32 of 34 existing columns confirmed present. 2 columns missing — replacements identified.**

| # | Alias | Column Name (old) | v2 Status | Used In Frontend | Notes |
|---|-------|-------------------|-----------|-----------------|-------|
| 1 | `OpportunityId` | Opportunity Id | ✅ | id, all lookups | Primary key |
| 2 | `OpportunityName` | Opportunity Name | ✅ | dealName | Display |
| 3 | `AccountName` | Account Name | ✅ | account | Display, search |
| 4 | `MgrForecastName` | Mgr Forecast Name | ⚠️ **MISSING** | owner (primary) | **Remap to "Forecast Manager"** (29% null — fallback to `Domo Opportunity Owner`). Old column had SE Manager names; "Forecast Manager" has same data in v2. Must update `transformOpportunityToDeal()` owner logic. |
| 5 | `DomoForecastCategory` | Domo Forecast Category | ✅ | forecastCategory, TDR scoring | Scoring factor |
| 6 | `Stage` | Stage | ✅ | stage, stageNumber | Display, scoring, filter |
| 7 | `CloseDate` | Close Date | ✅ | closeDate | Display, charts |
| 8 | `CurrentFQ` | Current FQ | ⚠️ **MISSING** | — (not used in frontend) | **Drop from manifest.** Never consumed by frontend code. Nearest v2 column ("Fiscal Quarter Relative to Current") is a different data type (relative offset, not FQ string). Safe to remove. |
| 9 | `CloseDateFQ` | Close Date FQ | ✅ | closeDateFQ | Display |
| 10 | `Likely` | Likely | ✅ | acv (primary source) | ACV display |
| 11 | `High` | High | ✅ | — | Manifest only |
| 12 | `AcvUsd` | ACV (USD) | ✅ | acv (fallback) | ACV display fallback |
| 13 | `AcvRecurring` | ACV (USD) Recurring | ✅ | — | Manifest only |
| 14 | `AcvNonRecurring` | ACV (USD) Non-Recurring | ✅ | — | Manifest only |
| 15 | `TcvUsd` | TCV (USD) | ✅ | — | Manifest only |
| 16 | `IsWon` | Is Won | ✅ | — | ML training label |
| 17 | `LastActivityDate` | Last Activity Date | ✅ | — | Manifest only |
| 18 | `StageAge` | Stage Age | ✅ | stageAge, riskLevel, scoring | Scoring factor, filter |
| 19 | `NumberOfCompetitors` | Number of Competitors | ✅ | numCompetitors, scoring | Scoring factor |
| 20 | `DomoOpportunityOwner` | Domo Opportunity Owner | ✅ | accountExecutive, owner fallback | Display |
| 21 | `LastModifiedDate` | Last Modified Date | ✅ | — | Manifest only |
| 22 | `Type` | Type | ✅ | dealType, scoring | Scoring factor |
| 23 | `LeadSource` | Lead Source | ✅ | — | Manifest only, ML feature |
| 24 | `PartnerInfluence` | Partner Influence | ✅ | partnerInfluence, scoring | Scoring factor |
| 25 | `PartnersInvolved` | Partners Involved | ✅ | partnerSignal, partnersInvolved | Scoring factor |
| 26 | `PartnerTier` | Partner Tier | ✅ | — | Manifest only |
| 27 | `PartnerType` | Partner Type | ✅ | — | Manifest only |
| 28 | `SnowflakeTeamPicklist` | Snowflake Team Picklist | ✅ | snowflakeTeam, scoring | Scoring factor |
| 29 | `SalesConsultant` | Sales Consultant | ✅ | salesConsultant, SE mapping | Team display |
| 30 | `PocSalesConsultant` | PoC Sales Consultant | ✅ | pocSalesConsultant, SE mapping | Team display |
| 31 | `DealCode` | Deal Code | ✅ | dealCode, scoring | Scoring factor |
| 32 | `PrimaryPartnerRole` | Primary Partner Role | ✅ | primaryPartnerRole, partnerSignal | Scoring factor |
| 33 | `WebisteDomain` | Webiste Domain | ✅ | websiteDomain | Enrichment lookups (typo preserved) |
| 34 | `Competitors` | competitors | ✅ | competitors | Display, scoring |

**Migration actions for missing existing columns:**

These two columns were previously identified and analyzed in the prior dataset exploration (`cursor_machine_learning_model_for_deal.md`, lines ~94889–95061). That analysis traced both columns through `useDomo.ts`, `domo.ts`, and `manifest.json`, whittling the 2 issues down to 1 real concern (`Mgr Forecast Name` remap) plus a clean removal (`Current FQ`).

1. **`MgrForecastName` → remap to `Forecast Manager`** — The column was originally named "Forecast Manager" in the dataset, then renamed to "Mgr Forecast Name" (which caused a production bug — see `cursor_code_engine_functions_in_manifes.md` ~line 16903). Multi-fallback `get()` calls were added to handle both names. In v2, the column reverts to "Forecast Manager" — the existing fallback code already handles this seamlessly. Manifest field name updates from "Mgr Forecast Name" to "Forecast Manager"; alias `MgrForecastName` stays the same. Note: "Forecast Manager" has 29% nulls in v2 — the existing fallback to `Domo Opportunity Owner` already handles this.

2. **`CurrentFQ` → drop** — Prior analysis confirmed this field is essentially useless: it only ever contains a single value (e.g. `2026-Q1`) derived from the current date at the dataset level. In `useDomo.ts` (lines ~377-380) it just gets added to the same `quarters` Set as `Close Date FQ`. If the current quarter needs to always appear in the filter dropdown, derive it from `new Date()` in 2 lines of TypeScript. Remove from `manifest.json`, `OPPORTUNITY_FIELD_MAP`, and `useDomo.ts`. Zero regression risk.

#### New Fields — ML Features and Expanded App Data

Verified against actual v2 sample (`samples/forecast_page_opportunities_cv2.json`).

**33 of 37 proposed columns confirmed present in v2. 4 columns do NOT exist — removed from plan.**

| # | Alias (new) | Column Name | v2 Status | Purpose |
|---|-------------|-------------|-----------|---------|
| 35 | `AccountRevenueUsd` | Account Revenue USD | ✅ | ML feature (log-transform) |
| 36 | `AccountEmployees` | Account Employees | ✅ | ML feature (log-transform) |
| 37 | `StrategicAccount` | Strategic Account | ✅ | ML feature (boolean) |
| 38 | `Region` | Region | ✅ | ML feature (categorical) |
| 39 | `SalesSegment` | Sales Segment | ✅ | ML feature (categorical) |
| 40 | `SalesVertical` | Sales Vertical | ✅ | ML feature (categorical) |
| 41 | `PlatformPrice` | Platform Price | ✅ | ML feature: services ratio |
| 42 | `ProfessionalServicesPrice` | Professional Services Price | ✅ | ML feature: services ratio |
| 43 | `LineItems` | Line Items | ✅ | ML feature: deal complexity |
| 44 | `ContractType` | Contract Type | ✅ | ML feature (categorical) |
| 45 | `PricingType` | Pricing Type | ✅ | ML feature (categorical) |
| 46 | `CPQ` | CPQ | ✅ | ML feature (boolean) |
| 47 | `IsPartner` | Is Partner | ✅ | ML feature (boolean) |
| 48 | `IsPipeline` | Is Pipeline | ✅ | ML feature (boolean) |
| 49 | `NonCompetitiveDeal` | Non-Competitive Deal | ✅ | ML feature (boolean) |
| 50 | `PeopleAiEngagement` | People AI Engagement Level | ✅ | ML feature: engagement proxy |
| 51 | `IsClosed` | Is Closed | ✅ | ML training filter |
| 52 | `TotalClosedWonCount` | Total Closed Won Count | ✅ | ML feature: account win rate |
| 53 | `TotalClosedLostCount` | Total Closed Lost Count | ✅ | ML feature: account win rate |
| 54 | `NewLogoWonCount` | New Logo Won Count | ✅ | ML feature: type-specific win rate |
| 55 | `NewLogoLostCount` | New Logo Lost Count | ✅ | ML feature: type-specific win rate |
| 56 | `UpsellWonCount` | Upsell Won Count | ✅ | ML feature: type-specific win rate |
| 57 | `UpsellLostCount` | Upsell Lost Count | ✅ | ML feature: type-specific win rate |
| 58 | `TotalOptyCount` | Total Opty Count | ✅ | ML feature: account density |
| 59 | `CreatedDate` | Created Date | ✅ | ML feature: days since created |
| 60 | `DiscoveryCallCompleted` | Discovery Call Completed | ✅ | ML feature: process completeness |
| 61 | `DemoCompletedDate` | Demo Completed Date | ✅ | ML feature: process completeness |
| 62 | `PricingCallDate` | Pricing Call Date | ✅ | ML feature: process completeness |
| 63 | `GateCallCompleted` | Gate Call Completed | ✅ | ML feature: process completeness |
| 64 | `HasPreCallPlan` | Has Pre-Call Plan | ✅ | ML feature: process flag |
| 65 | `HasAdmAeSyncAgenda` | Has ADM/AE Sync Agenda | ✅ | ML feature: process flag |
| 66 | `ForecastComments` | Forecast Comments | ✅ | Phase 2: AI text enrichment |
| 67 | `NextStep` | Next Step | ✅ | Phase 2: AI text enrichment |
| ~~68~~ | ~~`WhyDoAnything`~~ | ~~Why Do Anything~~ | ❌ **NOT IN v2** | ~~Phase 2: AI text enrichment~~ — **Removed** |
| ~~69~~ | ~~`WhyDomo`~~ | ~~Why Domo~~ | ❌ **NOT IN v2** | ~~Phase 2: AI text enrichment~~ — **Removed** |
| ~~70~~ | ~~`WhyNow`~~ | ~~Why Now~~ | ❌ **NOT IN v2** | ~~Phase 2: AI text enrichment~~ — **Removed** |
| 68 | `BusinessChallenge` | Business Challenge | ✅ | Phase 2: AI text enrichment |
| ~~71~~ | ~~`ManagerComments`~~ | ~~Manager Comments~~ | ❌ **NOT IN v2** | ~~Phase 2: AI text enrichment~~ — **Removed** |

**Revised totals: 32 existing + 33 new = 65 field mappings** (was 34 + 37 = 71; removed 2 existing + 4 proposed).

**Note on removed Phase 2 text columns:** "Why Do Anything", "Why Domo", "Why Now", and "Manager Comments" do not exist in the v2 dataset. These were planned for AI text enrichment only (not ML features). If these fields become available in a future dataset version, they can be added without breaking changes. The 2 confirmed text fields (`Forecast Comments`, `Next Step`) plus `Business Challenge` still provide AI enrichment surface area.

#### EDA Candidates — Additional v2 Columns Worth Evaluating

The v2 dataset has 506 columns total. The 65 mapped above were selected for known app or ML use. During Sub-Sprint B (EDA), the following unmapped columns should be evaluated as potential additional ML features:

| Column | Null % | Why Interesting |
|--------|--------|----------------|
| Customer Tenure (Months) | 59% | Direct tenure signal — strong for renewal/upsell propensity |
| Customer Type | 0% | "Domo Customer" vs prospect — categorical signal |
| Revenue (USD) | 1% | High-completeness revenue field, may differ from ACV |
| Revenue Band | 0% | Clean categorical bucketing of account size |
| Account Status | 0% | Account health state (Active, Cancelled, etc.) |
| Health Grade GPA | 69% | Direct health indicator ("A" through "F") |
| Retention Team | 9% | Which team handles retention — segment signal |
| Forecast Owner Tenure | 30% | Rep experience signal — longer tenure = higher close? |
| Customer Tenure Category | 0% | Clean categorical (e.g. "Has yet to renew") |
| StageDate1–5 | 5–75% | Stage progression timestamps — derive velocity features |
| Total Won ACV | 55% | Historical account value |
| Cancel Category / Cancelled Date | 82% | Churn risk context (sparse but powerful when present) |
| 6sense Account Intent Score | 0% | Intent signal (mostly "not set" — check real distribution) |

These are not committed to the manifest yet — they will be evaluated for completeness, signal quality, and marginal gain during EDA. If any prove high-signal, they'll be added to the manifest in Sub-Sprint A′ (a quick follow-up).

#### 1B. TypeScript interface expansion

Expand `DomoOpportunity` in `src/lib/domo.ts` and `OPPORTUNITY_FIELD_MAP` to include all new fields. Add a separate interface or extend the existing one:

```typescript
// New fields needed in DomoOpportunity
'Account Revenue USD': number | null;
'Account Employees': number | null;
'Strategic Account': boolean | null;
'Region': string | null;
'Sales Segment': string | null;
'Sales Vertical': string | null;
'Platform Price': number | null;
'Professional Services Price': number | null;
'Line Items': number | null;
'Contract Type': string | null;
'Pricing Type': string | null;
'CPQ': boolean | null;
'Is Partner': boolean | null;
'Is Pipeline': boolean | null;
'Non-Competitive Deal': boolean | null;
'People AI Engagement Level': number | null;
'Is Closed': boolean | null;
'Total Closed Won Count': number | null;
'Total Closed Lost Count': number | null;
'Created Date': string | null;
// ... etc
```

#### 1C. Backward compatibility

Every existing reference to the old field aliases must continue working. The `OPPORTUNITY_FIELD_MAP` grows but nothing is removed. `transformOpportunityToDeal()` in `useDomo.ts` is extended with new fields on the `Deal` interface — existing fields are untouched.

#### 1D. Deal type expansion

The `Deal` interface in `src/types/tdr.ts` gains new optional properties for the expanded data:

```typescript
// New Deal properties
accountRevenue?: number;
accountEmployees?: number;
strategicAccount?: boolean;
region?: string;
salesSegment?: string;
servicesRatio?: number;
dealComplexityIndex?: number;
salesProcessCompleteness?: number;
propensityScore?: number;      // ML-generated
propensityQuadrant?: string;   // CRITICAL | STANDARD | MONITOR | SKIP
```

### Part 2: ML Feature Pipeline

#### 2A. Feature Store view (Snowflake)

A view `ML_FEATURE_STORE` (or `V_ML_FEATURES`) that computes all 19 derived features from the raw opportunity data:

| Derived Feature | Formula |
|----------------|---------|
| `ACCOUNT_WIN_RATE` | Won / (Won + Lost) per account |
| `TYPE_SPECIFIC_WIN_RATE` | Win rate by deal type (New Logo vs Upsell) |
| `STAGE_VELOCITY_RATIO` | Stage Age / avg Stage Age for segment |
| `QUARTER_URGENCY` | 1 / (days until quarter end + 1) |
| `DEAL_COMPLEXITY_INDEX` | Normalized(Line Items + Competitors + Services Ratio) |
| `SERVICES_RATIO` | Professional Services / Total Price |
| `SALES_PROCESS_COMPLETENESS` | Non-null milestones / 7 |
| `REVENUE_PER_EMPLOYEE` | ACV / Account Employees |
| `ACV_NORMALIZED` | Z-score within Sales Segment |
| `DAYS_SINCE_CREATED` | Now - Created Date |
| `STAGE_ORDINAL` | Stage string → integer 1–7 |
| `DEAL_COMPLEXITY_ENCODED` | Low / Medium / High → 1 / 2 / 3 |
| `HAS_THESIS` | People AI Engagement populated? |
| `HAS_STAKEHOLDERS` | Snowflake Team Picklist populated? |
| `AI_MATURITY_ENCODED` | People AI Engagement → 1–5 |
| ... | (19 total) |

This view joins the raw opportunity data with computed features, producing one row per deal with all features ready for model input.

#### 2B. Training data view

A view `ML_TRAINING_DATA` that filters to closed deals only (`Is Closed = true`) and includes the target label (`IS_WON`) alongside all features. This is the input to `SNOWFLAKE.ML.CLASSIFICATION`.

### Part 3: Model Training & Inference

#### 3A. Model creation

```sql
CREATE OR REPLACE SNOWFLAKE.ML.CLASSIFICATION DEAL_CLOSE_PROPENSITY (
  INPUT_DATA => SYSTEM$REFERENCE('VIEW', 'TDR_APP.TDR_DATA.ML_TRAINING_DATA'),
  TARGET_COLNAME => 'IS_WON',
  CONFIG_OBJECT => {'ON_ERROR': 'SKIP'}
);
```

The model auto-handles encoding, validation splits, and hyperparameter tuning. No Python. No external compute.

#### 3B. Single-deal inference (real-time)

New Code Engine function `getWinProbability`:

```sql
SELECT
  pred:class::VARCHAR AS prediction,
  ROUND(pred:probability:1::FLOAT * 100, 1) AS propensity_pct
FROM (
  SELECT DEAL_CLOSE_PROPENSITY!PREDICT(
    OBJECT_CONSTRUCT(
      'ACV_LOG', :acv_log,
      'STAGE_ORDINAL', :stage_ordinal,
      'STAGE_AGE', :stage_age,
      'ACCOUNT_WIN_RATE', :account_win_rate,
      -- ... all features
    )
  ) AS pred
);
```

Latency: ~50–200ms via SQL API. Fits the existing Code Engine call pattern.

#### 3C. Batch scoring (nightly)

Snowflake Task scores all open pipeline deals nightly → inserts into `DEAL_ML_PREDICTIONS` table. The app reads batch predictions as the default; real-time scoring is a fallback for deals scored after the nightly run.

#### 3D. Retraining

Stored procedure `RETRAIN_PROPENSITY_MODEL` rebuilds the model from the latest training data. Snowflake Task runs it weekly (or biweekly). Metadata (accuracy, precision, recall, feature importance, sample count) logged to `ML_MODEL_METADATA`.

### Part 4: App Integration

#### 4A. Command Center table

New "Win Propensity" column in the AG Grid deals table:
- Shows percentage: "82%", "47%", "15%"
- Color-coded: >70% green, 40–70% amber, <40% red
- Sortable — "sort by propensity descending" surfaces the most closeable deals
- Filterable — filter to "high propensity" deals only

#### 4B. Quadrant view (new)

Scatter plot: propensity (Y) × TDR score (X). Each dot is a deal, colored by quadrant:
- Top-right (CRITICAL): red — both high propensity and high technical complexity
- Top-left (STANDARD): green — will close, TDR not critical
- Bottom-right (MONITOR): amber — complex but uncertain close
- Bottom-left (SKIP): grey

This view becomes a primary navigation surface for SE Managers deciding where to allocate TDR time.

#### 4C. Intelligence Panel — Propensity Card with SHAP Explanations

Propensity card alongside TDR Score in the Intelligence Panel:
- "Close Propensity: 82%" with color badge and quadrant label ("CRITICAL TDR")
- "TDR Complexity: 71 (HIGH)" — existing score
- **SHAP factor display** — top 3–5 factors driving this deal's propensity, designed for naive users:

```
What's driving this score:

  Account Win Rate        ████████░░  0.78  ↑ Helps close
  Stage Velocity          ██████░░░░  1.4×  ↑ Moving fast
  Engagement Level        ███░░░░░░░  Low   ↓ Risk factor
  Deal Complexity         ██████░░░░  Med   → Neutral
```

Design principles for SHAP display:
- **No jargon.** Labels say "Account Win Rate" not "ACCOUNT_WIN_RATE_SHAP_VALUE"
- **Directional arrows.** ↑ = this factor increases close probability, ↓ = decreases it, → = neutral
- **Magnitude bars.** Horizontal bar width shows how much each factor matters relative to the others
- **Plain English tooltips.** Hovering on "Account Win Rate ↑" shows: "This account has closed 78% of past deals — well above the 45% average. This is a strong positive signal."
- **Color-coded.** Green bars for ↑ factors, red for ↓ factors, grey for → neutral
- **Limited to top 5.** Don't overwhelm — show the factors that matter most for *this specific deal*

SHAP values come from `SNOWFLAKE.ML.CLASSIFICATION`'s `SHOW_FEATURE_IMPORTANCE()` (global) combined with per-prediction probability decomposition. The Code Engine function `getWinProbability` returns `topFactors[]` alongside the propensity score.

#### 4D. Why TDR? enhancement

The existing "Why TDR?" trigger pills expand to include propensity factors:
- Current: "Material ACV", "Cloud Partner", "Competitive Displacement", etc.
- New: "High Win Rate Account (0.78)", "Fast Stage Velocity (1.4×)", "Strong Engagement"

#### 4E. Portfolio analytics

New propensity-aware metrics:
- "Weighted propensity: 62% across portfolio" (pipeline-weighted average)
- "X deals in CRITICAL quadrant" (high propensity + high complexity)
- "Y deals ML flags as <20% — portfolio risk"
- Propensity distribution histogram

### Part 5: Code Engine & Manifest

#### 5A. New Code Engine functions

| Function | Parameters | Returns | Trigger |
|----------|-----------|---------|---------|
| `getWinProbability` | `{ opportunityId }` | `{ propensity, prediction, topFactors }` | Deal open, intelligence panel load |
| `batchScoreDeals` | `{}` | `{ scoredCount, avgPropensity }` | Nightly Snowflake Task or admin action |
| `getModelMetrics` | `{}` | `{ accuracy, precision, recall, featureImportance, sampleCount, lastTrained }` | Settings/admin page |
| `retrainModel` | `{}` | `{ status, sampleCount, accuracy }` | Admin button or scheduled task |

#### 5B. Manifest additions

Each new Code Engine function requires a `packageMapping` entry in `manifest.json`. The dataset mapping section expands with ~40 new field entries.

---

## Fit Check

| Requirement | Covered? | Notes |
|-------------|----------|-------|
| **R1: Swap without breaking** | ✅ Yes | Additive column expansion. All existing aliases preserved. Backward-compatible interface extension. |
| **R2: New columns for ML** | ✅ Yes | ~40 new field mappings covering firmographics, milestones, outcomes, engagement, text. |
| **R3: Propensity predicts close** | ✅ Yes | Target = `IS_WON`, clean SFDC ground truth. No proxy labels. |
| **R4: Two-axis composition** | ✅ Yes | Propensity × TDR score → quadrant. Quadrant logic in frontend. |
| **R5: Primary metric** | ✅ Yes | Surfaces in Command Center table, quadrant view, intelligence panel, portfolio analytics, Why TDR? pills. |
| **R6: Trains in Snowflake** | ✅ Yes | `SNOWFLAKE.ML.CLASSIFICATION` — pure SQL, same Code Engine pattern. |
| **R7: Graceful degradation** | ✅ Yes | Propensity column shows "—" when unavailable. TDR score independent. |

---

## Resolved Questions

1. **Dataset identity: same or new?** → **New dataset.** The new dataset includes historical closed deals (Won + Lost). Domo dataset ID: `6ae5896e-e13d-48ac-a9fb-c6e9116b4bb4`. Snowflake table: `TDR_APP.PUBLIC.Forecast_Page_Opportunities_Magic_SNFv2`. Proper exploratory data analysis is required before model training to validate label distribution, feature completeness, and data quality.

2. **New dataset name?** → Domo dataset ID `6ae5896e-e13d-48ac-a9fb-c6e9116b4bb4`. Alias stays `opportunitiesmagic` (avoids renaming throughout the codebase). Only the `dataSetId` changes in the manifest.

3. **How many closed deals exist?** → **Requires EDA.** The existing notebook (`notebooks/01_data_exploration.ipynb`) started this analysis but needs overhauling to target the new dataset (`Forecast_Page_Opportunities_Magic_SNFv2`). EDA is a prerequisite sub-sprint — must validate label counts, class balance, and feature fill rates before training.

4. **Feature importance display: SHAP values?** → **Yes, SHAP values, elegantly integrated for naive users.** `SNOWFLAKE.ML.CLASSIFICATION` exposes feature importance via `SHOW_FEATURE_IMPORTANCE()`. These translate to per-deal SHAP-like explanations ("This deal's propensity is driven by: Account Win Rate 0.78 ↑, Stage Velocity 1.4× ↑, Low Engagement ↓"). Display inline on every deal — not hidden in settings. Design for a user who doesn't know what SHAP is: plain English factor labels, directional arrows (↑ helps / ↓ hurts), magnitude bars. No technical jargon.

5. **Batch vs. real-time scoring default?** → **Batch default, real-time fallback.** Nightly batch scoring populates `DEAL_ML_PREDICTIONS`. Real-time scoring fires only for deals modified after the nightly run. Freshness indicator: "Scored 6 hours ago."

6. **Quadrant view: new page or Command Center tab?** → **Command Center tab.** Elegant scatter plot with quadrant coloring. Keeps the SE Manager workflow in one place. Design should be visually gorgeous — this is a showcase surface.

---

## Rabbit Holes

- **Don't build a stacking ensemble.** The context doc explored XGBoost + LightGBM + RF + LogReg ensembles. `SNOWFLAKE.ML.CLASSIFICATION` auto-tunes and auto-selects — it's ensemble-like under the hood. If it doesn't perform well enough, *then* consider a custom Snowpark Python pipeline. Start simple.
- **Don't add AI-enriched text features in Phase 1.** The unstructured text fields (Forecast Comments, Why Domo, etc.) are valuable but add complexity. Get the model working on structured features first. AI extraction is Phase 2.
- **Don't replace the deterministic TDR score.** The propensity model complements it. Both scores are visible. If they agree, confidence is high. If they disagree, that's the most interesting signal.
- **Don't build the causal inference layer yet.** The question "Did our TDR process change the outcome?" is important but requires 6–12 months of TDR session data with outcomes. The propensity baseline enables this analysis later — don't try to answer it now.
- **Don't over-engineer the quadrant.** Four quadrants, simple thresholds (e.g., propensity > 50% = "High", TDR score > 50 = "High"). Refine thresholds after seeing real model output distributions. Don't build configurable threshold sliders at launch.

---

## No-Gos

- No breaking changes to existing dataset consumption — all current fields must continue working
- No Python runtime or external compute for model training (Snowflake-native only)
- No circular logic — the deterministic TDR score is never used as a training label
- No hard dependency on the propensity model — app works without it
- No Phase 2 text features in Phase 1 — structured features only at launch
- No removal or replacement of the deterministic TDR score

---

## Implementation Sequence

| Sub-Sprint | Focus | Deliverables | Effort |
|------------|-------|-------------|--------|
| **A** | Dataset swap | Swap `dataSetId` in all 3 manifests, remap `Mgr Forecast Name` → `Forecast Manager`, drop `Current FQ`, add 33 new field mappings (65 total), expand `DomoOpportunity` interface and `OPPORTUNITY_FIELD_MAP`, expand `Deal` type, verify no regressions in existing app | 1 day |
| **B** | Exploratory data analysis | Overhaul `notebooks/01_data_exploration.ipynb` to target `Forecast_Page_Opportunities_Magic_SNFv2`. Label distribution, feature completeness, Won vs Lost distributions, correlation analysis, derived feature preview. Go/no-go for model training. | 1 day |
| **C** | ML infrastructure | `ML_FEATURE_STORE` view (19 derived features), `ML_TRAINING_DATA` view (closed deals + labels), `DEAL_ML_PREDICTIONS` table, `ML_MODEL_METADATA` table, grants | 1–2 days |
| **D** | Model training | `CREATE SNOWFLAKE.ML.CLASSIFICATION`, validate metrics via `SHOW_EVALUATION_METRICS()`, extract feature importance via `SHOW_FEATURE_IMPORTANCE()`, store metadata | 1 day |
| **E** | Code Engine + manifest | `getWinProbability` (with SHAP factors), `batchScoreDeals`, `getModelMetrics`, `retrainModel` functions, manifest `packageMapping` entries, nightly scoring Task, weekly retrain Task | 1–2 days |
| **F** | Frontend integration | Propensity column in Command Center, quadrant scatter plot (gorgeous, interactive), Intelligence Panel propensity card with SHAP factor bars, Why TDR? factor pills, portfolio metrics, graceful degradation ("—" when unavailable) | 2–3 days |

**Total: ~7–10 days across 4 focused sprints**

---

## Relationship to Existing Sprint 28

Sprint 28 in `IMPLEMENTATION_STRATEGY.md` planned a stacking ensemble with Snowpark Python notebooks. This shaping document **supersedes** that approach:

| Sprint 28 (old) | This Shape (new) |
|-----------------|-----------------|
| Stacking ensemble (XGBoost + LightGBM + RF + LogReg) | `SNOWFLAKE.ML.CLASSIFICATION` (native, auto-tunes) |
| Snowpark Python stored procedures | Pure SQL — no Python runtime |
| Python notebooks for model prototyping only | EDA notebook overhauled as prerequisite; model trains directly in Snowflake |
| 19 features in custom Feature Store table | Same 19 features, computed in a Snowflake view |
| Dataset stays as-is, ML is additive | **Dataset swap is prerequisite** — new dataset ID, 71 column mappings feed both app and model |
| No SHAP display planned | SHAP factors displayed inline per deal — designed for naive users |
| No quadrant scatter view | Gorgeous interactive quadrant scatter in Command Center |
| 4 sub-sprints (28a–28d), 5–7 days | 6 sub-sprints (A–F), 7–10 days (includes dataset swap, EDA, and frontend integration) |
| Old dataset ID `6f12ec25` | New dataset ID `6ae5896e`, Snowflake table `Forecast_Page_Opportunities_Magic_SNFv2` |

Sprint 28 in `IMPLEMENTATION_STRATEGY.md` is revised to reflect this approach.
