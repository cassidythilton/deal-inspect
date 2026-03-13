# TDR Deal Inspection — Implementation Strategy

> Account Intelligence, Snowflake Persistence, Cortex AI, Inline TDR Chat, Deal Close Propensity ML, and AI-Enhanced TDR Responses

**Status:** Active · **Version:** Draft 8.2 · **Date:** March 12, 2026 · **Sprints Completed:** 1–29b, OSS-1, PERF-1, 28b+, 28c, 28d, 28e, 30, 31, 32a (44 sprints) · **Pillars 1–17 Complete · Pillar 18 In Progress — Sprint 32a Complete · Sprint 32b (Seeded TDR Responses) Next**

---

### Current State & What's Next

**Where we are:** Pillars 1–17 are complete (43 sprints, Feb 9 – Mar 11, 2026). Sprint 32a (Model Calibration & Retrain) completed Mar 12 — model retrained on 3-year recency-filtered data with `DAYS_IN_PIPELINE` capped at 730, F1 improved from 0.923 to 0.956, score capping [3%,97%] deployed, 6,408 prediction snapshots captured for ground truth tracking. Sprint 32b (Seeded TDR Responses) is next — pre-populating TDR fields with Gong-extracted data from the `opportunitiesmagic` dataset. Sprint 32c–e continue the MLOps monitoring track.

**What's done (recently):**

| Sprint | Name | Status | Date | Key Outcome |
|--------|------|--------|------|-------------|
| **28a** | Dataset Swap | ✅ DONE | Mar 3 | v2 dataset (195K rows), manifest + types + transform updated, 33 new fields |
| **28b** | EDA Notebook Overhaul | ✅ DONE | Mar 4 | Notebook retargeted to v2, candidates identified. **Needs execution against Snowflake for go/no-go.** |
| **29a** | AI Enhancement Engine | ✅ DONE | Mar 4 | `domoAi.ts` — prompt construction, 8 context layers, Domo AI endpoint |
| **29b** | AI Enhancement UI | ✅ DONE | Mar 4 | Enhance button, inline diff, accept/edit/dismiss, dealContext wiring |
| **PERF-1** | Performance Optimization | ✅ DONE | Mar 5 | `/data/v2/` with `?fields=` + `&filter=` — 40s → 1s load, 194K → 5K records |
| **28b+** | Pre-Training Data Validation | ✅ DONE | Mar 5 | 7 critical checks passed, 38 safe features, warnings on high-cardinality fields |
| **28c** | ML Infrastructure & Model Training | ✅ DONE | Mar 6 | Model trained (AUC 0.997, F1 97.7%), 6,569 deals scored, tasks created |

**What's next (Sprint 32 series):**

| Sprint | Name | Effort | Prerequisite | Status | Key Deliverable |
|--------|------|--------|-------------|--------|-----------------|
| **32a** | Model Calibration & Retrain | 1–2 days | — | ✅ Complete | Score capping [3%,97%], DAYS_IN_PIPELINE cap at 730, training recency filter, prediction snapshots, retrain + re-score. F1 0.923→0.956 |
| **32b** | Seeded TDR Responses | 3–5 days | — | 🔲 Not Started | Pre-populate TDR fields from Gong-extracted data (24 new dataset columns). Propose/accept/dismiss UX with multi-source reference (seeded + prior iteration). Enhance button composes with seeded data. |
| **32c** | Code Engine MLOps Functions | 1 day | 32a | 🔲 Not Started | 7 new CE functions for MLOps data (metadata, eval metrics, feature importance, pipeline history, prediction accuracy, score distribution, factor aggregation) |
| **32d** | Frontend MLOps Page | 2–3 days | 32c | 🔲 Not Started | `/mlops` page: pipeline status, model registry, fit metrics, feature importance chart, score distribution, prediction accuracy, factor patterns, alert badges |
| **32e** | Polish + Documentation | 1 day | 32d | 🔲 Not Started | Alert threshold logic, distribution health checks, nav badge, Documentation Hub update, Pillar 18 finalization |

**Previously completed:**

| Sprint | Name | Status |
|--------|------|--------|
| **28d** | Domo Integration | ✅ Complete |
| **28e** | Frontend ML Integration | ✅ Complete |
| **30** | UX Polish & Iteration | ✅ Complete |
| **31** | TDR Framework Redesign | ✅ Complete |

**Shaping documents:** `shaping/dataset-swap-and-propensity-model.md` (Sprint 28), `shaping/ai-enhanced-tdr-responses.md` (Sprint 29), `shaping/tdr-quality-of-life.md` (Sprints 30 + 31), `shaping/sprint-30-combined-score-and-docs.md` (Sprint 30b), `shaping/sprint-30b-table-polish.md` (Sprint 30b — table column polish), `shaping/sprint-30b-priority-in-workspace.md` (Sprint 30b — Deal Priority in TDR Workspace), `shaping/mlops-monitoring-tab.md` (Sprint 32 — MLOps monitoring + model calibration), `shaping/sprint-32b-seeded-tdr-responses.md` (Sprint 32b — Gong-seeded TDR responses)

**Start point:** All major sprints complete through Sprint 31. On Mar 12, a model health issue was diagnosed and fixed (feature schema mismatch + probability key mismatch caused all-Lost predictions). The fix revealed a bimodal score distribution (35% at <5%, 15% at >95%) caused by covariate shift on DAYS_IN_PIPELINE. Sprint 32 addresses model calibration, MLOps monitoring, and ground truth tracking.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Solution Architecture Overview](#2-solution-architecture-overview)
3. [Current Architecture Baseline](#3-current-architecture-baseline)
4. [Strategic Goals](#4-strategic-goals)
5. [Snowflake Schema Design](#5-snowflake-schema-design)
6. [Code Engine Functions](#6-code-engine-functions)
7. [Perplexity Integration](#7-perplexity-integration)
8. [Sumble Integration](#8-sumble-integration)
9. [Snowflake Cortex Integration](#9-snowflake-cortex-integration)
10. [TDR Inline Chat Experience](#10-tdr-inline-chat-experience)
11. [Front-End Architecture Changes](#11-front-end-architecture-changes)
12. [TDR Scoring Enrichment](#12-tdr-scoring-enrichment)
13. [API Cost & Rate Limit Strategy](#13-api-cost--rate-limit-strategy)
14. [Migration Plan (AppDB → Snowflake)](#14-migration-plan-appdb--snowflake)
15. [Risks & Considerations](#15-risks--considerations)
16. [Development Tooling](#16-development-tooling)
17. [Implementation Phases](#17-implementation-phases)
18. [Sprint Plan & Progress Tracker](#18-sprint-plan--progress-tracker)
19. [Reference Links](#19-reference-links)
20. [Solution Strategy Summary — The Eighteen Pillars](#20-solution-strategy-summary--the-eighteen-pillars)
21. [TDR Readout: Executive PDF & Distribution](#21-tdr-readout-executive-pdf--distribution)

---

## 1. Executive Summary

This document describes the strategy for transforming the TDR Deal Inspection app from an internally-scoped scoring tool into an **AI-native, intelligence-enriched review platform**. Eight capabilities define the platform:

1. **External Account Intelligence** — Perplexity (web research) and Sumble (firmographic/technographic enrichment) provide real-world context about each account's technology stack, strategic initiatives, and competitive landscape.

2. **Snowflake Persistence** — All TDR session data, step inputs, chat conversations, and account intelligence move from Domo AppDB to Snowflake. Every write is append-only with timestamps, enabling full iteration history and cross-deal analytics.

3. **Snowflake Cortex AI** — Cortex AI SQL functions (`AI_COMPLETE`, `AI_AGG`, `AI_SUMMARIZE_AGG`, `AI_CLASSIFY`, `AI_EXTRACT`, `AI_EMBED`, Cortex Analyst, Cortex Search) process stored data directly in Snowflake to generate TDR summaries, cross-deal insights, competitive intelligence aggregation, and semantic search across all account research.

4. **TDR Inline Chat** — A context-aware conversational AI embedded in the TDR Workspace. The chat knows the current deal, all TDR inputs entered so far, and all cached account intelligence. It can answer questions using stored data (Cortex), search the web in real-time (Perplexity), or provide TDR methodology guidance — enabling the SE Manager to get answers without leaving the review workflow.

5. **Deal Close Propensity ML** — A `SNOWFLAKE.ML.CLASSIFICATION` model trained on historical SFDC deal outcomes predicts close probability for every pipeline deal. Native SQL — no Python, no external compute. 19 derived features. The propensity score composes with the deterministic TDR complexity score in a two-axis quadrant (propensity × complexity → CRITICAL / STANDARD / MONITOR / SKIP). SHAP-like factor explanations — plain English, directional arrows, magnitude bars — make every prediction transparent and trustworthy for naive users.

6. **AI-Enhanced TDR Responses** — Per-field AI enhancement for TDR inputs. SEs click "Enhance" on any textarea to get a context-aware improved version drawing from 8 layers (deal metadata, account intel, Knowledge Base filesets, cross-step inputs). Inline diff with Accept/Edit/Dismiss. Uses the Domo AI endpoint (Anthropic) for low-latency enhancement. Raises the quality floor for every downstream AI artifact.

7. **UX Polish & Data Visibility** — Dedicated refinement cycle for all Sprint 28–29 surfaces (propensity quadrant, SHAP factors, AI diff view) plus recalibration of data visibility rules. Fixes the `MAX_STAGE_AGE_DAYS = 365` hard filter that silently hides legitimate deals (e.g., renewals with high stage age but near-term close dates). Addresses duplicate Opportunity ID records with conflicting field values. Adds Intelligence Panel guided workflow, Perplexity tech pills with source provenance, Slack PDF color matching, Settings→Filter bridge, and data gap indicators.

8. **TDR Framework Redesign** — Consolidation from 9 steps / 29 fields to ~5–6 steps with sharper, less redundant fields. AI & ML elevated from a 2-field optional step to a rigorous core step with a structured AI value continuum framework (rules-based automation → traditional ML → generative AI → agentic solutions). Resizable textareas, semi-automated step completion, pill/tag inputs for Domo layers, and exposed TDR versioning for follow-up iterations. PDF readout updated to match.

The architecture routes all external API calls and Snowflake operations through **Domo Code Engine functions**, keeping API keys server-side and the front-end stateless.

---

## 2. Solution Architecture Overview

The final solution has four distinct layers. Each layer is independently valuable — you can ship persistence without chat, or intelligence without Cortex. But together they compound: every piece of stored data makes the chat smarter, every chat answer can feed back into TDR inputs, and every interaction is persisted for posterity.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXPERIENCE LAYER (React SPA)                     │
│                                                                         │
│   ┌─────────────┐  ┌─────────────┐  ┌────────────┐  ┌──────────────┐  │
│   │ Command      │  │ TDR          │  │ Inline     │  │ Settings &   │  │
│   │ Center       │  │ Workspace    │  │ Chat       │  │ Analytics    │  │
│   │              │  │              │  │            │  │              │  │
│   │ • Deal table │  │ • 10 steps   │  │ • Multi-   │  │ • API usage  │  │
│   │ • Scoring    │  │ • Intel panel│  │   turn     │  │ • Cache TTL  │  │
│   │ • Portfolio  │  │ • TDR brief  │  │ • Context- │  │ • Toggles    │  │
│   │   insights   │  │ • Similar    │  │   aware    │  │ • Connection │  │
│   │ • Ask TDR    │  │   deals      │  │ • Smart    │  │   status     │  │
│   │ • Search     │  │ • History    │  │   routing  │  │              │  │
│   └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  └──────┬───────┘  │
│          │                 │                │                │          │
└──────────┼─────────────────┼────────────────┼────────────────┼──────────┘
           │                 │                │                │
           ▼                 ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     INTELLIGENCE LAYER (Code Engine)                     │
│                                                                         │
│   ┌───────────────┐  ┌───────────────┐  ┌──────────────────────────┐   │
│   │ Perplexity    │  │ Sumble        │  │ Cortex AI                │   │
│   │ (Web Research)│  │ (Firmographic)│  │ (In-Snowflake LLM)       │   │
│   │               │  │               │  │                          │   │
│   │ • Real-time   │  │ • Tech stack  │  │ • AI_COMPLETE (briefs)   │   │
│   │   web search  │  │ • Industry    │  │ • AI_AGG (portfolio)     │   │
│   │ • Strategic   │  │ • Revenue     │  │ • AI_CLASSIFY (tags)     │   │
│   │   context     │  │ • Competitive │  │ • AI_EXTRACT (entities)  │   │
│   │ • Citations   │  │   tools       │  │ • AI_EMBED (similarity)  │   │
│   │               │  │               │  │ • AI_SENTIMENT (health)  │   │
│   │               │  │               │  │ • Analyst (NL → SQL)     │   │
│   │               │  │               │  │ • Search (hybrid)        │   │
│   └───────┬───────┘  └───────┬───────┘  └────────────┬─────────────┘   │
│           │                  │                       │                  │
└───────────┼──────────────────┼───────────────────────┼──────────────────┘
            │                  │                       │
            ▼                  ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      PERSISTENCE LAYER (Snowflake)                      │
│                                                                         │
│   TDR_SESSIONS  │ TDR_STEP_INPUTS │ TDR_CHAT_MESSAGES                  │
│   ACCOUNT_INTEL_SUMBLE │ ACCOUNT_INTEL_PERPLEXITY                      │
│   API_USAGE_LOG │ CORTEX_ANALYSIS_RESULTS                              │
│                                                                         │
│   • Append-only writes with timestamps                                  │
│   • Full iteration & edit history                                       │
│   • Chat conversations persisted per session                            │
│   • Cross-deal queryable via SQL / Cortex Analyst                       │
│   • Cortex functions operate directly on stored data                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
            ▲                  ▲                       ▲
            │                  │                       │
┌───────────┼──────────────────┼───────────────────────┼──────────────────┐
│                        DATA LAYER (Source Systems)                       │
│                                                                         │
│   SFDC Opportunities │ SE Mapping │ Forecasts │ WCP Weekly              │
│   (via Domo Datasets — existing, unchanged)                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### What Makes Each Layer Tick

| Layer | Core Principle | Key Insight |
|-------|---------------|-------------|
| **Experience** | Every interaction is contextual | The user never leaves the TDR workflow to get answers. Chat, research, briefs, and insights all happen inline. |
| **Intelligence** | Three AI backends, one unified context | Cortex for stored data, Perplexity for live web, Domo AI for candidate ranking. The chat routes to the right one automatically. |
| **Persistence** | Everything is append-only | No data is ever overwritten. Every edit, every research pull, every chat message creates a new timestamped row. This enables full posterity, iteration comparison, and trend analysis. |
| **Data** | SFDC remains the source of truth for pipeline | We enrich it but never replace it. The app works on SFDC data alone if all intelligence services are unavailable. |

---

## 3. Current Architecture Baseline

### What Exists Today

```
┌─────────────────────────────────────────────────────────────────┐
│                        Domo Platform                            │
│                                                                 │
│   opportunitiesmagic ──┐                                        │
│   semapping ───────────┤  /data/v1/...                          │
│   forecastsmagic ──────┤────────────────► React SPA             │
│   wcpweekly ───────────┘                   │                    │
│                                            │                    │
│   AppDB (TDRSessions) ◄──► /domo/datastores/v1/...              │
│                                            │                    │
│   Domo AI ◄──────────── /domo/ai/v1/text/chat                   │
│   (17-factor TDR prompt)                   │                    │
│                                            ▼                    │
│                              ┌──────────────────────┐           │
│                              │  TDR Deal Inspection  │          │
│                              │  React + TS + Vite    │          │
│                              └──────────────────────┘           │ 
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Role |
|------|------|
| `src/lib/domo.ts` | Fetches opportunities + SE mapping from Domo datasets |
| `src/lib/domoAi.ts` | Calls Domo AI with 17-factor TDR Framework prompt |
| `src/lib/appDb.ts` | CRUD for TDR sessions via Domo AppDB |
| `src/lib/tdrCriticalFactors.ts` | Deterministic scoring engine + factor detection |
| `src/lib/appSettings.ts` | localStorage-persisted settings |
| `src/hooks/useDomo.ts` | Main data hook — fetch, join, enrich, filter |
| `src/components/DealsTable.tsx` | Deals table with tooltips, pills, scoring |
| `src/components/TDRIntelligence.tsx` | TDR Workspace right panel — deal info, risks |
| `src/components/TDRInputs.tsx` | TDR Workspace center panel — step input forms |
| `src/pages/TDRWorkspace.tsx` | Three-panel TDR review workspace |
| `src/pages/Settings.tsx` | App configuration page |

### Data Gaps

The current app knows what SFDC tells it (ACV, stage, partner picklists, forecast category) but has no visibility into:

- What technologies the account actually runs
- What strategic initiatives the account has announced
- Who the key technical decision-makers are
- What competitive tools are entrenched
- How the account's technology direction has evolved over time

These gaps directly impact TDR quality. An SE Manager preparing for a review has to manually research each account — or go in blind.

---

## 4. Strategic Goals

| # | Goal | Metric |
|---|------|--------|
| 1 | **Eliminate manual account research** | SE Manager can see tech stack + strategic context without leaving the app |
| 2 | **Persist all TDR work product in Snowflake** | Every input, every research pull, every iteration — queryable via SQL |
| 3 | **Enable cross-deal intelligence** | Cortex AI surfaces patterns across the full portfolio, not just one deal at a time |
| 4 | **Control API costs** | Perplexity + Sumble calls are user-triggered, cached, and metered |
| 5 | **Maintain graceful degradation** | App works on SFDC data alone if any external service is unavailable |

---

## 5. Snowflake Schema Design

All tables live in a dedicated schema (e.g., `TDR_APP.PUBLIC` or `TDR_APP.TDR_DATA`). All writes are append-only with timestamps to support iteration tracking.

### Table 1: `TDR_SESSIONS`

Replaces Domo AppDB `TDRSessions` collection.

```sql
CREATE TABLE IF NOT EXISTS TDR_SESSIONS (
  SESSION_ID           VARCHAR PRIMARY KEY,     -- UUID generated client-side
  OPPORTUNITY_ID       VARCHAR NOT NULL,        -- SFDC Opportunity Id
  OPPORTUNITY_NAME     VARCHAR,
  ACCOUNT_NAME         VARCHAR,
  ACV                  NUMBER(12,2),
  STAGE                VARCHAR,
  STATUS               VARCHAR,                 -- 'in-progress' | 'completed'
  OUTCOME              VARCHAR,                 -- 'approved' | 'needs-work' | 'deferred' | 'at-risk'
  OWNER                VARCHAR,                 -- AE who owns the deal
  CREATED_BY           VARCHAR,                 -- Domo user who initiated
  ITERATION            INTEGER DEFAULT 1,       -- Which TDR pass (1st, 2nd, etc.)
  STEP_SCHEMA_VERSION  VARCHAR DEFAULT 'v1',    -- Which TDR step definition was active
  CREATED_AT           TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  UPDATED_AT           TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);
```

**Why `ITERATION`?** — When a deal goes through multiple TDR cycles (e.g., initial review, then a re-review after stalling), each cycle is a separate session with an incrementing iteration number. This lets you query "how did TDR findings change between the 1st and 3rd review?"

**Why `STEP_SCHEMA_VERSION`?** — The TDR process (step count, step IDs, field IDs) will evolve over time. This column records which version of the step definitions was active when the session was created. This lets us:
- Know whether a session was 5/9 complete (v1) or 5/12 complete (v2)
- Join to `TDR_STEP_DEFINITIONS` to get the correct step labels and ordering for historical sessions
- Avoid breaking old data when steps are renamed, reordered, added, or removed

### Table 2: `TDR_STEP_INPUTS`

Stores every field value from every TDR step. Append-only — every save creates a new row.

```sql
CREATE TABLE IF NOT EXISTS TDR_STEP_INPUTS (
  INPUT_ID           VARCHAR PRIMARY KEY,     -- UUID
  SESSION_ID         VARCHAR NOT NULL,        -- FK → TDR_SESSIONS
  OPPORTUNITY_ID     VARCHAR NOT NULL,
  STEP_ID            VARCHAR NOT NULL,        -- 'context' | 'decision' | 'current-arch' | ...
  STEP_LABEL         VARCHAR,                 -- 'Deal Context & Stakes' (human-readable, for Cortex/analytics)
  FIELD_ID           VARCHAR NOT NULL,        -- 'strategic-value' | 'business-impact' | ...
  FIELD_LABEL        VARCHAR,                 -- 'Strategic Value' (human-readable, for Cortex/analytics)
  FIELD_VALUE        VARCHAR,                 -- The user's input
  STEP_ORDER         INTEGER,                 -- Position of this step in the process (1-based)
  SAVED_AT           TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  SAVED_BY           VARCHAR
);
```

**Why `STEP_LABEL` / `FIELD_LABEL`?** — The IDs (`'current-arch'`, `'strategic-value'`) are stable keys for joins and code. The labels are what humans (and Cortex AI) see. Storing both means:
- Cortex `AI_COMPLETE` can build readable briefs: *"In the Current Architecture step, the manager noted..."* instead of *"current-arch.existing-systems = ..."*
- Direct Snowflake queries and Cortex Analyst don't require a lookup table join for basic readability
- If a step is renamed (label changes, ID stays), old rows retain the label that was current when the data was entered

**Why `STEP_ORDER`?** — Steps may be reordered over time. Storing the position at write time lets us reconstruct the original process flow for historical sessions.

**Querying the latest value per field:**

```sql
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY SESSION_ID, STEP_ID, FIELD_ID
    ORDER BY SAVED_AT DESC
  ) AS rn
  FROM TDR_STEP_INPUTS
  WHERE SESSION_ID = :sid
) WHERE rn = 1
ORDER BY STEP_ORDER;
```

**Viewing edit history for a single field:**

```sql
SELECT FIELD_VALUE, SAVED_AT, SAVED_BY
FROM TDR_STEP_INPUTS
WHERE SESSION_ID = :sid AND STEP_ID = 'current-arch' AND FIELD_ID = 'existing-systems'
ORDER BY SAVED_AT;
```

### Table 3: `TDR_STEP_DEFINITIONS`

A slowly-changing dimension that captures the TDR process structure at each version. When steps are added, removed, renamed, or reordered, a new version is created. This table is the historical record of what the TDR process looked like at any point in time.

```sql
CREATE TABLE IF NOT EXISTS TDR_STEP_DEFINITIONS (
  SCHEMA_VERSION     VARCHAR NOT NULL,        -- 'v1', 'v2', etc.
  STEP_ID            VARCHAR NOT NULL,        -- 'context' | 'decision' | 'current-arch' | ...
  STEP_TITLE         VARCHAR NOT NULL,        -- 'Deal Context & Stakes'
  STEP_DESCRIPTION   VARCHAR,                 -- 'Strategic importance and business impact'
  STEP_ORDER         INTEGER NOT NULL,        -- Position in the process (1-based)
  FIELDS             VARIANT,                 -- JSON array of { id, label, type, required }
  IS_ACTIVE          BOOLEAN DEFAULT TRUE,    -- FALSE if step was removed in this version
  CREATED_AT         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (SCHEMA_VERSION, STEP_ID)
);
```

**Seed data for v1** (the current 9-step process):

```sql
INSERT INTO TDR_STEP_DEFINITIONS (SCHEMA_VERSION, STEP_ID, STEP_TITLE, STEP_DESCRIPTION, STEP_ORDER, FIELDS)
VALUES
  ('v1', 'context',     'Deal Context & Stakes',  'Strategic importance and business impact',      1, PARSE_JSON('[{"id":"strategic-value","label":"Strategic Value","type":"textarea"},{"id":"business-impact","label":"Business Impact","type":"textarea"}]')),
  ('v1', 'decision',    'Business Decision',      'What is the customer trying to achieve?',       2, NULL),
  ('v1', 'current-arch','Current Architecture',    'Existing systems and data landscape',           3, NULL),
  ('v1', 'target-arch', 'Target Architecture',     'Proposed solution and integration points',      4, NULL),
  ('v1', 'domo-role',   'Domo Role',               'How Domo fits in the solution',                 5, NULL),
  ('v1', 'partner',     'Partner Alignment',       'SI/Partner involvement and commitment',         6, NULL),
  ('v1', 'ai-strategy', 'AI Strategy',             'AI/ML use cases and data science needs',        7, NULL),
  ('v1', 'risk',        'Technical Risk',          'Implementation risks and mitigations',          8, NULL),
  ('v1', 'usage',       'Usage & Adoption',        'User adoption plan and success metrics',        9, NULL);
```

**When the process evolves (example — adding "Account Research" as Step 2 in v2):**

```sql
-- Copy all v1 steps to v2, incrementing order for steps that shift
INSERT INTO TDR_STEP_DEFINITIONS (SCHEMA_VERSION, STEP_ID, STEP_TITLE, STEP_DESCRIPTION, STEP_ORDER, FIELDS)
SELECT 'v2', STEP_ID, STEP_TITLE, STEP_DESCRIPTION,
  CASE WHEN STEP_ORDER >= 2 THEN STEP_ORDER + 1 ELSE STEP_ORDER END,
  FIELDS
FROM TDR_STEP_DEFINITIONS WHERE SCHEMA_VERSION = 'v1';

-- Insert the new step
INSERT INTO TDR_STEP_DEFINITIONS (SCHEMA_VERSION, STEP_ID, STEP_TITLE, STEP_DESCRIPTION, STEP_ORDER)
VALUES ('v2', 'account-research', 'Account Research', 'External intelligence and tech stack discovery', 2);
```

**Querying "what did the process look like for a specific session?":**

```sql
SELECT d.*
FROM TDR_STEP_DEFINITIONS d
JOIN TDR_SESSIONS s ON s.STEP_SCHEMA_VERSION = d.SCHEMA_VERSION
WHERE s.SESSION_ID = :sid AND d.IS_ACTIVE = TRUE
ORDER BY d.STEP_ORDER;
```

**Why a table instead of just the front-end code?** — The front-end defines the *current* process. The table preserves *all* historical processes. When Cortex AI generates a brief for a 6-month-old session, it needs to know what steps existed then, not what steps exist now. This also enables Cortex Analyst to answer questions like *"How has the TDR process changed over the last year?"*

### Table 5: `ACCOUNT_INTEL_SUMBLE`

Stores Sumble enrichment snapshots. Each row is one "pull" — multiple pulls per account over time.

```sql
CREATE TABLE IF NOT EXISTS ACCOUNT_INTEL_SUMBLE (
  PULL_ID            VARCHAR PRIMARY KEY,     -- UUID
  OPPORTUNITY_ID     VARCHAR NOT NULL,
  ACCOUNT_NAME       VARCHAR NOT NULL,
  ACCOUNT_DOMAIN     VARCHAR,                 -- Domain used for lookup
  INDUSTRY           VARCHAR,
  SUB_INDUSTRY       VARCHAR,
  EMPLOYEE_COUNT     INTEGER,
  REVENUE            NUMBER(14,2),
  HEADQUARTERS       VARCHAR,
  TECHNOLOGIES       VARIANT,                 -- JSON array: ["Snowflake", "Tableau", ...]
  TECH_CATEGORIES    VARIANT,                 -- JSON obj: {"BI": ["Tableau"], "DW": ["Snowflake"]}
  RAW_RESPONSE       VARIANT,                 -- Full Sumble API response (audit trail)
  PULLED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  PULLED_BY          VARCHAR
);
```

### Table 6: `ACCOUNT_INTEL_PERPLEXITY`

Stores Perplexity web research snapshots. Each row is one research "pull."

```sql
CREATE TABLE IF NOT EXISTS ACCOUNT_INTEL_PERPLEXITY (
  PULL_ID             VARCHAR PRIMARY KEY,     -- UUID
  OPPORTUNITY_ID      VARCHAR NOT NULL,
  ACCOUNT_NAME        VARCHAR NOT NULL,
  SEARCH_CONTEXT      VARCHAR,                 -- What was searched (account + deal context)
  SUMMARY             VARCHAR,                 -- 2-3 sentence overview
  RECENT_INITIATIVES  VARIANT,                 -- JSON array of strings
  TECHNOLOGY_SIGNALS  VARIANT,                 -- JSON array of strings
  COMPETITIVE_LANDSCAPE VARIANT,               -- JSON array of strings
  KEY_INSIGHTS        VARIANT,                 -- JSON array of strings
  CITATIONS           VARIANT,                 -- JSON array of source URLs
  RAW_RESPONSE        VARIANT,                 -- Full Perplexity API response
  PULLED_AT           TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  PULLED_BY           VARCHAR
);
```

### Table 7: `API_USAGE_LOG`

Tracks every external API call for cost visibility.

```sql
CREATE TABLE IF NOT EXISTS API_USAGE_LOG (
  LOG_ID              VARCHAR PRIMARY KEY,
  SERVICE             VARCHAR NOT NULL,        -- 'perplexity' | 'sumble' | 'cortex'
  ACTION              VARCHAR,                 -- 'enrich' | 'research' | 'complete' | ...
  OPPORTUNITY_ID      VARCHAR,
  ACCOUNT_NAME        VARCHAR,
  TOKENS_IN           INTEGER,                 -- Input tokens (if applicable)
  TOKENS_OUT          INTEGER,                 -- Output tokens (if applicable)
  DURATION_MS         INTEGER,                 -- Round-trip time
  STATUS              VARCHAR,                 -- 'success' | 'error' | 'rate_limited'
  ERROR_MESSAGE       VARCHAR,
  CALLED_AT           TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  CALLED_BY           VARCHAR
);
```

### Table 8: `CORTEX_ANALYSIS_RESULTS`

Stores outputs from Cortex AI function calls (summaries, classifications, aggregations).

```sql
CREATE TABLE IF NOT EXISTS CORTEX_ANALYSIS_RESULTS (
  RESULT_ID           VARCHAR PRIMARY KEY,
  ANALYSIS_TYPE       VARCHAR NOT NULL,        -- 'tdr_summary' | 'portfolio_insights' |
                                               -- 'competitive_agg' | 'tech_classify' | ...
  OPPORTUNITY_ID      VARCHAR,                 -- NULL for cross-deal analysis
  SESSION_ID          VARCHAR,                 -- NULL for cross-deal analysis
  SCOPE               VARCHAR,                 -- 'deal' | 'manager' | 'portfolio' | 'global'
  INPUT_CONTEXT       VARCHAR,                 -- Description of what was analyzed
  OUTPUT              VARIANT,                 -- JSON: the Cortex result
  MODEL_USED          VARCHAR,                 -- 'claude-sonnet-4-5' | 'llama3.1-70b' | ...
  CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  CREATED_BY          VARCHAR
);
```

### Table 9: `TDR_CHAT_MESSAGES`

Stores all inline chat messages (user questions + assistant responses) per TDR session.

```sql
CREATE TABLE IF NOT EXISTS TDR_CHAT_MESSAGES (
    MESSAGE_ID          VARCHAR(36) PRIMARY KEY,    -- UUID
    SESSION_ID          VARCHAR(36) NOT NULL,        -- FK → TDR_SESSIONS
    OPPORTUNITY_ID      VARCHAR(18) NOT NULL,        -- SFDC Opp Id
    ACCOUNT_NAME        VARCHAR(255),                -- For cross-account queries
    ROLE                VARCHAR(10) NOT NULL,         -- 'user' | 'assistant'
    CONTENT             VARCHAR NOT NULL,             -- Message text
    CONTEXT_STEP        VARCHAR(50),                  -- TDR step user was on when asking
    PROVIDER            VARCHAR(30),                  -- 'cortex' | 'perplexity' | 'domo' | future providers
    MODEL_USED          VARCHAR(50),                  -- e.g. 'claude-sonnet-4-5' | 'sonar-pro' | 'domo-default'
    TOKENS_IN           INTEGER,                      -- For cost tracking
    TOKENS_OUT          INTEGER,
    CITED_SOURCES       VARIANT,                      -- JSON array of citation URLs
    CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    CREATED_BY          VARCHAR(100)                   -- Domo user display name
);
```

**Why `PROVIDER` + `MODEL_USED` as VARCHAR?** New providers and models are added without schema changes. Query by provider to compare usage: `SELECT PROVIDER, COUNT(*) FROM TDR_CHAT_MESSAGES GROUP BY PROVIDER`.

**Why a flat table instead of a `VARIANT` column on sessions?** Chat history can grow unbounded. A dedicated table lets us:
- Query across all sessions: *"What questions are SE Managers most commonly asking?"*
- Track per-provider usage and costs: *"How many Perplexity vs. Cortex vs. Domo calls this month?"*
- Cortex can analyze chat patterns via `AI_AGG` across all rows
- Compare response quality across providers for the same question type
- No risk of hitting Snowflake's per-row size limits on large conversations

---

## 6. Code Engine Functions

### Architecture Overview

All Code Engine functions are consolidated into a **single package** deployed to Domo. This follows the pattern established in the [github-appstudio-app reference](../github-appstudio-app/codeengine/), where one `functions.js` file exports all functions and one `packageMapping` array in `manifest.json` declares them.

**Pattern from `samples/cortexAnalystCodeEngine.js`:**
- JWT auth via `sdk.getAccount()` with Snowflake keypair credentials
- Snowflake SQL API via `axios` POST to `/api/v2/statements`
- Retry logic for 429/503/504 (exponential backoff)
- `mapRows()` helper to transform array-based responses into objects
- `base64UrlEncode()` and `getFingerprintFromPrivateKey()` for JWT signing

### Reference Directory Structure

A local `codeengine/` directory serves as a **reference copy** of the Code Engine source. This is not bundled with the React app — it is copied/pasted into Domo's Code Engine IDE when deploying.

```
codeengine/
├── functions.js        ← Main entry point. Exports all 23 functions.
├── snowflakeAuth.js    ← Shared JWT auth + SQL execution (from cortexAnalystCodeEngine.js)
├── persistence.js      ← TDR session + step input CRUD (8 functions)
├── chat.js             ← Inline chat: send messages + get history (2 functions)
├── accountIntel.js     ← Perplexity + Sumble API proxying + persistence (5 functions)
├── cortexAi.js         ← Cortex AI SQL function wrappers (8 functions)
└── package.json        ← Dependencies: codeengine, sdk, axios, crypto
```

**`package.json`:**

```json
{
  "name": "tdr-deal-inspect-codeengine",
  "version": "1.0.0",
  "description": "Code Engine functions for TDR Deal Inspection — Snowflake persistence, account intelligence, and Cortex AI",
  "main": "functions.js",
  "dependencies": {
    "codeengine": "*",
    "sdk": "*",
    "axios": "*"
  }
}
```

> **Note:** `crypto` is a Node.js built-in and does not need to be listed in dependencies.

### Domo Accounts Required

Three Domo Account entries store secrets server-side. The front-end never sees API keys.

| Account Name | Account ID | Properties | Purpose |
|-------------|-----------|-----------|---------|
| `Snowflake Keypair` | 148 (existing) | `privateKey` (PKCS8 PEM), `account` (e.g. `domopartner.us-east-1`), `username` (e.g. `DOMO_CE_USER`) | JWT auth for Snowflake SQL API |
| `Perplexity API` | TBD | `apiKey` (Bearer token) | Sonar chat completions API |
| `Sumble API` | TBD | `apiKey` (Bearer token) | Organization enrichment API |

**Account property retrieval in Code Engine:**

```javascript
// Snowflake (existing pattern from cortexAnalystCodeEngine.js)
const sfAcct = await sdk.getAccount(148);
const privateKeyPem = sfAcct.properties.privateKey;
const accountLocator = sfAcct.properties.account;
const username = sfAcct.properties.username;

// Perplexity
const pplxAcct = await sdk.getAccount(PERPLEXITY_ACCOUNT_ID);
const perplexityKey = pplxAcct.properties.apiKey;

// Sumble
const sumbleAcct = await sdk.getAccount(SUMBLE_ACCOUNT_ID);
const sumbleKey = sumbleAcct.properties.apiKey;
```

### Snowflake Connection Defaults

All SQL execution uses these defaults (configurable at the top of `snowflakeAuth.js`):

```javascript
const SNOWFLAKE_ACCOUNT_ID = 148;
const ACCOUNT = 'domopartner.us-east-1';
const WAREHOUSE = 'TDR_APP_WH';     // Dedicated XS warehouse, auto-suspend 60s
const DATABASE = 'TDR_APP';
const SCHEMA = 'TDR_DATA';
const ROLE = 'TDR_APP_ROLE';        // Scoped role with access only to TDR_APP
const REQUEST_TIMEOUT_MS = 120000;   // 2 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
```

### 5.1 Manifest Configuration (`packageMapping`)

Each Code Engine function must be declared in `manifest.json` under `packageMapping`. The `alias` matches the exported function name. Each parameter specifies:

- `alias` — parameter name (matches the function argument name)
- `type` — one of: `string`, `integer`, `boolean`, `object`
- `nullable` — whether the parameter can be omitted
- `isList` — whether the value is an array
- `children` — sub-fields for complex types (null for simple types)

The output specifies the return shape with the same type system.

**Full `packageMapping` to add to `manifest.json`:**

```json
{
  "id": "d53cbb5d-0abd-4631-91ee-57d334cec257",
  "name": "TDR Deal Inspection",
  "version": "1.24.0",
  "datasetsMapping": [ ... ],
  "proxyId": "tdr-codeengine",
  "packageMapping": [

    {
      "alias": "createSession",
      "parameters": [
        { "alias": "session", "type": "object", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "result", "type": "object", "isList": false, "children": null }
    },

    {
      "alias": "updateSession",
      "parameters": [
        { "alias": "sessionId", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "updates", "type": "object", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "result", "type": "object", "isList": false, "children": null }
    },

    {
      "alias": "getSessionsByOpp",
      "parameters": [
        { "alias": "opportunityId", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "sessions", "type": "object", "isList": true, "children": null }
    },

    {
      "alias": "getAllSessions",
      "parameters": [],
      "output": { "alias": "sessions", "type": "object", "isList": true, "children": null }
    },

    {
      "alias": "saveStepInput",
      "parameters": [
        { "alias": "sessionId", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "opportunityId", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "stepId", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "stepLabel", "type": "string", "nullable": true, "isList": false, "children": null },
        { "alias": "fieldId", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "fieldLabel", "type": "string", "nullable": true, "isList": false, "children": null },
        { "alias": "fieldValue", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "stepOrder", "type": "integer", "nullable": true, "isList": false, "children": null },
        { "alias": "savedBy", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "result", "type": "object", "isList": false, "children": null }
    },

    {
      "alias": "getLatestInputs",
      "parameters": [
        { "alias": "sessionId", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "inputs", "type": "object", "isList": true, "children": null }
    },

    {
      "alias": "getInputHistory",
      "parameters": [
        { "alias": "sessionId", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "stepId", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "fieldId", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "inputs", "type": "object", "isList": true, "children": null }
    },

    {
      "alias": "deleteSession",
      "parameters": [
        { "alias": "sessionId", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "result", "type": "object", "isList": false, "children": null }
    },

    {
      "alias": "enrichSumble",
      "parameters": [
        { "alias": "opportunityId", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "accountName", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "domain", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "calledBy", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "result", "type": "object", "isList": false, "children": null }
    },

    {
      "alias": "researchPerplexity",
      "parameters": [
        { "alias": "opportunityId", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "accountName", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "dealContext", "type": "object", "nullable": false, "isList": false, "children": null },
        { "alias": "calledBy", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "result", "type": "object", "isList": false, "children": null }
    },

    {
      "alias": "getLatestIntel",
      "parameters": [
        { "alias": "opportunityId", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "intel", "type": "object", "isList": false, "children": null }
    },

    {
      "alias": "getIntelHistory",
      "parameters": [
        { "alias": "opportunityId", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "history", "type": "object", "isList": true, "children": null }
    },

    {
      "alias": "getUsageStats",
      "parameters": [
        { "alias": "month", "type": "string", "nullable": true, "isList": false, "children": null }
      ],
      "output": { "alias": "stats", "type": "object", "isList": false, "children": null }
    },

    {
      "alias": "generateTDRBrief",
      "parameters": [
        { "alias": "sessionId", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "result", "type": "object", "isList": false, "children": null }
    },

    {
      "alias": "classifyFindings",
      "parameters": [
        { "alias": "pullId", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "classifications", "type": "object", "isList": true, "children": null }
    },

    {
      "alias": "extractEntities",
      "parameters": [
        { "alias": "pullId", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "entities", "type": "object", "isList": false, "children": null }
    },

    {
      "alias": "getPortfolioInsights",
      "parameters": [
        { "alias": "manager", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "result", "type": "object", "isList": false, "children": null }
    },

    {
      "alias": "summarizeIntelHistory",
      "parameters": [
        { "alias": "opportunityId", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "result", "type": "object", "isList": false, "children": null }
    },

    {
      "alias": "findSimilarDeals",
      "parameters": [
        { "alias": "opportunityId", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "deals", "type": "object", "isList": true, "children": null }
    },

    {
      "alias": "getSentimentTrend",
      "parameters": [
        { "alias": "opportunityId", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "trend", "type": "object", "isList": true, "children": null }
    },

    {
      "alias": "askAnalyst",
      "parameters": [
        { "alias": "question", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "conversationHistory", "type": "object", "nullable": true, "isList": true, "children": null }
      ],
      "output": { "alias": "result", "type": "object", "isList": false, "children": null }
    },

    {
      "alias": "sendChatMessage",
      "parameters": [
        { "alias": "sessionId", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "opportunityId", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "accountName", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "question", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "context", "type": "object", "nullable": false, "isList": false, "children": null },
        { "alias": "provider", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "model", "type": "string", "nullable": true, "isList": false, "children": null },
        { "alias": "step", "type": "string", "nullable": true, "isList": false, "children": null },
        { "alias": "userId", "type": "string", "nullable": true, "isList": false, "children": null }
      ],
      "output": { "alias": "result", "type": "object", "isList": false, "children": null }
    },

    {
      "alias": "getChatHistory",
      "parameters": [
        { "alias": "sessionId", "type": "string", "nullable": false, "isList": false, "children": null }
      ],
      "output": { "alias": "messages", "type": "object", "isList": true, "children": null }
    }

  ],
  "size": { "width": 1, "height": 1 },
  "fullpage": true,
  "fileName": "manifest.json"
}
```

### 5.2 Function Specifications

Every function below is exported from `functions.js`. The front-end calls them via:

```javascript
// From the React app:
const result = await domo.post('/domo/codeengine/v2/packages/tdr-codeengine/versions/1.0.0/run/createSession', {
  session: { opportunityId: '006...', accountName: 'Acme Corp', ... }
});
```

Or using the `@domoinc/ryuu-proxy` helper in dev mode, or Domo's built-in Code Engine client at runtime.

---

#### Group A: Snowflake Persistence (8 functions)

These replace `appDb.ts` entirely. Source: `codeengine/persistence.js`

##### `createSession`

| | |
|---|---|
| **Purpose** | Create a new TDR session for a deal |
| **Domo I/O Type** | Input: `object` → Output: `object` |
| **SQL** | `INSERT INTO TDR_SESSIONS (...)` |

**Input (`session` object):**
```json
{
  "opportunityId": "006ABC123",
  "opportunityName": "Acme Corp - Enterprise",
  "accountName": "Acme Corp",
  "acv": 250000,
  "stage": "5 - Negotiate",
  "owner": "Jane Smith",
  "createdBy": "john.doe@domo.com"
}
```

**Output (`result` object):**
```json
{
  "success": true,
  "sessionId": "uuid-generated-server-side",
  "iteration": 2
}
```

**Logic:** Query `MAX(ITERATION)` from `TDR_SESSIONS` for this `opportunityId`, then insert with `ITERATION + 1`.

##### `updateSession`

| | |
|---|---|
| **Purpose** | Update session status/outcome |
| **Domo I/O Type** | Input: `string` + `object` → Output: `object` |
| **SQL** | `UPDATE TDR_SESSIONS SET ... WHERE SESSION_ID = :sessionId` |

**Input:**
- `sessionId` (string): `"uuid-of-session"`
- `updates` (object): `{ "status": "completed", "outcome": "approved" }`

**Output:** `{ "success": true }`

##### `getSessionsByOpp`

| | |
|---|---|
| **Purpose** | Get all TDR sessions for a specific opportunity |
| **Domo I/O Type** | Input: `string` → Output: `object[]` |
| **SQL** | `SELECT * FROM TDR_SESSIONS WHERE OPPORTUNITY_ID = :oppId ORDER BY CREATED_AT DESC` |

**Input:** `opportunityId` (string)

**Output:** Array of session objects (newest first)

##### `getAllSessions`

| | |
|---|---|
| **Purpose** | Get all TDR sessions (for deals table enrichment) |
| **Domo I/O Type** | Input: none → Output: `object[]` |
| **SQL** | `SELECT * FROM TDR_SESSIONS ORDER BY CREATED_AT DESC` |

**Output:** Array of all session objects

##### `saveStepInput`

| | |
|---|---|
| **Purpose** | Save a single field value from a TDR step (append-only) |
| **Domo I/O Type** | Input: 9× `string`/`integer` → Output: `object` |
| **SQL** | `INSERT INTO TDR_STEP_INPUTS (INPUT_ID, SESSION_ID, OPPORTUNITY_ID, STEP_ID, STEP_LABEL, FIELD_ID, FIELD_LABEL, FIELD_VALUE, STEP_ORDER, SAVED_BY)` |

**Input:**
- `sessionId` (string)
- `opportunityId` (string)
- `stepId` (string): e.g. `"context"`, `"current-arch"`, `"target-arch"`
- `stepLabel` (string, nullable): e.g. `"Current Architecture"` — human-readable name at time of save
- `fieldId` (string): e.g. `"strategic-value"`, `"existing-systems"`
- `fieldLabel` (string, nullable): e.g. `"Existing Systems"` — human-readable name at time of save
- `fieldValue` (string): the user's input text
- `stepOrder` (integer, nullable): position of this step in the current process (e.g., 3)
- `savedBy` (string): Domo username

**Output:** `{ "success": true, "inputId": "uuid" }`

> **Key design:** This is **append-only**. Every save creates a new row. The latest value per field is determined by `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY SAVED_AT DESC)`. Labels and order are denormalized at write time so historical data remains self-describing even after process changes.

##### `getLatestInputs`

| | |
|---|---|
| **Purpose** | Get the most recent value for every field in a session |
| **Domo I/O Type** | Input: `string` → Output: `object[]` |
| **SQL** | ROW_NUMBER window query (see Section 4, Table 2) |

**Input:** `sessionId` (string)

**Output:** Array of `{ stepId, stepLabel, stepOrder, fieldId, fieldLabel, fieldValue, savedAt, savedBy }`

##### `getInputHistory`

| | |
|---|---|
| **Purpose** | Get full edit history for a specific field |
| **Domo I/O Type** | Input: 3× `string` → Output: `object[]` |
| **SQL** | `SELECT ... FROM TDR_STEP_INPUTS WHERE SESSION_ID = :sid AND STEP_ID = :step AND FIELD_ID = :field ORDER BY SAVED_AT` |

**Input:** `sessionId`, `stepId`, `fieldId` (all strings)

**Output:** Array of `{ fieldValue, savedAt, savedBy }` ordered oldest → newest

##### `deleteSession`

| | |
|---|---|
| **Purpose** | Delete a TDR session and all its step inputs |
| **Domo I/O Type** | Input: `string` → Output: `object` |
| **SQL** | `DELETE FROM TDR_STEP_INPUTS WHERE SESSION_ID = :sid; DELETE FROM TDR_SESSIONS WHERE SESSION_ID = :sid;` |

**Input:** `sessionId` (string)

**Output:** `{ "success": true, "deletedInputs": 47 }`

---

#### Group B: Account Intelligence (5 functions)

These proxy external API calls and persist results. Source: `codeengine/accountIntel.js`

##### `enrichSumble`

| | |
|---|---|
| **Purpose** | Call Sumble API, parse response, write to Snowflake, return enrichment |
| **Domo I/O Type** | Input: 4× `string` → Output: `object` |
| **External API** | `POST https://api.sumble.com/v3/organizations/enrich` |
| **SQL** | `INSERT INTO ACCOUNT_INTEL_SUMBLE (...)` + `INSERT INTO API_USAGE_LOG (...)` |

**Flow:**
1. `sdk.getAccount(SUMBLE_ACCOUNT_ID)` → get API key
2. POST to Sumble with `{ organization: { domain } }`
3. Parse response → extract technologies, industry, revenue, etc.
4. Generate UUID for `PULL_ID`
5. INSERT parsed row into `ACCOUNT_INTEL_SUMBLE`
6. INSERT log row into `API_USAGE_LOG` (service: `sumble`, duration, status)
7. Return parsed enrichment to front-end

**Input:** `opportunityId`, `accountName`, `domain`, `calledBy` (all strings)

**Output:**
```json
{
  "success": true,
  "pullId": "uuid",
  "industry": "Financial Services",
  "subIndustry": "Banking",
  "employeeCount": 12000,
  "revenue": 4200000000,
  "headquarters": "New York, NY",
  "technologies": ["Snowflake", "Tableau", "AWS", "Kafka"],
  "techCategories": { "BI": ["Tableau"], "DW": ["Snowflake"], "Cloud": ["AWS"] },
  "pulledAt": "2026-02-08T14:30:00Z"
}
```

##### `researchPerplexity`

| | |
|---|---|
| **Purpose** | Call Perplexity Sonar API, parse response, write to Snowflake, return research |
| **Domo I/O Type** | Input: 3× `string` + 1× `object` → Output: `object` |
| **External API** | `POST https://api.perplexity.ai/chat/completions` |
| **SQL** | `INSERT INTO ACCOUNT_INTEL_PERPLEXITY (...)` + `INSERT INTO API_USAGE_LOG (...)` |

**Flow:**
1. `sdk.getAccount(PERPLEXITY_ACCOUNT_ID)` → get API key
2. Build TDR-aware research prompt (see Section 6)
3. POST to Perplexity Sonar API with `{ model: "sonar", messages: [...] }`
4. Parse response → attempt JSON extraction, fallback to raw text
5. Extract citation URLs from response metadata
6. Generate UUID for `PULL_ID`
7. INSERT parsed row into `ACCOUNT_INTEL_PERPLEXITY`
8. INSERT log row into `API_USAGE_LOG` (service: `perplexity`, tokens_in, tokens_out, duration)
9. Return parsed research to front-end

**Input:**
- `opportunityId` (string)
- `accountName` (string)
- `dealContext` (object): `{ "acv": 250000, "stage": "5 - Negotiate", "partnersInvolved": "Snowflake" }`
- `calledBy` (string)

**Output:**
```json
{
  "success": true,
  "pullId": "uuid",
  "summary": "Acme Corp is a $4.2B financial services firm actively migrating...",
  "recentInitiatives": ["Cloud-first data strategy announced Q4 2025", "..."],
  "technologySignals": ["Evaluating Snowflake as primary DW", "..."],
  "competitiveLandscape": ["Tableau (primary BI)", "Power BI (secondary)", "..."],
  "keyInsights": ["New CDO hired Jan 2026 with cloud-native analytics focus", "..."],
  "citations": ["https://...", "https://..."],
  "pulledAt": "2026-02-08T14:30:00Z"
}
```

##### `getLatestIntel`

| | |
|---|---|
| **Purpose** | Get the most recent Sumble + Perplexity data for an opportunity (cached read, no API calls) |
| **Domo I/O Type** | Input: `string` → Output: `object` |
| **SQL** | Two queries: latest row from each intel table |

**Input:** `opportunityId` (string)

**Output:**
```json
{
  "sumble": { "pullId": "...", "technologies": [...], "pulledAt": "..." },
  "perplexity": { "pullId": "...", "summary": "...", "pulledAt": "..." },
  "hasSumble": true,
  "hasPerplexity": true
}
```

##### `getIntelHistory`

| | |
|---|---|
| **Purpose** | Get all intel pulls for an opportunity (for comparing iterations) |
| **Domo I/O Type** | Input: `string` → Output: `object[]` |
| **SQL** | `SELECT * FROM ACCOUNT_INTEL_SUMBLE WHERE OPPORTUNITY_ID = :oppId ORDER BY PULLED_AT DESC` + same for Perplexity |

**Input:** `opportunityId` (string)

**Output:** Array of `{ source: "sumble"|"perplexity", pullId, pulledAt, ... }`

##### `getUsageStats`

| | |
|---|---|
| **Purpose** | Get API call counts for the Settings page |
| **Domo I/O Type** | Input: `string` (nullable) → Output: `object` |
| **SQL** | `SELECT SERVICE, COUNT(*) ... FROM API_USAGE_LOG WHERE CALLED_AT >= :monthStart GROUP BY SERVICE` |

**Input:** `month` (string, nullable — defaults to current month). Format: `"2026-02"`

**Output:**
```json
{
  "month": "2026-02",
  "perplexity": { "calls": 34, "errors": 1, "avgDurationMs": 2100 },
  "sumble": { "calls": 28, "errors": 0, "avgDurationMs": 800 },
  "cortex": { "calls": 12, "errors": 0, "avgDurationMs": 3200 }
}
```

---

#### Group C: Cortex AI (8 functions)

These execute Cortex AI SQL functions inside Snowflake. Source: `codeengine/cortexAi.js`
See [Section 8](#8-snowflake-cortex-integration) for full SQL examples.

##### `generateTDRBrief`

| | |
|---|---|
| **Purpose** | Generate a structured TDR brief using `AI_COMPLETE` with all stored context |
| **Domo I/O Type** | Input: `string` → Output: `object` |
| **Cortex Function** | `AI_COMPLETE('claude-sonnet-4-5', ...)` |
| **SQL Joins** | `TDR_SESSIONS` + `TDR_STEP_INPUTS` + `ACCOUNT_INTEL_SUMBLE` + `ACCOUNT_INTEL_PERPLEXITY` |

**Input:** `sessionId` (string)

**Output:** `{ "success": true, "brief": "## Executive Summary\n...", "modelUsed": "claude-sonnet-4-5" }`

##### `classifyFindings`

| | |
|---|---|
| **Purpose** | Classify Perplexity findings into TDR-relevant categories |
| **Domo I/O Type** | Input: `string` → Output: `object[]` |
| **Cortex Function** | `AI_CLASSIFY(text, ['competitive_threat', 'technology_adoption', ...])` |

**Input:** `pullId` (string) — references a row in `ACCOUNT_INTEL_PERPLEXITY`

**Output:** Array of `{ "finding": "Acme evaluating ThoughtSpot", "category": "competitive_threat" }`

##### `extractEntities`

| | |
|---|---|
| **Purpose** | Extract competitor names, technologies, executives from Perplexity prose |
| **Domo I/O Type** | Input: `string` → Output: `object` |
| **Cortex Function** | `AI_EXTRACT(text, ['competitor names', 'technology platforms', ...])` |

**Input:** `pullId` (string)

**Output:** `{ "competitors": ["Tableau", "Looker"], "technologies": ["Snowflake", "dbt"], "executives": [{ "name": "Jane Doe", "title": "CDO" }] }`

##### `getPortfolioInsights`

| | |
|---|---|
| **Purpose** | Aggregate cross-deal insights for an SE Manager's portfolio |
| **Domo I/O Type** | Input: `string` → Output: `object` |
| **Cortex Function** | `AI_AGG(...)` — no context window limits |

**Input:** `manager` (string) — the SE Manager's name

**Output:** `{ "success": true, "insights": "Across your 28 deals...", "dealCount": 28 }`

##### `summarizeIntelHistory`

| | |
|---|---|
| **Purpose** | Summarize how account intel has evolved across multiple pulls |
| **Domo I/O Type** | Input: `string` → Output: `object` |
| **Cortex Function** | `AI_SUMMARIZE_AGG(...)` — no context window limits |

**Input:** `opportunityId` (string)

**Output:** `{ "success": true, "evolution": "Since October 2025, this account has shifted...", "pullCount": 4 }`

##### `findSimilarDeals`

| | |
|---|---|
| **Purpose** | Find deals with similar tech profiles / competitive landscapes |
| **Domo I/O Type** | Input: `string` → Output: `object[]` |
| **Cortex Function** | `AI_EMBED('e5-base-v2', ...)` + `AI_SIMILARITY(...)` |

**Input:** `opportunityId` (string)

**Output:** Array of `{ "opportunityId": "006...", "accountName": "Beta Inc", "similarityScore": 0.87, "sessionId": "uuid" }`

##### `getSentimentTrend`

| | |
|---|---|
| **Purpose** | Track sentiment of TDR notes across iterations |
| **Domo I/O Type** | Input: `string` → Output: `object[]` |
| **Cortex Function** | `AI_SENTIMENT(...)` |

**Input:** `opportunityId` (string)

**Output:** Array of `{ "iteration": 1, "sentiment": 0.3, "createdAt": "2026-01-15T..." }` ordered by iteration

##### `askAnalyst`

| | |
|---|---|
| **Purpose** | Natural language → SQL over TDR data via Cortex Analyst |
| **Domo I/O Type** | Input: `string` + `object[]` (nullable) → Output: `object` |
| **Cortex API** | `POST /api/v2/cortex/analyst/message` (same pattern as `cortexAnalystCodeEngine.js`) |

**Input:**
- `question` (string): `"Which accounts have Snowflake in their tech stack but no TDR?"`
- `conversationHistory` (object[], nullable): previous messages for multi-turn context

**Output:**
```json
{
  "success": true,
  "sql": "SELECT DISTINCT ...",
  "columns": ["ACCOUNT_NAME", "TECHNOLOGIES"],
  "rows": [{ "ACCOUNT_NAME": "Acme Corp", "TECHNOLOGIES": "[\"Snowflake\", ...]" }],
  "conversationHistory": [...]
}
```

---

#### Group D: Inline Chat (2 functions)

These handle the multi-provider conversational AI experience in the TDR Workspace. Source: `codeengine/chat.js`

##### `sendChatMessage`

| | |
|---|---|
| **Purpose** | Route a user question to the user-selected LLM provider, persist the exchange, and return the response |
| **Domo Input** | Object: `{ sessionId, opportunityId, accountName, question, context, provider, model, step, userId }` |
| **Domo Output** | Object |

**Logic flow:**
1. Validate inputs; generate UUIDs for user message and assistant message
2. Based on `provider` parameter:
   - **`"cortex"`**: Assemble system prompt from `context` object. Call Snowflake SQL API: `SELECT AI_COMPLETE(:model, [system_prompt, user_question])` where `:model` is the user-selected Cortex model (e.g., `'claude-sonnet-4-5'`, `'llama3.1-405b'`, etc.)
   - **`"perplexity"`**: Call Perplexity chat completions API with `model` parameter (`'sonar-pro'` or `'sonar'`). Include context as system prompt. Set `return_citations: true`. Extract response + citations.
   - **`"domo"`**: Call `/domo/ai/v1/text/chat` (existing endpoint). Context assembled as system prompt. Model is Domo-managed (ignore `model` param).
3. INSERT two rows into `TDR_CHAT_MESSAGES`: one for `role='user'`, one for `role='assistant'` (with `PROVIDER`, `MODEL_USED`, token counts, citations)
4. INSERT one row into `API_USAGE_LOG` for cost tracking
5. Return response object

**Input:**
- `sessionId` (string): `"sess-abc123"`
- `opportunityId` (string): `"006Dn000012abcDEF"`
- `accountName` (string): `"Acme Corp"`
- `question` (string): `"What BI tools does Acme use?"`
- `context` (object): `{ deal: {...}, tdrInputs: {...}, techStack: {...}, webResearch: {...}, currentStep: "Current Architecture" }`
- `provider` (string): `"cortex"`, `"perplexity"`, or `"domo"`
- `model` (string, nullable): `"claude-sonnet-4-5"`, `"sonar-pro"`, etc. NULL for Domo.
- `step` (string, nullable): `"Current Architecture"`
- `userId` (string, nullable): `"john.smith@company.com"`

**Output:**
```json
{
  "success": true,
  "messageId": "msg-xyz789",
  "content": "Based on Sumble enrichment (Feb 7): Acme Corp uses Tableau (primary BI), Power BI (departmental), and Excel (ad-hoc reporting). Perplexity research (Feb 5) also noted an active Looker evaluation for embedded analytics use cases.",
  "provider": "cortex",
  "model": "claude-sonnet-4-5",
  "citations": null,
  "tokensIn": 1200,
  "tokensOut": 85
}
```

##### `getChatHistory`

| | |
|---|---|
| **Purpose** | Retrieve all chat messages for a TDR session |
| **Domo Input** | Text: `sessionId` |
| **Domo Output** | Object (list) |

**SQL:** `SELECT * FROM TDR_CHAT_MESSAGES WHERE SESSION_ID = :sessionId ORDER BY CREATED_AT ASC`

**Input:**
- `sessionId` (string): `"sess-abc123"`

**Output:**
```json
{
  "success": true,
  "messages": [
    {
      "messageId": "msg-001",
      "role": "user",
      "content": "What BI tools does Acme use?",
      "contextStep": "Current Architecture",
      "provider": null,
      "createdAt": "2026-02-08T14:30:00Z"
    },
    {
      "messageId": "msg-002",
      "role": "assistant",
      "content": "Based on Sumble enrichment (Feb 7): ...",
      "contextStep": "Current Architecture",
      "provider": "cortex",
      "model": "claude-sonnet-4-5",
      "citations": null,
      "tokensIn": 1200,
      "tokensOut": 85,
      "createdAt": "2026-02-08T14:30:02Z"
    }
  ]
}
```

---

### 5.3 Shared Infrastructure (`snowflakeAuth.js`)

This module is directly adapted from `samples/cortexAnalystCodeEngine.js` and provides:

| Export | Purpose | Reused From Sample |
|--------|---------|-------------------|
| `getSnowflakeJwt(acctId)` | Generate JWT from Domo Account keypair | ✅ Lines 236–291 |
| `executeSql(statement, warehouse, database, schema, role)` | Execute SQL via Snowflake REST API | ✅ Lines 381–469 |
| `mapRows(respData)` | Transform Snowflake array response → objects | ✅ Lines 162–197 |
| `callAnalystAndGetSql(analystBody, retryCount)` | Call Cortex Analyst API with retry | ✅ Lines 302–376 |
| `buildAnalystBody(question, semanticModel, ...)` | Build Cortex Analyst request body | ✅ Lines 73–149 |
| `delay(ms)` | Sleep for retry backoff | ✅ Line 154 |
| `generateUUID()` | Generate UUID v4 for primary keys | New |

**Key difference from sample:** The sample hardcodes `ACCOUNT_ID = 148`. Our version keeps this as the Snowflake account but adds `PERPLEXITY_ACCOUNT_ID` and `SUMBLE_ACCOUNT_ID` constants for the external API accounts.

### 5.4 Front-End Calling Convention

The React app calls Code Engine functions through Domo's proxy:

```typescript
// src/lib/snowflakeStore.ts

import domo from 'ryuu-proxy';  // or window.domo in production

const CE_PACKAGE = 'tdr-codeengine';
const CE_VERSION = '1.0.0';

async function callCodeEngine<T>(functionName: string, params: Record<string, unknown>): Promise<T> {
  const url = `/domo/codeengine/v2/packages/${CE_PACKAGE}/versions/${CE_VERSION}/run/${functionName}`;
  const response = await domo.post(url, params);
  return response as T;
}

// Usage:
const result = await callCodeEngine('createSession', {
  session: { opportunityId: '006ABC123', accountName: 'Acme Corp', acv: 250000, ... }
});
```

**Dev mode fallback:** When `!window.domo` (local dev), all functions fall back to localStorage, same pattern as current `appDb.ts`.

---

## 7. Perplexity Integration

**API:** [Perplexity Sonar API](https://docs.perplexity.ai/docs/getting-started/overview)

### What We Ask Perplexity

For each deal, Perplexity is prompted with a TDR-aware research request:

```
Research the company "{Account Name}" with focus on:

1. Current data and analytics technology stack (what BI, data warehouse, ETL,
   and data integration tools do they use?)
2. Recent technology partnerships or vendor evaluations (especially data
   platforms like Snowflake, Databricks, or cloud providers)
3. Digital transformation or cloud migration initiatives announced in the
   last 12 months
4. Key technical decision-makers and their publicly stated technology
   priorities
5. Competitive BI/analytics tools currently in use (Tableau, Power BI,
   Looker, Qlik, ThoughtSpot, etc.)

Context: This is a ${deal.acv} deal in ${deal.stage}
${deal.partnersInvolved ? 'with partner involvement from ' + deal.partnersInvolved : ''}.

Return a JSON object:
{
  "summary": "2-3 sentence overview",
  "recentInitiatives": ["...", "..."],
  "technologySignals": ["...", "..."],
  "competitiveLandscape": ["...", "..."],
  "keyInsights": ["...", "..."]
}
```

### Response Parsing

Perplexity Sonar returns markdown-style text with inline citations. The Code Engine function:

1. Strips markdown fences if present
2. Attempts JSON.parse — if successful, stores structured fields
3. If not valid JSON, stores raw text as `SUMMARY` and sets other fields to empty arrays
4. Extracts citation URLs from the Perplexity response metadata into `CITATIONS`
5. Logs to `API_USAGE_LOG` with token counts and duration

### When Perplexity Is Called

| Trigger | Makes API Call? | Rationale |
|---------|----------------|-----------|
| Page load / deals list | **No** | Never batch-research |
| User opens TDR Workspace for a deal | **No** | Loads previously saved intel from Snowflake (if any). Never makes a new API call automatically |
| User clicks "Research Account" button | **Yes** | Explicit user intent. New row appended to Snowflake |
| User clicks "Refresh Research" button | **Yes** | Explicit re-pull. Previous data preserved for comparison |
| Tooltip hover | **No** | Tooltips show cached/scored data only |

---

## 8. Sumble Integration

**API:** [Sumble Organization Enrichment API](https://docs.sumble.com/api)

### What We Ask Sumble

```bash
POST https://api.sumble.com/v3/organizations/enrich
Authorization: Bearer $API_KEY
Content-Type: application/json

{
  "organization": {
    "domain": "acme.com"
  },
  "filters": {
    "technologies": ["*"]  # Return all detected technologies
  }
}
```

### Account Domain Resolution

Sumble requires a domain, but SFDC data only has `Account Name`. Resolution strategy (executed in Code Engine):

1. **SFDC field check** — If an `Account Website` or `Account Domain` field is available in the opportunity dataset, use it directly
2. **Heuristic derivation** — Strip common suffixes (Inc, Corp, LLC, Ltd, Group), lowercase, remove spaces, append `.com`
3. **Perplexity fallback** — If the heuristic fails (Sumble returns no results), use Perplexity to resolve: "What is the primary website domain for {Account Name}?"
4. **Manual override** — Allow the user to enter/correct the domain in the TDR Workspace before enrichment

### Response Mapping

Sumble returns rich firmographic + technographic data. We extract and store:

| Sumble Response Field | Snowflake Column | TDR Use |
|----------------------|-----------------|---------|
| Industry / sub-industry | `INDUSTRY`, `SUB_INDUSTRY` | Vertical depth scoring (Tier 2 factor) |
| Employee count | `EMPLOYEE_COUNT` | Enterprise scale indicator |
| Revenue | `REVENUE` | Strategic account qualification |
| Headquarters | `HEADQUARTERS` | Regional context |
| Technologies detected | `TECHNOLOGIES` (VARIANT) | Competitive tool detection, platform validation |
| Technology categories | `TECH_CATEGORIES` (VARIANT) | Grouped view: BI, DW, ETL, Cloud, etc. |

### Technology Relevance Filtering

Not all technologies Sumble detects are TDR-relevant. The Code Engine function categorizes technologies into TDR-relevant groups:

| Category | Technologies | TDR Impact |
|----------|-------------|------------|
| **BI / Analytics** | Tableau, Power BI, Looker, Qlik, ThoughtSpot, Sisense | Competitive displacement signal |
| **Data Warehouse** | Snowflake, Databricks, BigQuery, Redshift, Synapse | Partner alignment validation |
| **ETL / Integration** | dbt, Fivetran, Airflow, Informatica, Talend, Matillion | Integration complexity |
| **Cloud Platform** | AWS, Azure, GCP | Infrastructure context |
| **ML / AI** | SageMaker, Databricks ML, Vertex AI, DataRobot | AI strategy input |

Technologies outside these categories (e.g., WordPress, Salesforce CRM) are stored in `RAW_RESPONSE` but not surfaced in the UI.

### When Sumble Is Called

Same trigger model as Perplexity — user-initiated, cached, never batch. Sumble and Perplexity are called in parallel when the user requests enrichment.

### 8.1 Sumble Expansion — Deep Intelligence (Planned: Sprint 6.5)

**Current state:** We use only the **Enrich** endpoint (`POST /v3/organizations/enrich`) — it returns a list of detected technologies for a domain. This tells us *what* tech an account runs but nothing about *how deeply* they use it, *who* uses it, or *what they're building*.

**Expansion:** Three additional Sumble endpoints provide intelligence that maps directly to TDR framework steps and scoring factors. Each endpoint is a separate "depth tier" — the SE Manager chooses how deep to go based on deal importance.

#### Tier Model: Depth-on-Demand

| Tier | Endpoint | What It Reveals | Credits/Call | When to Use |
|------|----------|-----------------|--------------|-------------|
| **1 (Current)** | `POST /v3/organizations/enrich` | Technologies detected | ~5/tech found (~25–50) | Every TDR deal |
| **2 (New)** | `POST /v3/organizations/find` | Firmographics: industry, employees, HQ, tech adoption depth | ~5/filter/org (~15–25) | Material deals ($50K+) |
| **3 (New)** | `POST /v3/jobs/find` | Hiring signals: what they're building, competitive landscape, team structure | ~3/job returned (~30–90) | High-priority deals ($100K+ or competitive) |
| **4 (New)** | `POST /v3/people/find` | Key people: technical champions, evaluators, decision-makers | ~TBD/person (~TBD) | Strategic deals ($250K+ or new logo) |

**Cost guard:** Combined Tier 1–3 deep dive ≈ 70–165 credits. Only Tier 1 fires by default. Tier 2–4 each have their own button so the manager controls spend.

---

#### 8.1.1 Organizations Find — Firmographic Context (Tier 2)

**Endpoint:** `POST /v3/organizations/find`
**Docs:** https://docs.sumble.com/api/organizations

```json
{
  "filters": {
    "technologies": ["snowflake", "domo", "tableau", "power bi"]
  },
  "limit": 1
}
```

**What's new vs. Enrich:**

| Field | TDR Value | Maps to TDR Step / Factor |
|-------|-----------|--------------------------|
| `industry` | Vertical depth scoring — Financial Services, Healthcare, Manufacturing, Technology are Tier 2 factors per the 17-factor AI prompt | **Step 1** (Deal Context), **Scoring** (`verticalDepth` — new factor) |
| `total_employees` | Strategic account qualification — >5K employees = Tier 1 trigger per AI prompt ("Enterprise segment OR employees > 5K") | **Step 1** (Deal Context), **Scoring** (`strategicAccount` — new factor) |
| `matching_people_count` | Technology adoption *depth* — "2 people use Snowflake" vs "200 people use Snowflake" is a fundamentally different TDR conversation | **Step 3** (Current Architecture), **Step 9** (Usage & Adoption) |
| `matching_team_count` | Cross-functional adoption signal — tech in 1 team vs. 8 teams changes the integration scope | **Step 4** (Target Architecture), **Step 8** (Technical Risk) |
| `matching_job_post_count` | Hiring velocity = investment signal — active hiring for a technology means it's strategic, not legacy | **Step 3** (Current Architecture) |
| `matching_entities` | Granular tech signals with job/people/team counts per entity — the richest signal in the Sumble API | **Step 3**, **Step 8**, **Scoring** |
| `headquarters_country/state` | Geographic context for regional team planning and field engagement | **Step 1** (Deal Context) |
| `linkedin_organization_url` | Quick link for further manual research | **UI** (clickable link in Intel panel) |

**New TDR Scoring Factors This Enables:**
- `strategicAccount` (Tier 1, 15 pts): `total_employees >= 5000` or `industry` in high-value verticals
- `verticalDepth` (Tier 2, 8 pts): `industry` matches Financial Services, Healthcare, Manufacturing, Technology
- `deepTechAdoption` (Tier 2, 5 pts): `matching_people_count >= 50` for any Domo-competitive technology → well-entrenched incumbent, harder displacement

---

#### 8.1.2 Jobs Find — Hiring Signal Intelligence (Tier 3)

**Endpoint:** `POST /v3/jobs/find`
**Docs:** https://docs.sumble.com/api/jobs

```json
{
  "organization": { "domain": "acme.com" },
  "filters": {
    "technology_categories": ["business-intelligence", "data-warehousing", "etl", "cloud-infrastructure", "machine-learning"]
  },
  "limit": 20
}
```

**This is the richest Sumble endpoint for TDR.** Job postings are the most honest signal of what a company is actually investing in — they can't fake hiring.

| Field | TDR Value | Maps to TDR Step / Factor |
|-------|-----------|--------------------------|
| `job_title` | Hiring signals reveal investment direction: "Senior Snowflake Data Engineer" = real platform commitment, not just a pilot | **Step 3** (Current Architecture), **Step 6** (Partner Alignment) |
| `primary_job_function` | Which *departments* hire for these technologies — Data Engineering? Analytics? IT? Product? Changes the conversation. | **Step 2** (Business Decision), **Step 9** (Usage & Adoption) |
| `matched_technologies` | Confirmed tech stack from actual job requirements — more honest than any web scraper or marketing page | **Step 3** (Current Architecture), **Scoring** (validates `cloudPartner`, `competitiveDisplacement`) |
| `matched_projects` + `projects_description` | What they're actively *building* — "building modern data lakehouse" or "migrating legacy BI to cloud" reveals their strategic direction | **Step 2** (Business Decision), **Step 4** (Target Architecture) |
| `teams` | Internal team names using the tech — reveals organizational structure and potential champions | **Step 9** (Usage & Adoption), champion identification |
| `description` | Full job posting text — competitive intelligence gold mine. Often lists specific tools, architectures, and business problems being solved. | **Step 2**, **Step 3**, **Step 4**, **Step 7** (AI Strategy if AI/ML mentioned) |
| `datetime_pulled` | Recency of the signal — job posted last week vs. 6 months ago tells a different story | Signal freshness weight |
| `location` | Geographic hiring patterns — hiring a Snowflake engineer in the same city as the SE team = co-location opportunity | **Step 1** (Deal Context) |

**TDR Impact — Concrete Examples:**

1. **Competitive landscape confirmed:** Job posts requiring "Tableau" or "Power BI" = confirmed competitive presence. Today we only know competitor count from SFDC — now we know *which* competitors and *how deeply* they're embedded.
2. **Partner validation:** Job posts for "Snowflake DBA" or "Databricks ML Engineer" = the partner alignment isn't theoretical — they're investing headcount.
3. **Architecture direction signal:** "Migrating from on-prem to cloud data warehouse" in job descriptions = active transformation initiative → highest TDR value.
4. **AI readiness signal:** Job posts for ML engineers, data scientists, or AI platform roles = real AI investment → maps directly to Step 7 (AI Strategy).
5. **Hiring velocity:** 15 data engineering posts in the last 90 days vs. 1 = very different urgency and opportunity size.

**New TDR Scoring Factors This Enables:**
- `hiringMomentum` (Tier 2, 8 pts): ≥5 relevant job posts in last 90 days → account is actively investing in data infrastructure
- `competitorConfirmed` (Tier 1 upgrade, +5 pts on `competitiveDisplacement`): job posts confirm specific competitor platforms in use
- `aiInvestmentSignal` (Tier 2, 5 pts): ≥2 AI/ML job posts → real AI strategy, not just marketing

---

#### 8.1.3 People Find — Key Person Identification (Tier 4)

**Endpoint:** `POST /v3/people/find`
**Docs:** https://docs.sumble.com/api/people

```json
{
  "organization": { "domain": "acme.com" },
  "filters": {
    "technology_categories": ["business-intelligence", "data-warehousing"]
  },
  "limit": 20
}
```

**What it provides:**
- People at the organization with specific technology associations
- Titles, seniority levels, departments
- Technology skills matched to the individual

| Data Point | TDR Value | Maps to TDR Step / Factor |
|------------|-----------|--------------------------|
| Name + Title | Identify potential technical champions and evaluators before the first meeting | **Step 1** (Deal Context), champion mapping |
| Department / Team | Understand organizational structure — who owns the data platform decision? | **Step 2** (Business Decision), stakeholder mapping |
| Technology associations | Who are the SMEs for each technology? The person running their Snowflake deployment is the partner-alignment champion. | **Step 6** (Partner Alignment), **Step 3** (Current Architecture) |
| Seniority | Director of Data Engineering vs. Junior Analyst → different engagement strategy | **Step 9** (Usage & Adoption) |

**TDR Impact:**
- **Champion identification:** Before the SE Manager even opens the TDR, they can see *who* at the account has the matching technology background.
- **Engagement planning:** If the account has 3 Snowflake experts, the partner alignment conversation is very different than if they have 0.
- **Adoption planning:** Understanding team size and seniority distribution helps plan realistic adoption strategies.

**Privacy & Credit Consideration:** People data is the most sensitive and most expensive. This tier should only fire on explicit user request for strategic deals.

---

#### 8.1.4 Composite TDR Intelligence View

When all tiers fire, the Intelligence panel transforms from a tech list to a **complete account profile**:

```
┌─────────────────────────────────────────────────────────────┐
│ 🏢 Acme Corp                                                │
│ Industry: Financial Services · 12,500 employees · NYC       │
│ LinkedIn: [→ View]                                          │
├─────────────────────────────────────────────────────────────┤
│ 🔧 Tech Stack (Tier 1 — Enrich)                             │
│ BI: Tableau (8 teams, 43 people), Power BI (2 teams)       │
│ DW: Snowflake (12 teams, 87 people), Redshift (3 teams)   │
│ ETL: dbt (6 teams), Airflow (4 teams)                      │
│ Cloud: AWS, Azure                                           │
│ AI/ML: SageMaker (2 teams), DataRobot (1 team)            │
│ ERP: NetSuite                                               │
├─────────────────────────────────────────────────────────────┤
│ 📊 Tech Adoption Depth (Tier 2 — Organizations)             │
│ 87 people · 12 teams · 23 active job posts                 │
│ Snowflake is the dominant DW (87 people vs Redshift 11)    │
├─────────────────────────────────────────────────────────────┤
│ 💼 Hiring Signals (Tier 3 — Jobs)                            │
│ 🟢 15 data engineering posts in last 90 days (HIGH velocity)│
│ 🔴 3 posts mention "Tableau migration" (competitive signal) │
│ 🟡 2 posts for "ML Platform Engineer" (AI investment)       │
│ Top roles: Sr. Data Engineer (7), Analytics Lead (4)        │
│ Key project: "Cloud data lakehouse modernization"           │
├─────────────────────────────────────────────────────────────┤
│ 👥 Key People (Tier 4 — People)                              │
│ Sarah Chen — VP Data Engineering (Snowflake, dbt, Airflow) │
│ Marcus Johnson — Dir. Analytics (Tableau, Power BI)        │
│ Emily Park — Sr. Data Architect (Snowflake, AWS)           │
└─────────────────────────────────────────────────────────────┘
```

---

#### 8.1.5 Snowflake Storage for Expanded Data

New tables (append-only, same pattern as existing intel tables):

```sql
-- Tier 2: Organization firmographic data
CREATE TABLE IF NOT EXISTS ACCOUNT_INTEL_SUMBLE_ORG (
  ID              VARCHAR(36) DEFAULT UUID_STRING(),
  OPPORTUNITY_ID  VARCHAR(50) NOT NULL,
  ACCOUNT_NAME    VARCHAR(255),
  DOMAIN          VARCHAR(255),
  INDUSTRY        VARCHAR(255),
  TOTAL_EMPLOYEES INTEGER,
  HQ_COUNTRY      VARCHAR(100),
  HQ_STATE        VARCHAR(100),
  LINKEDIN_URL    VARCHAR(500),
  MATCHING_PEOPLE INTEGER,
  MATCHING_TEAMS  INTEGER,
  MATCHING_JOBS   INTEGER,
  MATCHING_ENTITIES VARIANT,
  RAW_RESPONSE    VARIANT,
  CREDITS_USED    INTEGER,
  PULLED_AT       TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  CALLED_BY       VARCHAR(100)
);

-- Tier 3: Job posting intelligence
CREATE TABLE IF NOT EXISTS ACCOUNT_INTEL_SUMBLE_JOBS (
  ID              VARCHAR(36) DEFAULT UUID_STRING(),
  OPPORTUNITY_ID  VARCHAR(50) NOT NULL,
  ACCOUNT_NAME    VARCHAR(255),
  DOMAIN          VARCHAR(255),
  JOB_COUNT       INTEGER,
  JOBS_SUMMARY    VARIANT,       -- Array of { title, function, technologies, teams, location, postedDate }
  RAW_RESPONSE    VARIANT,
  CREDITS_USED    INTEGER,
  PULLED_AT       TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  CALLED_BY       VARCHAR(100)
);

-- Tier 4: Key people data
CREATE TABLE IF NOT EXISTS ACCOUNT_INTEL_SUMBLE_PEOPLE (
  ID              VARCHAR(36) DEFAULT UUID_STRING(),
  OPPORTUNITY_ID  VARCHAR(50) NOT NULL,
  ACCOUNT_NAME    VARCHAR(255),
  DOMAIN          VARCHAR(255),
  PEOPLE_COUNT    INTEGER,
  PEOPLE_SUMMARY  VARIANT,       -- Array of { name, title, department, technologies }
  RAW_RESPONSE    VARIANT,
  CREDITS_USED    INTEGER,
  PULLED_AT       TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  CALLED_BY       VARCHAR(100)
);
```

#### 8.1.6 Code Engine Functions (New)

| Function | Input | Output | Sumble Endpoint |
|----------|-------|--------|-----------------|
| `enrichSumbleOrg` | `opportunityId`, `accountName`, `domain`, `calledBy` | `{ success, orgData, creditsUsed }` | `POST /v3/organizations/find` |
| `enrichSumbleJobs` | `opportunityId`, `accountName`, `domain`, `calledBy` | `{ success, jobs[], creditsUsed }` | `POST /v3/jobs/find` |
| `enrichSumblePeople` | `opportunityId`, `accountName`, `domain`, `calledBy` | `{ success, people[], creditsUsed }` | `POST /v3/people/find` |

#### 8.1.7 Credit Cost Strategy

| Deal Tier | Sumble Tiers Called | Estimated Credits | Trigger |
|-----------|--------------------|--------------------|---------|
| Standard TDR | Tier 1 only | ~25–50 | Click "Enrich" (current) |
| Material ($50K+) | Tier 1 + 2 | ~40–75 | Click "Deep Profile" (new button) |
| High-Priority ($100K+) | Tier 1 + 2 + 3 | ~70–165 | Click "Full Intelligence" (new button) |
| Strategic ($250K+) | All 4 tiers | ~100–200+ | Click "Strategic Deep Dive" (new button) |

All calls remain **user-initiated only**. No auto-fetching. Credits consumed are displayed after each call and tracked in `API_USAGE_LOG`.

---

## 9. Snowflake Cortex Integration

Cortex AI functions run **inside Snowflake** as SQL expressions. This is powerful because the AI has direct access to all stored TDR data, account intelligence, and pipeline information — no need to assemble payloads and send them to an external API.

Reference: [Snowflake Cortex AI Functions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql) · [Cortex Code CLI](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli)

### Component Overview

Cortex is not one thing — it is a toolkit. Some tools are user-facing buttons, some run silently behind the scenes, some are interactive query interfaces, and one is a power-user terminal tool. They all operate on the same Snowflake data, so they compound — each piece of stored intelligence becomes more valuable as more Cortex functions process it.

| Component | What It Does | Where It Fits |
|-----------|-------------|--------------|
| **`AI_COMPLETE`** | General-purpose LLM (Claude, Llama, Mistral, etc.) called via SQL. The prompt can join data from any Snowflake table — no payload assembly needed. | **In-app:** "Generate TDR Brief" button in the TDR Workspace. **Back-end:** Weekly TDR quality scoring via Snowflake Tasks. |
| **`AI_AGG`** | Aggregates insights across many rows with **no context window limits**. Snowflake handles chunking internally. | **In-app:** "Portfolio Insights" button on Command Center — analyze 30+ TDR sessions at once. **Back-end:** Weekly competitive intelligence aggregation across all deals. |
| **`AI_SUMMARIZE_AGG`** | Multi-row summarization, also with no context window limits. Optimized for coherent summaries rather than analytical questions. | **In-app:** "Intelligence Evolution" section in TDR Workspace — shows how account intel changed across multiple research pulls. **Back-end:** Executive hand-off summaries. |
| **`AI_CLASSIFY`** | Takes text + a list of categories, returns the best-fit category. A smart tagging machine. | **Back-end (auto):** Runs after each Perplexity pull. Classifies findings into: `competitive_threat`, `technology_adoption`, `strategic_initiative`, `risk_indicator`, etc. **In-app (indirect):** Classified findings render as color-coded tags. |
| **`AI_EXTRACT`** | Pulls specific entities (names, technologies, amounts) from unstructured text. | **Back-end (auto):** Runs after each Perplexity pull. Extracts competitor names, technologies, executive names. **In-app (indirect):** Extracted competitors feed the "Competitive Tech Detected" pill; extracted technologies supplement Sumble data. |
| **`AI_SENTIMENT`** | Returns a score from -1 to +1 indicating positive/negative sentiment. | **In-app:** Sentiment trend line in TDR History — shows whether deal health is improving or deteriorating across iterations. **Back-end:** Weekly scan flags deals where sentiment dropped significantly. |
| **`AI_EMBED` + `AI_SIMILARITY`** | `AI_EMBED` converts text to a meaning vector. `AI_SIMILARITY` compares two vectors. Together they enable "find things that are about similar topics." | **In-app:** "Similar Deals" section in Intelligence panel — shows deals with comparable tech profiles and competitive landscapes. **Back-end:** Embeddings computed automatically after each enrichment. |
| **Cortex Analyst** | Natural language → SQL. A semantic model (YAML) describes your tables; users ask questions in plain English and get results. | **In-app:** "Ask TDR" query bar in Command Center. Manager types "Which accounts have Snowflake but no TDR?" and gets a table. |
| **Cortex Search** | Hybrid (keyword + semantic) search index over unstructured text. | **In-app:** Search bar in Command Center that searches across ALL stored Perplexity research, Sumble enrichments, and TDR notes. |
| **Cortex Code CLI** | Interactive terminal tool — type natural language, get SQL, dashboards, schema exploration. | **Operational only** (not in the app). Power-user tool for SE leadership to query TDR data from their terminal. Available for free once the Snowflake schema exists. |

#### Deployment Summary

| Component | In-App (User Sees It) | Back-End (Automatic) | Operational (CLI/Admin) |
|-----------|:--------------------:|:-------------------:|:----------------------:|
| `AI_COMPLETE` | ✅ "Generate TDR Brief" | ✅ Weekly quality scoring | — |
| `AI_AGG` | ✅ "Portfolio Insights" | ✅ Weekly competitive agg | — |
| `AI_SUMMARIZE_AGG` | ✅ "Intel Evolution" panel | ✅ Executive summaries | — |
| `AI_CLASSIFY` | Indirect (color-coded tags) | ✅ Auto after Perplexity pull | — |
| `AI_EXTRACT` | Indirect (entities populate UI) | ✅ Auto after Perplexity pull | — |
| `AI_SENTIMENT` | ✅ Sentiment trend in TDR History | ✅ Weekly sentiment alert scan | — |
| `AI_EMBED` + `AI_SIMILARITY` | ✅ "Similar Deals" section | ✅ Embeddings post-enrichment | — |
| Cortex Analyst | ✅ "Ask TDR" query bar | — | — |
| Cortex Search | ✅ Command Center search | — | — |
| Cortex Code CLI | — | — | ✅ Terminal for leadership |

### 8.1 In-App Cortex Functions (via Code Engine)

These are called from the front-end through the `tdr-cortex-ai` Code Engine function, which executes Cortex SQL against Snowflake.

#### 8.1.1 `AI_COMPLETE` — TDR Brief Generation

After a TDR session is completed (or at any point during), generate a structured TDR brief by feeding all step inputs + account intelligence to a Cortex LLM:

```sql
SELECT AI_COMPLETE(
  'claude-sonnet-4-5',
  CONCAT(
    'Generate a Technical Deal Review brief for this deal.\n\n',
    'DEAL: ', s.ACCOUNT_NAME, ' — ', s.OPPORTUNITY_NAME, '\n',
    'ACV: $', s.ACV, ' | Stage: ', s.STAGE, '\n\n',
    'TDR INPUTS:\n', (SELECT LISTAGG(STEP_ID || '.' || FIELD_ID || ': ' || FIELD_VALUE, '\n')
                       FROM TDR_STEP_INPUTS WHERE SESSION_ID = s.SESSION_ID), '\n\n',
    'ACCOUNT TECH STACK (Sumble): ', su.TECHNOLOGIES::VARCHAR, '\n',
    'STRATEGIC CONTEXT (Perplexity): ', p.SUMMARY, '\n',
    'RECENT INITIATIVES: ', p.RECENT_INITIATIVES::VARCHAR, '\n',
    'COMPETITIVE LANDSCAPE: ', p.COMPETITIVE_LANDSCAPE::VARCHAR, '\n\n',
    'Generate a structured brief with: Executive Summary, Technical Architecture Assessment, ',
    'Risk Factors, Recommended Actions, and TDR Outcome Recommendation.'
  )
) AS TDR_BRIEF
FROM TDR_SESSIONS s
LEFT JOIN ACCOUNT_INTEL_SUMBLE su ON su.OPPORTUNITY_ID = s.OPPORTUNITY_ID
  AND su.PULLED_AT = (SELECT MAX(PULLED_AT) FROM ACCOUNT_INTEL_SUMBLE WHERE OPPORTUNITY_ID = s.OPPORTUNITY_ID)
LEFT JOIN ACCOUNT_INTEL_PERPLEXITY p ON p.OPPORTUNITY_ID = s.OPPORTUNITY_ID
  AND p.PULLED_AT = (SELECT MAX(PULLED_AT) FROM ACCOUNT_INTEL_PERPLEXITY WHERE OPPORTUNITY_ID = s.OPPORTUNITY_ID)
WHERE s.SESSION_ID = :session_id;
```

**When:** User clicks "Generate Summary" in TDR Workspace (replaces current Domo AI-based summary).

**Advantage over Domo AI:** The LLM has access to ALL stored context — every step input, every Perplexity finding, every Sumble technology — directly via SQL joins. No payload size limits.

#### 8.1.2 `AI_AGG` — Cross-Deal Portfolio Insights

`AI_AGG` aggregates insights across multiple rows **without context window limitations**. This is uniquely powerful for portfolio-level analysis:

```sql
SELECT AI_AGG(
  CONCAT(
    'Deal: ', s.ACCOUNT_NAME, ' ($', s.ACV, ', ', s.STAGE, ')\n',
    'Tech Stack: ', COALESCE(su.TECHNOLOGIES::VARCHAR, 'Unknown'), '\n',
    'Competitive Tools: ', COALESCE(p.COMPETITIVE_LANDSCAPE::VARCHAR, 'None detected'), '\n',
    'Status: ', s.STATUS, ' | Outcome: ', COALESCE(s.OUTCOME, 'pending')
  ),
  'Analyze these deals as a portfolio. Identify: (1) Common technology patterns across deals, '
  || '(2) Most frequent competitive threats, (3) Deals that share similar architecture challenges, '
  || '(4) Top 3 strategic recommendations for the SE Manager.'
) AS PORTFOLIO_INSIGHTS
FROM TDR_SESSIONS s
LEFT JOIN ACCOUNT_INTEL_SUMBLE su ON su.OPPORTUNITY_ID = s.OPPORTUNITY_ID
LEFT JOIN ACCOUNT_INTEL_PERPLEXITY p ON p.OPPORTUNITY_ID = s.OPPORTUNITY_ID
WHERE s.CREATED_BY = :manager_name
  AND s.CREATED_AT >= DATEADD('month', -6, CURRENT_TIMESTAMP());
```

**When:** New "Portfolio Insights" button on the Command Center dashboard. SE Manager can request an AI-generated analysis of their entire TDR portfolio.

**Why `AI_AGG` and not `AI_COMPLETE`?** — `AI_AGG` is specifically designed for multi-row aggregation without context window limits. A manager with 30 TDR sessions would exceed `AI_COMPLETE`'s context window, but `AI_AGG` handles it natively.

#### 8.1.3 `AI_SUMMARIZE_AGG` — Intelligence Evolution

Summarize how account intelligence has evolved across multiple Perplexity/Sumble pulls:

```sql
SELECT AI_SUMMARIZE_AGG(
  CONCAT(
    '[', TO_CHAR(p.PULLED_AT, 'YYYY-MM-DD'), '] ',
    'Summary: ', p.SUMMARY, ' | ',
    'Initiatives: ', p.RECENT_INITIATIVES::VARCHAR, ' | ',
    'Tech Signals: ', p.TECHNOLOGY_SIGNALS::VARCHAR
  )
) AS INTEL_EVOLUTION
FROM ACCOUNT_INTEL_PERPLEXITY p
WHERE p.OPPORTUNITY_ID = :opp_id
ORDER BY p.PULLED_AT;
```

**When:** Shown in the TDR Workspace Intelligence panel when an account has 2+ research pulls. Answers the question: "What has changed about this account since we last researched it?"

#### 8.1.4 `AI_CLASSIFY` — Finding Categorization

Automatically classify Perplexity findings into TDR-relevant categories:

```sql
SELECT
  f.VALUE::VARCHAR AS finding,
  AI_CLASSIFY(
    f.VALUE::VARCHAR,
    ['competitive_threat', 'technology_adoption', 'strategic_initiative',
     'organizational_change', 'risk_indicator', 'expansion_opportunity']
  ) AS category
FROM ACCOUNT_INTEL_PERPLEXITY p,
     LATERAL FLATTEN(input => p.KEY_INSIGHTS) f
WHERE p.PULL_ID = :pull_id;
```

**When:** Automatically run after each Perplexity pull. Results stored in `CORTEX_ANALYSIS_RESULTS`. Feeds into the "Why TDR?" tooltip enrichment and critical factor scoring.

#### 8.1.5 `AI_EXTRACT` — Entity Extraction

Extract specific entities from Perplexity prose — competitor names, technology names, executive names:

```sql
SELECT AI_EXTRACT(
  p.SUMMARY || ' ' || p.RECENT_INITIATIVES::VARCHAR,
  ['competitor names', 'technology platforms', 'executive names and titles',
   'budget or investment amounts', 'timeline or deadline mentions']
) AS extracted_entities
FROM ACCOUNT_INTEL_PERPLEXITY p
WHERE p.PULL_ID = :pull_id;
```

**When:** Automatically run after each Perplexity pull. Extracted competitors feed into the competitive displacement factor. Extracted technologies validate/supplement Sumble data.

#### 8.1.6 `AI_SENTIMENT` — TDR Health Tracking

Track sentiment of TDR notes over time to identify deals trending positive or negative:

```sql
SELECT
  s.OPPORTUNITY_ID,
  s.ACCOUNT_NAME,
  s.ITERATION,
  AI_SENTIMENT(
    (SELECT LISTAGG(FIELD_VALUE, '. ')
     FROM TDR_STEP_INPUTS
     WHERE SESSION_ID = s.SESSION_ID AND FIELD_VALUE IS NOT NULL)
  ) AS tdr_sentiment
FROM TDR_SESSIONS s
WHERE s.OPPORTUNITY_ID = :opp_id
ORDER BY s.ITERATION;
```

**When:** Displayed in the TDR History page as a sentiment trend line across iterations.

#### 8.1.7 `AI_EMBED` + `AI_SIMILARITY` — Semantic Deal Matching

Embed all account intelligence to enable "find similar deals":

```sql
-- Build embeddings (could be a scheduled task or triggered post-enrichment)
INSERT INTO DEAL_EMBEDDINGS (OPPORTUNITY_ID, EMBEDDING, CREATED_AT)
SELECT
  p.OPPORTUNITY_ID,
  AI_EMBED(
    'e5-base-v2',
    CONCAT(
      'Account: ', p.ACCOUNT_NAME, '. ',
      'Tech Stack: ', COALESCE(su.TECHNOLOGIES::VARCHAR, ''), '. ',
      'Initiatives: ', COALESCE(p.RECENT_INITIATIVES::VARCHAR, ''), '. ',
      'Competitive: ', COALESCE(p.COMPETITIVE_LANDSCAPE::VARCHAR, '')
    )
  ),
  CURRENT_TIMESTAMP()
FROM ACCOUNT_INTEL_PERPLEXITY p
LEFT JOIN ACCOUNT_INTEL_SUMBLE su ON su.OPPORTUNITY_ID = p.OPPORTUNITY_ID;

-- Find similar deals
SELECT
  e2.OPPORTUNITY_ID,
  s.ACCOUNT_NAME,
  AI_SIMILARITY(e1.EMBEDDING, e2.EMBEDDING) AS similarity_score
FROM DEAL_EMBEDDINGS e1
JOIN DEAL_EMBEDDINGS e2 ON e1.OPPORTUNITY_ID != e2.OPPORTUNITY_ID
JOIN TDR_SESSIONS s ON s.OPPORTUNITY_ID = e2.OPPORTUNITY_ID
WHERE e1.OPPORTUNITY_ID = :current_opp_id
ORDER BY similarity_score DESC
LIMIT 5;
```

**When:** "Similar Deals" section in the TDR Workspace Intelligence panel. Shows deals with similar tech profiles, competitive landscapes, or strategic patterns — and links to their TDR sessions so the SE Manager can reference past approaches.

### 8.2 Cortex Analyst — Natural Language Queries

The existing `cortexAnalystCodeEngine.js` pattern can be extended to query TDR data with natural language. A semantic model (YAML) would be defined over the TDR tables:

**Example queries an SE Manager could ask:**

- "Show me all deals where Snowflake was in the tech stack and we won"
- "Which accounts have Tableau — those are displacement opportunities"
- "What was the average TDR score for deals where we identified competitive tech?"
- "List deals that stalled after the first TDR"
- "Compare TDR findings for Acme Corp across all 3 sessions"

**Where in the app:** A new "Ask TDR" input in the Command Center or a dedicated analysis page. The query goes to Code Engine → Cortex Analyst → SQL → results rendered in the app.

### 8.3 Cortex Search — Hybrid Search Across All Intel

Once Perplexity research, Sumble enrichments, and TDR notes are stored in Snowflake, Cortex Search can index the unstructured text for hybrid (keyword + semantic) search:

**Example searches:**

- "cloud migration" → finds all accounts where Perplexity detected cloud migration initiatives
- "Tableau replacement" → finds all deals with Tableau displacement signals
- "data mesh" → finds accounts exploring data mesh architecture

**Where in the app:** A search bar in the Command Center that searches across all stored account intelligence, not just deal names and SFDC fields.

### 8.4 Cortex Code CLI — Operational Use

[Cortex Code CLI](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli) is an interactive terminal tool for Snowflake. While not embedded in the React app, it provides value for:

- **Ad-hoc analysis:** SE leadership can query TDR data directly from their terminal without writing SQL
- **Report generation:** "Build a Streamlit dashboard showing TDR coverage by manager"
- **Data exploration:** "What tables do I have in TDR_APP and what do they contain?"
- **Schema evolution:** "Add a column to TDR_SESSIONS for tracking executive sponsor"

**Not a build dependency** — this is a power-user tool that becomes available automatically once the Snowflake schema exists.

### 8.5 Post-Facto Batch Analysis (Scheduled)

Once data accumulates, scheduled Snowflake Tasks can run Cortex analysis on a cadence:

| Analysis | Cadence | Cortex Function | Output |
|----------|---------|-----------------|--------|
| Win/loss correlation with TDR factors | Weekly | `AI_AGG` | Which factors predicted wins vs. losses? |
| Competitive intelligence aggregation | Weekly | `AI_AGG` | What competitive tools appear most often across all deals? |
| Stale intelligence detection | Daily | `AI_FILTER` | Which accounts have intel > 30 days old and active deals? |
| TDR quality scoring | Weekly | `AI_COMPLETE` | Rate the completeness and quality of each TDR session |
| Technology trend analysis | Monthly | `AI_AGG` | What technologies are trending across the portfolio? |

These results would be written to `CORTEX_ANALYSIS_RESULTS` and surfaced in the app's Command Center as insight cards.

### 8.6 Cortex vs. Domo AI — Role Delineation

Both Cortex and Domo AI remain in the architecture, but with distinct roles:

| Capability | Domo AI (`/domo/ai/v1/text/chat`) | Snowflake Cortex |
|-----------|-----------------------------------|------------------|
| **TDR candidate recommendations** | ✅ Primary (existing, working) | Possible future migration |
| **Per-deal TDR brief generation** | — | ✅ `AI_COMPLETE` (richer context from Snowflake joins) |
| **Cross-deal portfolio analysis** | ❌ (limited to 40-deal payloads) | ✅ `AI_AGG` (no context window limits) |
| **Intelligence summarization** | — | ✅ `AI_SUMMARIZE_AGG` |
| **Finding classification** | — | ✅ `AI_CLASSIFY` |
| **Entity extraction** | — | ✅ `AI_EXTRACT` |
| **Semantic search** | — | ✅ `AI_EMBED` + Cortex Search |
| **Natural language SQL** | — | ✅ Cortex Analyst |
| **Data residency** | Domo cloud | Your Snowflake account |
| **Model selection** | Domo-managed | Claude Sonnet 4.5, Llama 3.1, Mistral Large, etc. |

**Near-term:** Both coexist. Domo AI handles the initial TDR candidate ranking (it works, it's fast, it's integrated). Cortex handles everything that requires access to stored data.

**Long-term option:** Migrate TDR candidate recommendations to Cortex as well, since Cortex would have access to enriched data (tech stacks, strategic context) that Domo AI never sees.

---

## 10. TDR Inline Chat Experience

### 10.1 The Problem

During a TDR review, the SE Manager constantly needs answers: *"What BI tools does this account use?" "What's the competitive landscape here?" "How have we positioned against Tableau in similar deals?" "What should I ask about their data governance?"* Today, these questions require leaving the TDR workflow — opening browser tabs, checking Slack, searching email, or pinging colleagues.

The inline chat eliminates that context-switching entirely.

### 10.2 Core Concept

A **context-aware conversational AI panel** that lives inside the TDR Workspace. It knows:

- **The current deal** — account name, ACV, stage, close date, partners, forecast category
- **All TDR inputs** — every field the manager has filled in across all 10 steps
- **Cached account intelligence** — Sumble tech stack, Perplexity research, previous findings
- **TDR scoring context** — which critical factors fired and why
- **Historical context** — previous TDR sessions for this deal, edit history
- **The TDR framework itself** — the 17-factor methodology, so it can coach the process

### 10.3 LLM Provider Architecture

The user explicitly selects which LLM provider to use. The architecture is a **provider registry** — a pluggable abstraction that makes it trivial to add new providers in the future without touching the chat UI, persistence layer, or context assembly.

#### Provider Registry

```typescript
interface LLMProvider {
  id: string;                      // 'cortex' | 'perplexity' | 'domo' | future providers
  label: string;                   // Display name
  description: string;             // One-liner for tooltip
  models: LLMModel[];              // Available models for this provider
  defaultModel: string;            // Which model to select by default
  supportsStreaming: boolean;       // For future streaming support
  supportsCitations: boolean;      // Does the provider return source URLs?
  requiresApiKey: boolean;         // Does this need a Domo Account secret?
  costTier: 'low' | 'medium' | 'high'; // For cost-awareness in UI
}

interface LLMModel {
  id: string;                      // Model identifier sent to the backend
  label: string;                   // Display name
  description: string;             // Capability summary
  contextWindow: number;           // Max tokens
  isDefault: boolean;
}
```

#### Three Launch Providers

**1. Snowflake Cortex** — Best for questions about stored data, TDR methodology, and deal analysis. Runs inside Snowflake, has direct access to all persisted data.

| Model ID | Display Name | Context Window | Best For |
|----------|-------------|---------------|----------|
| `claude-sonnet-4-5` | Claude Sonnet 4.5 | 200K | Highest quality reasoning, nuanced strategy advice |
| `claude-4-sonnet` | Claude 4 Sonnet | 200K | Strong reasoning, balanced quality/speed |
| `claude-opus-4-5` | Claude Opus 4.5 | 200K | Premium quality, complex multi-step analysis |
| `llama3.1-405b` | Llama 3.1 405B | 128K | Broad knowledge, detailed analysis |
| `mistral-large2` | Mistral Large 2 | 128K | Concise answers, fast responses |

> **Note:** Cortex model availability varies by Snowflake region and evolves over time. The model list should be configurable in Settings (or ideally queried dynamically). Cross-region inference may be required for some models — an `ACCOUNTADMIN` can enable it via `ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'AWS_US'` (see [Cortex cross-region inference](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-cross-region-inference)). The five listed above represent the most capable options per the [Cortex Code CLI docs](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli).

**2. Perplexity** — Best for real-time web research, current events, and questions requiring live data. Returns citations.

| Model ID | Display Name | Context Window | Best For |
|----------|-------------|---------------|----------|
| `sonar-pro` | Sonar Pro | 200K | Deep research, multi-step reasoning with web sources |
| `sonar` | Sonar | 128K | Quick web lookups, faster responses |

**3. Domo AI** — Already integrated (`/domo/ai/v1/text/chat`). Familiar, no additional setup. Good default for teams not yet on Snowflake Cortex.

| Model ID | Display Name | Context Window | Best For |
|----------|-------------|---------------|----------|
| `domo-default` | Domo AI | Managed | General questions, TDR methodology, quick answers |

#### Provider Comparison

| Capability | Cortex | Perplexity | Domo AI |
|-----------|--------|-----------|---------|
| Stored deal data in context | ✅ Direct SQL joins | ⚠️ Via assembled prompt | ⚠️ Via assembled prompt |
| Real-time web search | ❌ | ✅ Native | ❌ |
| Citations/sources | ❌ | ✅ | ❌ |
| Model selection | ✅ 5 models | ✅ 2 models | ❌ Fixed |
| Cost | Snowflake credits | Per API call | Included with Domo |
| Data residency | Your Snowflake account | Perplexity cloud | Domo cloud |
| Setup required | Snowflake + Code Engine | API key | None (already works) |

#### How the Flow Works

```
User selects provider (dropdown)           User selects model (if applicable)
        │                                          │
        ▼                                          ▼
┌──────────────────────────────────────────────────────────┐
│                    Chat Input Bar                         │
│                                                          │
│  [🧊 Cortex ▾] [claude-sonnet-4-5 ▾]  [Ask...]  [Send] │
│                                                          │
│  💡 "What BI tools does Acme use?"                       │
│  💡 "What should I ask about their data governance?"     │
└──────────────────────────────────────────────────────────┘
        │
        ▼
   sendChatMessage(provider, model, question, context)
        │
        ▼
   Code Engine routes to selected provider:
   ├── provider = 'cortex'    → SQL API: AI_COMPLETE(model, [system_prompt, question])
   ├── provider = 'perplexity' → Perplexity API: chat completions with return_citations
   └── provider = 'domo'      → Domo AI: /domo/ai/v1/text/chat (existing endpoint)
        │
        ▼
   Persist Q&A to TDR_CHAT_MESSAGES (with provider + model recorded)
        │
        ▼
   Return response to UI
```

#### Adding a New Provider (Future)

Adding a new LLM provider requires:
1. **Add provider definition** to the provider registry config (front-end)
2. **Add handler** in `sendChatMessage` Code Engine function (one `else if` branch)
3. **(If external API)** Create a Domo Account to store the API key
4. **No schema changes** — `BACKEND` and `MODEL_USED` are VARCHAR, any string works

Examples of future providers: OpenAI GPT, Anthropic direct, Google Gemini, Groq, Cohere, etc. The registry pattern means any of these is a ~30-minute addition.

### 10.4 Context Assembly

Every chat request assembles a **deal context object** that becomes the system prompt. This is what makes the chat "inline" — it always knows what you're working on.

```typescript
interface ChatContext {
  // From the current TDR session
  deal: {
    name: string;
    account: string;
    acv: number;
    stage: string;
    closeDate: string;
    partners: string[];
    forecastCategory: string;
    tdrScore: number;
    criticalFactors: string[];
  };

  // From TDR step inputs (whatever has been filled in so far)
  tdrInputs: Record<string, string>;

  // From Sumble (if available)
  techStack?: {
    categories: Record<string, string[]>;
    lastUpdated: string;
  };

  // From Perplexity (if available)
  webResearch?: {
    summary: string;
    keyFindings: string[];
    lastUpdated: string;
  };

  // Current step context
  currentStep: string;  // e.g., "Current Architecture"

  // Previous sessions for this deal (if any)
  previousSessions?: { date: string; status: string; summary: string }[];
}
```

**System prompt template:**

```
You are a Technical Deal Review (TDR) assistant helping an SE Manager
review a sales opportunity. You have access to the following context
about the current deal:

DEAL: {deal.name} | Account: {deal.account} | ACV: ${deal.acv}
Stage: {deal.stage} | Close: {deal.closeDate}
TDR Score: {deal.tdrScore}/100 | Critical Factors: {deal.criticalFactors}

TDR INPUTS SO FAR:
{tdrInputs formatted as key: value pairs}

ACCOUNT INTELLIGENCE:
Tech Stack: {techStack.categories}
Web Research Summary: {webResearch.summary}

CURRENT STEP: {currentStep}

Answer the user's question concisely and specifically in the context
of THIS deal. If you reference stored data, cite where it came from
(Sumble, Perplexity, or TDR inputs). If the question requires
real-time web data that you don't have, say so and suggest the user
click "Search Web" to route the question to Perplexity.
```

### 10.5 Conversation Persistence

Every chat message persists to Snowflake. This serves three purposes:

1. **Continuity** — Close the workspace, reopen it next week, chat history is intact
2. **Posterity** — The conversation becomes part of the TDR record. Future reviewers can see what questions were asked and what the AI recommended.
3. **Training signal** — Over time, the accumulated Q&A corpus reveals common questions, knowledge gaps, and coaching opportunities

**New table: `TDR_CHAT_MESSAGES`**

```sql
CREATE TABLE IF NOT EXISTS TDR_CHAT_MESSAGES (
    MESSAGE_ID          VARCHAR(36) PRIMARY KEY,   -- UUID
    SESSION_ID          VARCHAR(36) NOT NULL,       -- FK → TDR_SESSIONS
    OPPORTUNITY_ID      VARCHAR(18) NOT NULL,       -- SFDC Opp Id
    ACCOUNT_NAME        VARCHAR(255),               -- For cross-account queries
    ROLE                VARCHAR(10) NOT NULL,        -- 'user' | 'assistant'
    CONTENT             VARCHAR NOT NULL,            -- Message text
    CONTEXT_STEP        VARCHAR(50),                 -- TDR step active when question was asked
    PROVIDER            VARCHAR(30),                 -- 'cortex' | 'perplexity' | 'domo' | future providers
    MODEL_USED          VARCHAR(50),                 -- e.g., 'claude-sonnet-4-5' | 'sonar-pro' | 'domo-default'
    TOKENS_IN           INTEGER,                     -- For cost tracking
    TOKENS_OUT          INTEGER,
    CITED_SOURCES       VARIANT,                     -- JSON array of citation URLs (Perplexity)
    CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    CREATED_BY          VARCHAR(100)                 -- Domo user display name
);
```

> **Note:** `PROVIDER` and `MODEL_USED` are both free-form VARCHAR. Adding a new provider or model never requires a schema change.

### 10.6 Code Engine Functions for Chat

Two new Code Engine functions:

**`sendChatMessage`** — Receives the question + provider + model + assembled context, routes to the selected provider, persists both the question and the response, returns the response.

| Property | Value |
|----------|-------|
| **Input** | `{ sessionId, opportunityId, accountName, question, context, provider, model, step, userId }` |
| **Domo I/O** | Input: Object, Output: Object |
| **provider = "cortex"** | Assembles system prompt from context, calls Snowflake SQL API: `SELECT AI_COMPLETE(:model, [...])` |
| **provider = "perplexity"** | Calls Perplexity chat completions API with selected model, includes `return_citations: true` |
| **provider = "domo"** | Calls `/domo/ai/v1/text/chat` (existing Domo AI endpoint), no model selection needed |
| **Persist** | INSERTs user message row + assistant message row into `TDR_CHAT_MESSAGES` (with `PROVIDER` and `MODEL_USED`) |
| **Returns** | `{ messageId, content, provider, model, citations?, tokensIn, tokensOut }` |

**`getChatHistory`** — Returns all messages for a session, ordered chronologically.

| Property | Value |
|----------|-------|
| **Input** | `{ sessionId }` |
| **Domo I/O** | Input: Text, Output: Object |
| **SQL** | `SELECT * FROM TDR_CHAT_MESSAGES WHERE SESSION_ID = ? ORDER BY CREATED_AT ASC` |
| **Returns** | `{ messages: ChatMessage[] }` (each message includes `provider` and `model` for display) |

### 10.7 UI Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TDR Workspace                                                           │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────┐ │
│  │  TDR Steps (left panel)          │  │  Intelligence + Chat         │ │
│  │                                  │  │  (right panel)               │ │
│  │  ┌────────────────────────────┐  │  │                              │ │
│  │  │ Step 4: Current            │  │  │  [Intel] [Chat] [Brief]      │ │
│  │  │ Architecture               │  │  │        ▼ active tab          │ │
│  │  │                            │  │  │                              │ │
│  │  │ What BI tools?             │  │  │  ┌──────────────────────────┐│ │
│  │  │ [________________]         │  │  │  │ You (2 min ago)         ││ │
│  │  │                            │  │  │  │ What BI tools does Acme ││ │
│  │  │ Current data platform?     │  │  │  │ use?                    ││ │
│  │  │ [________________]         │  │  │  ├──────────────────────────┤│ │
│  │  │                            │  │  │  │ 🧊 Cortex · sonnet-4.5  ││ │
│  │  │ Pain points?               │  │  │  │                         ││ │
│  │  │ [________________]         │  │  │  │ Based on Sumble         ││ │
│  │  │                            │  │  │  │ (enriched Feb 7):       ││ │
│  │  │                            │  │  │  │ • Tableau (primary)     ││ │
│  │  │                            │  │  │  │ • Power BI (dept.)      ││ │
│  │  │                            │  │  │  │ • Excel (ad-hoc)        ││ │
│  │  │                            │  │  │  │                         ││ │
│  │  │                            │  │  │  │ Perplexity (Feb 5) also ││ │
│  │  │                            │  │  │  │ noted Looker eval for   ││ │
│  │  │                            │  │  │  │ embedded analytics.     ││ │
│  │  └────────────────────────────┘  │  │  └──────────────────────────┘│ │
│  │                                  │  │                              │ │
│  │  [◀ Prev]  Step 4 of 10  [Next ▶]│  │  ┌──────────────────────────┐│ │
│  │                                  │  │  │ [🧊 Cortex ▾]            ││ │
│  │                                  │  │  │ [claude-sonnet-4-5 ▾]    ││ │
│  │                                  │  │  │                          ││ │
│  │                                  │  │  │ 🔍 Ask about their      ││ │
│  │                                  │  │  │ architecture...          ││ │
│  │                                  │  │  │                   [Send] ││ │
│  │                                  │  │  │                          ││ │
│  │                                  │  │  │ 💡 Suggestions:          ││ │
│  │                                  │  │  │ "What BI tools?"         ││ │
│  │                                  │  │  │ "Current data platform?" ││ │
│  │                                  │  │  │ 8/30 msgs · $0.02 today ││ │
│  │                                  │  │  └──────────────────────────┘│ │
│  └──────────────────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key UX decisions:**

- **Tab-based right panel:** Three tabs — Intel (Sumble/Perplexity data), Chat (conversation), Brief (generated TDR brief). All share the same panel real estate.
- **Provider selector dropdown:** Compact dropdown in the chat input area showing the active provider (🧊 Cortex, 🔍 Perplexity, 🟦 Domo). Remembers last selection per session.
- **Model selector dropdown:** Appears below the provider dropdown when the selected provider supports multiple models. Hidden for Domo AI (no model choice). Shows model name + brief description in the dropdown.
- **Provider badge on messages:** Each assistant response shows a small badge indicating which provider + model generated it (e.g., "🧊 Cortex · sonnet-4.5" or "🔍 Perplexity · sonar-pro"). This gives visibility when reviewing chat history where different providers may have been used.
- **Step awareness:** The chat input placeholder changes based on the current step: *"Ask about their architecture..."* on Step 4, *"Ask about competitive positioning..."* on Step 6.
- **Citations:** Perplexity responses show clickable source URLs below the message. Cortex and Domo responses do not (they cite stored data sources inline instead).
- **Suggestion chips:** Below the input, 2–3 contextual suggestions based on the current step and selected provider. For Perplexity, suggestions lean toward web research queries. For Cortex, suggestions lean toward stored data and methodology.
- **Cost footer:** Shows message count + estimated cost for the session: *"8/30 msgs · $0.02 today"*

#### Provider-Specific Behaviors

| Behavior | Cortex | Perplexity | Domo AI |
|----------|--------|-----------|---------|
| System prompt includes | Full deal context + stored intel via SQL joins | Full deal context (assembled) | Full deal context (assembled) |
| Response style | Data-grounded, cites Sumble/Perplexity sources | Web-grounded, always includes citation URLs | General-purpose, TDR methodology aware |
| Model picker | ✅ 5 models shown | ✅ 2 models shown | ❌ Hidden (single model) |
| Token limits | Configurable per model | 1,500 output tokens | Domo-managed |
| Input placeholder hint | *"Ask about stored data, strategy..."* | *"Search the web for..."* | *"Ask anything about this deal..."* |

### 10.8 Interaction Patterns

**Pattern 1: Fill-assist** — Ask a question, use the answer to fill in a TDR input field.
> "What's Acme's current data platform?" → "Based on Sumble: Snowflake (cloud DW) + Tableau (BI)" → User pastes into "Current Architecture" field.

**Pattern 2: Strategy coaching** — Ask for TDR methodology guidance.
> "What should I be asking about their data governance?" → AI responds with framework-aligned questions drawn from the TDR methodology.

**Pattern 3: Live research** — Toggle "Web" and ask about current events.
> "What's the latest on Acme's digital transformation initiative?" → Perplexity returns real-time web results with citations.

**Pattern 4: Cross-deal learning** — Ask about similar deals.
> "Have we reviewed similar deals?" → Cortex uses AI_EMBED similarity to find comparable TDR sessions.

**Pattern 5: Summarization** — Ask for a synthesis of everything known.
> "Summarize everything we know about this account" → Cortex combines stored intel, inputs, and previous sessions into a coherent brief.

### 10.9 Cost Controls

Chat can generate significant API usage. Each provider has different cost characteristics:

| Provider | Cost Model | Relative Cost |
|----------|-----------|---------------|
| **Cortex** | Snowflake credits (per token) | Low–Medium (depends on model size) |
| **Perplexity** | Per API call + tokens | Medium–High (web search overhead) |
| **Domo AI** | Included with Domo subscription | Free (already paid) |

**Controls:**

- **Rate limiting:** Max 30 messages per session per day (configurable in Settings, applies across all providers)
- **Per-provider limits:** Optional separate limits per provider (e.g., 30 Cortex, 10 Perplexity, unlimited Domo)
- **Token budget:** Cortex capped at 2,000 output tokens; Perplexity capped at 1,500; Domo managed internally
- **Usage display:** Chat footer shows: *"8/30 msgs · $0.02 today"* — cost estimated from token counts
- **Cache hit:** If a question has been asked before in this session with the same provider+model, return the cached answer (exact match check)
- **Cost awareness in UI:** Perplexity shows a subtle cost indicator (💰) in the provider dropdown to signal it's the most expensive option. Domo shows a ✨ to indicate it's included.
- **Default to lowest cost:** New sessions default to Domo AI (free) or Cortex with the smallest capable model. Users opt-in to higher-cost options explicitly.

### 10.10 Settings Integration

New settings for the chat experience (added to Settings page):

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `chatDefaultProvider` | Dropdown | `'domo'` | Default provider for new chat sessions |
| `chatDefaultCortexModel` | Dropdown | `'claude-4-sonnet'` | Default Cortex model (when Cortex is selected) |
| `chatDailyMessageLimit` | Slider | `30` | Max messages per session per day |
| `chatPerplexityDailyLimit` | Slider | `10` | Max Perplexity messages per day (cost control) |
| `chatEnabledProviders` | Multi-select | All enabled | Which providers appear in the dropdown |
| `chatShowCostEstimates` | Toggle | `true` | Show estimated cost in chat footer |

---

## 11. Front-End Architecture Changes

### 9.1 New Service: `src/lib/snowflakeStore.ts`

Replaces `appDb.ts`. All operations route through Domo Code Engine → Snowflake.

```
Front-end                      Code Engine                  Snowflake
─────────                      ───────────                  ─────────
snowflakeStore.createSession() → POST /domo/codeengine/...  → INSERT TDR_SESSIONS
snowflakeStore.saveStepInput() → POST /domo/codeengine/...  → INSERT TDR_STEP_INPUTS
snowflakeStore.getLatestIntel() → POST /domo/codeengine/... → SELECT ACCOUNT_INTEL_*
```

Dev mode: falls back to localStorage (same pattern as current `appDb.ts`).

### 9.2 New Service: `src/lib/accountIntel.ts`

Orchestrates account intelligence enrichment:

```typescript
async function getAccountIntelligence(deal: Deal): Promise<AccountIntelligence> {
  // 1. Check Snowflake cache via Code Engine
  const cached = await snowflakeStore.getLatestIntel(deal.id);
  if (cached && isWithinCacheTTL(cached.pulledAt)) {
    return cached;
  }
  // 2. If stale or missing, call Code Engine to fetch fresh
  //    (Code Engine calls Perplexity + Sumble in parallel, writes to Snowflake, returns)
  return await snowflakeStore.enrichAccount(deal);
}
```

### 9.3 New Service: `src/lib/cortexAi.ts`

Wraps Cortex AI Code Engine calls for the front-end:

```typescript
async function generateTDRBrief(sessionId: string): Promise<string> { ... }
async function getPortfolioInsights(manager: string): Promise<string> { ... }
async function findSimilarDeals(opportunityId: string): Promise<SimilarDeal[]> { ... }
async function askAnalyst(question: string): Promise<AnalystResult> { ... }
```

### 9.4 New TDR Step: "Account Research" (Step 2)

Inserted between "Deal Context & Stakes" and "Business Decision" in `mockData.ts` and `TDRInputs.tsx`:

```
1. Deal Context & Stakes
2. Account Research          ← NEW
3. Business Decision
4. Current Architecture
5. Target Architecture
6. Domo Role
7. Partner Alignment
8. AI Strategy
9. Technical Risk
10. Usage & Adoption
```

The Account Research step displays:
- **Technology Stack** (from Sumble) — categorized badge groups
- **Strategic Context** (from Perplexity) — summary + expandable findings
- **Key Insights** — highlighted TDR-relevant findings
- **Source Citations** — clickable Perplexity source URLs
- **"Research Account" / "Refresh" button** — triggers enrichment
- **Domain input** — allows user to correct the inferred domain before enrichment

### 9.5 Intelligence Panel Enrichment (`TDRIntelligence.tsx`)

New collapsible section between "Deal Team" and "Readiness Score":

```
ACCOUNT INTELLIGENCE
├── Industry: Financial Services
├── Revenue: $4.2B · Employees: 12,000
├── Known Tech: Snowflake, Tableau, AWS, Kafka
├── Competitive Tools: Tableau (BI), Looker (embedded)
├── Last Researched: 2 hours ago (v3 — 2 prior pulls)
└── [↻ Refresh]  [📊 View History]
```

### 9.6 Settings Page Additions

New card in `Settings.tsx` — "Account Intelligence":

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| **Enable Account Research** | boolean | `true` | Master toggle — hides Enrich/Research buttons when disabled |
| **Monthly API Calls** | read-only | — | Current month Perplexity + Sumble call count (from `API_USAGE_LOG`) |

API keys are NOT in the Settings page — they live as Domo Account secrets accessed only by Code Engine.

### 9.7 Deals Table Indicators (`DealsTable.tsx`)

- 🔍 icon next to account name when `AccountIntelligence` exists in Snowflake
- New "Why TDR?" pills for enrichment-based factors (see Section 10)
- TDR Score tooltip notes when enrichment data contributed to the score

---

## 12. TDR Scoring Enrichment

### New Critical Factors (from intelligence data)

#### `techStackOverlap` (Tier 2, 10 pts)

Triggered when Sumble detects competitive BI/analytics tools in the account's tech stack.

```typescript
techStackOverlap: {
  id: 'techStackOverlap',
  label: 'Competitive Tech Detected',
  shortLabel: 'Tech overlap',
  tier: 2,
  points: 10,
  description: 'Sumble confirms account runs competitive BI/analytics tools',
  strategy: 'Position Domo against the specific detected tools. Prepare displacement narrative.',
  tdrPrep: [
    'Review Sumble-detected competitive tools and identify displacement angles',
    'Prepare migration path from detected tool to Domo',
    'Identify capability gaps in the existing stack that Domo fills',
    'Research whether the account has expressed dissatisfaction with current tools',
  ],
  icon: 'Layers',
  color: 'amber',
}
```

#### `strategicMomentum` (Tier 2, 8 pts)

Triggered when Perplexity finds evidence of active digital transformation, cloud migration, or data strategy initiatives.

```typescript
strategicMomentum: {
  id: 'strategicMomentum',
  label: 'Strategic Initiative',
  shortLabel: 'Active initiative',
  tier: 2,
  points: 8,
  description: 'Perplexity confirms account has active technology transformation initiative',
  strategy: 'Align Domo positioning with the announced initiative. Reference public statements.',
  tdrPrep: [
    'Review the specific initiative from web research',
    'Map Domo capabilities to the stated goals',
    'Identify the executive sponsor of the initiative',
    'Prepare value narrative tied to published strategic priorities',
  ],
  icon: 'Rocket',
  color: 'emerald',
}
```

### Enhanced Existing Factors

- **`cloudPartner`** — When Sumble confirms the account is on Snowflake/Databricks/BigQuery (beyond SFDC picklist), increase confidence and adjust tooltip: "Confirmed via Sumble: Account runs Snowflake"
- **`competitiveDisplacement`** — When Perplexity finds competitive intelligence, add specific details to tdrPrep
- **`newLogoDeal`** — When Sumble provides the full tech stack, pre-populate "Current Architecture" step

### Domo AI Prompt Enrichment

The Domo AI 17-factor prompt in `domoAi.ts` can be enriched with cached intel:

```typescript
// In the per-opportunity payload:
{
  id: opp.id,
  name: opp.name,
  acv: 350000,
  // ... existing SFDC fields ...
  
  // NEW: cached intelligence (if available)
  accountIntel: {
    industry: "Financial Services",
    revenue: "$4.2B",
    techStack: ["Snowflake", "Tableau", "AWS", "Kafka"],
    recentSignals: ["Cloud-first data strategy announced Q4 2025"]
  }
}
```

---

## 13. API Cost & Rate Limit Strategy

### Call Budget

| API | Rate Limit | Expected Monthly Usage | Trigger Model |
|-----|-----------|----------------------|---------------|
| **Sumble** | 10 req/sec | 50–100 enrichments | User-initiated only |
| **Perplexity** | Per-plan | 50–100 research pulls | User-initiated only |
| **Cortex AI** | Per-credit (compute) | ~200 function calls | User-initiated + scheduled batch |
| **Domo AI** | Domo-managed | ~50 recommendation runs | On page load (existing) |

### Cost Control Mechanisms

1. **User-triggered only** — Perplexity and Sumble are NEVER called automatically. No auto-enrich on page load, workspace open, or any other event. The user must explicitly click "Enrich" or "Research."

2. **Persistent results** — Results from each click are saved to Snowflake and displayed on subsequent workspace opens without making new API calls. There is no cache TTL or auto-refresh — saved data is shown as-is with its pull timestamp until the user explicitly clicks again.

3. **Domain-level deduplication** — If two opportunities share the same account, one Sumble call covers both. Sumble results are keyed by domain, not opportunity ID.

4. **API Usage Log** — Every call is logged to `API_USAGE_LOG` with tokens, duration, and status. The Settings page shows a monthly usage counter.

5. **Monthly budget alerts** — A Snowflake Task checks `API_USAGE_LOG` daily. If monthly calls exceed a configurable threshold, a flag is set that the front-end reads to show a warning.

6. **Rate limit handling** — Code Engine functions implement exponential backoff for 429 responses. After 3 retries, return a graceful error to the front-end.

7. **Cortex model selection** — Use smaller/cheaper models for classification and extraction (`llama3.1-8b`), larger models for brief generation and portfolio analysis (`claude-sonnet-4-5`).

### Graceful Degradation

| Scenario | App Behavior |
|----------|-------------|
| Perplexity API down | Show SFDC data only. "Research unavailable" message. |
| Sumble API down | Show SFDC data only. "Enrichment unavailable" message. |
| Snowflake unreachable | Fall back to localStorage (same as current dev mode). |
| Cortex model unavailable | Skip AI analysis. Manual TDR process still works. |
| API budget exhausted | Show warning. Research buttons disabled. Cached data still accessible. |

---

## 14. Migration Plan (AppDB → Snowflake)

### Phase 1: Dual-Write

- `snowflakeStore.ts` writes to BOTH Snowflake and AppDB
- Reads prefer Snowflake, fall back to AppDB
- Validates data consistency

### Phase 2: AppDB Migration Script

A one-time Code Engine function:

```javascript
// 1. Read all documents from AppDB TDRSessions collection
// 2. Transform to Snowflake schema
// 3. INSERT into TDR_SESSIONS + TDR_STEP_INPUTS
// 4. Validate counts match
```

### Phase 3: Snowflake-Only

- Remove AppDB writes from `snowflakeStore.ts`
- Remove `appDb.ts` (or keep as dead code for rollback)
- Update Settings page: remove "AppDB Persistence" toggle, add Snowflake connection status

### User Identity

Current `appDb.ts` doesn't track who made changes. With Snowflake, every row has `CREATED_BY` / `SAVED_BY` / `PULLED_BY`. Captured via:

```typescript
// In the front-end, on app initialization:
const currentUser = await domo.get('/domo/users/v1/me');
// Stored in React context and passed to all snowflakeStore calls
```

---

## 15. Risks & Considerations

### Technical Risks

| Risk | Mitigation |
|------|-----------|
| **Code Engine cold starts** add latency to Snowflake calls | XS warehouse with auto-suspend at 60s. Pre-warm on app load by calling `getSessionsByOpp` early. |
| **Snowflake warehouse contention** if shared with other workloads | Dedicated `TDR_APP_WH` warehouse, XS size, isolated from analytics queries. |
| **Perplexity response quality varies** — some accounts are too obscure | Fall back gracefully. Show "Limited public information available" rather than empty state. |
| **Sumble domain resolution fails** for accounts with non-obvious domains | Multi-step resolution (SFDC field → heuristic → Perplexity → manual). User can always correct. |
| **Cortex model availability** varies by region | Use `auto` model selection for non-critical tasks. Specify model for critical tasks (brief generation). Configure cross-region inference. |
| **VARIANT column query performance** at scale | Add search optimization on `TECHNOLOGIES` column. Consider flattened views for frequent queries. |

### Data & Privacy

| Concern | Approach |
|---------|----------|
| **PII in Perplexity results** (executive names, etc.) | Perplexity returns publicly available information only. Optional: use `AI_REDACT` to strip PII before storage. |
| **API key security** | Keys stored as Domo Account secrets, never in front-end code or localStorage. |
| **Data residency** | All data stays in your Snowflake account. Cortex functions run inside Snowflake. |
| **Sumble/Perplexity terms of service** | Review enrichment data usage terms. Stored data should not be reshared externally. |

### Operational

| Concern | Approach |
|---------|----------|
| **Three Code Engine functions to maintain** | Modular design. Each function is single-purpose. Shared auth pattern. |
| **Snowflake schema evolution** | Use `ALTER TABLE IF NOT EXISTS` pattern. Version schema in git alongside app code. |
| **Monitoring** | `API_USAGE_LOG` table covers all external calls. Snowflake query history covers Cortex usage. |
| **Cost visibility** | Settings page shows monthly API call counts. Snowflake credit consumption visible in Snowflake UI. |

### TDR Process Evolution Strategy

The TDR process (steps, fields, ordering) **will** change. Steps may be added, removed, renamed, reordered, or split. The data model is designed to handle this gracefully without migrations or data loss.

**Principles:**

1. **Step IDs are immutable once used.** If `'current-arch'` exists in the data, that ID stays forever. To rename, change the label but keep the ID. To replace, create a new ID (e.g., `'architecture-review'`) and mark the old one as inactive.

2. **Labels are denormalized at write time.** Every `TDR_STEP_INPUTS` row stores the `STEP_LABEL` and `FIELD_LABEL` that were current when the data was saved. This means old data is always human-readable, even if labels change.

3. **Versions are explicit.** Each session records `STEP_SCHEMA_VERSION`. Each version's full step definition lives in `TDR_STEP_DEFINITIONS`. You can always reconstruct "what did the process look like when this session was created?"

4. **The front-end is the authority for the current version.** Step definitions in `src/config/tdrSteps.ts` define what users see today. The Snowflake `TDR_STEP_DEFINITIONS` table preserves what they saw historically.

**How to evolve:**

| Change | What to do |
|--------|-----------|
| **Add a step** | Add to front-end config. Bump `STEP_SCHEMA_VERSION` (e.g., `'v1'` → `'v2'`). Insert new rows into `TDR_STEP_DEFINITIONS` for v2. Old sessions (v1) are unaffected — their data remains queryable with v1 definitions. |
| **Remove a step** | Remove from front-end config. In `TDR_STEP_DEFINITIONS`, set `IS_ACTIVE = FALSE` for that step in the new version. Old sessions retain their data. New sessions simply won't have that step. |
| **Rename a step** | Keep the `STEP_ID`. Change the `STEP_TITLE` in the front-end and in `TDR_STEP_DEFINITIONS` for the new version. Old `TDR_STEP_INPUTS` rows retain the old `STEP_LABEL` they were saved with. |
| **Reorder steps** | Update `STEP_ORDER` in the front-end config and `TDR_STEP_DEFINITIONS`. Old `TDR_STEP_INPUTS` rows retain their original `STEP_ORDER`. |
| **Add a field to a step** | Add to the step's `FIELDS` in the front-end config and `TDR_STEP_DEFINITIONS`. Old sessions simply won't have that field — `getLatestInputs` returns whatever fields exist for that session. |
| **Remove a field** | Remove from front-end config. Old data remains in `TDR_STEP_INPUTS` — it just won't appear in new sessions. No deletion needed. |

**What never happens:**
- No `ALTER TABLE` DDL for process changes
- No data migration when steps change
- No old data becomes unreadable
- No need to "backfill" new fields into old sessions

---

## 16. Development Tooling

### 16.1 Cortex Code CLI (Available Locally)

The [Cortex Code CLI](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli) is installed and available on the development machine:

```
$ which cortex
~/.local/bin/cortex

$ cortex --version
Cortex Code v1.0.6
```

Cortex Code CLI is a natural-language terminal agent that can orchestrate Snowflake operations. It supports:

- **Claude Sonnet 4.5** (`claude-sonnet-4-5`) — highest quality
- **Claude 4 Sonnet** (`claude-4-sonnet`) — balanced
- **Claude Opus 4.5** (`claude-opus-4-5`) — premium
- **`auto`** mode — automatically selects the best available model

> Cross-region inference may need to be enabled by an `ACCOUNTADMIN`:
> `ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'AWS_US';`

### 16.2 Where to Use Cortex Code CLI During Development

| Sprint | Use Case | Example Command |
|--------|----------|-----------------|
| **Sprint 1** | Create/validate Snowflake schema | *"Create the 9 TDR tables from the DDL in my implementation strategy"* |
| **Sprint 1** | Verify table creation | *"List every table in the TDR_APP schema and describe their columns"* |
| **Sprint 3** | Test Cortex AI functions | *"Run AI_COMPLETE with claude-sonnet-4-5 on a sample TDR prompt"* |
| **Sprint 6** | Validate embeddings | *"Generate AI_EMBED vectors for these 3 test deals and check similarity"* |
| **Sprint 8** | Test chat prompts | *"Use AI_COMPLETE to answer 'What BI tools does Acme use?' with this system prompt"* |
| **Sprint 9** | Build batch analysis | *"Write a Snowflake Task that runs AI_AGG weekly on TDR_STEP_INPUTS"* |
| **Any** | Debug queries | *"Explain why this query is slow and optimize it"* |
| **Any** | Explore data | *"Show me the 10 most recent TDR sessions with their step inputs"* |
| **Any** | Generate Streamlit | *"Build a Streamlit dashboard on TDR_SESSIONS showing completion rates by manager"* |

### 16.3 Cortex Code CLI vs. Code Engine

| Aspect | Cortex Code CLI | Code Engine Functions |
|--------|----------------|----------------------|
| **Where it runs** | Local terminal (dev machine) | Domo server (production) |
| **Auth** | `~/.snowflake/connections.toml` | JWT keypair (Domo Account) |
| **Purpose** | Interactive development, debugging, ad-hoc analysis | Programmatic API calls from the app |
| **Models** | Claude 4.x family (`auto` mode) | Any model via `AI_COMPLETE` |
| **When to use** | Schema creation, testing, exploration, one-off analysis | App runtime — every request from the UI |

### 16.4 Development Workflow

```
┌──────────────────────────────────────────────────────────────────┐
│                     Development Workflow                          │
│                                                                  │
│   1. PLAN (Cursor + Strategy Doc)                                │
│      │                                                           │
│   2. SCHEMA (Cortex Code CLI)                                    │
│      │  "Create table TDR_SESSIONS in TDR_APP schema..."         │
│      │  "Describe the table and verify columns"                  │
│      │                                                           │
│   3. CODE ENGINE (Cursor → codeengine/*.js → Domo)               │
│      │  Write functions locally, paste into Domo Code Engine     │
│      │                                                           │
│   4. TEST (Cortex Code CLI + App)                                │
│      │  "Insert a test TDR session and verify it's queryable"    │
│      │  "Run AI_COMPLETE on a test prompt"                       │
│      │                                                           │
│   5. FRONT-END (Cursor → npm run dev → test)                     │
│      │                                                           │
│   6. VALIDATE (Cortex Code CLI)                                  │
│      │  "Show me the data that was just written by the app"      │
│      │  "Summarize the TDR sessions created today"               │
│                                                                  │
│   Cortex Code CLI is available at every stage for inspection,    │
│   debugging, ad-hoc queries, and AI-assisted development.        │
└──────────────────────────────────────────────────────────────────┘
```

### 16.5 Quick Reference

```bash
# Start Cortex Code CLI
cortex

# Inside a session:
# Switch models
/model claude-sonnet-4-5

# Example: create schema
# "Create all 9 TDR tables in the TDR_APP.PUBLIC schema using the DDL from my implementation strategy"

# Example: test AI_COMPLETE
# "SELECT AI_COMPLETE('claude-4-sonnet', 'Summarize this deal: Acme Corp, $150K ACV, Stage 3')"

# Example: inspect data
# "What's in TDR_SESSIONS? Show me the latest 5 rows"

# Example: build Streamlit
# "Build a Streamlit app on TDR_CHAT_MESSAGES showing message counts by provider"
```

### 16.6 Best Practices — Lessons from Active Development

> **Key insight:** Cortex Code CLI is not just a future tool — it is actively used during development and should be the **first choice** for any Snowflake-related inquiry. It is faster and more accurate than web searches for Snowflake-specific questions because it has direct access to official Snowflake documentation and your account's live metadata.

**Proven use cases (from actual development sessions):**

| What We Needed | How We Used Cortex CLI | Result |
|---------------|----------------------|--------|
| List all available AI_COMPLETE models | `cortex -p "List all available Snowflake Cortex AI_COMPLETE models grouped by provider"` | Got the complete, current model list in seconds — including `claude-4-opus`, `claude-4-sonnet`, `openai-gpt-4.1`, `openai-o4-mini`, and confirmation that Gemini is NOT available on Cortex |
| Verify model capabilities | `cortex -p "Is openai-gpt-4.1 the latest OpenAI model available? Is claude-4-opus the best Anthropic model?"` | Confirmed model rankings and availability without guessing |

**Best practice rules:**

1. **Use Cortex CLI before web search.** For any question about Snowflake capabilities, available models, SQL syntax, Cortex functions, or account metadata — ask Cortex CLI first. It knows Snowflake better than any web search.

2. **Use `-p` flag for non-interactive queries.** The `-p` (print) flag runs a single query and exits — perfect for scripted or CI use:
   ```bash
   cortex -p "What tables exist in TDR_APP.TDR_DATA?"
   cortex -p "Show me the schema of CORTEX_ANALYSIS_RESULTS"
   cortex -p "What Cortex AI_COMPLETE models are available in my region?"
   ```

3. **Use Cortex CLI for live data validation.** After deploying Code Engine changes, verify data was written correctly:
   ```bash
   cortex -p "Show the 5 most recent rows in API_USAGE_LOG where SERVICE = 'cortex'"
   cortex -p "Count TDR_SESSIONS by STATUS"
   ```

4. **Use Cortex CLI to test prompts before Code Engine.** Before writing a new `AI_COMPLETE` call in Code Engine, test the prompt interactively:
   ```bash
   cortex -p "SELECT AI_COMPLETE('claude-4-sonnet', 'You are a TDR analyst. Summarize: ...')"
   ```

5. **Use Cortex CLI for schema operations.** Creating tables, adding columns, granting permissions — all can be done conversationally:
   ```bash
   cortex -p "Add a column MODEL_USED VARCHAR(100) to CORTEX_ANALYSIS_RESULTS if it doesn't exist"
   ```

6. **Connection config lives at `~/.snowflake/connections.toml`.** The current connection uses `externalbrowser` auth (SSO). For non-interactive use (`-p` flag), ensure a recent browser session is active.

**Reference:** [Cortex Code CLI Documentation](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli)

**Cortex Code CLI supported models (for the CLI agent itself):**
- `auto` — automatically selects the best available model (default)
- `claude-sonnet-4-5` — highest quality
- `claude-4-sonnet` — balanced
- `claude-opus-4-5` — premium

> **Note:** These are the models that power the Cortex Code CLI *agent itself* — not to be confused with the AI_COMPLETE models available for application use (which include OpenAI and other providers). The CLI agent uses Claude models to understand your requests and orchestrate Snowflake operations.

### 16.7 Cortex CLI — Rules of Engagement

> **Shaping document:** `shaping/cortex-cli-usage-guidelines.md` — full problem framing, requirements, boundary model, sprint tool assignment, invocation patterns, and fit check.

> **The cardinal rule:** Cortex CLI is a Snowflake assistant. It knows Snowflake. Ask it about Snowflake. Do not ask it to write application code.

**What Cortex CLI IS:**
A Snowflake-native agent that has direct access to your account metadata, live schema, Snowflake documentation, and Cortex AI capabilities. It excels at anything that lives inside Snowflake.

**What Cortex CLI IS NOT:**
A general-purpose code generator. It is not a JavaScript developer, a React developer, a Python notebook builder, or an application architect. It does not know Domo Code Engine patterns, frontend frameworks, or local development tooling.

#### ✅ USE Cortex CLI For:

| Category | Examples |
|----------|---------|
| **DDL & Schema** | Create tables, schemas, views, stages. Alter columns. Grant permissions. Describe existing objects. |
| **Stored Procedures** | Generate SQL or Snowpark Python stored procedures that run *inside* Snowflake. |
| **Tasks, Alerts, Streams** | Create and configure Snowflake automation objects. |
| **Cortex AI Functions** | Test `AI_COMPLETE`, `AI_CLASSIFY`, `AI_EXTRACT`, `AI_EMBED`, `AI_AGG` calls. Validate prompts. |
| **Snowflake ML** | `SNOWFLAKE.ML.CLASSIFICATION`, Snowpark ML pipelines, Model Registry operations. |
| **Data Exploration** | Query live data, profile tables, check row counts, validate feature distributions. |
| **Architecture Questions** | "What warehouse size for this workload?", "How does Snowflake Model Registry work?", "What Python packages are available in Snowpark?" |
| **Debugging SQL** | Explain slow queries, optimize SQL, troubleshoot Snowflake-specific errors. |
| **Schema Validation** | Verify objects were created correctly, inspect column types, check grants. |

#### 🚫 DO NOT USE Cortex CLI For:

| Category | Why Not | Who Does This |
|----------|---------|---------------|
| **Code Engine JavaScript** | Cortex CLI doesn't know the Domo Code Engine SDK, the `executeSql` pattern, JWT auth, or `manifest.json` packageMapping format. | **Cursor / direct authoring** — follow existing patterns in `cortexAi.js` and `consolidated-sprint4-5.js`. |
| **Frontend TypeScript / React** | Cortex CLI has no knowledge of the app's component architecture, hooks, state management, or UI patterns. | **Cursor / direct authoring** — follow existing patterns in `src/`. |
| **Python Notebooks** | Cortex CLI cannot create local files, install pip packages, or set up virtual environments. | **Cursor / direct authoring** — standard Jupyter + pip workflow. |
| **Library Installation** | Cortex CLI runs in Snowflake, not on the local machine. `pip install`, `npm install`, `brew install` are local operations. | **Cursor / terminal** — standard package management. |
| **Application Architecture** | Cortex CLI doesn't understand the Domo App Studio ecosystem, the React → Code Engine → Snowflake data flow, or the frontend/backend separation. | **Cursor / direct authoring** — reference `IMPLEMENTATION_STRATEGY.md`. |
| **Testing & CI** | Cortex CLI cannot run unit tests, linting, build commands, or validation scripts. | **Cursor / terminal** — standard dev tooling. |
| **Git Operations** | Cortex CLI has no access to the local git repo. | **Cursor / terminal** — standard git commands. |
| **manifest.json Editing** | Cortex CLI doesn't know the Domo manifest format or packaging model. | **Cursor / direct authoring** — follow existing structure. |

#### Engagement Model

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   CORTEX CLI ENGAGEMENT MODEL                           │
│                                                                         │
│   ┌─────────────────────────────────────────────────┐                   │
│   │              SNOWFLAKE DOMAIN                   │                   │
│   │                                                 │                   │
│   │   DDL · Views · Procedures · Tasks · Alerts     │ ◄── Cortex CLI   │
│   │   Streams · Stages · Grants · ML Functions      │                   │
│   │   Data Queries · AI Functions · Architecture    │                   │
│   │   Warehouse Sizing · Model Registry · Debugging │                   │
│   │                                                 │                   │
│   └─────────────────────────────────────────────────┘                   │
│                                                                         │
│   ┌─────────────────────────────────────────────────┐                   │
│   │            APPLICATION DOMAIN                   │                   │
│   │                                                 │                   │
│   │   Code Engine JS · Frontend TS/React · Notebooks│ ◄── Direct       │
│   │   Library Installation · manifest.json · Git    │     Authoring     │
│   │   Testing · CI · Build · Local Dev Environment  │     (Cursor)      │
│   │                                                 │                   │
│   └─────────────────────────────────────────────────┘                   │
│                                                                         │
│   The line is clear: if it runs IN Snowflake, ask Cortex CLI.           │
│   If it runs OUTSIDE Snowflake, author it directly.                     │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Anti-Patterns (Mistakes to Never Repeat)

1. **❌ Asking Cortex CLI to generate Code Engine functions.** Code Engine JS files follow Domo-specific patterns (SDK, `executeSql`, JWT auth, `packageMapping`). Cortex CLI doesn't know these patterns and will produce code that doesn't integrate correctly.

2. **❌ Asking Cortex CLI to write frontend components.** The React component architecture, hook patterns, TypeScript interfaces, and UI design system are application-domain knowledge. Cortex CLI will generate generic code that doesn't fit.

3. **❌ Asking Cortex CLI to set up local dev environments.** Python virtual environments, pip installs, Jupyter setup — these are local machine operations. Cortex CLI operates within Snowflake.

4. **❌ Asking Cortex CLI to generate manifest.json entries.** The Domo manifest format is application-specific. Follow existing patterns in the codebase.

5. **❌ Asking Cortex CLI for general ML architecture advice.** ML *strategy* decisions (ensemble vs. single model, feature selection, label design) are human judgment calls informed by domain expertise. Cortex CLI can answer "What Python packages does Snowpark support?" but should not be the source of architectural decisions.

#### Correct Workflow Example (Sprint 28 — Dataset Swap & Propensity ML)

```
Step 1: SHAPE (Cursor + human)                            ✅ Complete
  → Define problem, features, architecture, sprint plan
  → shaping/dataset-swap-and-propensity-model.md

Step 2: DATASET SWAP (Cursor + direct authoring)          Sprint 28a
  → manifest.json field mappings, DomoOpportunity interface,
    OPPORTUNITY_FIELD_MAP, Deal type expansion
  → Cortex CLI NOT used (application domain)

Step 3: EDA (Cursor + local Python notebook)              Sprint 28b
  → notebooks/01_data_exploration.ipynb
  → Cortex CLI: query live Snowflake table for label distribution,
    feature completeness, null rates
  → Cursor: notebook authoring, visualization, go/no-go analysis

Step 4: SNOWFLAKE INFRASTRUCTURE (Cortex CLI)             Sprint 28c
  → DDL: ML_FEATURE_STORE view, ML_TRAINING_DATA view,
    DEAL_ML_PREDICTIONS table, ML_MODEL_METADATA table
  → Grants: CREATE SNOWFLAKE.ML.CLASSIFICATION, CORTEX_USER
  → "Create view ML_FEATURE_STORE with these 19 derived features..."
  → "CREATE SNOWFLAKE.ML.CLASSIFICATION DEAL_CLOSE_PROPENSITY..."
  → "Run SHOW_EVALUATION_METRICS() and SHOW_FEATURE_IMPORTANCE()"
  → Stored procedure: RETRAIN_PROPENSITY_MODEL
  → Tasks: nightly batch scoring, weekly retraining

Step 5: APPLICATION CODE (Cursor + direct authoring)      Sprint 28d
  → codeengine/ — getWinProbability, batchScoreDeals,
    getModelMetrics, retrainModel
  → src/lib/mlPredictions.ts (frontend service)
  → manifest.json packageMapping entries
  → Cortex CLI NOT used (application domain)

Step 6: FRONTEND (Cursor + direct authoring)              Sprint 28e
  → Propensity column, quadrant scatter plot, SHAP factors,
    Intelligence Panel card, portfolio metrics
  → Cortex CLI NOT used (application domain)

Step 7: VALIDATE (Cortex CLI)
  → "Show the latest 10 rows in DEAL_ML_PREDICTIONS"
  → "What's the accuracy and AUC_ROC for DEAL_CLOSE_PROPENSITY?"
  → "Show feature importance for the deployed model"
  → "Count predictions by prediction class"
  → "Verify ML_FEATURE_STORE returns correct derived features for a sample deal"
```

---

## 17. Implementation Phases

> **Note:** This section contains the original phase-based plan drafted before implementation began. **All 8 phases below are complete** — they were executed as Sprints 1–12 (see [Section 18: Sprint Plan & Progress Tracker](#18-sprint-plan--progress-tracker) for the detailed sprint-by-sprint record). Subsequent work (Sprints 13–29) extended well beyond the original 8 phases and is documented exclusively in Section 18. **For current status, refer to Section 18 and the Progress Dashboard.**

| Phase | Scope | Completed As |
|-------|-------|-------------|
| Phase 1 — Snowflake Foundation | DDL, Code Engine, snowflakeStore | Sprint 1 ✅ |
| Phase 2 — TDR Input Persistence | Step inputs save/load from Snowflake | Sprints 2–3 ✅ |
| Phase 3 — Account Intelligence | Sumble + Perplexity + caching | Sprints 4–6 ✅ |
| Phase 4 — Cortex AI (Deal-Level) | AI_COMPLETE, AI_CLASSIFY, AI_EXTRACT | Sprint 7 ✅ |
| Phase 5 — Cortex AI (Portfolio-Level) | AI_AGG, AI_EMBED, Analyst, Search | Sprints 9, 11 ✅ |
| Phase 6 — Scoring & Prompt Enrichment | TDR scoring with intel signals | Sprint 10 ✅ |
| Phase 7 — Settings, Migration & Polish | AppDB → Snowflake migration, cleanup | Sprint 12 ✅ |
| Phase 8 — Cortex Search & Analyst | Semantic search, NLQ | Sprint 11 ✅ |

---

## 18. Sprint Plan & Progress Tracker

Each sprint is a focused work session (2–4 hours). The app remains fully functional after every sprint — no sprint leaves the app in a broken state. Sprints are ordered by dependency: each builds on the one before it.

> **Archived:** Detailed sprint records for Sprints 1–27 and OSS-1 (37 sprints, Feb 9 – Mar 3, 2026) have been moved to [`SPRINT_ARCHIVE.md`](SPRINT_ARCHIVE.md). The archive preserves all task checklists, learnings & decisions, files changed, definition of done, and post-sprint bug fix notes. The Progress Dashboard below provides a compact status overview.

### Progress Dashboard

| Sprint | Name | Status | Completed | Dependencies | Scope |
|--------|------|--------|-----------|-------------|-------|
| 1 | Snowflake Foundation | ✅ Complete | Feb 9, 2026 | None | Infrastructure |
| 2 | Session Persistence (Dual-Write) | ✅ Complete | Feb 9, 2026 | Sprint 1 | Persistence |
| 3 | Step Input Persistence | ✅ Complete | Feb 9, 2026 | Sprint 2 | Persistence |
| 4 | Sumble Account Enrichment | ✅ Complete | Feb 9, 2026 | Sprint 1 | Intelligence |
| 5 | Perplexity Web Research | ✅ Complete | Feb 9, 2026 | Sprint 1 | Intelligence |
| 5.5 | UI/UX Polish & Bug Fixes | ✅ Complete | Feb 9, 2026 | Sprints 4 + 5 | UX / Polish |
| 6 | Usage Tracking, Intel History & Indicators | ✅ Complete | Feb 9, 2026 | Sprints 4 + 5 | Intelligence |
| **6.5** | **Sumble Deep Intelligence Expansion** | ✅ Complete | Feb 9, 2026 | Sprint 6 | **Intelligence** |
| 7 | Cortex AI: Deal-Level | ✅ Complete | Feb 10, 2026 | Sprints 3 + 6 | AI |
| 8 | TDR Inline Chat | ✅ Complete | Feb 9, 2026 | Sprints 3 + 6 | Experience |
| 9 | Cortex AI: Portfolio & Sentiment | ✅ Complete | Feb 9, 2026 | Sprint 7 | AI |
| 10 | TDR Scoring Enrichment | ✅ Complete | Feb 9, 2026 | Sprints 6 + 6.5 | Scoring |
| 11 | Semantic Search & Analyst | ✅ Complete | Feb 9, 2026 | Sprints 7 + 8 | AI |
| 12 | Migration & Cleanup | ✅ Complete | Feb 9, 2026 | All above | Cleanup |
| **13** | **TDR Readout: PDF Engine** | ✅ Complete | Feb 10, 2026 | Sprints 3 + 7; enriched by 10 | **Artifact** |
| **14** | **TDR Readout: Slack Distribution** | ✅ Complete | Feb 12, 2026 (polished Feb 13) | Sprint 13 | **Distribution** |
| **15** | **AG Grid Table, Deal Search & Filter Rethink** | ✅ Complete | Feb 11, 2026 | None (frontend-only) | **UX** |
| **16** | **Fix Similar Deals** | ✅ Complete | Feb 10, 2026 | None | **Bug Fix** |
| **17** | **Lean TDR Refactor** | ✅ Complete | Feb 10, 2026 | Sprints 3 + 7 | **UX** |
| **17.5** | **Structured TDR Analytics Extraction Pipeline** | ✅ Complete | Feb 10, 2026 | Sprint 17 | **Analytics** |
| **17.6** | **TDR Portfolio Analytics Page + NLQ** | ✅ Complete | Feb 10, 2026 | Sprint 17.5 | **Analytics / UX** |
| **18** | **TDR Score v2 (Pre-TDR & Post-TDR)** | ✅ Complete | Feb 10, 2026 | Sprints 17.5 + 6.5 | **Scoring** |
| **19** | **Fileset Intelligence Layer** | ✅ Complete | Feb 11, 2026 | None | **Knowledge Base** |
| **19.5** | **Cortex KB Summarization & Fileset UX** | ✅ Complete | Feb 11, 2026 | Sprint 19 | **AI / UX** |
| **20** | **Hero Metrics & Nav Cleanup** | ✅ Complete | Feb 12, 2026 | Sprint 18 | **UX** |
| **21** | **Action Plan Synthesis (CAPSTONE)** | ✅ Complete | Feb 12, 2026 | S17.5+S18+S19+S19.5+S22 | **AI / Artifact** |
| **22** | **Frontier Model Upgrade + Cortex Branding** | ✅ Complete | Feb 12, 2026 | None | **AI / Config / UX** |
| **23** | **KB Insights Cleanup + KB Tooltip** | ✅ Complete | Feb 12, 2026 | S19.5 + S22 | **UX** |
| **24** | **Performance Optimization & KB Summary Caching** | ✅ Complete | Feb 12–14, 2026 | S21 | **Performance** |
| **26** | **Intelligence Panel UX Review & Consolidation** | ✅ Complete | Feb 13, 2026 | S14 + S21 + S24-WS1 | **UX** |
| **27** | **Intelligence Panel Decision Architecture** | ✅ Complete | Feb 14, 2026 | S26 | **UX / Architecture** |
| **25** | **Documentation Hub & Architecture Diagram** | ✅ Complete | Feb 14, 2026 | S24 + S27 | **Documentation / Visualization** |
| **OSS-1** | **Open-Source Readiness & README Overhaul** | ✅ Complete | Mar 3, 2026 | S25 | **Security / Documentation** |
| **28a** | **Dataset Swap** | ✅ Complete | Mar 3, 2026 | S18 | **Data** |
| **28b** | **EDA Notebook Overhaul** | ✅ Complete | Mar 4, 2026 | S28a | **Data / ML Prep** |
| **29a** | **AI Enhancement Engine** | ✅ Complete | Mar 4, 2026 | S17 + S19 + S6.5 | **AI** |
| **29b** | **AI Enhancement UI** | ✅ Complete | Mar 4, 2026 | S29a | **AI / UX** |
| **PERF-1** | **Performance Optimization** | ✅ Complete | Mar 5, 2026 | S28a | **Performance** |
| **28c** | **ML Infrastructure & Model Training** | ✅ Complete | — | S28b (notebook run) | **ML / Snowflake** |
| **28d** | **Domo Integration** | ✅ Complete | — | S28c | **ML / Data** |
| **28e** | **Frontend ML Integration** | ✅ Complete | — | S28d | **ML / UX** |
| **30** | **UX Polish & Iteration** | ✅ Complete | — | S28e + S29b | **UX** |
| **31** | **TDR Framework Redesign** | ✅ Complete | — | S30 | **UX / Architecture** |
| **32a** | **Model Calibration & Retrain** | ✅ Complete | — | — | **ML / Calibration** |
| **32b** | **Code Engine MLOps Functions** | 🔲 Not Started | — | S32a | **ML / Code Engine** |
| **32c** | **Frontend MLOps Page** | 🔲 Not Started | — | S32b | **ML / UX** |
| **32d** | **MLOps Polish + Documentation** | 🔲 Not Started | — | S32c | **Documentation / UX** |


---

### Sprint 28 — Dataset Swap & Deal Close Propensity ML Model 🔶 IN PROGRESS (28a ✅, 28b ✅, PERF-1 ✅ — 28c/28d/28e remaining)

> **Goal:** (1) Swap the primary app dataset to an expanded version with 65 column mappings (up from 34), including historical outcomes, account firmographics, sales milestones, and engagement signals. (2) Build a `SNOWFLAKE.ML.CLASSIFICATION` propensity-to-close model that predicts close probability for every deal. (3) Surface the propensity score as a primary metric alongside TDR Score in a two-axis quadrant. (4) Display SHAP-like factor explanations inline per deal, designed for naive users.
> **Risk to app:** Low–Medium — dataset swap requires careful column reconciliation to avoid regressions. 2 existing columns missing from v2 (remap `Mgr Forecast Name` → `Forecast Manager`; drop unused `Current FQ`). ML model is additive; existing TDR scoring continues unchanged.
> **Effort:** ~7–10 days (6 sub-sprints)
> **Dependencies:** Sprint 18 (TDR Score v2 — for the two-axis composition)
> **Shaping document:** `shaping/dataset-swap-and-propensity-model.md`

**Problem Statement:**
The current TDR prioritization relies on a deterministic 9-factor scoring engine (`tdrCriticalFactors.ts`) that assigns a 0–100 score based on hand-tuned weights. This score answers "How technically complex is this deal?" — but not "How likely is this deal to close?" A deal can score 85 on TDR complexity but have a 15% chance of closing. The SE Manager needs both axes to allocate TDR time effectively.

Additionally, the app ingests only 34 of 300+ available SFDC columns. The current `opportunitiesmagic` dataset (ID: `6f12ec25-0018-4ed3-adfe-93ebdfad41fe`) lacks the account firmographics, sales milestones, engagement signals, and historical win/loss data required for ML. A new dataset with expanded columns is the prerequisite.

**Dataset Swap:**

New Domo dataset ID: `6ae5896e-e13d-48ac-a9fb-c6e9116b4bb4`
Snowflake table: `TDR_APP.PUBLIC.Forecast_Page_Opportunities_Magic_SNFv2`
Alias: `opportunitiesmagic` (unchanged — avoids codebase-wide rename)
Column mappings: 32 existing (preserved; 2 remapped/dropped) + 33 new = **65 total**

Verified against actual v2 sample (`samples/forecast_page_opportunities_cv2.json` — 506 columns). 2 existing columns required changes: `Mgr Forecast Name` → remapped to `Forecast Manager` (same data, alias unchanged); `Current FQ` → dropped (not used in frontend). 4 proposed columns removed (not in v2): `Why Do Anything`, `Why Domo`, `Why Now`, `Manager Comments`. The 33 confirmed new fields add: account firmographics (Revenue, Employees, Strategic Account, Region, Segment, Vertical), extended deal economics (Platform Price, Services Price, Line Items, Contract Type, Pricing Type, CPQ), sales milestones (Discovery Call, Demo, Pricing Call, Gate Call, Pre-Call Plan, ADM Agenda), engagement (People AI), historical outcomes (Is Closed, Won/Lost/Opty counts by type), dates (Created Date), deal flags (Is Partner, Is Pipeline, Non-Competitive), and unstructured text (Forecast Comments, Next Step, Business Challenge) for Phase 2 AI enrichment.

Full reconciliation table in `shaping/dataset-swap-and-propensity-model.md`.

**Training Architecture: `SNOWFLAKE.ML.CLASSIFICATION` (Native)**

| Aspect | Approach |
|--------|----------|
| **Engine** | `SNOWFLAKE.ML.CLASSIFICATION` — native, GA, pure SQL |
| **Target** | `IS_WON` (binary: Won = 1, Lost = 0) from closed deals |
| **Features** | 19 derived features computed in `ML_FEATURE_STORE` view |
| **Preprocessing** | Auto-handled by Snowflake (encoding, splits, tuning) |
| **Explainability** | `SHOW_FEATURE_IMPORTANCE()` for global; per-prediction factor decomposition for SHAP-like inline display |
| **Inference** | Batch (nightly Task) + real-time fallback (on-demand Code Engine call) |
| **Retraining** | Weekly via Snowflake Task; metadata logged to `ML_MODEL_METADATA` |
| **No Python** | No Snowpark, no UDFs, no external compute — pure SQL through existing Code Engine pattern |

**Why native over stacking ensemble (revised from original Sprint 28 plan):**
The original plan called for a custom XGBoost + LightGBM + RF + LogReg stacking ensemble with Snowpark Python. `SNOWFLAKE.ML.CLASSIFICATION` is simpler: it auto-tunes internally (it's already ensemble-like under the hood), requires no Python runtime, and fits the existing Code Engine → SQL API pattern. Start native; if performance is insufficient, *then* consider Snowpark. Built-in escape hatch, not upfront complexity.

**Two-Axis Composition:**

| | High Propensity | Low Propensity |
|---|---|---|
| **High TDR Score** | 🔴 **CRITICAL** — winnable + complex, TDR adds most value | ⚠️ MONITOR — complex but uncertain, investigate blockers |
| **Low TDR Score** | ✅ STANDARD — likely to close, TDR not critical | ⬜ SKIP — unlikely + simple, not worth TDR time |

**19 Derived Features:**

| Feature | Derivation |
|---------|-----------|
| `ACCOUNT_WIN_RATE` | Total Closed Won / (Won + Lost) per account |
| `TYPE_SPECIFIC_WIN_RATE` | Win rate by deal type (New Logo vs. Upsell) |
| `STAGE_VELOCITY_RATIO` | Stage Age / avg Stage Age for Sales Segment |
| `QUARTER_URGENCY` | Proximity to quarter end (0–1) |
| `DAYS_IN_CURRENT_STAGE` | Stage Age (integer) |
| `DAYS_SINCE_CREATED` | Created Date → now |
| `DEAL_COMPLEXITY_INDEX` | Normalized(Line Items + Competitors + Services Ratio) |
| `COMPETITOR_COUNT` | Number of Competitors |
| `LINE_ITEM_COUNT` | Line Items |
| `SERVICES_RATIO` | Professional Services Price / Total Price |
| `ACV_NORMALIZED` | Z-score within Sales Segment |
| `REVENUE_PER_EMPLOYEE` | ACV / Account Employees |
| `SALES_PROCESS_COMPLETENESS` | Non-null milestones / 7 |
| `STEPS_COMPLETED` | Count of completed milestones + process flags |
| `HAS_THESIS` | People AI Engagement Level populated? |
| `HAS_STAKEHOLDERS` | Snowflake Team Picklist populated? |
| `STAGE_ORDINAL` | Stage → integer 1–7 |
| `DEAL_COMPLEXITY_ENCODED` | Low / Medium / High → 1 / 2 / 3 |
| `AI_MATURITY_ENCODED` | People AI Engagement → 1–5 |

**Snowflake Objects:**

| Object | Type | Purpose |
|--------|------|---------|
| `ML_FEATURE_STORE` | View | 19 derived features computed from raw opportunity data |
| `ML_TRAINING_DATA` | View | Closed deals + labels + features for training input |
| `ML_TRAINING_DATA_CLEAN` | View | 3-year recency filter + DAYS_IN_PIPELINE capped at 730 (Sprint 32a) |
| `ML_PIPELINE_FEATURES` | View | Open pipeline deals — same features as training, DAYS_IN_PIPELINE capped at 730 |
| `DEAL_CLOSE_PROPENSITY` | ML Model | `SNOWFLAKE.ML.CLASSIFICATION` model object |
| `DEAL_PREDICTIONS` | Table | Batch prediction results (opp_id, propensity_score, quadrant, top 5 factors, scored_at) |
| `PREDICTION_SNAPSHOTS` | Table | Pre-overwrite prediction snapshots for ground truth tracking (Sprint 32a) |
| `ML_MODEL_METADATA` | Table | Model registry — version, class counts, eval metrics (VARIANT), feature importance (VARIANT) |
| `SCORE_PIPELINE_DEALS` | Procedure | Batch-scores pipeline with score capping [3%,97%] + pre-overwrite snapshots |
| `RETRAIN_PROPENSITY_MODEL` | Procedure | Retrains on `ML_TRAINING_DATA_CLEAN`, persists eval metrics + feature importance |
| `TASK_NIGHTLY_SCORE` | Task | Nightly scoring (2 AM UTC) |
| `TASK_WEEKLY_RETRAIN` | Task | Weekly retraining (Sun 3 AM UTC) |

**Code Engine Functions (4 new):**

| Function | Purpose |
|----------|---------|
| `getWinProbability(opportunityId)` | Single-deal propensity with top SHAP-like factors |
| `batchScoreDeals()` | Batch score all pipeline deals |
| `getModelMetrics()` | Accuracy, precision, recall, feature importance, last trained |
| `retrainModel()` | Admin-triggered model retrain |

**Frontend Integration:**

| Surface | Change |
|---------|--------|
| **Command Center table** | New "Win Propensity" column — percentage, color-coded (>70% green, 40–70% amber, <40% red), sortable |
| **Command Center quadrant tab** | Gorgeous interactive scatter plot: propensity (Y) × TDR score (X), deals colored by quadrant, click-to-navigate |
| **Intelligence Panel** | Propensity card with SHAP factor bars — plain English labels, directional arrows (↑ helps / ↓ hurts), magnitude bars, color-coded. Designed for naive users — no jargon |
| **Why TDR? pills** | New propensity factor pills: "High Win Rate (0.78)", "Fast Stage Velocity (1.4×)", "Strong Engagement" |
| **Portfolio analytics** | Weighted propensity, CRITICAL quadrant count, <20% risk deals |
| **Graceful degradation** | Propensity shows "—" when model unavailable; TDR score works independently |

**Sub-Sprint Breakdown:**

**Sprint 28a — Dataset Swap (Day 1)** *[Cursor — application domain]* ✅ DONE (Mar 3, 2026)
- [x] Swap `dataSetId` from `6f12ec25-0018-4ed3-adfe-93ebdfad41fe` to `6ae5896e-e13d-48ac-a9fb-c6e9116b4bb4` in `dist/manifest.json`, `public/manifest.json`, and root `manifest.json`
- [x] Remap `Mgr Forecast Name` → `Forecast Manager` in manifest field mappings (alias stays `MgrForecastName`)
- [x] Drop `Current FQ` from manifest (not used in frontend)
- [x] Add 33 new field mappings (65 total) per reconciliation table in shaping doc
- [x] Expand `DomoOpportunity` interface in `src/lib/domo.ts` with new fields
- [x] Expand `OPPORTUNITY_FIELD_MAP` with new alias → canonical mappings
- [x] Expand `Deal` interface in `src/types/tdr.ts` with new optional properties
- [x] Extend `transformOpportunityToDeal()` in `src/hooks/useDomo.ts` for new fields
- [x] Verify all existing pages, components, and scoring work without regressions
- [x] Verify `domoAi.ts` AI payload still works with expanded data

**Sprint 28b — Exploratory Data Analysis (Day 2)** *[Cursor + Cortex CLI for live Snowflake queries]* ✅ DONE (Mar 4, 2026)
- [x] Overhaul `notebooks/01_data_exploration.ipynb` to target `TDR_APP.PUBLIC.Forecast_Page_Opportunities_Magic_SNFv2`
- [x] Validate label distribution: Won count, Lost count, Open count, class balance
- [x] Feature completeness: null rates for all 19 ML feature source columns across closed and open deals
- [x] Won vs Lost distribution analysis for key numeric features
- [x] Correlation analysis: identify multicollinear features to avoid redundancy
- [x] Derived feature preview: account win rate, stage velocity, services ratio, sales process completeness
- [x] **GO — EDA executed against live Snowflake (Mar 6, 2026).** 194,762 total rows. 188,193 closed deals (49,684 Won / 138,509 Lost / 26.4% win rate). 134 candidate features, 87 with <10% null. Threshold was ≥500 labeled deals — dataset has 376× that. Class imbalance ~1:2.8 (Won:Lost) — moderate, manageable by `SNOWFLAKE.ML.CLASSIFICATION` auto-tuning.

**Sprint PERF-1 — Performance Optimization** *[Cursor — application domain]* ✅ DONE (Mar 5, 2026)
- [x] Diagnosed 40-second load time: `/sql/v1/` endpoint returning 400, falling back to unfiltered `/data/v1/` (194,762 rows)
- [x] Reverse-engineered `@domoinc/query` library source — discovered `/data/v2/` endpoint with `?fields=` + `&filter=` query params
- [x] Implemented multi-strategy cascade: `/data/v2/` with fields+filter → `/data/v1/` with filter → `/data/v2/` with fields → `/data/v1/` full fallback
- [x] Strategy 1 succeeded: 5,375 records in 1,008ms (24 columns, server-side filter for open deals + 5-quarter window)
- [x] Fixed "all managers" filter bug: `DEFAULT_MANAGER` was `'all'` (string) but TopBar sets `null` — mismatch caused empty first render
- [x] Default quarter filter set to current quarter; SQL fetches current+4 quarters for early-stage deal visibility
- [x] App version bumped to v1.63.0, all UAT passed

**Sprint 28b+ — Pre-Training Data Validation** *[Python script]* ✅ DONE (Mar 6, 2026)
- [x] Ran `python notebooks/02_pre_training_validation.py` against live Snowflake
- [x] **Gate: ALL CRITICAL CHECKS PASSED** — 0 duplicates, labels consistent, 16 leakage columns identified, 38 safe features confirmed
- [x] Warnings noted: `Lead Source` (183 values) and `People AI Engagement Level` (101 values) need bucketing; "Duplicate" (13,136) and "Obsolete" (802) stage deals must be excluded from training
- [x] Temporal split recommendation: train on pre-2026, hold out 2026-Q1 as test set
- [x] Results saved to `notebooks/validation_results.json`

**Sprint 28c — ML Infrastructure & Model Training (Day 3–4)** ✅ DONE (Mar 6, 2026) *[Cortex CLI — all Snowflake domain]*
- [x] Create `ML_FEATURE_STORE` view — 194,762 rows, 38 safe features + derived features (Mar 6)
- [x] Create `ML_TRAINING_DATA` view — 173,770 closed deals (49,206 Won / 124,564 Lost, 28.3% win rate), excludes Duplicate/Obsolete (Mar 6)
- [x] Create `ML_TRAINING_DATA_CLEAN` view — Cortex added to handle type coercions (People AI Engagement Level FLOAT→VARCHAR) (Mar 6)
- [x] Create `DEAL_PREDICTIONS` table + `ML_MODEL_METADATA` table (Mar 6)
- [x] Grants configured for schema and ML operations (Mar 6)
- [x] `CREATE SNOWFLAKE.ML.CLASSIFICATION DEAL_CLOSE_PROPENSITY` — trained successfully (Mar 6)
- [x] v1 evaluation metrics: AUC 0.997, F1 97.7% — **leakage detected** in ACCOUNT_WIN_RATE, STAGE_AGE, TOTAL_OPTY_COUNT (Mar 6)
- [x] **Leakage audit**: dropped 5 features (ACCOUNT_WIN_RATE, TYPE_SPECIFIC_WIN_RATE, TOTAL_OPTY_COUNT, STAGE_AGE, STAGE_VELOCITY_RATIO), fixed DAYS_SINCE_CREATED → DAYS_IN_PIPELINE, added RECURRING_RATIO (Mar 6)
- [x] v2 retrain (leakage-clean): **F1 92.3% (Won)**, Precision 92.5%, Recall 92.1%, F1 97.1% (Lost) (Mar 6)
- [x] Feature importance validated (v2) — top factors: DAYS_IN_PIPELINE (15.2%), LINE_ITEMS (9.6%), CONTRACT_TYPE (5.1%), DEAL_TYPE (4.9%), SALES_SEGMENT (4.8%) — all legitimately available at prediction time (Mar 6)
- [x] Create `ML_PIPELINE_FEATURES` view — 6,569 open pipeline deals (Mar 6)
- [x] Create `SCORE_PIPELINE_DEALS()` procedure + `RETRAIN_PROPENSITY_MODEL()` procedure (Mar 6)
- [x] Create Snowflake Tasks: `TASK_NIGHTLY_SCORE` (2 AM UTC) + `TASK_WEEKLY_RETRAIN` (Sun 3 AM UTC) — created **suspended** (Mar 6)
- [x] v2 batch scoring: **6,569 pipeline deals scored** — 2,487 HIGH (avg 85.2%), 884 MONITOR (avg 39.1%), 3,198 AT_RISK (avg 5.0%) (Mar 6)
- [x] All objects in `TDR_APP.ML_MODELS` schema, using `TDR_APP_WH` (Mar 6)
- [x] Fixed empty string handling: `Demo Completed Date`, `Pricing Call Date` are TEXT with empty strings (Mar 6)

**Sprint 28d — Domo Integration (Day 5–6)** *[Domo Admin + Cursor for manifest]* ✅ COMPLETE
- [x] Synced `TDR_APP.ML_MODELS.DEAL_PREDICTIONS` as Domo dataset
- [x] Created Domo Magic ETL joining `DEAL_PREDICTIONS` with opportunities dataset on `OPPORTUNITY_ID`
- [x] Updated `manifest.json` with joined dataset mapping — propensity columns available as regular fields
- [x] Updated TypeScript types (`Deal` interface) — `WIN_PROBABILITY`, `PROPENSITY_QUADRANT`, `FACTOR_*` fields
- [x] Updated `useDomo.ts` transform to parse propensity + factor columns from dataset
- [ ] Resume Snowflake Tasks: `ALTER TASK ... RESUME` for nightly scoring + weekly retrain — deferred to Sprint 30
- [x] Verified end-to-end: Snowflake → Domo sync → app reads propensity as columns on Deal object

**Sprint 28e — Frontend ML Integration (Day 7–10)** *[Cursor — application domain]* ✅ COMPLETE
- [x] Add Win % column to Command Center deals table (AG Grid) — color-coded badge, sortable, tooltip with quadrant + ML factors
- [x] Build Deal Positioning quadrant scatter plot — TDR Complexity (X) × Win Probability (Y), ACV-sized dots, dynamic axes, click-to-navigate, 2×2 quadrant labels (Prioritize/Fast Track/Investigate/Deprioritize)
- [x] Replace Score Distribution chart with Propensity Distribution chart (HIGH/MONITOR/AT_RISK bars, purple palette)
- [x] Remove Close Urgency chart, reorganize to 2-compact + 1-wide scatter layout
- [x] Add propensity card to Intelligence Panel (score, quadrant badge, progress bar, top 5 SHAP factor bars, freshness indicator, graceful degradation)
- [x] Extend Why TDR? pills with ML propensity factor pills (indigo)
- [ ] Portfolio-level propensity metrics in stat cards — deferred to Sprint 30
- [ ] Implement graceful degradation ("—" when model unavailable)
- [ ] Update Documentation Hub: Architecture Diagram, AI Models Reference, Data Model Reference

**Definition of Done:** Dataset swapped to expanded 65-column mapping with zero regressions (`Mgr Forecast Name` remapped, `Current FQ` dropped, 4 unavailable text columns removed). EDA validates sufficient training data. `SNOWFLAKE.ML.CLASSIFICATION` model trained and scoring pipeline deals nightly. Propensity score surfaces in Command Center table, interactive quadrant scatter, Intelligence Panel (with SHAP factors), and portfolio analytics. Two-axis quadrant (propensity × TDR score) is the primary prioritization view. Weekly retraining automated.

**Key Decision Points:**
1. **Go/no-go from EDA** — if <100 closed deals in the new dataset, defer model training. App still works; propensity shows "—".
2. **Class imbalance** — if Won:Lost ratio is heavily skewed, evaluate class_weight vs. oversampling in training config.
3. **Threshold calibration** — initial quadrant thresholds (propensity 50%, TDR score 50) refined after seeing actual model output distributions.

**Learnings (from Sprint 28 reshaping):**
- Stacking ensemble dropped in favor of native `SNOWFLAKE.ML.CLASSIFICATION`. Simpler, no Python, fits existing pattern. Upgrade path to Snowpark ensemble exists if needed.
- Dataset swap is the prerequisite — the original Sprint 28 assumed ML on top of existing data. The expanded dataset feeds both the app and the model.
- SHAP-like factor display is designed for naive users: plain English, directional arrows, magnitude bars, no jargon.
- Propensity is a platform, not a point solution: TDR prioritization, pipeline health, forecast validation, portfolio risk, and (6–12 months out) causal analysis of TDR intervention impact.

---

### Sprint 29 — AI-Enhanced TDR Responses ✅ DONE (Mar 4, 2026)

> **Goal:** Add per-field AI enhancement to TDR textarea inputs. When an SE types a terse response, they can click "Enhance" to get an AI-improved version that preserves their intent but adds specificity, structure, and completeness — drawing from deal context, account intel, and the Knowledge Base. The SE reviews a before/after diff and explicitly accepts, edits, or dismisses the enhancement.
> **Risk to app:** Low — additive UX feature on existing textarea fields. No changes to TDR step structure, field definitions, or save infrastructure. Enhancement is opt-in (button click), not automatic.
> **Effort:** ~2–3 days (2 sub-sprints)
> **Dependencies:** Sprint 17 (lean TDR inputs — field structure), Sprint 19 (fileset intelligence — KB context), Sprint 6.5 (Sumble deep intel — account context). No dependency on Sprint 28.
> **Shaping document:** `shaping/ai-enhanced-tdr-responses.md`

**Problem Statement:**
SEs filling out TDR fields write terse, incomplete responses under time pressure. A typical human input looks like "New CFO wants better reporting. Current process is manual." — but useful TDR inputs require specificity about timing, stakeholders, constraints, and architectural truth. Every downstream AI artifact (structured extract, TDR brief, action plan) degrades when inputs are thin. The gap isn't length — it's the SE knowing more than they wrote down.

**Solution: "Enhance" Button + Inline Diff**

An "Enhance" affordance appears on textarea fields (not selects, not short text). On click, the system assembles a context-aware prompt from 8 layers:

1. **Field identity** — label, placeholder, hint from `stepInputConfigs`
2. **Step identity** — title, core question from `tdrSteps`
3. **SE's raw input** — the seed to enhance
4. **Sibling fields** — other filled fields in the same step
5. **Cross-step context** — filled fields from other steps (thesis, decision, entry layer)
6. **Deal metadata** — account, ACV, stage, deal type, close date
7. **Account intel** — Sumble + Perplexity data (if enriched)
8. **Knowledge Base** — Domo filesets (battle cards, playbooks, competitive guides — always available)

The prompt respects TDR forcing functions: "Customer Decision" gets tightened to one sentence, "Architectural Truth" gets sharpened as a constraint, "Key Assumption" gets isolated as a single falsifiable belief.

The AI returns an enhanced version. The SE sees an inline diff (original vs. enhanced) with three actions:
- **Accept** → enhanced value replaces field content, saves via existing `onSaveInput`
- **Edit** → enhanced text enters the textarea for manual tweaks, normal auto-save takes over
- **Dismiss** → nothing changes

A context-source badge shows what was used: "Enhanced using: Perplexity research, Sumble tech stack, Knowledge Base, deal metadata" — building trust in the output.

**API:** Uses **Domo AI endpoint** (`/domo/ai/v1/text/chat`) via `domoAi.ts` pattern — same Anthropic model quality as Cortex but lower latency (no Code Engine → Snowflake round-trip) and no Cortex per-token cost. ~500 output tokens per field enhancement.

**Key Design Decisions:**
- Per-field only (no bulk "enhance all" at launch — risk of rubber-stamping)
- Re-enhance always available (Enhance button reappears after any edit, even on previously enhanced fields)
- Enhancement quality signal shown (which context sources were used)
- Filesets provide baseline context even when Sumble/Perplexity haven't been run ("Enrich account data for better enhancements" nudge when intel is missing)
- No new Snowflake tables — edit history in `TDR_STEP_INPUTS` captures original and enhanced values
- "AI-enhanced" badge on accepted fields so reviewers know which inputs had AI assist

**Sprint 29a — Enhancement Engine & Prompt Construction (Day 1–2)** ✅ DONE (Mar 4, 2026)
- [x] Created enhancement logic in `src/lib/domoAi.ts` — `enhanceTDRField()` with layered prompt construction
- [x] Implemented 8 context layers: field identity, step context, raw input, sibling fields, cross-step context, deal metadata, account intel, KB filesets
- [x] Added `ENHANCE_SYSTEM_PROMPT` and `buildEnhancementPrompt()` for context-aware enhancement
- [x] Uses Domo AI endpoint (`/domo/ai/v1/text/chat`) — Anthropic model, low latency
- [x] Returns `EnhancementResult` with enhanced text and context sources used

**Sprint 29b — UI Integration & Diff View (Day 2–3)** ✅ DONE (Mar 4, 2026)
- [x] Added "Enhance" button (sparkle icon) to textarea fields in `TDRInputs.tsx`, disabled when empty
- [x] Built inline violet card showing AI-enhanced result with context sources
- [x] Wired Accept → replaces field content, saves via `onSaveInput`
- [x] Wired Edit → enhanced text enters textarea for manual tweaks
- [x] Wired Dismiss → closes card, no changes
- [x] Added context-source indicator ("Enhanced using: deal metadata, field context, ...")
- [x] Wired `dealContext` prop through `TDRWorkspace.tsx` → `TDRInputs.tsx` for live deal metadata

---

### Sprint 30 — UX Polish & Iteration ✅ COMPLETE

> **Goal:** Dedicated time for holistic UX evaluation and refinement of Sprint 28 and Sprint 29 deliverables. New ML visualizations (propensity quadrant, SHAP factors), AI enhancement UI (diff view, context badges), and the expanded dataset columns all need real-user feedback cycles before they're production-ready. This sprint also addresses pre-existing data visibility issues discovered during UAT (e.g., Stage Age filtering threshold).
> **Risk to app:** None — purely additive refinements to existing, working features.
> **Effort:** ~1–2 days
> **Dependencies:** Sprint 28 (propensity quadrant + SHAP display), Sprint 29 (AI enhancement + diff view). Both must be functional before UX iteration begins.

**Problem Statement:**
First implementations of complex visualizations and interaction patterns rarely nail the UX on the first pass. The propensity quadrant scatter plot, SHAP factor cards, AI enhancement diff view, and context-source badges are all net-new interaction surfaces that benefit from evaluation in situ — with real deal data, real screen sizes, and real user workflows. Additionally, existing data visibility rules may need recalibration: the current `MAX_STAGE_AGE_DAYS = 365` threshold silently hides legitimate deals (e.g., renewals that sit in early stages for extended periods), creating a trust gap when users search for deals they know exist.

**Scope (candidate items — prioritized during sprint):**

1. ~~**Stage Age Threshold Review**~~ ✅ — Increased threshold to 730 days. Added 90-day close-date proximity override: deals with close dates within 90 days of today are always shown regardless of stage age. Fixes the "New York State Olympic Regional" visibility bug.

2. **Propensity Quadrant Polish** ✅ — Scatter plot has dynamic X/Y axes (both start and end adapt to data), tighter 5-unit snapping, ACV-sized dots, 2×2 quadrant labels anchored to far corners, background shading, click-to-navigate.

3. **SHAP Factor Display** — Partially addressed in Sprint 28e (factor bars in Intelligence Panel card, ML pills in table). Remaining: "Why this score?" expandable section.

4. ~~**AI Enhancement Diff View**~~ ✅ — Word-level inline diff in `TDRInputs.tsx`: additions highlighted in emerald, removals in red strikethrough. `computeWordDiff()` compares original SE input against AI-enhanced text. Falls back to plain display if no changes detected.

5. ~~**Context-Source Badges**~~ ✅ — Each AI enhancement shows color-coded pills for the context sources used: slate for SE input/field purpose, blue for sibling fields, violet for cross-step context, amber for deal metadata, cyan for knowledge base, emerald for enrichment. `CONTEXT_SOURCE_STYLES` map in `TDRInputs.tsx`.

6. **Expanded Dataset Column Visibility** — Ongoing evaluation. No new columns surfaced yet.

7. ~~**Duplicate Record Handling**~~ ✅ — Implemented richness-based deduplication in `domo.ts`. For duplicate Opportunity IDs, the record with the most non-empty fields wins. Logged to console.

8. **TDR Step Restructuring** — Moved to Sprint 31 (TDR Framework Redesign).

9. ~~**Settings → Filter bridge**~~ ✅ — `getActiveManagers()` in `appSettings.ts` is now the single source of truth. `TopBar`, `CommandCenter`, and `useDomo` all read from it. Manager changes in Settings immediately apply without code changes.

10. **Perplexity tech pills** — Perplexity data flows via the Research button (`perplexityData.technologySignals`), but tech signals are narrative strings, not pill-ready names. Use Domo AI/LLM endpoint to extract technology names from narrative signals, categorize them using `TECH_CATEGORY_STYLES`, and render as pills with a Perplexity provenance icon. See `TDRIntelligence.tsx` lines 941–943 (currently skipped) and 1617–1624 (narrative rendering).

11. **Slack PDF tech pill colors** — Deferred to Sprint 31.

12. **Intelligence Panel guided workflow** — Deferred to Sprint 31.

13. **Slack share caching** — Deferred to Sprint 31.

14. ~~**Gap indicator**~~ ✅ — Amber "gap" badge on textarea fields that are empty or terse (< 15 chars) when sibling fields have content. Step header shows aggregate count ("2 gaps"). Non-blocking diagnostic cue.

15. ~~**Why TDR? pill → icon conversion**~~ ✅ — Converted to compact icon-only badges (just the Lucide icon, no text label). ML factor pills collapse to direction arrows (↑/↓/→) color-coded by direction (green/red/indigo). Column width reduced from ~200px to ~90px. All detail preserved in rich tooltips: factor name, description, strategy, TDR prep steps.

16. **Chart row uniformity** ✅ — 2-compact + 1-wide scatter layout (`grid-cols-4`). All cards share consistent `stat-card` styling.

17. **Deal Positioning scatter polish** ✅ — Dynamic X-axis domain (adapts to data range, not fixed at 0), quadrant labels anchored with proportional positioning, background shading uses dynamic domain bounds.

18. ~~**Portfolio-level propensity metrics**~~ ✅ — 5th stat card "Win Propensity" added to Command Center: average ML win probability, count of high-propensity deals (60%+), and their pipeline ACV. Grid changed to `grid-cols-5`.

19. ~~**Resume Snowflake Tasks**~~ ✅ — `ALTER TASK TASK_NIGHTLY_SCORE RESUME` and `ALTER TASK TASK_WEEKLY_RETRAIN RESUME` executed. Nightly scoring (2 AM UTC) and weekly retraining (Sun 3 AM UTC) are live.

**No-Gos:**
- No auto-enhancement without user action
- No enhancement that introduces facts not in SE input or account intel
- No new Snowflake tables
- No custom diff renderer (use existing React diff library or simple before/after toggle)
- No forced workflow in the Intelligence Panel — checklist is advisory, not blocking

**Sprint 30b — Combined Priority + Table Polish + Docs** ✅ COMPLETE

> **Shaping documents:** `shaping/sprint-30-combined-score-and-docs.md`, `shaping/sprint-30b-table-polish.md`

20. ~~**Resume Snowflake Tasks**~~ ✅ — nightly scoring + weekly retrain are live.
21. ~~**Deal Priority column**~~ ✅ — Composite score (60% propensity + 40% TDR) with quadrant badge (PRIORITIZE / FAST TRACK / INVESTIGATE / DEPRIORITIZE). Sortable. Default sort. Matches scatter plot thresholds.
22. ~~**Priority tooltip upgrade**~~ ✅ — Rich tooltip matching Win%/TDR depth: quadrant pill (high-contrast solid colors), prescriptive guidance, formula breakdown with labeled rows, key signals section (top TDR factor + top ML factor). Pill colors upgraded from `bg-*/15` to solid `bg-purple-600`/`bg-emerald-600`/`bg-amber-500`/`bg-slate-600` with white/dark text for readability.
23. ~~**Stage column compression**~~ ✅ — Cell shows stage number only (was `[04] Confirm Solu`). Rich tooltip: full stage name, TDR value window badge, expanded guidance, stage age context. Column shrunk from `minWidth: 150` to `50/62` — ~100px reclaimed.
24. ~~**Why TDR? icon uniformity**~~ ✅ — All icons (factor + ML direction arrows) share `ICON_CONTAINER` class (22×22px, same border-radius/padding). Factor tooltips restructured with tier/points badge. ML factor tooltips upgraded: human-readable names via `ML_FACTOR_DISPLAY` lookup (13 factors), plain-English explanations, direction label, and value display. Consistent `space-y-2` tooltip structure across both types.
25. ~~**Column header readability**~~ ✅ — Headers: "Stg" (was "Stage"), "Pri" (was "Priority"). All fit at rendered widths with `headerTooltip` for full descriptions. ~100px freed by Stage compression distributes to remaining columns.
26. ~~**Perplexity tech pills**~~ ✅ — `extractTechFromSignals` via Domo AI LLM extracts tech names from narrative signals, renders as categorized pills with `SourceBadge source="perplexity"`. Merges into `allTechnologies` map. Falls back to raw narrative if extraction returns empty.
27. ~~**Slack PDF tech pill colors**~~ ✅ — `getTechColor` applies keyword-based category colors to flat tech lists and extracted entities in PDF. All tech pills now category-colored (orange for CRM, blue for BI, violet for DW, etc.).
28. ~~**Intelligence Panel readout checklist**~~ ✅ — 4-step advisory workflow (Enrich → Research → Action Plan → TDR Brief) with green ✓ / gray — status indicators. Non-blocking. Sits below signal strip in Zone A.
29. ~~**Slack share caching**~~ ✅ — Session-level `_cache` object in `tdrReadout.ts` caches `assembleReadout` payload and PDF base64. Repeated shares skip regeneration when same `sessionId`.
30. ~~**SHAP "Why this score?" expandable**~~ ✅ — `ChevronRight` toggle below Win Propensity. Shows all 5 factors with `getMLFactorDisplayName` (human-readable), `getMLFactorExplanation` (plain English), direction badges (Helps/Hurts/Neutral), and magnitude bars.
31. ~~**Expanded dataset columns**~~ ✅ — `accountRevenue`, `accountEmployees`, `strategicAccount`, `region`, `salesSegment`, `salesVertical` fetched in `/data/v2/` fields, mapped in `transformOpportunityToDeal`, surfaced as firmographics row in Intelligence Panel deal header.
32. ~~**Documentation overhaul**~~ ✅ — All 7 doc components updated: ArchitectureDiagram (DEAL_PREDICTIONS + ML.CLASSIFICATION nodes, Domo AI node), DataModelReference (predictions table, new Deal fields), ScoringReference (Win Propensity + Deal Priority sections), CapabilitiesGuide (14 new feature entries), IntegrationsReference (Snowflake ML, Domo AI enhancement/extraction, Magic ETL), AIModelsReference (ML Classification, Domo AI, SHAP factors), GlossaryReference (11 new terms). Version bumped to v1.70.0.
33. ~~**Deal Priority in TDR Workspace**~~ ✅ — Hero metric in Zone A: `text-3xl` bold score + quadrant pill (solid color) + prescriptive guidance + formula breakdown. Existing TDR Score and Win Propensity demoted to "Score Components" section header with `text-lg`. See `shaping/sprint-30b-priority-in-workspace.md`.

**Definition of Done:** SE can sort the deals table by Deal Priority to surface PRIORITIZE deals first. All score tooltips have comparable depth. Stage column is number-only. Why TDR? icons are visually uniform. Deal Priority is the hero metric in the TDR Workspace Intelligence Panel. Perplexity-sourced tech renders as categorized pills with provenance icon. Slack PDF tech pills are color-coded. Intelligence Panel shows a readout checklist. Documentation Hub accurately reflects the Sprint 30 app. All 7 doc sections updated.

---

### Sprint 31 — TDR Framework Redesign ✅ COMPLETE

> **Goal:** Consolidate the TDR from 9 steps / 29 fields to 5 steps / 23 fields. Elevate AI & ML from an optional 2-field afterthought to a rigorous core step with structured AI value continuum framework, plain English labels, and level-specific dynamic hints. Add resizable textareas, semi-automated step completion, pill/tag inputs (Domo Layers, AI Signals, AI Data Readiness), gap indicators for "Unknown" selections, and exposed TDR versioning. Update the PDF readout to match.
> **Risk to app:** Medium — structural change to the core TDR framework. Mitigated by: (1) Snowflake schema is field-ID-agnostic (new IDs are additive, old data preserved), (2) scoring weights can be remapped, (3) old sessions remain readable.
> **Effort:** ~3–5 days
> **Dependencies:** Sprint 29 (AI Enhancement — build on current steps first, then restructure), Sprint 30 (UX Polish — quick fixes ship independently).
> **Shaping document:** `shaping/tdr-quality-of-life.md` — **step design approved and locked.**
> **Reference materials:** `samples/ai-value-continuum.png`, `samples/what-to-look-for.png`, `samples/Practitioners Series Problem Framing Worksheet (1).pdf` — all reviewed and incorporated into the AI & ML step design.

**Problem Statement:**
The current 9-step TDR is exceedingly detailed for real-world SE workflows. Several fields overlap (Entry Layer / In-Scope Layers, System of Record / Architectural Truth / What Changes in Target State). The AI & ML assessment is a 2-field optional step that doesn't surface whether the opportunity is for rules-based automation, traditional ML, generative AI, or agentic solutions. Step completion is a manual checkbox with no intelligence about actual field completeness. In-scope layers save as free text instead of structured tags usable for analytics. Textareas can't be resized. TDR versioning (adding follow-up responses at a later date) isn't clearly exposed despite existing Snowflake support.

**Approved Step Structure (5 steps, 23 fields — down from 9 steps, 29 fields):**

| # | Step | Required? | Fields | Key Changes |
|---|------|-----------|--------|-------------|
| 1 | Deal Context | Yes | 5 | Merges Context + Business Decision. Drops `success-criteria`. Renames `key-stakeholders` → `key-technical-stakeholders`. |
| 2 | Technical Architecture | Yes | 6 (4 req, 2 opt) | Merges Architecture + Domo Role + Target Architecture. 12 fields → 6. `current-state` consolidates SoR + arch-truth + pain-points. `target-state` consolidates 4 target fields. `domo-layers` multi-select pills replace entry-layer + in-scope. `why-composition` → `why-domo` ("Why Domo Wins Here"). |
| 3 | Risk & Verdict | Yes | 5 (3 req, 2 opt) | Absorbs Partner. Partner posture is a risk/opportunity signal. Drops `compute-alignment`. |
| 4 | AI & ML Opportunity Assessment | Yes | 5 | **New core step.** Plain English labels (Rules & Automation, Predictive AI, Generative AI, Autonomous AI). Dynamic hints change based on `ai-level`. `ai-data` is multi-select. "Unknown / needs discovery" triggers gap indicator. |
| 5 | Adoption & Success | No | 2 | Streamlines Usage. Merges `adoption-plan` + `success-metrics` → `adoption-success`. |

**Sprint 31a — Step Consolidation Design & User Approval** ✅ APPROVED
- [x] Propose consolidated step structure — 5 steps, 23 fields
- [x] Design AI & ML core step using value continuum framework (3 reference docs reviewed)
- [x] Map field consolidations: Entry Layer + In-Scope → Domo Layers pills; SoR + Arch Truth + Pain Points → Current State; 4 target fields → Target State; Stakeholders renamed; Why Composition → Why Domo Wins Here
- [x] Evaluate: Business Decision reduced (merged into Deal Context, success-criteria dropped); Out of Scope kept optional; Additional Context folded into core steps
- [x] User approval obtained — step design locked

**Sprint 31b — Step Implementation** ✅ COMPLETE
- [x] Update `tdrSteps` in `mockData.ts` with 5 new step IDs, titles, core questions
- [x] Update `stepInputConfigs` in `TDRInputs.tsx` with 23 field definitions, including dynamic hints for AI & ML step
- [x] Build pill/tag input component for Domo Layers, AI Signals, and AI Data Readiness (inline toggleable pills with exclusive-option logic)
- [x] Implement `ai-level` select with plain English labels + subtitle descriptions in dropdown
- [x] Wire dynamic hint switching on `ai-problem` and `ai-value` textareas based on `ai-level` selection
- [x] Add `resize: vertical` CSS to all textarea fields
- [x] Implement semi-automated step completion: auto-complete when required fields have substantive content (>15 chars for textareas, any non-empty selection for selects, any selected pill for multi-select); manual override preserved
- [x] Gap indicators: existing system works with new field structure (>15 char threshold + sibling check)
- [x] Update `tdrCriticalFactors.ts` scoring defaults for new 4-required/1-optional step structure
- [x] Legacy step configs preserved in `stepInputConfigs` for backward compatibility with old sessions
- [x] `LEGACY_STEP_IDS` exported from `mockData.ts` for reference

**Sprint 31c — Versioning & PDF** ✅ COMPLETE
- [x] Add "Start New Iteration" button in TDR Workspace header (visible when prior iterations exist)
- [x] `useTDRSession` exposes `previousSessions` and `startNewIteration` — creates new session with incremented iteration, archives current
- [x] Prior iteration count displayed in header
- [x] Update `TDRReadoutDocument.tsx` PDF layout: new step labels/fields, JSON array pill rendering, dedicated AI & ML section with level badge + signal/data pills
- [x] Update `tdrReadout.ts` mock data for new 5-step structure
- [x] Backward compatibility: PDF renders both old (9-step) and new (5-step) sessions

---

### Sprint 32 — MLOps Monitoring & Model Calibration 🔶 IN PROGRESS

> **Goal:** Fix model calibration (bimodal score distribution), build MLOps monitoring infrastructure, and create a dedicated `/mlops` page for model health visibility. The current model produces overconfident predictions (35% of deals at <5%, 15% at >95%) driven by covariate shift on `DAYS_IN_PIPELINE`. This sprint fixes the model first, then builds the tooling to monitor it.
> **Risk to app:** Low for calibration (Snowflake-side changes only). Medium for frontend (new page + nav changes). Mitigated by: model retrain is non-destructive (old predictions preserved in snapshots), new page is additive.
> **Effort:** ~5–7 days across 4 sub-sprints
> **Dependencies:** Sprint 28c (ML model exists), Sprint 28d (Domo integration), Sprint 28e (frontend ML integration)
> **Shaping document:** `shaping/mlops-monitoring-tab.md`

**Problem Statement:**
The propensity model runs inside Snowflake (nightly scoring, weekly retraining) with zero visibility into its health from the app. When the model broke (feature schema mismatch → all predictions "Lost"), it took manual SQL debugging via Cortex CLI to diagnose. An SE Manager seeing "Win Propensity: 0%" had no way to distinguish a model failure from reality. Additionally, the model produces a bimodal, overconfident distribution — 2,234 deals scored below 3%, 940 deals above 97% — driven by a 3.5× gap in `DAYS_IN_PIPELINE` between training data (avg 153 days) and scoring data (avg 532 days).

**Sprint 32a — Model Calibration & Retrain (1–2 days)** *[Cortex CLI for Snowflake]* ✅ COMPLETE (Mar 12, 2026)

This sprint ran FIRST — fixed model quality before building the monitoring UI.

- [x] Create `ML_TRAINING_DATA_CLEAN` view — 3-year recency filter + `DAYS_IN_PIPELINE` capped at 730; 46,154 rows (32.0% win rate), down from 173K uncapped (Mar 12)
- [x] Cap `DAYS_IN_PIPELINE` at 730 in `ML_PIPELINE_FEATURES` view — max confirmed at 730, avg 422 (Mar 12)
- [x] Add score capping to `SCORE_PIPELINE_DEALS()`: `GREATEST(0.03, LEAST(0.97, score))` — min 0.03, max 0.97 confirmed (Mar 12)
- [x] Create `PREDICTION_SNAPSHOTS` table — 15 columns, grants to `TDR_APP_ROLE` (Mar 12)
- [x] Update `SCORE_PIPELINE_DEALS()` to append snapshots before overwriting predictions — 6,408 snapshots captured on first run (Mar 12)
- [x] Retrain model on recency-filtered, normalized data — `v20260312_234848`, F1 0.956 (Won), F1 0.979 (Lost), Precision 0.951, Recall 0.960 (Mar 12)
- [x] Re-score all pipeline deals — 6,403 deals scored with `v3_calibrated` model version (Mar 12)
- [x] Verify score distribution — score capping works (bounds enforced), bimodal shape persists (41.4% in 0–10% bucket; GBT architecture inherently produces sharp probabilities; true calibration via Platt/isotonic scaling not available in `SNOWFLAKE.ML.CLASSIFICATION` — defer to Sprint 32e) (Mar 12)
- [x] Update `RETRAIN_PROPENSITY_MODEL()` — trains against `ML_TRAINING_DATA_CLEAN`, persists `SHOW_EVALUATION_METRICS()` and `SHOW_FEATURE_IMPORTANCE()` to `ML_MODEL_METADATA` via temp tables (Mar 12)
- [x] Backfill current model metrics into `ML_MODEL_METADATA` — v2 model (`v20260308_083005`) now has 8 eval metrics + 32 feature importance scores (Mar 12)

**SQL file:** `sql/sprint_32a_calibration.sql`

**Calibration Results (v3 vs v2):**
| Metric | v2 (leakage-clean) | v3 (calibrated) |
|--------|-------------------|-----------------|
| F1 (Won class) | 0.923 | 0.956 |
| Training rows | 173,770 | 46,154 (3yr filter) |
| Score min/max | 0.00 / 1.00 | 0.03 / 0.97 |
| DAYS_IN_PIPELINE cap | None (up to 2,758) | 730 |
| Eval metrics persisted | No | Yes |
| Feature importance persisted | No | Yes |
| Prediction snapshots | No | Yes (6,408 captured) |

**Known Limitation:** Distribution remains bimodal (41.4% in 0–10%, 26.1% in 90–100%). `SNOWFLAKE.ML.CLASSIFICATION` uses gradient boosted trees which produce sharp probabilities. True probability calibration (Platt scaling, isotonic regression) requires post-processing not available in the native ML API. Score capping eliminates false certainty but doesn't reshape the distribution. Further calibration deferred to Sprint 32e.

**Sprint 32b — Seeded TDR Responses (3–5 days)** *[Cursor]* 🔲 NOT STARTED

> **Shaping document:** `shaping/sprint-32b-seeded-tdr-responses.md`

Pre-populate TDR input fields with Cortex AI-modeled inferences derived from Gong call transcripts. A Cortex pipeline analyzes aggregated Gong transcripts per opportunity and infers likely values for each TDR field. The `opportunitiesmagic` dataset now includes 24 new columns (23 TDR field values + `call_count`) refreshed daily. This sprint surfaces them as "proposed" responses that SEs review, edit, and accept before saving.

- [ ] Add 24 field aliases to all 3 manifests (`manifest.json`, `public/manifest.json`, `dist/manifest.json`)
- [ ] Extend `Deal` interface with `seededInputs?: Record<string, string>` and `callCount?: number`
- [ ] Map 24 dataset columns to `seededInputs` in `useDomo.ts:transformOpportunityToDeal`
- [ ] Thread `seededInputs` and `callCount` from TDRWorkspace → TDRInputs
- [ ] Update `getFieldValue()` to fall back to seeded values (after local draft and saved inputs)
- [ ] Add "AI Proposed" visual indicator on fields displaying seeded data (dashed violet border)
- [ ] Add Accept / Dismiss controls for seeded values (seeded data does not auto-save)
- [ ] Add "Cortex · N calls" badge on step headers and deal table rows
- [ ] Handle select fields (exact option match) and multi-select fields (JSON array passthrough)
- [ ] Load prior iteration inputs when starting new TDR version (`priorInputValues`)
- [ ] Add tri-source resolution: local draft → saved → prior iteration → seeded → empty
- [ ] Add "View alternatives" panel for fields with multiple source values
- [ ] Add step-level seed coverage indicator ("4/5 seeded")
- [ ] Verify Enhance button works with seeded data (reads from `getFieldValue` — should work without changes)

**Definition of Done:** Deals with Cortex-modeled Gong data show pre-populated TDR fields. SEs can accept, edit, dismiss, or enhance seeded values. New iterations reference both fresh seeded data and prior manual inputs. Deals without call data behave identically to today.

**Sprint 32c — Code Engine MLOps Functions (1 day)** *[Cursor for Code Engine JS]* 🔲 NOT STARTED

- [ ] Create `getMLModelMetadata` — returns all model versions with evaluation metrics from `ML_MODEL_METADATA`
- [ ] Create `getMLEvaluationMetrics` — calls `SHOW_EVALUATION_METRICS()` for per-class precision/recall/F1/support
- [ ] Create `getMLFeatureImportance` — calls `SHOW_FEATURE_IMPORTANCE()` for ranked feature list with scores
- [ ] Create `getMLPipelineHistory` — queries `INFORMATION_SCHEMA.TASK_HISTORY()` for last 30 days of task executions
- [ ] Create `getMLPredictionAccuracy` — joins `DEAL_PREDICTIONS` against `ML_FEATURE_STORE` for predicted vs. actual on closed deals
- [ ] Create `getMLScoreDistribution` — returns histogram buckets with counts from `DEAL_PREDICTIONS`
- [ ] Create `getMLFactorAggregation` — returns factor frequency, direction, and magnitude aggregates from `DEAL_PREDICTIONS`
- [ ] Add all 7 functions to `manifest.json` packageMapping

**Definition of Done:** All 7 Code Engine functions deployed, manifest mappings added, each function returns valid data from Snowflake.

**Sprint 32d — Frontend MLOps Page (2–3 days)** *[Cursor]* 🔲 NOT STARTED

- [ ] Create `src/pages/MLOps.tsx` page component at `/mlops` route
- [ ] Pipeline Status: two status cards (Scoring + Retraining) with last-run time, status badge, next scheduled
- [ ] Model Registry: table of model versions with production badge, training stats, class split
- [ ] Fit Metrics: stat cards for precision, recall, F1 per class + optional confusion matrix
- [ ] Feature Importance: horizontal bar chart (Recharts), color-coded by feature category (deal economics, account firmographics, engagement, etc.)
- [ ] Score Distribution: histogram of current propensity scores by bucket
- [ ] Prediction Accuracy: accuracy %, false positive/negative rates (when ground truth data available)
- [ ] Factor Patterns: aggregated factor frequency + direction visualization
- [ ] Alert Badges: status indicators at top of page (healthy/warning/critical)
- [ ] Navigation: add "MLOps" to sidebar nav (Activity or BarChart3 icon from Lucide)

**Definition of Done:** `/mlops` page renders with all 8 sections populated from Code Engine data. Navigation includes MLOps link. Alert badges reflect model health state.

**Sprint 32e — Polish + Documentation (1 day)** *[Cursor]* 🔲 NOT STARTED

- [ ] Alert threshold logic: model stale >14 days → warning; scoring task failed → critical; >90% in one score bucket → critical; accuracy below threshold → warning
- [ ] Distribution health check: automated after each scoring run (>30% in single 10% bucket → warning, >50% in top/bottom 10% → critical)
- [ ] Nav badge: show alert count if any warnings/criticals
- [ ] Update Documentation Hub (`/docs`): add MLOps section to Capabilities Guide, update Architecture Diagram, update Data Model Reference with new tables
- [ ] Update `IMPLEMENTATION_STRATEGY.md`: finalize Pillar 18, close Sprint 32

**Definition of Done:** Alert system functional. Documentation Hub reflects MLOps capabilities. Implementation strategy document finalized for Pillar 18.

---

### Sprint Execution Order & Dependencies

```
Sprint 16 — Fix Similar Deals (1 hr) ✅
    │ (no dependencies — quick win, do first)
    ▼
Sprint 17 — Lean TDR Refactor (2–3 days) ✅ ──┐
    │                                           │
    ▼                                           │
Sprint 17.5 — Structured TDR Analytics (1 day) ✅ │
    │  (Cortex extracts → analytics table)        │
    │                                             │
    ▼                                             │
Sprint 17.6 — TDR Analytics Page + NLQ ✅        │
    │  (visualization of V_TDR_ANALYTICS)       │
    │                                           │
    │  Sprint 19 — Fileset Intelligence ✅      │
    │  (2–3 days, parallel with S17.5/6) ──────┤
    │         │                                 │
    ▼         ▼                                 │
Sprint 18 — TDR Score v2 (2 days) ✅     ──────┤
    │                                           │
    │  Sprint 19.5 — Cortex KB Summary (1 day)  │
    │  (depends on S19) ───────────────────────┤
    │                                           │
    ▼                                           │
Sprint 22 — Frontier Models + Branding ✅       │
    │  (claude-4-sonnet, Cortex branding, UX)  │
    │                                           │
    ▼                                           │
Sprint 23 — KB Insights + KB Tooltip ✅          │
    │  (cleaner insight names, rich KB tooltip) │
    │                                           │
    ▼                                           │
Sprint 20 — Hero Metrics & Nav ✅               │
    │  (TDR-aligned stat cards + new charts)    │
    │                                           │
    ▼                                           ▼
Sprint 21 — Action Plan Synthesis ✅
    │  (depends on S17.5 + S18 + S19 + S19.5 + S22)
    │  THE CAPSTONE — synthesizes everything
    │  (now uses frontier models for best results)
    │
    ▼
Sprint 14 — Slack Distribution ✅ COMPLETE
    │
    │  Push PDF + AI summary to Slack channels
    │
    ▼
Sprint 26 — Intelligence Panel UX Review ✅ COMPLETE
    │  Consolidated Sumble buttons, reduced branding,
    │  hid analytics extraction, reordered sections
    │
    ▼
Sprint 27 — Intelligence Panel Decision Architecture ✅ COMPLETE
    │  4-zone layout, lifecycle-aware TDR score,
    │  confidence score, auto-load, Domo refresh suppression
    │
    ▼
Sprint 24 — Perf Optimization + KB Caching ✅ COMPLETE
    │  WS1: cache-first loading for KB/AP/Extraction
    │  WS2: 9 dead files removed, 2 unused datasets dropped
    │  WS3: audited — no changes needed (no regressions)
    │
    ▼
Sprint 25 — Documentation Hub & Architecture Diagram ✅ COMPLETE
    (depends on S24 — diagram reflects final clean architecture)
    7-section Documentation Hub: Architecture Diagram (5 layers),
    Scoring Reference, Capabilities Guide, Integrations,
    Data Model, AI Models, Glossary & FAQ
    /docs route with sticky ToC + accordions
    │
    ▼
Sprint OSS-1 — Open-Source Readiness & README Overhaul ✅ COMPLETE
    │  Security: removed secrets, data, build artifacts from tracking + history
    │  Hardened .gitignore, scrubbed IMPLEMENTATION_STRATEGY.md
    │  README: rewritten for expert/exec audience (4-layer arch, AI stack, ML strategy)
    │
    ▼
Sprint 28 — Dataset Swap & Deal Close Propensity ML ✅
    │  (depends on S18)
    │  28a: Dataset Swap ✅ — 28b: EDA ✅ — 28c: ML Training ✅
    │  28d: Domo Integration ✅ — 28e: Frontend ML ✅
    │  PERF-1: Performance Optimization ✅ — 28b+: Pre-Training Validation ✅
    │
    ▼
Sprint 29 — AI-Enhanced TDR Responses ✅
    │  29a: Enhancement Engine ✅ — 29b: UI Integration ✅
    │  Domo AI endpoint (Anthropic), 8 context layers
    │
    ▼
Sprint 30 — UX Polish & Iteration ✅
    │  Stage age fix, dedup, settings bridge, gap indicator, icon pills
    │  Settings→Filter bridge, Perplexity tech pills
    │  Slack PDF colors, Intelligence Panel checklist
    │  Gap indicators, duplicate record handling
    │  ~1–2 days
    │
    ▼
Sprint 31 — TDR Framework Redesign ✅
    │  31a: Step consolidation design & approval ✅
    │  31b: Step implementation (pills, resize, auto-complete) ✅
    │  31c: Versioning UX & PDF readout update ✅
    │  9 → 5 steps, AI & ML core step, value continuum
    │  ~3–5 days
    │
    ▼
Sprint 32 — MLOps + Seeded TDR Responses 🔶
    │  32a: Model calibration & retrain (score capping, recency filter) ✅
    │  32b: Seeded TDR Responses (Gong-extracted pre-population) 🔲
    │  32c: Code Engine MLOps functions (7 new CE functions) 🔲
    │  32d: Frontend MLOps page (/mlops) 🔲
    │  32e: Polish + Documentation 🔲
    │  32d: Polish + documentation 🔲
    │  ~5–7 days
```

**Total estimated effort (original):** ~22–29 days · **Completed:** ~37 days (Sprints 14–31, OSS-1, PERF-1, 32a) · **Remaining:** ~8–11 days (Sprint 32b–e)

| Sprint | Can Parallel? | Depends On | Effort | Status |
|--------|--------------|------------|--------|--------|
| S16: Fix Similar Deals | — | None | ~1 hr | ✅ |
| S17: Lean TDR Refactor | ✅ with S19 | None | 2-3 days | ✅ |
| S17.5: Structured TDR Analytics | ✅ with S19 | S17 | 1 day | ✅ |
| S17.6: TDR Portfolio Analytics Page | Sequential | S17.5 | 1.5 days | ✅ |
| S19: Fileset Intelligence | ✅ with S17.5/6 | None | 2-3 days | ✅ |
| S18: TDR Score v2 | No | S17.5 + S19 | 2 days | ✅ |
| S19.5: Cortex KB Summarization | ✅ with S22 | S19 | 1 day | ✅ |
| **S22: Frontier Model Upgrade** | ✅ with S20 | None | 0.5 day | ✅ |
| **S23: KB Insights + KB Tooltip** | ✅ with S22 | S19.5 + S22 | 0.5 day | ✅ |
| **S20: Hero Metrics & Nav** | ✅ with S22 | S18 | 1-2 days | ✅ |
| **S21: Action Plan Synthesis** | — | S17.5 + S18 + S19 + S19.5 + S22 | 2-3 days | ✅ |
| **S14: Slack Distribution** | — | S13 | 2-3 days | ✅ (polished Feb 13) |
| **S24: Perf Optimization** | — | S21 | 2 days | ✅ Feb 12–14 |
| **S26: Intelligence Panel UX** | — | S14 + S21 + S24-WS1 | 2-3 days | ✅ Feb 13 |
| **S27: Decision Architecture** | — | S26 | 2 days | ✅ Feb 14 |
| **S25: Documentation Hub + Architecture** | — | S24 + S27 | 1 day | ✅ Feb 14 |
| **OSS-1: Open-Source Readiness** | — | S25 | 0.5 day | ✅ Mar 3 |
| **S28: Dataset Swap & Propensity ML** | — | S18 | 7–10 days (5 sub-sprints) | ✅ Complete |
| **S29: AI-Enhanced TDR Responses** | ✅ with S28 | S17 + S19 + S6.5 | 2–3 days (2 sub-sprints) | ✅ Complete |
| **PERF-1: Performance Optimization** | — | S28a | 1 day | ✅ Complete |
| **S30: UX Polish & Iteration** | — | S28 + S29 | 1–2 days | ✅ Complete |
| **S31: TDR Framework Redesign** | — | S29 + S30 | 3–5 days (3 sub-sprints) | ✅ Complete |
| **S32: MLOps + Seeded TDR + Model Calibration** | — | S28c + S28d + S28e | 8–12 days (5 sub-sprints) | 🔶 In Progress |

---

| Resource | URL |
|----------|-----|
| Snowflake Cortex AI Functions | https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql |
| Cortex Code CLI | https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli |
| Cortex Cross-Region Inference | https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-cross-region-inference |
| Perplexity API Docs | https://docs.perplexity.ai/docs/getting-started/overview |
| Sumble API Docs | https://docs.sumble.com/api |
| Sumble Organizations API | https://docs.sumble.com/api/organizations |
| Sumble Jobs API | https://docs.sumble.com/api/jobs |
| Sumble People API | https://docs.sumble.com/api/people |
| Snowflake SQL API (Statements) | https://docs.snowflake.com/en/developer-guide/sql-api/reference |
| Domo Code Engine | https://developer.domo.com/portal/8k7stcm6lubfh-code-engine-overview |
| Domo AppDB API | https://developer.domo.com/portal/1l1fm2g0sfm69-app-db-api |
| Sample: aptSnowflakeCodeEngine.js | `samples/aptSnowflakeCodeEngine.js` (local, .gitignored) |
| Sample: cortexAnalystCodeEngine.js | `samples/cortexAnalystCodeEngine.js` (local, .gitignored) |
| Sample: Filesets Chat Interface | `samples/filesets chat interface_/` (local, .gitignored) |
| Domo Filesets API (query endpoint) | `/domo/files/v1/filesets/{id}/query` (App Studio proxy) |
| Domo Filesets (default KB) | https://domo.domo.com/datacenter/filesets/6d0776f7-cafe-47c0-9153-d11a365a0c02/files |

---

---

## 21. TDR Readout: Executive PDF & Distribution

This section describes the architecture for the **TDR Readout** — the canonical artifact of record for every Technical Deal Review. It is not a summary or a snapshot. It is the complete, structured, executive-ready document that captures the entire TDR lifecycle.

### 21.1 Design Philosophy

A TDR Readout must satisfy three audiences simultaneously:

| Audience | Needs | Readout Section |
|----------|-------|-----------------|
| **VP / Executive** | 30-second skim: what's the deal, what's the risk, what's the ask | Cover + Executive Summary |
| **SE Manager / Reviewer** | Full context: inputs, intelligence, competitive landscape, decision rationale | §1–§7 (main body) |
| **SE Manager / Deal Desk** | Scoring rationale: why this deal was prioritized, which factors fired, what intel confirmed | §6 TDR Score & Enriched Factors |
| **Future SE / Archivist** | Everything: raw data, chat excerpts, citations, API usage | §9 Appendix |

The PDF is designed to be read top-to-bottom as a narrative arc: **Context → Intelligence → Analysis → Decision**. Every section cites its data source (Sumble, Perplexity, user input, Cortex AI) so the reader knows what's human-authored vs. AI-generated.

### 21.2 Content Assembly Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 assembleTDRReadout (Code Engine)             │
│                                                             │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │ TDR_SESSIONS │  │ TDR_STEP_INPUTS│  │ CORTEX_ANALYSIS│  │
│  │  (metadata)  │  │ (all user      │  │  _RESULTS      │  │
│  │              │  │  inputs)       │  │ (brief, class, │  │
│  │              │  │                │  │  entities)     │  │
│  └──────┬───────┘  └───────┬────────┘  └───────┬────────┘  │
│         │                  │                    │           │
│  ┌──────┴───────┐  ┌──────┴────────┐  ┌───────┴────────┐  │
│  │ACCOUNT_INTEL │  │ACCOUNT_INTEL  │  │TDR_CHAT        │  │
│  │_SUMBLE       │  │_PERPLEXITY    │  │_MESSAGES       │  │
│  │(firmographics│  │(research,     │  │(top 5 AI-      │  │
│  │ tech stack)  │  │ citations)    │  │ selected)      │  │
│  └──────┬───────┘  └──────┬────────┘  └───────┬────────┘  │
│         │                 │                    │           │
│         └─────────────────┴────────────────────┘           │
│                           │                                 │
│                    ReadoutPayload                            │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│             TDRReadoutDocument (React PDF)                   │
│                                                             │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ Cover Page │  │ Exec Summary │  │ §1-§7 Body Sections │ │
│  └────────────┘  └──────────────┘  └─────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ §6 TDR Score & Enriched Factors                     │   │
│  │ §9 Appendix (chat, citations, API usage, metadata)  │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                 │
│                      PDF Blob                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
        ┌──────────────┐      ┌─────────────────┐
        │  Download    │      │  Slack Distro   │
        │  (browser)   │      │  (Code Engine)  │
        └──────────────┘      └─────────────────┘
```

### 21.3 PDF Document Structure

| Section | Source Tables | Content |
|---------|-------------|---------|
| **Cover Page** | `TDR_SESSIONS`, SFDC | Deal name, account, ACV, stage, date, reviewer(s), TDR iteration, status badge, company logo |
| **Executive Summary** | `CORTEX_ANALYSIS_RESULTS` | AI-generated 2–3 paragraph narrative. If no cached brief, generated on-demand. Tone: executive, decisive. |
| **§1 Deal Context** | `TDR_STEP_INPUTS` (context, decision) | Strategic value, business impact, timeline, decision framework, success criteria |
| **§2 Account Intelligence** | `ACCOUNT_INTEL_SUMBLE`, `ACCOUNT_INTEL_PERPLEXITY` | Firmographics table (industry, size, HQ, revenue), tech stack table with categories, web research narrative, strategic initiatives, cited sources |
| **§3 Architecture** | `TDR_STEP_INPUTS` (current-arch, proposed-solution) | Current state, proposed solution, integration points, migration considerations |
| **§4 Competitive Landscape** | `ACCOUNT_INTEL_PERPLEXITY`, `TDR_STEP_INPUTS` | Competitive tools detected, displacement strategy, positioning narrative |
| **§5 Risk Assessment** | `CORTEX_ANALYSIS_RESULTS` (classify, extract) | Risk matrix table (risk × severity × mitigation), classified findings, extracted key entities |
| **§6 TDR Score & Enriched Factors** | TDR scoring engine output, `ACCOUNT_INTEL_SUMBLE`, `ACCOUNT_INTEL_PERPLEXITY`, `CORTEX_ANALYSIS_RESULTS` | Overall TDR score (gauge chart), tier-by-tier factor breakdown table (Tier 1/2/3, factor name, points, status, source), intel-validated factors with confirmation badges ("✓ Confirmed via Sumble"), `techStackOverlap` score with detected competitive tools, `strategicMomentum` score with cited initiatives, "Why TDR?" pill summary, Domo AI recommendations grounded in account intelligence |
| **§7 Technical Evaluation** | `TDR_STEP_INPUTS` (poc-plan, resources) | PoC plan, success criteria, resource requirements, timeline, dependencies |
| **§8 Decision & Recommendations** | `TDR_STEP_INPUTS` (readiness, action) | Go/no-go recommendation, decision rationale, next steps with owners and dates |
| **§9 Appendix** | `TDR_CHAT_MESSAGES`, `API_USAGE_LOG` | Top 5 chat exchanges, raw citation URLs, API usage summary, generation metadata (model, timestamp, data freshness) |

### 21.4 Branded Theming System

```
Theme Configuration (stored in app settings or passed at generation time):

{
  "logo": "base64 or URL",          // Company logo for cover page header
  "primaryColor": "#6929C4",         // Headings, accent bars, cover background
  "secondaryColor": "#1B1630",       // Section backgrounds, dark accents
  "accentColor": "#8B5CF6",          // Highlights, links, callout borders
  "bodyFont": "Helvetica",           // PDF standard font (no custom font loading needed)
  "confidentiality": "CONFIDENTIAL — Internal Use Only",
  "footerText": "Generated by TDR Deal Inspection"
}
```

| Element | Styling |
|---------|---------|
| Cover page | Full-bleed primary color background, white text, logo top-left |
| Section headings | Primary color left-border accent bar (4px), bold 14pt |
| Sub-headings | Secondary color, bold 11pt |
| Body text | Black/dark gray, 10pt, 1.4 line-height |
| Tables | Alternating row shading (light gray / white), primary color header row |
| AI-generated text | Subtle left border accent + "AI-Generated" attribution footnote |
| Citations | Numbered superscript in text, full URLs in appendix |
| Page header | "{Account Name} — TDR Readout" left, confidentiality notice right |
| Page footer | Page number center, generation date right |

### 21.5 Chart Embedding Strategy

Charts cannot be rendered natively in `@react-pdf/renderer`. Strategy:

1. **Pre-render to canvas** — Use existing chart components (or lightweight `<canvas>` renderers) to draw risk gauges, score breakdowns, and sentiment sparklines
2. **Canvas → PNG** — `canvas.toDataURL('image/png')` extracts the image
3. **Embed in PDF** — `@react-pdf/renderer`'s `<Image src={pngDataUrl} />` renders it as a static image
4. Charts are rendered at 2× resolution for crisp print quality (retina-equivalent)

Specific charts planned:
- **TDR Score gauge** — circular gauge with score out of 100 + risk color (green/yellow/red)
- **Factor breakdown bar chart** — horizontal stacked bars showing Tier 1/2/3 point contributions, with enrichment-sourced factors highlighted in a distinct accent color
- **Risk matrix** — 2×2 grid (impact × likelihood) with positioned findings
- **Tech stack distribution** — horizontal bar chart of technology categories from Sumble
- **Enrichment impact visual** — before/after TDR score comparison showing point delta from `techStackOverlap` + `strategicMomentum` factors (demonstrates intelligence ROI)
- **Sentiment trend** — sparkline across TDR iterations (when Sprint 9 data available)

### 21.6 Slack Distribution

```
┌──────────────────────────────────────────────────┐
│             Slack Block Kit Message               │
│                                                   │
│  📋 TDR Readout: {Account Name}                  │
│  ──────────────────────────────────────           │
│                                                   │
│  {AI-generated 3-5 sentence executive summary}    │
│                                                   │
│  ┌─────────────────┬─────────────────────────┐   │
│  │ ACV             │ $385,000                │   │
│  │ Stage           │ 3: Demonstrate Value    │   │
│  │ Decision        │ Approved — proceed      │   │
│  │ Reviewer        │ Dan Wentworth           │   │
│  │ TDR Iteration   │ #2                      │   │
│  └─────────────────┴─────────────────────────┘   │
│                                                   │
│  [📄 View in TDR App]  [📎 PDF Attached Below]   │
│                                                   │
└──────────────────────────────────────────────────┘
│
├── 📎 TDR-Readout-AccountName-2026-02-09.pdf
```

The Slack Bot requires OAuth scopes: `chat:write`, `chat:write.public`, `files:write`, `files:read`, `channels:read`, `groups:read`. The Slack App is created via **App Manifest** (see Sprint 14 for the full manifest JSON and setup steps). The bot token (`xoxb-...`) is stored as a Domo Account (same pattern as Sumble/Perplexity API keys).

### 21.7 Snowflake Schema Additions

```sql
-- Table 10: TDR_READOUTS — tracks every generated readout
CREATE TABLE IF NOT EXISTS TDR_READOUTS (
  READOUT_ID          VARCHAR(36) PRIMARY KEY,
  SESSION_ID          VARCHAR(36) NOT NULL,     -- FK → TDR_SESSIONS
  OPPORTUNITY_ID      VARCHAR(18) NOT NULL,
  ACCOUNT_NAME        VARCHAR(255),
  SECTIONS_INCLUDED   VARIANT,                  -- JSON array of section IDs that had data
  SECTIONS_EMPTY      VARIANT,                  -- JSON array of section IDs with no data
  EXECUTIVE_SUMMARY   VARCHAR,                  -- Cached AI summary
  TOTAL_PAGES         INTEGER,
  FILE_SIZE_BYTES     INTEGER,
  FILE_HASH           VARCHAR(64),              -- SHA-256 for integrity verification
  THEME_CONFIG        VARIANT,                  -- JSON of theme settings used
  GENERATED_AT        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  GENERATED_BY        VARCHAR(100)
);

-- Table 11: TDR_DISTRIBUTIONS — tracks distribution events
CREATE TABLE IF NOT EXISTS TDR_DISTRIBUTIONS (
  DISTRIBUTION_ID     VARCHAR(36) PRIMARY KEY,
  READOUT_ID          VARCHAR(36) NOT NULL,     -- FK → TDR_READOUTS
  SESSION_ID          VARCHAR(36) NOT NULL,
  METHOD              VARCHAR(20) NOT NULL,     -- 'download' | 'slack' | 'email'
  CHANNEL             VARCHAR(255),             -- Slack channel name/ID, email address, or 'local'
  RECIPIENT           VARCHAR(255),             -- Who received it
  SUMMARY_SENT        VARCHAR,                  -- The executive summary that was sent
  STATUS              VARCHAR(20),              -- 'success' | 'failed' | 'pending'
  ERROR_MESSAGE       VARCHAR,
  DISTRIBUTED_AT      TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  DISTRIBUTED_BY      VARCHAR(100)
);
```

### 21.8 Code Engine Functions

| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `assembleTDRReadout` | `sessionId` (string) | `ReadoutPayload` (object) | Pull all data for a session into a single structured payload |
| `generateReadoutSummary` | `sessionId` (string) | `{ summary, model }` (object) | AI-generate a 3–5 sentence executive summary via `AI_COMPLETE` |
| `distributeToSlack` | `sessionId`, `channel`, `summary`, `pdfBase64` | `{ success, messageTs, error }` (object) | Post to Slack channel with Block Kit message + PDF attachment |
| `logDistribution` | `distributionId`, `readoutId`, `sessionId`, `method`, `channel`, `status` | `{ success }` (object) | Record distribution event in `TDR_DISTRIBUTIONS` |

### 21.9 Frontend Files

| File | Purpose |
|------|---------|
| `src/components/pdf/TDRReadoutDocument.tsx` | Root `<Document>` — assembles all page components |
| `src/components/pdf/CoverPage.tsx` | Cover page with branding, deal info, status badge |
| `src/components/pdf/ExecSummaryPage.tsx` | AI narrative + deal snapshot table |
| `src/components/pdf/SectionPage.tsx` | Reusable section template (heading, body, tables, citations) |
| `src/components/pdf/AppendixPage.tsx` | Chat highlights, scoring, raw citations |
| `src/components/pdf/pdfTheme.ts` | Stylesheet factory — generates `@react-pdf/renderer` `StyleSheet` from theme config |
| `src/components/pdf/chartRenderers.ts` | Canvas-to-PNG utilities for chart embedding |
| `src/lib/tdrReadout.ts` | Frontend service: `assembleReadout()`, `generatePDF()`, `downloadPDF()`, `distributeToSlack()` |
| `src/components/TDRReadoutDialog.tsx` | Export dialog UI: section checklist, preview, generate + download + share buttons |

---

## 20. Solution Strategy Summary — The Eighteen Pillars

This is the "elevator pitch" view. The final solution is built on eighteen distinct pillars. Each pillar is independently valuable, but together they create a compounding effect: more data makes the chat smarter, chat interactions surface insights that improve scoring, scoring drives better TDR prioritization, better prioritization means more valuable data is collected, the readout captures it all as a permanent record, the ML model predicts which deals will close, and the MLOps layer monitors and calibrates every prediction. It's a flywheel.

### Pillar 1: Persistent Memory (Sprints 1–3)
**What:** Every TDR session, every step input, every edit — stored in Snowflake with timestamps. Full history, never overwritten.
**Why it matters independently:** Even without AI, the team gains posterity. "What did we know about this deal in October?" becomes answerable. TDR reviews become auditable. Handoffs between SEs are seamless.
**Key outcome:** The app remembers everything.

### Pillar 2: External Intelligence (Sprints 4–6, 6.5)
**What:** Sumble provides firmographic + technographic enrichment (what tech do they run?), with expansion to deep intelligence tiers: organization firmographics (industry, size, tech depth), hiring signal intelligence (what they're building, competitive landscape), and key person identification (champions, evaluators). Perplexity provides web-grounded research (what are they doing strategically?). Both cache to Snowflake. Both track iteration history. All calls are user-initiated with tiered depth controls.
**Why it matters independently:** Even without chat or Cortex, the SE Manager sees real-world context inside the TDR workflow instead of researching in browser tabs. The tech stack view alone transforms how competitive deals are prepared. With deep intelligence, the manager knows not just *what* tech they use, but *how deeply*, *what they're building*, and *who* to engage.
**Key outcome:** The app knows the account — deeply.

### Pillar 3: Inline Chat (Sprint 8)
**What:** A conversational AI panel in the TDR Workspace. Multi-turn. Context-aware (knows the deal, the inputs, the intel). Can answer from stored data (Cortex) or search the web on-demand (Perplexity). Every message persisted.
**Why it matters independently:** Even with minimal stored intel, the chat provides TDR methodology coaching, helps brainstorm positioning, and answers "what should I ask?" questions. With stored intel, it becomes a deal expert that cites its sources.
**Key outcome:** The app answers your questions.

### Pillar 4: Cortex AI Processing (Sprints 7, 9–11)
**What:** Snowflake Cortex processes stored data in-database. Generates TDR briefs (AI_COMPLETE). Classifies findings (AI_CLASSIFY). Extracts entities (AI_EXTRACT). Finds similar deals (AI_EMBED). Analyzes portfolio patterns (AI_AGG). Enables natural language SQL (Analyst). Full-text + semantic search (Search).
**Why it matters independently:** Even without external intelligence, Cortex can analyze patterns across historical TDR sessions, find deals that stalled at similar stages, and surface insights from the team's own notes. With external intelligence, it becomes a strategic advisor.
**Key outcome:** The app thinks about the data.

### Pillar 5: Enriched Scoring (Sprints 10, 18)
**What:** TDR scores incorporate real-world signals. Phase 1 (Sprint 10): New critical factors fire based on external intelligence. Phase 2 (Sprint 18): Two-phase scoring — Pre-TDR (structured SFDC data) and Post-TDR (enriched with SE input quality, Cortex AI analysis, named competitor threat, fileset intelligence match, and enrichment depth). Named "dangerous competitors" (Sigma, Fivetran, dbt, Matillion, Tableau) are configurable in Settings and weighted higher.
**Why it matters independently:** Even if a manager never opens the TDR Workspace, the deals table shows better priorities. The "Why TDR?" pills tell a richer story. Post-TDR scores validate that the SE did meaningful work and the deal is genuinely complex.
**Key outcome:** The app prioritizes smarter — and gets smarter after each review.

### Pillar 6: Canonical Readout (Sprints 13–14)
**What:** A one-click, executive-ready PDF that captures the entire TDR lifecycle — inputs, enrichment, analysis, research, chat highlights, decision rationale, and recommendations — rendered into a beautifully structured document with branded theming, tables, charts, and citations. Distribution via direct download or push-to-Slack with an AI-generated executive summary.
**Why it matters independently:** Even if nothing else changes, the readout transforms a TDR from a transient work session into a permanent artifact. It's the document that gets attached to a deal review email, shared in a leadership Slack channel, or pulled up six months later during renewal prep. It closes the loop: every other pillar generates value *during* the TDR; this pillar packages that value for consumption *after* the TDR.
**Key outcome:** The app produces a deliverable.

### Pillar 7: Unstructured Knowledge (Sprints 19, 19.5)
**What:** Domo filesets — PDFs containing partner playbooks, competitive battle cards, co-sell guides — are made searchable and actionable within the TDR experience. When an SE opens a TDR, the app auto-searches configured filesets for content relevant to the deal's competitors, partner platform, and cloud strategy. Results surface in the Intelligence panel and enrich the chat context. Sprint 19.5 enhances the KB summary by routing it through Cortex AI_COMPLETE with full TDR session context and a TDR-Framework-aware prompt, and adds deep links to source documents in the Domo datacenter.
**Why it matters independently:** Even without any other enrichment, filesets turn the TDR into a context-aware experience. An SE reviewing a Sigma competitive deal gets the Sigma battle card surfaced automatically. An SE reviewing a Snowflake co-sell deal gets the Snowflake partner playbook. The knowledge that exists in scattered PDFs becomes instantly accessible at the point of decision. With Cortex integration, the summary is grounded in deal-specific context from Snowflake.
**Key outcome:** The app knows the playbook — and connects it to the deal.

### Pillar 8: Frontier Model Strategy (Sprint 22)
**What:** Every AI operation in the app — chat, TDR briefs, classification, entity extraction, KB summarization, analyst queries — is upgraded from legacy open-source models (Llama, Mistral, Arctic) to best-in-breed frontier models from OpenAI (`openai-gpt-4.1`, `openai-o4-mini`) and Anthropic (`claude-4-opus`, `claude-4-sonnet`). Google Gemini will be added when Snowflake Cortex adds support.
**Why it matters independently:** Model quality is the single biggest lever for AI output quality. Frontier models produce dramatically better TDR briefs, more accurate entity extraction, more insightful KB summaries, and more useful chat responses. This is a force multiplier for every other pillar.
**Key outcome:** The app uses the best AI available — period.

### Pillar 9: Lean Operating Model (Sprint 17)
**What:** The 9-step TDR is compressed into 5 required sections + optional extras. A Thesis field ("Why does Domo belong?") is always visible. Fields are replaced with forcing questions. The target is 30 minutes, not 90.
**Why it matters independently:** Even if you never build another enrichment source, a faster TDR means more deals get reviewed. The compression removes documentation overhead and focuses the SE on the one question that matters: does the technical story hold together?
**Key outcome:** The app respects the user's time.

### Pillar 10: Action Plan Synthesis (Sprint 21) — THE CAPSTONE
**What:** After TDR completion, Cortex AI synthesizes ALL captured data — SE inputs, deal metadata, Perplexity research, Sumble enrichment, fileset battle cards/playbooks, chat highlights, classified findings, Post-TDR Score — into a 7-section strategic action plan tailored to the specific deal. Every recommendation cites its data source. The plan names specific competitors, specific partners, specific people, specific technologies.
**Why it matters independently:** This is the payoff for everything else. Every other pillar *generates* intelligence. This pillar *converts* that intelligence into action. Without it, the SE/AE still has to read through raw data and figure out what to do. With it, they open the PDF and the first thing they see is: "Here's exactly what to do next, in what order, and why."
**Key outcome:** The app tells you what to do.

### Pillar 11: Performance & Caching (Sprint 24)
**What:** A full-stack audit of the app — dead code removal, unused dataset cleanup, bundle optimization, and most critically: **caching Cortex KB summaries to Snowflake** so they persist across sessions rather than regenerating on every deal load. A "Refresh" button gives the user explicit control over when to invoke a fresh Cortex call.
**Why it matters independently:** Even without any new features, this pillar makes the existing app faster, cheaper, and leaner. KB summaries load in < 200ms from Snowflake cache instead of 5-10s from a live Cortex call. The bundle shrinks by ≥ 15%. Dead code and orphaned datasets are eliminated, reducing maintenance surface area. Cortex AI token spend drops significantly as redundant calls are eliminated.
**Key outcome:** The app is fast, lean, and cost-efficient.

### Pillar 12: UX Cohesion (Sprint 26) — THE POLISH
**What:** A comprehensive usability audit and redesign of the Intelligence panel — the most information-dense surface in the app. Consolidates 4 separate Sumble enrichment buttons into one "Enrich Account" action. Reduces branding from colored pills on every section to subtle icon-only indicators. Moves Analytics Extraction behind the scenes (auto-runs, invisible to user). Reorders sections by decision value: Action Plan and TDR Score at top, raw data feeds in collapsible middle sections, administrative controls at bottom.
**Why it matters independently:** Even without any new features, this pillar transforms the user experience from "wall of features accumulated over 23 sprints" to "cohesive intelligence dashboard designed for daily workflow." A first-time user can scan the panel and immediately find what matters. A returning user doesn't waste clicks on 4 separate enrichment buttons.
**Key outcome:** The app feels designed, not assembled.

### Pillar 13: Documentation Hub & Architecture Visualization (Sprint 25)
**What:** A comprehensive in-app Documentation Hub at `/docs` containing seven sections: (1) Interactive Architecture Diagram with 5 switchable SVG layers (System Overview, Snowflake Data Model, Cortex AI Model Map, Enrichment Pipeline, User Workflow), (2) Scoring Reference detailing Pre-TDR, Post-TDR, and Confidence Score methodology with factor tables, (3) Capabilities Guide covering all 9 app sections with feature-level detail, (4) Integrations Reference documenting all 5 external systems (Snowflake Cortex, Sumble, Perplexity, Domo Platform, Slack), (5) Data Model Reference mapping all 10 Snowflake tables/views, (6) AI Models Reference cataloging every model across 3 providers, and (7) Glossary & FAQ with 20+ terms and common questions. The hub uses a sticky Table of Contents sidebar, accordion-based navigation, and the app's dark violet design language throughout.
**Why it matters independently:** This is the meta-deliverable. It documents everything the other eleven pillars built. When a Snowflake SA asks "What does your app do?", you open this tab. When a Domo executive asks "How is Cortex being used?", you check the AI Models section. When an SE asks "How is the TDR score calculated?", the Scoring Reference has every factor and weight. When a new engineer joins the project, they have a visual map plus complete technical documentation of the entire system. It transforms institutional knowledge into a comprehensive, interactive reference.
**Key outcome:** The app explains itself — completely.

### Pillar 14: Dataset Swap & Deal Close Propensity (Sprint 28)
**What:** Two-part: (1) Swap the primary dataset from a 34-column mapping to 65 columns (2 existing remapped/dropped, 33 new added), adding account firmographics, sales milestones, engagement signals, historical outcomes, and unstructured text. Verified against actual v2 sample (506 total columns available). New Domo dataset ID includes historical closed deals for ML training. (2) Train a `SNOWFLAKE.ML.CLASSIFICATION` propensity-to-close model — native SQL, no Python, no ensemble complexity. 19 derived features. Propensity composes with TDR score into a **two-axis quadrant** (CRITICAL / STANDARD / MONITOR / SKIP). SHAP-like factor explanations surface inline per deal — designed for naive users with plain English labels, directional arrows (↑ helps / ↓ hurts), and magnitude bars. Gorgeous interactive quadrant scatter plot in the Command Center. EDA notebook validates data quality before training.
**Why it matters independently:** The dataset swap alone expands what the app knows about each deal — firmographics, engagement, process milestones become visible. The propensity model answers the question the deterministic score can't: "Will this deal actually close?" Combined with TDR complexity, the CRITICAL quadrant (high propensity + high complexity) becomes the priority queue. The SHAP factor display makes the model trustworthy: not just "82% likely to close" but "because account win rate is 0.78, stage velocity is 1.4× average, and engagement is strong" — in words anyone can understand.
**Key outcome:** The app predicts which deals will close, explains why in plain English, and composes that with technical complexity to focus SE Manager time on the right deals.

### Pillar 15: AI-Enhanced TDR Responses (Sprint 29)
**What:** Per-field AI enhancement for TDR textarea inputs. An SE types a terse response ("New CFO wants better reporting"), clicks "Enhance," and receives a context-aware improved version that preserves their intent but adds specificity, structure, and completeness. The enhancement draws from 8 context layers: field identity, step forcing function, sibling/cross-step inputs, deal metadata, Sumble account intel, Perplexity research, and Domo Knowledge Base filesets. The SE sees an inline diff and explicitly accepts, edits, or dismisses. Uses the Domo AI endpoint (Anthropic) for low-latency, cost-effective enhancement without a Snowflake round-trip. No new infrastructure — enhanced values save through the existing `onSaveInput` flow and edit history captures both original and enhanced versions.
**Why it matters independently:** The entire DealInspect intelligence stack — structured extraction, TDR brief, action plan, classified findings — is only as good as what the SE types into the TDR fields. Thin inputs produce thin artifacts. This pillar closes the gap between what the SE knows and what they write, making every downstream AI artifact materially better without requiring the SE to become a better writer. It also creates a positive feedback loop: as SEs see enhanced responses, they internalize what "good" looks like and start writing better inputs naturally.
**Key outcome:** The quality floor for TDR inputs rises — no deal goes through the system with terse, unstructured responses that starve the AI pipeline.

### Pillar 16: UX Polish & Iteration (Sprint 30)
**What:** A dedicated pass over every net-new interaction surface from Sprints 28–29 — propensity quadrant scatter plot, SHAP factor cards, AI enhancement diff view, context-source badges — plus recalibration of existing data visibility rules. The `MAX_STAGE_AGE_DAYS` threshold (currently 365) silently hides legitimate deals like renewals that linger in early stages; this pillar evaluates alternatives (higher threshold, deal-type awareness, close-date proximity override, or soft "stale" indicator instead of hard exclusion). Duplicate Opportunity ID records with conflicting field values (e.g., one row with `Mgr Forecast Name = "NAM Enterprise"`, another with `Casey Morgan`) get a deduplication strategy. Every new column from the expanded dataset is evaluated for surfacing in deal detail views. Additionally: Settings→Filter bridge so manager additions immediately reflect in dropdowns, Perplexity-cited tech rendered as pills with source provenance icons, Slack PDF tech pills colored to match the app, Intelligence Panel guided workflow checklist, Slack share caching to eliminate redundant regeneration, and data gap indicators on empty/terse TDR fields.
**Why it matters independently:** First-pass implementations of ML visualizations and AI interaction patterns almost never nail the UX. Without a dedicated refinement cycle, rough edges accumulate — an awkward tooltip placement, an unintuitive diff rendering, a hidden deal — and users lose trust faster than they build it. This pillar ensures the new capabilities *feel* as good as they *work*. It also catches data visibility bugs before they become "why can't I find my deal?" support tickets. The Intelligence Panel checklist and gap indicators address a second class of problem: workflow opacity and silent information gaps that undermine the TDR process itself.
**Key outcome:** The app's new ML and AI surfaces are production-polished, zero legitimate deals are silently hidden, and the path from "open a deal" to "share a complete readout" is obvious.

### Pillar 17: TDR Framework Redesign (Sprint 31)
**What:** Consolidation of the TDR from 9 steps / 29 fields to ~5–6 steps with fewer, sharper fields. The current step structure has redundancies (Entry Layer / In-Scope Layers, System of Record / Architectural Truth / Target State Change, Business Decision fields) that slow SEs down. AI & ML is elevated from a 2-field optional step to a rigorous core step with a structured AI value continuum framework spanning rules-based automation, traditional ML, generative AI, and agentic solutions — reflecting what Domo actually sells. Field-level improvements: "Key Stakeholders" → "Key Technical Stakeholders", Entry Layer becomes multi-select, In-Scope Layers become pill/tag inputs for analytics, all textareas get resize handles. Step completion semi-automates based on field completeness instead of manual checkbox. TDR versioning (multiple iterations over time) is exposed in the UI. PDF readout updates to match the new structure. All changes align to the existing Snowflake schema (field IDs are strings — additive, not destructive). **Requires explicit user approval before implementation.**
**Why it matters independently:** The TDR framework is the core data-collection instrument. Every downstream artifact — structured extraction, TDR brief, action plan, readout PDF — is only as good as the inputs the steps elicit. A framework that's too granular, has redundant fields, and underweights AI assessment produces lower-quality inputs under time pressure. Consolidating steps makes TDR completion faster, elevating AI & ML makes the most strategically relevant assessment unavoidable, and structured tags (pills) for Domo layers unlock cross-deal analytics that free text can't provide. Semi-automated completion removes a tedious manual gate. Versioning enables living TDRs that evolve as deals progress.
**Key outcome:** SEs complete TDRs faster with sharper, less redundant inputs. AI & ML opportunity assessment is a first-class concern. The TDR becomes a living document with iteration history.

### Pillar 18: MLOps Monitoring & Model Calibration (Sprint 32)
**What:** A dedicated MLOps tab (`/mlops`) providing full visibility into propensity model health: pipeline execution history (nightly scoring + weekly retraining status), model version registry with fit metrics (per-class precision/recall/F1), feature importance ranking (interactive bar chart of all 32 features), prediction accuracy vs. ground truth (for deals that close after scoring), score distribution histogram, and SHAP factor aggregation across the portfolio. Alert badges surface warnings when the model is stale, a task fails, or the score distribution becomes degenerate. Critically, this pillar also addresses **model calibration** — the current model produces a bimodal distribution (35% of deals at <5%, 15% at >95%) driven by covariate shift on `DAYS_IN_PIPELINE` (training avg 153 days vs. scoring avg 532 days). Fixes: score capping [3%–97%], DAYS_IN_PIPELINE normalization (cap at 730), training recency filter, and a `PREDICTION_SNAPSHOTS` table for ground truth tracking. 7 new Code Engine functions expose Snowflake ML metadata to the frontend.
**Why it matters independently:** When the model broke (feature schema mismatch → all predictions "Lost"), the only diagnostic path was raw SQL via Cortex CLI. An SE Manager seeing "Win Propensity: 0%" had no way to distinguish a model failure from reality. This pillar makes model health visible, score quality trustworthy, and provides the infrastructure to continuously validate and improve predictions. The calibration fixes ensure scores represent credible probabilities — no deal should be 99.8% or 0.02% certain.
**Key outcome:** The model is monitored, calibrated, and self-diagnosing — no silent failures, credible score distributions, and ground truth tracking for continuous accuracy measurement.

### The Flywheel

```
                    ┌──────────────────────┐
                    │  Better Priorities   │
                    │  (Two-Phase Scoring) │
                    └──────────┬───────────┘
                               │
                    Manager reviews the RIGHT deals
                               │
                               ▼
┌──────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│  Smarter AI  │◄───│  Lean TDR Reviews    │───►│  Canonical Readout  │
│  (Cortex)    │    │  (30 min, focused)   │    │  (PDF + Slack)      │
└──────┬───────┘    └──────────┬───────────┘    └─────────┬───────────┘
       │                       │                          │
       │            More data flows into Snowflake        │
       │                       │                  Readout shared with
       ▼                       ▼                  leadership & archive
┌──────────────────────────────────────────┐              │
│       Deeper Persistent Memory           │              │
│  (Sessions, Inputs, Chat, Intel, Cortex) │◄─────────────┘
└──────────────┬───────────────────────────┘   Distribution
               │                               logged back
    ┌──────────┴──────────┐                    to Snowflake
    ▼                     ▼
┌────────────────┐  ┌─────────────────────┐
│  Knowledge     │  │  Post-TDR Score     │
│  Base Search   │  │  (AI-evaluated)     │
│  (Filesets)    │  │                     │
└────────────────┘  └─────────────────────┘
    │                     │
    └──── Both feed back into scoring,
          chat context, and next TDR
```

### What This Means Practically

| If you build only... | Status | The app becomes... |
|----------------------|--------|-------------------|
| Pillar 1 (Persistence) | ✅ | A reliable, auditable TDR system with history |
| Pillars 1–2 (+ Intelligence) | ✅ | A context-rich TDR tool that knows the account |
| Pillars 1–3 (+ Chat) | ✅ | An AI-assisted TDR workflow where you never leave the app |
| Pillars 1–4 (+ Cortex) | ✅ | A strategic platform that generates insights across all deals |
| Pillars 1–5 (+ Scoring v2) | ✅ | A self-improving deal intelligence system that gets smarter with every review, with Pre-TDR and Post-TDR scores |
| Pillars 1–6 (+ Readout) | ✅ | A complete deal intelligence platform that produces executive-ready artifacts |
| Pillars 1–7 (+ Knowledge Base) | ✅ | A knowledge-augmented TDR system — battle cards and playbooks surface automatically at the point of decision |
| Pillars 1–8 (+ Frontier Models) | ✅ | Every AI operation uses best-in-breed frontier models — force multiplier for all pillars |
| Pillars 1–9 (+ Lean Model) | ✅ | A fast, focused TDR that takes 30 minutes and produces structured intelligence |
| Pillars 1–10 (+ Action Plan) | ✅ | **The complete platform:** every data source, every AI capability, every enrichment — synthesized into a specific, tailored action plan that tells the SE/AE exactly what to do next |
| Pillars 1–11 (+ Performance) | ✅ | A production-grade platform — cached intelligence, lean bundle, zero waste. Every Cortex call is intentional, every byte justified. |
| Pillars 1–12 (+ UX Cohesion) | ✅ | A polished platform — the Intelligence panel feels designed, not assembled. One-click enrichment, clear hierarchy, no branding noise. |
| Pillars 1–13 (+ Documentation Hub) | ✅ | **The documented platform:** the system explains itself. Stakeholders see the architecture, Snowflake SAs see Cortex usage, new engineers see the full map. The app is both the product and its own documentation. |
| Pillars 1–14 (+ Dataset Swap + ML Propensity) | ✅ | **The predictive platform:** the system ingests the full deal picture (65 columns, verified against actual v2 dataset), predicts which deals will close, explains why in plain English (SHAP factors), and composes that prediction with TDR complexity into a gorgeous interactive quadrant. SE Managers allocate time to the CRITICAL quadrant: deals that are both winnable and technically complex. The flywheel accelerates: as more deals close (or don't), the model retrains and gets smarter. |
| All 15 Pillars (+ AI Enhancement) | ✅ | **The self-improving platform:** the system raises the quality floor of its own inputs. SEs get AI-assisted writing that draws from every context source the platform has accumulated — filesets, Sumble, Perplexity, cross-step inputs — ensuring no deal enters the intelligence pipeline with thin, unstructured data. Better inputs → better extractions → better briefs → better action plans. Inline diff view shows exactly what the AI changed. Context-source badges show which layers of intelligence informed each enhancement. The flywheel tightens. |
| All 16 Pillars (+ UX Polish) | ✅ | **The production-polished platform:** every new surface — propensity quadrant, SHAP factors, AI enhancement diff — has been evaluated with real data and refined. Data visibility rules are recalibrated (Stage Age threshold, duplicate handling) so zero legitimate deals are silently hidden. Intelligence Panel has a unified readout workflow. Tech pills show provenance. The app doesn't just work; it feels right. |
| All 17 Pillars (+ TDR Redesign) | ✅ | **The streamlined platform:** the TDR itself — the core instrument — is rebuilt. 9 steps become 5. Redundant fields are consolidated. AI & ML is a rigorous core step, not an afterthought. Textareas resize, steps auto-complete, Domo layers are pills for analytics, and TDRs version over time. SEs complete reviews faster with sharper inputs. Every downstream artifact gets better because the inputs got better. The flywheel is complete. |
| All 18 Pillars (+ MLOps Monitoring) | 🔶 | **The self-monitoring platform:** the ML model that predicts deal outcomes is now observable, calibrated, and continuously validated. Score distributions are credible — no false certainty. Ground truth tracking measures real-world prediction accuracy as deals close. Pipeline health is visible at a glance: stale models, failed tasks, and degenerate distributions surface as alerts, not silent failures. The flywheel becomes trustworthy. |

Each row is a valid stopping point. The app works and delivers value at every increment. But each pillar makes the next one exponentially more powerful. **Pillars 1–17 are complete.** Pillar 18 (MLOps Monitoring & Model Calibration) is in progress. Pillar 10 is the capstone: it converts everything the other pillars generate into a single actionable artifact. Pillar 14 adds predictive intelligence: the app doesn't just describe deals, it forecasts their outcomes. Pillar 15 closes the input quality gap: the system helps SEs write better inputs, which makes everything downstream better. Pillar 16 ensures the new ML and AI surfaces are production-polished. Pillar 17 rebuilds the core TDR instrument — fewer steps, sharper fields, AI & ML as a first-class concern. Pillar 18 closes the observability gap: the ML predictions are monitored, calibrated, and self-diagnosing.

---

*This document is a living strategy. Update it as decisions are made and phases are completed.*

