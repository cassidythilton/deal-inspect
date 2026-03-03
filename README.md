# DealInspect

> **AI-powered Technical Deal Review platform for sales engineering teams.** Inspect, score, and act on complex deals — combining deterministic scoring, multi-model AI intelligence, and ML-driven win propensity into a single operational workspace.

![version](https://img.shields.io/badge/version-1.53.0-blue?style=flat-square)
![platform](https://img.shields.io/badge/platform-Domo_Custom_App-6236FF?style=flat-square&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABpSURBVDhPY/wPBAxUBExQmmpg1EaqAUY0TDUHCf9HY1MDMKFhqgFGNEw1wIiGqQYY0TDVACMaphpgRMNUA4xomGqAEQ1TDTCiYaoBRjRMNcCIhqkGGNEw1QAjGqYaYETDVAN/GRgYALnDJbFPGKPnAAAAAElFTkSuQmCC)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![react](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)
![typescript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![snowflake](https://img.shields.io/badge/Snowflake-Cortex_AI-29B5E8?style=flat-square&logo=snowflake&logoColor=white)
![vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)
![tailwind](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![python](https://img.shields.io/badge/Snowpark_Python-3.10-3776AB?style=flat-square&logo=python&logoColor=white)

---

## Table of Contents

1. [What Problem Does This Solve?](#what-problem-does-this-solve)
2. [Architecture](#architecture)
3. [Key Capabilities](#key-capabilities)
4. [TDR Index — Scoring Engine](#tdr-index--scoring-engine)
5. [AI & Intelligence Stack](#ai--intelligence-stack)
6. [Deal Close Propensity ML](#deal-close-propensity-ml)
7. [Pages & Navigation](#pages--navigation)
8. [Data Model](#data-model)
9. [Design System](#design-system)
10. [Development & Deployment](#development--deployment)
11. [Project Structure](#project-structure)
12. [License](#license)

---

## What Problem Does This Solve?

SE managers oversee dozens of active deals. Some require a **Technical Deal Review (TDR)** — a structured inspection to validate architecture, partner strategy, and competitive positioning before decisions lock in. The challenge: **which deals, and when?**

DealInspect answers this by combining **three intelligence signals**:

| Signal | Source | Question It Answers | Status |
|--------|--------|---------------------|--------|
| ![score](https://img.shields.io/badge/TDR_Complexity_Score-Deterministic-56E39F?style=flat-square) | 9-factor scoring engine | *"How technically complex is this deal?"* | ![live](https://img.shields.io/badge/status-live-success?style=flat-square) |
| ![ai](https://img.shields.io/badge/AI_Recommendations-Domo_AI-6236FF?style=flat-square) | 17-factor framework | *"Which deals should I review first?"* | ![live](https://img.shields.io/badge/status-live-success?style=flat-square) |
| ![ml](https://img.shields.io/badge/Win_Probability-Stacking_Ensemble-FF6B35?style=flat-square) | ML model (Snowpark Python) | *"How likely is this deal to close?"* | ![wip](https://img.shields.io/badge/status-in_progress-yellow?style=flat-square) |

The platform then provides a structured workspace to *conduct* the review — with context-aware chat, external account intelligence, Cortex-generated briefs, and Slack distribution of the final readout.

---

## Architecture

DealInspect is a **four-layer system**. Each layer is independently valuable; together they compound.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     EXPERIENCE LAYER (React SPA)                        │
│                                                                         │
│   Command Center  │  TDR Workspace  │  Inline Chat  │  Analytics       │
│   Documentation   │  TDR History    │  Settings     │  PDF Readout     │
│                                                                         │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  INTELLIGENCE LAYER (Domo Code Engine)                   │
│                                                                         │
│   Snowflake Cortex AI          │  Perplexity        │  Sumble          │
│   ├─ AI_COMPLETE (briefs)      │  (web research,    │  (firmographic,  │
│   ├─ AI_CLASSIFY (tags)        │   citations)       │   technographic, │
│   ├─ AI_EXTRACT (entities)     │                    │   competitive)   │
│   ├─ AI_EMBED (similarity)     ├────────────────────┤                  │
│   ├─ AI_SENTIMENT (health)     │  Domo AI           │  Slack           │
│   ├─ Cortex Analyst (NL→SQL)   │  (17-factor TDR    │  (readout        │
│   └─ Cortex Search (hybrid)    │   recommendations) │   distribution)  │
│                                                                         │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     PERSISTENCE LAYER (Snowflake)                       │
│                                                                         │
│   TDR_SESSIONS  │  TDR_STEP_INPUTS  │  TDR_CHAT_MESSAGES              │
│   TDR_STRUCTURED_EXTRACTS  │  TDR_READOUTS  │  TDR_DISTRIBUTIONS      │
│   ACCOUNT_INTEL_SUMBLE  │  ACCOUNT_INTEL_PERPLEXITY                    │
│   API_USAGE_LOG  │  CORTEX_ANALYSIS_RESULTS                            │
│   ML_FEATURE_STORE  │  DEAL_ML_PREDICTIONS  │  ML_MODEL_METADATA      │
│                                                                         │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      DATA LAYER (Source Systems)                        │
│                                                                         │
│   SFDC Opportunities  │  SE Mapping  │  Forecasts  │  WCP Weekly       │
│   (via Domo Datasets — existing, unchanged)                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

| Layer | Technology | Core Principle |
|-------|-----------|---------------|
| ![exp](https://img.shields.io/badge/Experience-React_SPA-61DAFB?style=flat-square&logo=react&logoColor=white) | React 18 · TypeScript · Tailwind | Every interaction is contextual — chat, research, briefs, and insights happen inline without leaving the TDR workflow |
| ![int](https://img.shields.io/badge/Intelligence-Code_Engine-6236FF?style=flat-square) | Cortex AI · Perplexity · Sumble · Domo AI | Three AI backends, one unified context — Cortex for stored data, Perplexity for live web, Domo AI for candidate ranking |
| ![per](https://img.shields.io/badge/Persistence-Snowflake-29B5E8?style=flat-square&logo=snowflake&logoColor=white) | Snowflake · Snowpark Python | Everything is append-only — every edit, research pull, and chat message creates a timestamped row for full posterity |
| ![data](https://img.shields.io/badge/Data-SFDC_via_Domo-gray?style=flat-square) | Domo Datasets | SFDC remains the source of truth — the app enriches it but never replaces it |

---

## Key Capabilities

### ![cmd](https://img.shields.io/badge/Command_Center-Dashboard-56E39F?style=flat-square) Command Center

The operational dashboard for SE managers. Shows pipeline metrics, TDR priority distribution, close urgency trends, and a scored deals table with actionable "Why TDR?" pills. Deals can be pinned to an **Agenda** for the next TDR meeting. Domo AI auto-suggests the top 5 candidates.

<p align="center">
  <img src="docs/screenshots/command-center.png" alt="Command Center" width="800" />
</p>

### ![ws](https://img.shields.io/badge/TDR_Workspace-Three_Panel-59C9A5?style=flat-square) TDR Workspace

A three-panel layout for conducting a Technical Deal Review:

| Panel | Content |
|-------|---------|
| ![left](https://img.shields.io/badge/Left-Steps-5B6C5D?style=flat-square) | 5 required + 4 optional TDR steps with progress tracking |
| ![center](https://img.shields.io/badge/Center-Inputs-5B6C5D?style=flat-square) | Structured input area with per-field save and edit history |
| ![right](https://img.shields.io/badge/Right-Intelligence-5B6C5D?style=flat-square) | Account profile, tech landscape, competitive position, market signals, action plan, brief & verdict, risk scoring, research & similar deals |

<p align="center">
  <img src="docs/screenshots/workspace-intelligence.png" alt="TDR Workspace — Intelligence Panel" width="800" />
</p>

### ![chat](https://img.shields.io/badge/Inline_Chat-Multi_Provider-3B2C35?style=flat-square) Inline Chat

Context-aware conversational AI embedded in the workspace. The chat knows the current deal, all TDR inputs, and all cached account intelligence.

| Provider | Best For | Data Routing |
|----------|----------|---------|
| ![cortex](https://img.shields.io/badge/Snowflake_Cortex-29B5E8?style=flat-square&logo=snowflake&logoColor=white) | Questions about stored TDR/account data | In-database — no data leaves Snowflake |
| ![claude](https://img.shields.io/badge/Claude_4_Sonnet-191919?style=flat-square&logo=anthropic&logoColor=white) | Complex reasoning, TDR strategy | Via Cortex AI_COMPLETE |
| ![pplx](https://img.shields.io/badge/Perplexity-1a1a2e?style=flat-square) | Real-time web research with citations | External API via Code Engine |

<p align="center">
  <img src="docs/screenshots/workspace-chat.png" alt="TDR Workspace — Inline Chat" width="800" />
</p>

### ![intel](https://img.shields.io/badge/Account_Intelligence-One_Click-FF6B35?style=flat-square) Account Intelligence

One-click enrichment for any deal:

| Source | What You Get |
|--------|-------------|
| ![sumble](https://img.shields.io/badge/Sumble-Firmographic_+_Technographic-4A90D9?style=flat-square) | Industry, revenue, employee count, BI/CRM/cloud/DevOps/AI tool stack with confidence scores, competitive tool landscape |
| ![pplx](https://img.shields.io/badge/Perplexity-Web_Research-1a1a2e?style=flat-square) | Strategic initiatives, market position, technology decisions, competitive dynamics — with source citations |

### ![readout](https://img.shields.io/badge/TDR_Readout-PDF_+_Slack-E01E5A?style=flat-square&logo=slack&logoColor=white) TDR Readout & Distribution

After completing a TDR, generate an executive-ready **PDF readout** and distribute to Slack channels with AI-generated summary, deal team @mentions, and the PDF attached.

### ![analytics](https://img.shields.io/badge/Portfolio_Analytics-NLQ_Powered-8B5CF6?style=flat-square) Portfolio Analytics

Cross-deal pattern analysis powered by structured TDR extracts. Includes an NLQ hero bar (*"Ask Your TDR Data"*) backed by Cortex Analyst, plus charts for competitor frequency, platform distribution, entry layer patterns, risk categories, and TDR status distribution.

### ![docs](https://img.shields.io/badge/Documentation_Hub-In_App_Reference-6B7280?style=flat-square) Documentation Hub

In-app reference covering scoring methodology, app capabilities, integrations, Snowflake data model, AI model registry, glossary, and an interactive **5-layer architecture diagram** with pan/zoom navigation.

<p align="center">
  <img src="docs/screenshots/documentation.png" alt="Documentation Hub" width="800" />
</p>

---

## TDR Index — Scoring Engine

![engine](https://img.shields.io/badge/type-deterministic-56E39F?style=flat-square)
![components](https://img.shields.io/badge/components-9-blue?style=flat-square)
![range](https://img.shields.io/badge/score_range-0_to_100-orange?style=flat-square)
![file](https://img.shields.io/badge/source-tdrCriticalFactors.ts-3178C6?style=flat-square&logo=typescript&logoColor=white)

The TDR Index is a deterministic 9-component scoring engine. Base score starts at **0** — every point must be earned. Most deals land LOW or MEDIUM; only complex, high-value deals with multiple converging signals reach HIGH or CRITICAL.

### The 9 Components

| # | Component | Range | Key Logic |
|---|-----------|-------|-----------|
| 1 | ![c1](https://img.shields.io/badge/ACV_Significance-0--20-blue?style=flat-square) | 0–20 | ≥$250K → 20 · ≥$100K → 15 · ≥$50K → 10 |
| 2 | ![c2](https://img.shields.io/badge/Stage_TDR_Value-0--15-blue?style=flat-square) | 0–15 | Stage 2 (Determine Needs) → 15 · Stage 3 → 12 |
| 3 | ![c3](https://img.shields.io/badge/Cloud_Partner_Alignment-0--15-blue?style=flat-square) | 0–15 | Snowflake / Databricks / BigQuery → 15 |
| 4 | ![c4](https://img.shields.io/badge/Competitive_Pressure-0--10-blue?style=flat-square) | 0–10 | ≥2 competitors → 10 |
| 5 | ![c5](https://img.shields.io/badge/Deal_Type_Signal-0--10-blue?style=flat-square) | 0–10 | New Logo → 10 · Acquisition → 8 |
| 6 | ![c6](https://img.shields.io/badge/Forecast_Momentum-0--10-blue?style=flat-square) | 0–10 | Probable → 10 · Best Case → 8 |
| 7 | ![c7](https://img.shields.io/badge/Stage_Freshness-−10_to_+5-blue?style=flat-square) | −10 to +5 | ≤14d → +5 · >180d → −10 |
| 8 | ![c8](https://img.shields.io/badge/Deal_Complexity-0--10-blue?style=flat-square) | 0–10 | PA prefix → +5 · Multi-component → +3 |
| 9 | ![c9](https://img.shields.io/badge/Partner_Role_Strength-0--5-blue?style=flat-square) | 0–5 | Co-sell → 5 · Reseller → 3 |

### Priority Bands

| Priority | Score | Action |
|----------|-------|--------|
| ![crit](https://img.shields.io/badge/CRITICAL-≥_75-dc2626?style=flat-square) | ≥ 75 | Immediate TDR — multiple Tier 1 signals converging |
| ![high](https://img.shields.io/badge/HIGH-50--74-f97316?style=flat-square) | 50–74 | TDR strongly recommended |
| ![med](https://img.shields.io/badge/MEDIUM-25--49-eab308?style=flat-square) | 25–49 | Monitor for escalation |
| ![low](https://img.shields.io/badge/LOW-<_25-22c55e?style=flat-square) | < 25 | Standard process |

### "Why TDR?" Pills

Each deal gets up to **2 colored pills** explaining *why* it scored the way it did:

![pill](https://img.shields.io/badge/Material_Deal-Tier_1-dc2626?style=flat-square)
![pill](https://img.shields.io/badge/Cloud_Platform-Tier_1-dc2626?style=flat-square)
![pill](https://img.shields.io/badge/Shaping_Window-Tier_1-dc2626?style=flat-square)
![pill](https://img.shields.io/badge/Competitive_Displacement-Tier_2-f97316?style=flat-square)
![pill](https://img.shields.io/badge/New_Logo-Tier_2-f97316?style=flat-square)
![pill](https://img.shields.io/badge/Partner_Play-Tier_2-f97316?style=flat-square)
![pill](https://img.shields.io/badge/Forecast_Momentum-Tier_2-f97316?style=flat-square)
![pill](https://img.shields.io/badge/Enterprise_Scale-Tier_2-f97316?style=flat-square)
![pill](https://img.shields.io/badge/Stalling-Tier_3-eab308?style=flat-square)
![pill](https://img.shields.io/badge/Stalled-Tier_3-eab308?style=flat-square)
![pill](https://img.shields.io/badge/Late_Stage-Tier_3-eab308?style=flat-square)

Each pill includes an icon, dynamic label, and strategy tooltip.

### Post-TDR Score Augmentation

After a TDR begins, the score evolves with **4 additional components**:

| Component | Range | Purpose |
|-----------|-------|---------|
| ![c](https://img.shields.io/badge/Named_Competitor_Threat-0--10-purple?style=flat-square) | 0–10 | Known competitive threats surface from enrichment |
| ![c](https://img.shields.io/badge/Enrichment_Depth-0--5-purple?style=flat-square) | 0–5 | Reward for intelligence-gathering effort |
| ![c](https://img.shields.io/badge/TDR_Input_Completeness-0--10-purple?style=flat-square) | 0–10 | Percentage of TDR steps completed |
| ![c](https://img.shields.io/badge/Risk_Awareness-0--5-purple?style=flat-square) | 0–5 | Risks identified and acknowledged |

---

## AI & Intelligence Stack

![models](https://img.shields.io/badge/AI_models-11_functions-29B5E8?style=flat-square&logo=snowflake&logoColor=white)
![providers](https://img.shields.io/badge/providers-4-blue?style=flat-square)
![routing](https://img.shields.io/badge/routing-server_side_only-green?style=flat-square)

DealInspect uses AI at **eleven distinct points**, each with a different purpose:

| Function | AI Backend | Purpose | Trigger |
|----------|-----------|---------|---------|
| ![f](https://img.shields.io/badge/TDR_Candidate_Ranking-6236FF?style=flat-square) | Domo AI (text/chat) | 17-factor framework scores top 40 deals by ACV | Automatic on data load |
| ![f](https://img.shields.io/badge/TDR_Brief_Generation-29B5E8?style=flat-square) | Cortex AI_COMPLETE | Synthesizes all inputs/intel into executive summary | User-initiated |
| ![f](https://img.shields.io/badge/Entity_Extraction-29B5E8?style=flat-square) | Cortex AI_EXTRACT | Pulls competitors, technologies, risks from free text | After TDR step |
| ![f](https://img.shields.io/badge/Finding_Classification-29B5E8?style=flat-square) | Cortex AI_CLASSIFY | Categorizes Perplexity research findings | After enrichment |
| ![f](https://img.shields.io/badge/Portfolio_Insights-29B5E8?style=flat-square) | Cortex AI_AGG | Cross-deal pattern analysis from structured extracts | Analytics page |
| ![f](https://img.shields.io/badge/Sentiment_Tracking-29B5E8?style=flat-square) | Cortex AI_SENTIMENT | TDR health trend over time | Per-session |
| ![f](https://img.shields.io/badge/Similar_Deal_Discovery-29B5E8?style=flat-square) | Cortex AI_EMBED | Semantic similarity search across past TDRs | Intelligence panel |
| ![f](https://img.shields.io/badge/Natural_Language_Query-29B5E8?style=flat-square) | Cortex Analyst | "Ask Your TDR Data" — NL → SQL → results | Analytics page |
| ![f](https://img.shields.io/badge/Inline_Chat-Multi_Provider-3B2C35?style=flat-square) | Cortex / Perplexity / Domo | Context-aware Q&A within the workspace | User-initiated |
| ![f](https://img.shields.io/badge/Readout_Summary-29B5E8?style=flat-square) | Cortex AI_COMPLETE | Slack-formatted TDR outcome summary | Share workflow |
| ![f](https://img.shields.io/badge/KB_Summarization-29B5E8?style=flat-square) | Cortex AI_COMPLETE | Summarize fileset/knowledge base search results | Intelligence panel |

> All external API calls route through **Domo Code Engine functions**, keeping API keys server-side and the frontend stateless.

---

## Deal Close Propensity ML

![status](https://img.shields.io/badge/status-in_progress-yellow?style=flat-square)
![sprint](https://img.shields.io/badge/sprint-28-blue?style=flat-square)
![runtime](https://img.shields.io/badge/runtime-Snowpark_Python_3.10-3776AB?style=flat-square&logo=python&logoColor=white)
![approach](https://img.shields.io/badge/approach-stacking_ensemble-FF6B35?style=flat-square)

> Infrastructure defined · Training procedures written · Frontend integration pending

### The Problem

The deterministic TDR score answers *"How technically complex is this deal?"* but not *"How likely is this deal to close?"* A deal can score 85 on TDR complexity yet have a **15% chance of closing**. SE managers need both axes to allocate review time effectively.

### The Solution — Two-Axis Prioritization

A stacking ensemble ML model predicts `P(close)` for every pipeline deal. The propensity score composes with the deterministic TDR score to create a **2×2 quadrant**:

| | ![high-p](https://img.shields.io/badge/High_Win_Probability-✓-22c55e?style=flat-square) | ![low-p](https://img.shields.io/badge/Low_Win_Probability-✗-dc2626?style=flat-square) |
|---|---|---|
| ![high-tdr](https://img.shields.io/badge/High_TDR_Score-▲-orange?style=flat-square) | 🔴 **CRITICAL** — winnable + complex, TDR adds most value | ⚠️ **MONITOR** — complex but unlikely, investigate blockers |
| ![low-tdr](https://img.shields.io/badge/Low_TDR_Score-▼-blue?style=flat-square) | ✅ **LOW TOUCH** — likely to close, minimal SE intervention | ⬜ **DEPRIORITIZE** — unlikely + simple, not worth TDR time |

### Model Architecture

```
Level 0 (Base Models)          Level 1 (Meta-Learner)
┌─────────────────────┐
│  XGBoost            │───┐
│  LightGBM           │───┤   ┌───────────────────────┐
│  RandomForest       │───┼──▶│  LogisticRegression   │──▶ P(close)
│  LogisticRegression │───┘   │  (learned weights)    │
└─────────────────────┘       └───────────────────────┘
         │
    5-fold stratified CV
    (out-of-fold predictions)
```

| Design Decision | Detail |
|-----------------|--------|
| ![d](https://img.shields.io/badge/Training_Data-SFDC_historical-blue?style=flat-square) | `Is Won` label — clean, auditable ground truth |
| ![d](https://img.shields.io/badge/Imbalance-SMOTE-blue?style=flat-square) | SMOTE oversampling or class-weight balancing |
| ![d](https://img.shields.io/badge/Explainability-SHAP-blue?style=flat-square) | SHAP values per prediction — every score is transparent |
| ![d](https://img.shields.io/badge/Baseline-Snowflake_ML-29B5E8?style=flat-square) | Native `SNOWFLAKE.ML.CLASSIFICATION` runs alongside; ensemble must beat by >2% AUC |

### 19 Engineered Features

| Category | Features |
|----------|----------|
| ![cat](https://img.shields.io/badge/Historical-2_features-5B6C5D?style=flat-square) | Account win rate, type-specific win rate |
| ![cat](https://img.shields.io/badge/Velocity-4_features-5B6C5D?style=flat-square) | Stage velocity ratio, quarter urgency, days in stage, deal age |
| ![cat](https://img.shields.io/badge/Complexity-3_features-5B6C5D?style=flat-square) | Deal complexity index, competitor count, line item count |
| ![cat](https://img.shields.io/badge/Financial-3_features-5B6C5D?style=flat-square) | Services ratio, ACV normalized, revenue per employee |
| ![cat](https://img.shields.io/badge/Process-4_features-5B6C5D?style=flat-square) | Sales process completeness, steps completed, has thesis, has stakeholders |
| ![cat](https://img.shields.io/badge/Categorical-3_features-5B6C5D?style=flat-square) | Stage ordinal, deal complexity encoded, AI maturity encoded |

### Snowflake Infrastructure

| Object | Type | Purpose |
|--------|------|---------|
| ![obj](https://img.shields.io/badge/ML__FEATURE__STORE-table-29B5E8?style=flat-square) | Table | Pre-computed derived features, versioned by date |
| ![obj](https://img.shields.io/badge/DEAL__ML__PREDICTIONS-table-29B5E8?style=flat-square) | Table | Batch scoring results + SHAP explanations + risk flags |
| ![obj](https://img.shields.io/badge/ML__MODEL__METADATA-table-29B5E8?style=flat-square) | Table | Model registry with versioning, metrics, and lifecycle |
| ![obj](https://img.shields.io/badge/SP__TRAIN__STACKING__ENSEMBLE-procedure-purple?style=flat-square) | Snowpark Procedure | Trains ensemble with 5-fold CV |
| ![obj](https://img.shields.io/badge/SP__PREDICT__WIN__PROBABILITY-procedure-purple?style=flat-square) | Snowpark Procedure | Batch/single prediction with SHAP |
| ![obj](https://img.shields.io/badge/TASK__BATCH__SCORE-task-orange?style=flat-square) | Scheduled Task | Daily automated scoring (7 AM UTC) |
| ![obj](https://img.shields.io/badge/TASK__RETRAIN__MODEL-task-orange?style=flat-square) | Scheduled Task | Biweekly retraining (1st & 15th) |
| ![obj](https://img.shields.io/badge/ALERT__MODEL__DEGRADATION-alert-dc2626?style=flat-square) | Alert | Triggers if AUC-ROC drops below 0.65 |

### Planned Frontend Surfaces

| Surface | Integration |
|---------|------------|
| ![s](https://img.shields.io/badge/Command_Center-Deals_Table-56E39F?style=flat-square) | Win Probability column with color-coded confidence |
| ![s](https://img.shields.io/badge/Intelligence_Panel-Propensity_Card-59C9A5?style=flat-square) | SHAP top factors and risk flags per deal |
| ![s](https://img.shields.io/badge/Documentation_Hub-ML_Layer-6B7280?style=flat-square) | Architecture diagram update + model registry reference |

---

## Pages & Navigation

The app uses a collapsible sidebar with **6 routes**:

| Route | Page | Description |
|-------|------|-------------|
| ![r](https://img.shields.io/badge//-Command_Center-56E39F?style=flat-square) | **Command Center** | Pipeline dashboard — metrics, charts, scored deals table, agenda |
| ![r](https://img.shields.io/badge//workspace-TDR_Workspace-59C9A5?style=flat-square) | **TDR Workspace** | Three-panel TDR review — steps, inputs, intelligence + chat |
| ![r](https://img.shields.io/badge//history-TDR_History-5B6C5D?style=flat-square) | **TDR History** | Past TDR reviews with search and outcome filters |
| ![r](https://img.shields.io/badge//analytics-Portfolio_Analytics-8B5CF6?style=flat-square) | **Portfolio Analytics** | Cross-deal patterns, NLQ, competitor/platform/risk charts |
| ![r](https://img.shields.io/badge//docs-Documentation_Hub-6B7280?style=flat-square) | **Documentation Hub** | In-app reference — scoring, architecture, data model, glossary |
| ![r](https://img.shields.io/badge//settings-Settings-3B2C35?style=flat-square) | **Settings** | Allowed managers, ACV thresholds, feature flags, API toggles |

---

## Data Model

### ![domo](https://img.shields.io/badge/Domo_Datasets-Source_|_Read_Only-6236FF?style=flat-square) Domo Datasets

| Alias | Purpose |
|-------|---------|
| `opportunitiesmagic` | Primary pipeline data — all open SFDC opportunities |
| `forecastsmagic` | Manager-level forecast calls by quarter |
| `wcpweekly` | Weekly commit pipeline snapshots |
| `semapping` | SE-to-Manager lookup (29 rows) |

### ![sf](https://img.shields.io/badge/Snowflake-TDR__APP.TDR__DATA-29B5E8?style=flat-square&logo=snowflake&logoColor=white) Snowflake Persistence

| Table | Purpose |
|-------|---------|
| `TDR_SESSIONS` | Session lifecycle, status, outcome |
| `TDR_STEP_INPUTS` | Per-field inputs with edit history |
| `TDR_CHAT_MESSAGES` | Multi-turn chat conversations per session |
| `TDR_STRUCTURED_EXTRACTS` | AI-extracted entities (competitors, technologies, risks) |
| `TDR_READOUTS` | Generated readout metadata |
| `TDR_DISTRIBUTIONS` | Slack distribution audit log |
| `ACCOUNT_INTEL_SUMBLE` | Firmographic + technographic enrichment |
| `ACCOUNT_INTEL_PERPLEXITY` | Web research with citations |
| `CORTEX_ANALYSIS_RESULTS` | Cached AI analysis outputs (briefs, classifications) |
| `API_USAGE_LOG` | Per-call cost and latency tracking |

### ![ml](https://img.shields.io/badge/Snowflake_ML-TDR__APP.ML__MODELS-FF6B35?style=flat-square&logo=snowflake&logoColor=white) ML Tables

| Table | Purpose |
|-------|---------|
| `ML_FEATURE_STORE` | 19 derived features per opportunity, date-versioned |
| `DEAL_ML_PREDICTIONS` | Win probability + SHAP explanations + risk flags |
| `ML_MODEL_METADATA` | Model registry — versions, metrics, artifacts, lifecycle |

---

## Design System

### Color Palette

Source: [coolors.co palette](https://coolors.co/palette/56e39f-59c9a5-5b6c5d-3b2c35-2a1f2d)

| Swatch | Name | Hex | Usage |
|--------|------|-----|-------|
| ![#56E39F](https://img.shields.io/badge/-56E39F-56E39F?style=flat-square) | Emerald | `#56E39F` | Success states, Critical priority |
| ![#59C9A5](https://img.shields.io/badge/-59C9A5-59C9A5?style=flat-square) | Teal | `#59C9A5` | Accents, High priority |
| ![#5B6C5D](https://img.shields.io/badge/-5B6C5D-5B6C5D?style=flat-square) | Sage | `#5B6C5D` | Muted foregrounds, borders |
| ![#3B2C35](https://img.shields.io/badge/-3B2C35-3B2C35?style=flat-square) | Plum | `#3B2C35` | Primary buttons, badges |
| ![#2A1F2D](https://img.shields.io/badge/-2A1F2D-2A1F2D?style=flat-square) | Aubergine | `#2A1F2D` | Sidebar, deep surfaces |

The app supports ![light](https://img.shields.io/badge/light_mode-☀️-white?style=flat-square) and ![dark](https://img.shields.io/badge/dark_mode-🌙-2A1F2D?style=flat-square) via CSS custom properties. The Documentation Hub forces dark mode for visual cohesion with architecture diagrams.

---

## Development & Deployment

### Prerequisites

![node](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)
![npm](https://img.shields.io/badge/npm-9+-CB3837?style=flat-square&logo=npm&logoColor=white)
![domo](https://img.shields.io/badge/Domo_CLI-@domoinc/ryuu-6236FF?style=flat-square)

### Local Development

```bash
npm install
npm run dev          # Vite dev server at localhost:5173
```

> In dev mode, Domo SDK is unavailable — data hooks return mock data, AppDB falls back to `localStorage`, and AI functions return simulated responses.

### Build & Deploy

```bash
npm run build        # Production build → dist/
npm run deploy       # Build + publish to Domo
npm run deploy:zip   # Build + create ZIP for manual upload
npm run deploy:check # Verify manifest, thumbnail, SDK reference
```

### ML Development

![python](https://img.shields.io/badge/Python-3.10-3776AB?style=flat-square&logo=python&logoColor=white)
![jupyter](https://img.shields.io/badge/Jupyter-Notebook-F37626?style=flat-square&logo=jupyter&logoColor=white)

The ML modeling environment uses Python 3.10 (matching the Snowpark runtime):

```bash
python3.10 -m venv ml-venv
source ml-venv/bin/activate
pip install -r notebooks/requirements.txt
jupyter notebook
```

Notebooks in `notebooks/` are the prototyping environment — feature engineering and model training are iterated locally, then promoted to Snowflake stored procedures once validated.

---

## Project Structure

```
deal-inspect/
├── README.md
├── IMPLEMENTATION_STRATEGY.md       # Full implementation strategy (28 sprints)
├── manifest.json                    # Domo app manifest (datasets, collections, version)
├── package.json
├── vite.config.ts
├── tailwind.config.ts
│
├── src/
│   ├── App.tsx                      # Router + providers
│   ├── main.tsx                     # Entry point
│   ├── index.css                    # Design system (CSS variables)
│   │
│   ├── types/
│   │   └── tdr.ts                   # Core types: Deal, TDRStep, TDRSessionSummary
│   │
│   ├── lib/
│   │   ├── domo.ts                  # Domo data fetching + field normalization
│   │   ├── domoAi.ts                # Domo AI 17-factor TDR recommendations
│   │   ├── snowflakeStore.ts        # Snowflake persistence (sessions, inputs)
│   │   ├── cortexAi.ts              # Cortex AI functions (brief, classify, extract, embed)
│   │   ├── accountIntel.ts          # Sumble + Perplexity enrichment orchestration
│   │   ├── filesetIntel.ts          # Domo Fileset search + KB summarization
│   │   ├── tdrChat.ts               # Multi-provider chat (Cortex, Perplexity, Domo)
│   │   ├── tdrReadout.ts            # Readout assembly + Slack distribution
│   │   ├── tdrCriticalFactors.ts    # Scoring engine + factor detection
│   │   ├── appDb.ts                 # AppDB fallback for TDR sessions
│   │   ├── appSettings.ts           # localStorage settings
│   │   ├── constants.ts             # Allowed managers, thresholds, TDR steps
│   │   ├── tooltips.ts              # Dynamic tooltip content
│   │   └── utils.ts                 # cn() helper (clsx + tailwind-merge)
│   │
│   ├── hooks/
│   │   └── useDomo.ts               # Main data hook (fetch, join, enrich, filter)
│   │
│   ├── pages/
│   │   ├── CommandCenter.tsx         # Dashboard — metrics, charts, deals table, agenda
│   │   ├── TDRWorkspace.tsx          # Three-panel TDR review workspace
│   │   ├── TDRHistory.tsx            # Past TDR reviews
│   │   ├── TDRAnalytics.tsx          # Portfolio analytics + NLQ
│   │   ├── Documentation.tsx         # In-app reference hub
│   │   └── Settings.tsx              # App configuration
│   │
│   ├── components/
│   │   ├── TopBar.tsx                # Filter bar (quarter, manager, SE, priority)
│   │   ├── AppSidebar.tsx            # Collapsible navigation sidebar
│   │   ├── DealsTable.tsx            # Scored deals table with pills + tooltips
│   │   ├── AgendaSection.tsx         # Pinned deals + AI suggestions
│   │   ├── DealSearch.tsx            # Global deal search
│   │   ├── TDRSteps.tsx              # Step progress (workspace left panel)
│   │   ├── TDRInputs.tsx             # Step inputs (workspace center panel)
│   │   ├── TDRIntelligence.tsx       # Intelligence panel (workspace right panel)
│   │   ├── TDRChat.tsx               # Multi-provider chat component
│   │   ├── TDRShareDialog.tsx        # Slack distribution dialog
│   │   ├── CortexBranding.tsx        # Cortex AI model badges
│   │   ├── charts/
│   │   │   ├── TDRCoverageChart.tsx
│   │   │   ├── ScoreDistributionChart.tsx
│   │   │   └── CloseUrgencyChart.tsx
│   │   ├── docs/                     # Documentation Hub sections
│   │   │   ├── ArchitectureDiagram.tsx
│   │   │   ├── ScoringReference.tsx
│   │   │   ├── CapabilitiesGuide.tsx
│   │   │   ├── IntegrationsReference.tsx
│   │   │   ├── DataModelReference.tsx
│   │   │   ├── AIModelsReference.tsx
│   │   │   └── GlossaryReference.tsx
│   │   ├── pdf/
│   │   │   ├── TDRReadoutDocument.tsx  # React-PDF readout template
│   │   │   └── readoutTypes.ts
│   │   ├── icons/                    # Brand icons (Domo, Perplexity, Slack, Sumble)
│   │   └── ui/                       # shadcn/ui primitives
│   │
│   ├── layouts/
│   │   └── MainLayout.tsx            # Sidebar + <Outlet /> wrapper
│   │
│   └── data/
│       └── mockData.ts               # Mock deals for local development
│
├── sql/
│   └── bootstrap.sql                 # Snowflake DDL bootstrap
│
├── ml_infrastructure_ddl.sql         # ML schema, tables, views, stage, grants
├── ml_feature_computation.sql        # Feature engineering stored procedure
├── ml_training_procedure.sql         # Training + prediction + deployment procedures
├── ml_automation.sql                 # Tasks, Alerts, Streams, monitoring
│
├── notebooks/                        # ML prototyping (local Python)
│   └── 01_data_exploration.ipynb
│
├── codeengine/                       # Reference copies of Domo Code Engine functions
│                                     # (deployed via Domo CE IDE, not from this repo)
│
└── docs/
    └── screenshots/                  # App screenshots for README
```

> ![note](https://img.shields.io/badge/note-important-blue?style=flat-square) `codeengine/`, `samples/`, `dist/`, and `ml-venv/` are `.gitignore`d. Code Engine functions are deployed via the Domo Code Engine IDE. Build artifacts are generated with `npm run build`. The ML virtual environment is created locally per the [ML Development](#ml-development) instructions.

---

## License

![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)

This project is licensed under the [MIT License](LICENSE).
