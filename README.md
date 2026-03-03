# DealInspect

**AI-powered Technical Deal Review platform for sales engineering teams.**

DealInspect combines structured SE workflows with multi-model AI intelligence to help sales engineering leaders inspect, score, and act on complex deals. It integrates Snowflake Cortex AI for in-database LLM functions, Sumble for firmographic and technographic enrichment, Perplexity for web-grounded research, Slack for readout distribution, and Domo's platform for data, hosting, and code execution.

**Version:** 1.53.0 · **Platform:** Domo Custom App · **Stack:** React 18 · TypeScript · Vite · Tailwind CSS · Snowflake · Snowpark Python

---

## Screenshots

| Command Center | TDR Workspace — Intelligence |
|:-:|:-:|
| ![Command Center](docs/screenshots/command-center.png) | ![TDR Workspace Intelligence](docs/screenshots/workspace-intelligence.png) |

| TDR Workspace — Chat | Documentation Hub |
|:-:|:-:|
| ![TDR Workspace Chat](docs/screenshots/workspace-chat.png) | ![Documentation Hub](docs/screenshots/documentation.png) |

---

## Table of Contents

1. [What Problem Does This Solve?](#what-problem-does-this-solve)
2. [Architecture](#architecture)
3. [Key Capabilities](#key-capabilities)
4. [TDR Index — Scoring Engine](#tdr-index--scoring-engine)
5. [AI & Intelligence Stack](#ai--intelligence-stack)
6. [Deal Close Propensity ML (In Progress)](#deal-close-propensity-ml-in-progress)
7. [Pages & Navigation](#pages--navigation)
8. [Data Model](#data-model)
9. [Design System](#design-system)
10. [Development & Deployment](#development--deployment)
11. [Project Structure](#project-structure)
12. [License](#license)

---

## What Problem Does This Solve?

SE managers oversee dozens of active deals. Some require a Technical Deal Review (TDR) — a structured inspection to validate architecture, partner strategy, and competitive positioning before decisions lock in. The challenge: **which deals, and when?**

DealInspect answers this by combining three intelligence signals:

| Signal | Source | Question It Answers |
|--------|--------|---------------------|
| **TDR Complexity Score** | Deterministic 9-factor engine | "How technically complex is this deal?" |
| **AI Recommendations** | Domo AI + 17-factor framework | "Which deals should I review first?" |
| **Win Probability** *(in progress)* | Stacking ensemble ML model | "How likely is this deal to close?" |

The platform then provides a structured workspace to *conduct* the review — with context-aware chat, external account intelligence, Cortex-generated briefs, and Slack distribution of the final readout.

---

## Architecture

DealInspect is a four-layer system. Each layer is independently valuable; together they compound.

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
│   • Append-only writes with timestamps (full iteration history)        │
│   • Cortex AI operates directly on stored data                         │
│   • Cross-deal analytics via SQL / Cortex Analyst                      │
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

| Layer | Core Principle |
|-------|---------------|
| **Experience** | Every interaction is contextual — chat, research, briefs, and insights happen inline without leaving the TDR workflow |
| **Intelligence** | Three AI backends, one unified context — Cortex for stored data, Perplexity for live web, Domo AI for candidate ranking |
| **Persistence** | Everything is append-only — every edit, research pull, and chat message creates a timestamped row for full posterity |
| **Data** | SFDC remains the source of truth — the app enriches it but never replaces it |

---

## Key Capabilities

### Command Center

The operational dashboard for SE managers. Shows pipeline metrics, TDR priority distribution, close urgency trends, and a scored deals table with actionable "Why TDR?" pills. Deals can be pinned to an Agenda for the next TDR meeting. Domo AI auto-suggests the top 5 candidates.

### TDR Workspace

A three-panel layout for conducting a Technical Deal Review:

- **Left** — 5 required + 4 optional TDR steps with progress tracking
- **Center** — Structured input area with per-field save and edit history
- **Right** — Intelligence panel with account profile, technical landscape, competitive position, market signals, strategic action plan, TDR brief & verdict, risk & readiness scoring, and research & similar deals

### Inline Chat

Context-aware conversational AI embedded in the workspace. The chat knows the current deal, all TDR inputs, and all cached account intelligence. Three providers:

| Provider | Best For | Routing |
|----------|----------|---------|
| **Snowflake Cortex** | Questions about stored TDR/account data | In-database, no data leaves Snowflake |
| **Claude 4 Sonnet** | Complex reasoning, TDR strategy | Via Cortex AI_COMPLETE |
| **Perplexity** | Real-time web research with citations | External API via Code Engine |

### Account Intelligence

One-click enrichment for any deal:

- **Sumble** — Firmographic profile (industry, revenue, employees), technographic stack (BI, CRM, cloud, DevOps, AI/ML tools with confidence scores), and competitive tool landscape
- **Perplexity** — Web-grounded research on strategic initiatives, market position, technology decisions, and competitive dynamics — with source citations

### TDR Readout & Distribution

After completing a TDR, generate an executive-ready PDF readout and distribute to Slack channels with AI-generated summary, deal team @mentions, and the PDF attached.

### Portfolio Analytics

Cross-deal pattern analysis powered by structured TDR extracts. Includes an NLQ hero bar ("Ask Your TDR Data") backed by Cortex AI, plus charts for competitor frequency, platform distribution, entry layer patterns, risk categories, and TDR status distribution.

### Documentation Hub

In-app reference covering scoring methodology, app capabilities, integrations, Snowflake data model, AI model registry, glossary, and an interactive 5-layer architecture diagram with pan/zoom navigation.

---

## TDR Index — Scoring Engine

**File:** `src/lib/tdrCriticalFactors.ts`

The TDR Index is a deterministic 9-component scoring engine. Base score starts at 0 — every point must be earned. Most deals land LOW or MEDIUM; only complex, high-value deals with multiple converging signals reach HIGH or CRITICAL.

### The 9 Components

| # | Component | Range | Key Logic |
|---|-----------|-------|-----------|
| 1 | **ACV Significance** | 0–20 | ≥$250K → 20 · ≥$100K → 15 · ≥$50K → 10 |
| 2 | **Stage TDR Value** | 0–15 | Stage 2 (Determine Needs) → 15 · Stage 3 → 12 |
| 3 | **Cloud Partner Alignment** | 0–15 | Snowflake/Databricks/BigQuery → 15 |
| 4 | **Competitive Pressure** | 0–10 | ≥2 competitors → 10 |
| 5 | **Deal Type Signal** | 0–10 | New Logo → 10 · Acquisition → 8 |
| 6 | **Forecast Momentum** | 0–10 | Probable → 10 · Best Case → 8 |
| 7 | **Stage Freshness** | −10 to +5 | ≤14d → +5 · >180d → −10 |
| 8 | **Deal Complexity** | 0–10 | PA prefix → +5 · Multi-component → +3 |
| 9 | **Partner Role Strength** | 0–5 | Co-sell → 5 · Reseller → 3 |

### Priority Bands

| Priority | Score | Action |
|----------|-------|--------|
| **CRITICAL** | ≥ 75 | Immediate TDR — multiple Tier 1 signals converging |
| **HIGH** | 50–74 | TDR strongly recommended |
| **MEDIUM** | 25–49 | Monitor for escalation |
| **LOW** | < 25 | Standard process |

### "Why TDR?" Pills

Each deal gets up to 2 colored pills explaining *why* it scored the way it did. 11 defined factors across 3 tiers (Material Deal, Cloud Platform, Shaping Window, Competitive Displacement, New Logo, Partner Play, Forecast Momentum, Enterprise Scale, Stalling, Stalled, Late Stage) — each with an icon, dynamic label, and strategy tooltip.

### Post-TDR Score

After a TDR begins, the score evolves with 4 additional components: Named Competitor Threat (0–10), Enrichment Depth (0–5), TDR Input Completeness (0–10), and Risk Awareness (0–5) — reflecting how much intelligence has been gathered during the review.

---

## AI & Intelligence Stack

DealInspect uses AI at five distinct points, each with a different purpose:

| Function | AI Backend | Purpose | Trigger |
|----------|-----------|---------|---------|
| **TDR Candidate Ranking** | Domo AI (text/chat) | 17-factor framework scores top 40 deals by ACV | Automatic on data load |
| **TDR Brief Generation** | Cortex AI_COMPLETE | Synthesizes all inputs/intel into executive summary | User-initiated |
| **Entity Extraction** | Cortex AI_EXTRACT | Pulls competitors, technologies, risks from free text | After TDR step completion |
| **Finding Classification** | Cortex AI_CLASSIFY | Categorizes Perplexity research findings | After research enrichment |
| **Portfolio Insights** | Cortex AI_AGG | Cross-deal pattern analysis from structured extracts | Analytics page load |
| **Sentiment Tracking** | Cortex AI_SENTIMENT | TDR health trend over time | Per-session |
| **Similar Deal Discovery** | Cortex AI_EMBED | Semantic similarity search across past TDRs | Intelligence panel |
| **Natural Language Query** | Cortex Analyst | "Ask Your TDR Data" — NL → SQL → results | Analytics page |
| **Inline Chat** | Cortex / Perplexity / Domo | Context-aware Q&A within the workspace | User-initiated |
| **Readout Summary** | Cortex AI_COMPLETE | Slack-formatted message summarizing TDR outcome | Share workflow |
| **KB Summarization** | Cortex AI_COMPLETE | Summarize fileset/knowledge base search results | Intelligence panel |

All external API calls route through **Domo Code Engine functions**, keeping API keys server-side and the frontend stateless.

---

## Deal Close Propensity ML (In Progress)

> **Status:** Sprint 28 — Infrastructure defined, training procedures written, frontend integration pending.

### The Problem

The deterministic TDR score answers *"How technically complex is this deal?"* but not *"How likely is this deal to close?"* A deal can score 85 on TDR complexity yet have a 15% chance of closing. SE managers need both axes to allocate review time effectively.

### The Solution: Two-Axis Prioritization

A stacking ensemble ML model predicts `P(close)` for every pipeline deal. The propensity score composes with the deterministic TDR score to create a 2×2 quadrant:

| | High Win Probability | Low Win Probability |
|---|---|---|
| **High TDR Score** | 🔴 **CRITICAL** — winnable + complex, TDR adds most value | ⚠️ **MONITOR** — complex but unlikely, investigate blockers |
| **Low TDR Score** | ✅ **LOW TOUCH** — likely to close, minimal SE intervention | ⬜ **DEPRIORITIZE** — unlikely + simple, not worth TDR time |

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

- **Training data:** Historical SFDC deal outcomes (`Is Won` label — clean, auditable)
- **Imbalance handling:** SMOTE oversampling or class-weight balancing
- **Explainability:** SHAP values per prediction — every score is transparent
- **Baseline comparison:** Native `SNOWFLAKE.ML.CLASSIFICATION` runs alongside; if ensemble doesn't beat it by >2% AUC, the system simplifies to native-only

### 19 Engineered Features

| Category | Features |
|----------|----------|
| **Historical** | Account win rate, type-specific win rate |
| **Velocity** | Stage velocity ratio, quarter urgency, days in stage, deal age |
| **Complexity** | Deal complexity index, competitor count, line item count |
| **Financial** | Services ratio, ACV normalized, revenue per employee |
| **Process** | Sales process completeness, steps completed, has thesis, has stakeholders |
| **Categorical** | Stage ordinal, deal complexity encoded, AI maturity encoded |

### Snowflake Infrastructure

| Object | Purpose |
|--------|---------|
| `ML_FEATURE_STORE` | Pre-computed derived features, versioned by date |
| `DEAL_ML_PREDICTIONS` | Batch scoring results + SHAP explanations + risk flags |
| `ML_MODEL_METADATA` | Model registry with versioning, metrics, and lifecycle |
| `SP_TRAIN_STACKING_ENSEMBLE` | Snowpark Python: trains ensemble with 5-fold CV |
| `SP_PREDICT_WIN_PROBABILITY` | Snowpark Python: batch/single prediction with SHAP |
| `TASK_BATCH_SCORE` | Daily automated scoring (7am UTC) |
| `TASK_RETRAIN_MODEL` | Biweekly retraining (1st & 15th) |
| `ALERT_MODEL_PERFORMANCE_DEGRADATION` | Triggers if AUC-ROC drops below 0.65 |

### Planned Frontend Surfaces

- **Command Center** — Win Probability column in deals table
- **Intelligence Panel** — Deal Propensity card with SHAP top factors and risk flags
- **Documentation Hub** — ML layer in architecture diagram, model registry reference

---

## Pages & Navigation

The app uses a collapsible sidebar with 6 routes:

| Route | Page | Description |
|-------|------|-------------|
| `/` | Command Center | Pipeline dashboard — metrics, charts, scored deals table, agenda |
| `/workspace` | TDR Workspace | Three-panel TDR review — steps, inputs, intelligence + chat |
| `/history` | TDR History | Past TDR reviews with search and outcome filters |
| `/analytics` | Portfolio Analytics | Cross-deal patterns, NLQ, competitor/platform/risk charts |
| `/docs` | Documentation Hub | In-app reference — scoring, architecture, data model, glossary |
| `/settings` | Settings | Allowed managers, ACV thresholds, feature flags, API toggles |

---

## Data Model

### Domo Datasets (Source — Read-Only)

| Alias | Purpose |
|-------|---------|
| `opportunitiesmagic` | Primary pipeline data — all open SFDC opportunities |
| `forecastsmagic` | Manager-level forecast calls by quarter |
| `wcpweekly` | Weekly commit pipeline snapshots |
| `semapping` | SE-to-Manager lookup (29 rows) |

### Snowflake Persistence (TDR_APP.TDR_DATA)

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

### Snowflake ML (TDR_APP.ML_MODELS)

| Table | Purpose |
|-------|---------|
| `ML_FEATURE_STORE` | 19 derived features per opportunity, date-versioned |
| `DEAL_ML_PREDICTIONS` | Win probability + SHAP explanations + risk flags |
| `ML_MODEL_METADATA` | Model registry — versions, metrics, artifacts, lifecycle |

---

## Design System

### Color Palette

Source: [coolors.co palette](https://coolors.co/palette/56e39f-59c9a5-5b6c5d-3b2c35-2a1f2d)

| Name | Hex | Usage |
|------|-----|-------|
| Emerald | `#56E39F` | Success states, Critical priority |
| Teal | `#59C9A5` | Accents, High priority |
| Sage | `#5B6C5D` | Muted foregrounds, borders |
| Plum | `#3B2C35` | Primary buttons, badges |
| Aubergine | `#2A1F2D` | Sidebar, deep surfaces |

The app supports light and dark modes via CSS custom properties. The Documentation Hub forces dark mode for visual cohesion with architecture diagrams.

---

## Development & Deployment

### Prerequisites

- Node.js 18+
- npm 9+
- Domo CLI (`npm install -g @domoinc/ryuu`)

### Local Development

```bash
npm install
npm run dev          # Vite dev server at localhost:5173
```

In dev mode, Domo SDK is unavailable — data hooks return mock data, AppDB falls back to `localStorage`, and AI functions return simulated responses.

### Build & Deploy

```bash
npm run build        # Production build → dist/
npm run deploy       # Build + publish to Domo
npm run deploy:zip   # Build + create ZIP for manual upload
npm run deploy:check # Verify manifest, thumbnail, SDK reference
```

### ML Development

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
│   │   ├── TDRIntelligence.tsx        # Intelligence panel (workspace right panel)
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

> **Note:** `codeengine/`, `samples/`, `dist/`, and `ml-venv/` are `.gitignore`d. Code Engine functions are deployed via the Domo Code Engine IDE. Build artifacts are generated with `npm run build`. The ML virtual environment is created locally per the [ML Development](#ml-development) instructions.

---

## License

This project is not yet licensed. A license will be added before the repository is made public.
