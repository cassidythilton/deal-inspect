# TDR Deal Inspection — Implementation Strategy

> Account Intelligence, Snowflake Persistence, Cortex AI, and Inline TDR Chat

**Status:** In Progress · **Version:** Draft 2.5 · **Date:** February 9, 2026 · **Sprints Completed:** 1, 2, 3, 4, 5, 5.5, 6

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
20. [Solution Strategy Summary — The Five Pillars](#20-solution-strategy-summary--the-five-pillars)

---

## 1. Executive Summary

This document describes the strategy for transforming the TDR Deal Inspection app from an internally-scoped scoring tool into an **AI-native, intelligence-enriched review platform**. Four capabilities are introduced:

1. **External Account Intelligence** — Perplexity (web research) and Sumble (firmographic/technographic enrichment) provide real-world context about each account's technology stack, strategic initiatives, and competitive landscape.

2. **Snowflake Persistence** — All TDR session data, step inputs, chat conversations, and account intelligence move from Domo AppDB to Snowflake. Every write is append-only with timestamps, enabling full iteration history and cross-deal analytics.

3. **Snowflake Cortex AI** — Cortex AI SQL functions (`AI_COMPLETE`, `AI_AGG`, `AI_SUMMARIZE_AGG`, `AI_CLASSIFY`, `AI_EXTRACT`, `AI_EMBED`, Cortex Analyst, Cortex Search) process stored data directly in Snowflake to generate TDR summaries, cross-deal insights, competitive intelligence aggregation, and semantic search across all account research.

4. **TDR Inline Chat** — A context-aware conversational AI embedded in the TDR Workspace. The chat knows the current deal, all TDR inputs entered so far, and all cached account intelligence. It can answer questions using stored data (Cortex), search the web in real-time (Perplexity), or provide TDR methodology guidance — enabling the SE Manager to get answers without leaving the review workflow.

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
│   AppDB (TDRSessions) ◄──► /domo/datastores/v1/...             │
│                                            │                    │
│   Domo AI ◄──────────── /domo/ai/v1/text/chat                  │
│   (17-factor TDR prompt)                   │                    │
│                                            ▼                    │
│                              ┌──────────────────────┐           │
│                              │  TDR Deal Inspection  │           │
│                              │  React + TS + Vite    │           │
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
/Users/cassidy.hilton/.local/bin/cortex

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

---

## 17. Implementation Phases

### Phase 1 — Snowflake Foundation

**Scope:** DDL + `tdr-snowflake-persistence` Code Engine function + `snowflakeStore.ts`

**Deliverables:**
- [ ] Create Snowflake database/schema (`TDR_APP.TDR_DATA`)
- [ ] Create dedicated warehouse (`TDR_APP_WH`, XS, auto-suspend 60s)
- [ ] Create all 6 tables (sessions, inputs, sumble, perplexity, usage log, cortex results)
- [ ] Build `tdr-snowflake-persistence` Code Engine function
- [ ] Build `src/lib/snowflakeStore.ts` (front-end service, replaces `appDb.ts`)
- [ ] Wire TDR Workspace to use `snowflakeStore` for session CRUD
- [ ] Implement dual-write (Snowflake + AppDB) during transition

### Phase 2 — TDR Input Persistence

**Scope:** Wire TDR step inputs to save/load from Snowflake

**Deliverables:**
- [ ] Update `TDRInputs.tsx` to save field values on change (debounced)
- [ ] Update `TDRWorkspace.tsx` to load latest inputs on session open
- [ ] Add input history view ("View edit history" per field)
- [ ] Capture user identity via `/domo/users/v1/me`

### Phase 3 — Account Intelligence

**Scope:** `tdr-account-intel` Code Engine function + front-end integration

**Deliverables:**
- [ ] Create Domo Account entries for Perplexity and Sumble API keys
- [ ] Build `tdr-account-intel` Code Engine function (Perplexity + Sumble + Snowflake writes)
- [ ] Build `src/lib/accountIntel.ts` (front-end orchestration)
- [ ] Add "Account Research" step to TDR Workspace (Step 2)
- [ ] Add "Account Intelligence" section to `TDRIntelligence.tsx`
- [ ] Implement domain resolution logic
- [x] ~~Implement cache-first architecture with configurable TTL~~ → Removed. All API calls are user-initiated only (click-to-enrich). No auto-fetch or TTL.

### Phase 4 — Cortex AI (Phase A — Deal-Level)

**Scope:** Per-deal Cortex functions via `tdr-cortex-ai` Code Engine function

**Deliverables:**
- [ ] Build `tdr-cortex-ai` Code Engine function
- [ ] Build `src/lib/cortexAi.ts` (front-end service)
- [ ] Implement `AI_COMPLETE` TDR brief generation (replaces Domo AI summary)
- [ ] Implement `AI_CLASSIFY` for Perplexity finding categorization
- [ ] Implement `AI_EXTRACT` for entity extraction from research
- [ ] Implement `AI_SENTIMENT` for TDR health tracking
- [ ] Store all results in `CORTEX_ANALYSIS_RESULTS`

### Phase 5 — Cortex AI (Phase B — Portfolio-Level)

**Scope:** Cross-deal analysis and semantic search

**Deliverables:**
- [ ] Implement `AI_AGG` portfolio insights (Command Center)
- [ ] Implement `AI_SUMMARIZE_AGG` intel evolution (Workspace)
- [ ] Implement `AI_EMBED` + `AI_SIMILARITY` for deal matching
- [ ] Add "Similar Deals" section to Intelligence panel
- [ ] Add "Portfolio Insights" to Command Center
- [ ] Set up Cortex Analyst semantic model over TDR tables
- [ ] Add "Ask TDR" natural language query interface

### Phase 6 — Scoring & Prompt Enrichment

**Scope:** Intelligence-aware TDR scoring and Domo AI prompt enhancement

**Deliverables:**
- [ ] Add `techStackOverlap` critical factor
- [ ] Add `strategicMomentum` critical factor
- [ ] Enhance existing factors with intel validation
- [ ] Enrich Domo AI prompt payload with cached intel
- [ ] Add enrichment indicators to DealsTable

### Phase 7 — Settings, Migration & Polish

**Scope:** Settings UI, AppDB migration, monitoring

**Deliverables:**
- [ ] Add "Account Intelligence" card to Settings page
- [ ] Add API usage counter display
- [ ] Build AppDB → Snowflake migration Code Engine function
- [ ] Run migration, validate data, cut over to Snowflake-only
- [ ] Remove AppDB dependency
- [ ] Set up scheduled Cortex batch analysis (Snowflake Tasks)

### Phase 8 — Cortex Search & Analyst (Advanced)

**Scope:** Full-text search and natural language analytics

**Deliverables:**
- [ ] Set up Cortex Search service over intel + TDR notes
- [ ] Add search bar to Command Center
- [ ] Build Cortex Analyst semantic model YAML
- [ ] Add "Ask TDR" interface
- [ ] Document Cortex Code CLI usage for SE leadership

---

## 18. Sprint Plan & Progress Tracker

Each sprint is a focused work session (2–4 hours). The app remains fully functional after every sprint — no sprint leaves the app in a broken state. Sprints are ordered by dependency: each builds on the one before it.

### Sprint 1 — Snowflake Foundation ✅ COMPLETE

> **Goal:** Stand up the Snowflake environment. Zero app changes.
> **Risk to app:** None — purely infrastructure.
> **Completed:** February 9, 2026

- [x] Run bootstrap DDL: create `TDR_APP` database, `TDR_DATA` schema, `TDR_APP_WH` warehouse (XS, auto-suspend 60s), `TDR_APP_ROLE` role
- [x] Run table DDL: create all 9 tables (`TDR_SESSIONS`, `TDR_STEP_INPUTS`, `TDR_STEP_DEFINITIONS`, `TDR_CHAT_MESSAGES`, `ACCOUNT_INTEL_SUMBLE`, `ACCOUNT_INTEL_PERPLEXITY`, `API_USAGE_LOG`, `CORTEX_ANALYSIS_RESULTS`)
- [x] Seed `TDR_STEP_DEFINITIONS` with v1 process (9 steps: context → usage)
- [x] Grant permissions: `TDR_APP_ROLE` gets USAGE + ALL on schema/tables/warehouse + `CORTEX_USER` database role
- [x] Deploy `snowflakeAuth.js` shared infrastructure to Code Engine (JWT auth + `executeSql` + `mapRows`)
- [x] Validate: run a test SQL (`SELECT CURRENT_TIMESTAMP()`) from Code Engine → confirm it returns successfully
- [x] Verify: `INSERT` + `SELECT` on `TDR_SESSIONS` from Code Engine → confirm round-trip works

**Definition of Done:** Code Engine can authenticate to Snowflake and execute SQL against all 6 tables.

**Learnings & Decisions:**
- Used hardcoded keypair auth (PKCS#8 private key + `DOMOINC-DOMOPARTNER` account locator + `CHILTON` user) matching the `cortexAnalystCodeEngine.js` pattern — `sdk.getAccount()` was unreliable (500 errors).
- Built a `testConnection` function to diagnose Snowflake connectivity step-by-step (config → JWT → SQL → table access → seed verification).
- Consolidated all persistence functions into a single `consolidated-sprint1.js` for direct paste into the Domo Code Engine IDE.
- Bootstrap DDL executed via Cortex CLI (`cortex`).
- Code Engine package ID: `8f01e509-429a-474e-a1c8-6a912e363000`.

---

### Sprint 2 — Session Persistence (Dual-Write) ✅ COMPLETE

> **Goal:** TDR sessions save to Snowflake AND AppDB. Reads prefer Snowflake, fall back to AppDB.
> **Risk to app:** Low — dual-write means AppDB is still the safety net.
> **Completed:** February 9, 2026

- [x] Deploy persistence functions to Code Engine: `createSession`, `updateSession`, `getSessionsByOpp`, `getAllSessions`, `deleteSession`, `saveStepInput`, `getLatestInputs`, `getInputHistory` (deployed all 8 at once)
- [x] Add `packageMapping` entries for all 8 persistence functions to `manifest.json`
- [x] Create `src/lib/snowflakeStore.ts` — front-end service wrapping Code Engine calls
- [ ] ~~Capture user identity: call `/domo/users/v1/me` on app init, store in React context~~ (deferred — using deal owner for now)
- [x] Wire `TDRWorkspace.tsx`: session auto-creation on workspace mount via `useTDRSession` hook
- [x] Wire `useDomo.ts`: session fetch → try Snowflake first, fall back to AppDB
- [x] Add `enableSnowflake` toggle to Settings page (default: true)
- [x] Wire `TDRInputs.tsx`: controlled inputs with save-on-blur, saved-field indicators
- [x] Test: load deals table → Snowflake `getAllSessions` returns clean `[]` → TDR status column works
- [x] Test: open deal in TDR Workspace → session auto-created, step inputs rendered

**Definition of Done:** Sessions persist to both Snowflake and AppDB. Users see no difference in behavior.

**Learnings & Decisions:**
- **URL pattern:** The Domo SDK Code Engine proxy does NOT include the `proxyId` in the URL path. Correct: `/domo/codeengine/v2/packages/{functionAlias}`. The `proxyId` in `manifest.json` tells Domo which CE package to resolve to, but is invisible in the URL. (Reference: `github-appstudio-app/app.js`)
- **SDK output wrapping:** Domo SDK wraps CE return values inside `{ [outputAlias]: returnValue }`. For `getAllSessions` with output alias `"sessions"`, the response is `{ sessions: { success: true, sessions: [] } }`. The `extractSessionsArray()` helper unwraps this nested structure.
- **Defensive response parsing:** Following the reference app's pattern, all CE response consumers handle multiple shapes (direct array, raw CE object, SDK-wrapped object).
- **Code Engine version:** v1.0.4 deployed. `stepOrder` declared as `"type": "string"` in `packageMapping` to align with Domo CE IDE limitations (integer type not available in IDE configuration).
- **Vite build:** `public/manifest.json` must mirror root `manifest.json` — Vite copies `public/manifest.json` → `dist/manifest.json` during build.

---

### Sprint 3 — Step Input Persistence ✅ COMPLETE

> **Goal:** TDR step field values save to Snowflake (append-only). Edit history becomes available.
> **Risk to app:** Low — additive only.
> **Completed:** February 9, 2026

- [x] Deploy remaining persistence functions: `saveStepInput`, `getLatestInputs`, `getInputHistory` (deployed in Sprint 2 alongside session functions)
- [x] Add `packageMapping` entries for the 3 input functions (deployed in Sprint 2)
- [x] Wire `TDRInputs.tsx`: on field blur/change → debounced `saveStepInput` call (built in Sprint 2)
- [x] Wire `TDRWorkspace.tsx`: on session open → `getLatestInputs` to populate fields (built in Sprint 2 via `useTDRSession` hook)
- [x] Add "View edit history" button per field → calls `getInputHistory`, shows dialog with timestamped changes
- [ ] Test: fill out TDR steps, close workspace, reopen → fields restore from Snowflake (user validation)
- [ ] Test: edit a field 3 times → "View history" shows all 3 values with timestamps (user validation)

**Definition of Done:** All TDR step inputs persist to Snowflake with full edit history. Fields auto-populate on session open.

**Learnings & Decisions:**
- Most Sprint 3 work was pulled forward into Sprint 2 (all 8 persistence functions deployed at once, `TDRInputs` and `useTDRSession` wired from the start).
- Edit history dialog uses `snowflakeStore.getInputHistory(sessionId, stepId, fieldId)` — returns all timestamped values newest-first.
- History button only appears on fields that have a current value and a valid `sessionId` (not visible on empty/local sessions).
- **Domo reload protection:** Domo reloads the app whenever any powering dataset updates. Added two layers of protection:
  1. **Debounced auto-save (2s):** Every keystroke resets a 2-second timer. When it fires, all dirty fields are flushed to Snowflake — not just on blur.
  2. **sessionStorage draft cache:** Every keystroke is immediately cached in `sessionStorage` (keyed by `sessionId`). On reload, drafts are recovered and auto-saved to Snowflake with a visible "Unsaved inputs recovered" banner.
- This combination ensures no more than 2 seconds of typing can be lost, and even that is recoverable from `sessionStorage` on the next load.

---

### Sprint 4 — Sumble Account Enrichment ✅

> **Goal:** Enrich accounts with firmographic + technographic data from Sumble.
> **Risk to app:** None — new feature, no existing behavior changes.
> **Completed:** February 9, 2026

- [x] ~~Create Domo Account for Sumble API key~~ → Hardcoded in consolidated CE file (same pattern as Snowflake credentials)
- [x] Deploy `enrichSumble`, `getLatestIntel`, `getIntelHistory`, `getUsageStats` functions to Code Engine
- [x] Add `packageMapping` entries for all 5 account intel functions (+ `getUsageStats`)
- [x] Create `src/lib/accountIntel.ts` — front-end orchestration service with mock data for dev mode
- [x] Add domain input field to TDR Intelligence panel (editable, with heuristic pre-fill from account name via `guessDomain`)
- [x] Add "Enrich" button → calls `enrichSumble` → displays firmographics + tech stack as categorized color-coded badges
- [x] Add "Account Intelligence" section to `TDRIntelligence.tsx` — industry, revenue, employee count, headquarters, categorized tech stack
- [ ] Test: click "Enrich Account" for a real deal → see Sumble data in workspace AND in Snowflake table (user validation)
- [ ] Test: click again → see 2 pulls in `ACCOUNT_INTEL_SUMBLE` (user validation)

**Definition of Done:** SE Manager can enrich an account with one click. Tech stack displays in workspace. Data persists with timestamps.

**Learnings & Decisions:**
- API keys hardcoded in consolidated CE file (`consolidated-sprint4-5.js`) — `sdk.getAccount()` doesn't work in this CE package (learned in Sprint 1).
- Sumble free tier has limited credits — UI buttons clearly show "Enrich" vs "Refresh" to make the user aware of when they're making API calls.
- Tech stack is categorized into BI, DW, ETL, Cloud, ML, CRM, DevOps, ERP, Other — each with color-coded badges for quick visual scanning.
- Domain is auto-derived from account name via heuristic (`guessDomain`) but editable by the user. Additionally, a new `WebisteDomain` field was added to the opportunities dataset and is now pre-filled into the domain input (user can overwrite).
- `accountIntel.ts` includes mock data for dev mode so the UI can be developed without hitting external APIs.
- **Sumble API body format:** The Sumble `/v3/organizations/enrich` endpoint requires `organization.name` (not just `domain`) and a `filters.query` field matching Sumble's filter syntax. Multiple iterations were needed to get the request body correct per [Sumble API docs](https://docs.sumble.com/api).
- **ERP category added:** NetSuite, SAP, Workday, Oracle ERP, PeopleSoft now categorize under ERP (previously fell into "Other"). Added to both Code Engine `categorizeTechnologies` and frontend `TECH_CATEGORY_STYLES`.

---

### Sprint 5 — Perplexity Web Research ✅

> **Goal:** Research accounts via web to surface strategic context, competitive landscape, and technology signals.
> **Risk to app:** None — new feature, no existing behavior changes.
> **Completed:** February 9, 2026

- [x] ~~Create Domo Account for Perplexity API key~~ → Hardcoded in consolidated CE file
- [x] Deploy `researchPerplexity` function to Code Engine
- [x] Add `packageMapping` entry
- [x] Research integrated into TDR Intelligence panel (right sidebar) — not a separate TDR step
- [x] Research view: summary, technology signals, competitive landscape, key insights, citation URLs
- [x] "Research" button → calls `researchPerplexity` with deal context (acv, stage, partners)
- [x] "Re-research" button → appends new row (doesn't overwrite) — button label changes after first pull
- [x] Show citation URLs as clickable links (truncated to domain name)
- [ ] Test: research a well-known company → see structured findings with sources (user validation)
- [ ] Test: research twice → both pulls visible in `ACCOUNT_INTEL_PERPLEXITY` (user validation)

**Definition of Done:** SE Manager can research any account from the workspace. Findings are structured, sourced, and persisted.

**Learnings & Decisions:**
- Research placed in TDR Intelligence panel (right sidebar) alongside Sumble data, not as a separate TDR step — keeps the workspace simpler and intelligence contextually visible at all times.
- Perplexity prompt is TDR-aware: includes ACV, stage, and partner context to get more relevant results.
- JSON parsing has a fallback: if Perplexity returns non-JSON, the raw text becomes the summary.
- Citations are displayed as truncated domain names with external link icons.
- Perplexity usage is token-tracked in `API_USAGE_LOG` (tokens_in, tokens_out) for cost monitoring.
- **SQL escaping fix:** Perplexity's raw response often contains single quotes and special characters that break Snowflake `INSERT` statements. Added a robust `escapeSqlString()` helper that escapes single quotes, backslashes, and null bytes. Raw response is now stored as `PARSE_JSON()` of the escaped JSON string.
- **Timestamp fix:** Snowflake `TIMESTAMP_LTZ` values come back as epoch-second strings (e.g., `"1770624234.951000000"`). Added `sfTimestampToISO()` in Code Engine and `formatDate()` in the frontend to handle ISO, epoch-ms, and epoch-second formats gracefully.

---

### Sprint 5.5 — UI/UX Polish & Bug Fixes ✅

> **Goal:** Redesign the intelligence panel for visual prominence, fix API integration bugs, add provider icons, integrate WebisteDomain field.
> **Risk to app:** Low — visual changes only, no persistence or logic changes.
> **Completed:** February 9, 2026

- [x] **Right panel redesign:** Changed right `aside` in `TDRWorkspace.tsx` from `bg-card` (light) to `bg-[#1B1630]` (dark purple matching left nav). Border updated to `border-[#2A2540]`.
- [x] **Panel width increase:** Widened right panel from `w-80` (320px) → `w-[28rem]` (448px) → `w-[42rem]` (672px, 150% of interim width) to give Account Intelligence more prominence relative to the center panel.
- [x] **Purple-tinted dark theme:** Replaced all `slate-` Tailwind classes in `TDRIntelligence.tsx` with custom purple-tinted hex colors (`#1B1630`, `#221D38`, `#2A2540`, `#362F50`, `#4A3F6B`) to match the left navigation's purple palette.
- [x] **Account Intelligence elevation:** The intelligence section uses `bg-[#221D38]` (slightly lighter purple) to subtly stand out from the rest of the `bg-[#1B1630]` panel — no jarring card borders, just a shade difference.
- [x] **Sumble icon:** Created `src/components/icons/SumbleIcon.tsx` with official Sumble logo SVG. Iterated through multiple color versions; final: `#C1C1C1` rounded-rect background (full opacity), `#4C4C4C` outer shapes, `#FEFEFE` inner shapes.
- [x] **Perplexity icon:** Created `src/components/icons/PerplexityIcon.tsx` with official Perplexity logo SVG in `#EDEDED` fill for dark background visibility.
- [x] **WebisteDomain integration:** New `WebisteDomain` field added to opportunities dataset. Mapped in `manifest.json` as column alias. Pre-fills the Account Domain input in the intelligence panel (user can overwrite). Flows through `domo.ts` → `useDomo.ts` → `TDRIntelligence.tsx`.
- [x] **Timestamp display fix:** Added `formatDate()` helper in `TDRIntelligence.tsx` and `sfTimestampToISO()` in Code Engine to handle Snowflake epoch-second timestamps correctly.
- [x] **ERP category:** Added ERP to technology categorization (NetSuite, SAP, Workday, Oracle ERP, PeopleSoft) in both Code Engine and frontend.

**Learnings & Decisions:**
- The initial dark redesign (just `bg-slate-900` on the Account Intelligence card) looked jarring against a light sidebar. Making the **entire right panel dark** and restyling all child elements for dark was the correct approach.
- Using the same purple hue family as the left nav creates visual cohesion across the three-panel layout. The Account Intelligence section is differentiated by a subtle shade shift, not a hard border.
- The `WebisteDomain` field name is misspelled in the source dataset ("Webiste" not "Website") — preserved as-is for compatibility. The alias in `manifest.json` maps it correctly.
- Sumble icon required several iterations (opacity, background shape, color) to look balanced on the dark panel. Final version has a rounded-rect bg at full opacity with `#4C4C4C`/`#FEFEFE` letterforms.

---

### Sprint 6 — Usage Tracking, Intel History & Indicators ✅ COMPLETE

> **Goal:** Add API usage visibility, intel pull history, and enrichment indicators to the deals table. No auto-enrichment — all API calls remain user-initiated (click-to-enrich only).
> **Risk to app:** None — new Settings card and visual indicators, no existing behavior changes.
> **Completed:** February 9, 2026
>
> **Design principle:** Intelligence is **never fetched automatically**. The user clicks "Enrich" or "Research" explicitly. Snowflake stores the results. On subsequent workspace opens, saved results are loaded and displayed with their pull timestamps — but no new API calls are made. There is no cache TTL or auto-refresh.

- [x] Deploy `getUsageStats` and `getDealsWithIntel` functions to Code Engine (consolidated-sprint4-5.js)
- [x] Add `getDealsWithIntel` to `manifest.json` packageMapping
- [x] Add "Account Intelligence" card to Settings page: monthly API usage counters per service (calls, errors, avg response time) with side-by-side Sumble/Perplexity display
- [x] Implement `getIntelHistory` UI: "View Research History" button in TDRIntelligence panel opens a modal dialog showing all timestamped pulls for an account with source, date, account name, pulled-by, and summary snippet
- [x] Add 🔍 icon (violet `Search` icon) to DealsTable account name column when the account has saved intel in Snowflake
- [x] Add `hasIntel` boolean to `Deal` type, fetched via `accountIntel.getDealsWithIntel()` in `useDomo.ts`
- [x] Frontend service methods: `accountIntel.getDealsWithIntel()` and `accountIntel.getUsageStats(month?)` with dev-mode fallbacks
- [x] Build & dist verified

**New Code Engine function:**
- `getDealsWithIntel()` — Input: none → Output: `{ success: boolean, opportunityIds: string[] }`. Runs `SELECT DISTINCT OPPORTUNITY_ID` from both intel tables.

**Files changed:**
- `codeengine/consolidated-sprint4-5.js` → Added `getDealsWithIntel`, bumped version to 1.26.0
- `manifest.json` → Added `getDealsWithIntel` packageMapping entry
- `src/lib/accountIntel.ts` → Added `getDealsWithIntel()`, `getUsageStats(month?)` methods
- `src/types/tdr.ts` → Added `hasIntel?: boolean` to `Deal` interface
- `src/hooks/useDomo.ts` → Import `accountIntel`, fetch deals-with-intel on mount, enrich deals with `hasIntel` flag
- `src/components/DealsTable.tsx` → Import `Search` icon, render violet 🔍 with tooltip for deals with `hasIntel`
- `src/pages/Settings.tsx` → Added "Account Intelligence" card with Sumble/Perplexity usage stats grid
- `src/components/TDRIntelligence.tsx` → Added "View Research History" dialog with history fetch, imports for `Dialog`, `History` icon

**Learnings & Decisions:**
- The `getDealsWithIntel` function uses a simple `UNION` of `DISTINCT OPPORTUNITY_ID` from both intel tables — lightweight and fast.
- Intel indicator in the deals table uses a subtle violet `Search` icon that doesn't compete with existing TDR score and partner indicators.
- The history dialog renders in the dark purple theme consistent with the right panel redesign from Sprint 5.5.
- Usage stats card uses a two-column grid layout matching Sumble (left) and Perplexity (right) for quick visual comparison.

**Definition of Done:** ✅ API usage is visible in Settings. Research history is reviewable per account. Deals table shows which accounts have intel. All API calls remain explicitly user-triggered — no auto-enrich, no TTL, no staleness logic.

---

### Sprint 7 — Cortex AI: Deal-Level Intelligence ⬜

> **Goal:** AI-generated TDR briefs, auto-classified findings, entity extraction.
> **Risk to app:** None — new features behind buttons.

- [ ] Deploy `generateTDRBrief`, `classifyFindings`, `extractEntities` to Code Engine
- [ ] Add `packageMapping` entries
- [ ] Create `src/lib/cortexAi.ts` front-end service
- [ ] Add "Generate TDR Brief" button to TDR Workspace → renders structured brief (executive summary, risks, recommendations)
- [ ] Auto-classify Perplexity findings after each research pull → color-coded category tags in UI
- [ ] Auto-extract entities after each research pull → competitor names populate "Competitive Signals" section, technologies supplement Sumble data
- [ ] Store all Cortex outputs in `CORTEX_ANALYSIS_RESULTS`
- [ ] Test: complete a TDR session with enrichment → generate brief → verify it references Sumble tech stack and Perplexity findings
- [ ] Test: classified findings show distinct categories (competitive threat vs. strategic initiative vs. expansion opportunity)

**Definition of Done:** AI generates actionable TDR briefs grounded in real account intelligence. Findings are automatically categorized and entities extracted.

---

### Sprint 8 — TDR Inline Chat ⬜

> **Goal:** Embed a multi-provider, context-aware conversational AI in the TDR Workspace. The manager picks their preferred LLM (Cortex, Perplexity, or Domo) and model, asks questions about the deal — and the AI answers with full context.
> **Risk to app:** None — new panel in existing workspace. All existing functionality untouched.

**Provider & Model Infrastructure:**
- [ ] Deploy `sendChatMessage`, `getChatHistory` Code Engine functions with multi-provider routing (Cortex, Perplexity, Domo)
- [ ] Add `packageMapping` entries for both functions
- [ ] Create `codeengine/chat.js` reference file with provider handler abstraction
- [ ] Define `LLMProvider` and `LLMModel` registry in `src/config/llmProviders.ts` (3 providers, extensible)
- [ ] Cortex: 5 models (claude-sonnet-4-5, claude-4-sonnet, claude-opus-4-5, llama3.1-405b, mistral-large2)
- [ ] Perplexity: 2 models (sonar-pro, sonar)
- [ ] Domo AI: 1 model (domo-default, no selection needed)

**Front-End Chat UI:**
- [ ] Create `src/lib/tdrChat.ts` — front-end service for chat orchestration + context assembly
- [ ] Build `src/components/TDRChat.tsx` — chat panel component (message list, input, provider/model dropdowns, send button)
- [ ] Integrate chat panel as a tab in the TDR Workspace right panel: [Intel] [**Chat**] [Brief]
- [ ] Provider selector dropdown: 🧊 Cortex | 🔍 Perplexity | 🟦 Domo — remembers last selection
- [ ] Model selector dropdown: appears below provider, shows available models for selected provider. Hidden for Domo.
- [ ] Provider badge on each assistant message: "🧊 Cortex · sonnet-4.5" or "🔍 Perplexity · sonar-pro"

**Context & Behavior:**
- [ ] Implement context assembly: gather deal info, TDR inputs, cached Sumble/Perplexity intel, current step → system prompt
- [ ] Persist all messages to `TDR_CHAT_MESSAGES` with `PROVIDER` + `MODEL_USED`
- [ ] Load chat history on session open via `getChatHistory`; display provider badges on historical messages
- [ ] Step-aware input placeholder: varies by provider + step
- [ ] Contextual suggestion chips: vary by selected provider (web research for Perplexity, stored data for Cortex)
- [ ] Perplexity responses show clickable citation URLs
- [ ] Cost footer: message count + estimated cost: *"8/30 msgs · $0.02 today"*
- [ ] Rate limit: 30 msgs/day overall, 10/day for Perplexity (configurable)

**Settings:**
- [ ] Add chat settings to Settings page: default provider, default Cortex model, daily limits, enabled providers

**Testing:**
- [ ] Test: select Cortex + sonnet-4.5 → ask "What BI tools does this account use?" → get answer citing Sumble data
- [ ] Test: switch to Perplexity + sonar-pro → ask about current events → get response with citations
- [ ] Test: switch to Domo → ask about TDR methodology → get methodology guidance
- [ ] Test: close workspace, reopen → chat history persists with provider badges
- [ ] Test: hit daily limit → graceful "limit reached" message with suggestion to try a different provider

**Definition of Done:** SE Manager can have a multi-turn, context-aware conversation with their choice of 3 LLM providers and 8 models. Chat persists with full provider/model attribution. Adding a new provider in the future is a ~30-minute task.

---

### Sprint 9 — Cortex AI: Portfolio & Sentiment ⬜

> **Goal:** Cross-deal portfolio analysis, intelligence evolution summaries, sentiment tracking.
> **Risk to app:** None — new features on existing pages.

- [ ] Deploy `getPortfolioInsights`, `summarizeIntelHistory`, `getSentimentTrend` to Code Engine
- [ ] Add `packageMapping` entries
- [ ] Add "Portfolio Insights" button to Command Center → AI-generated analysis across all manager's TDR sessions
- [ ] Add "Intelligence Evolution" section to workspace (visible when 2+ research pulls exist)
- [ ] Add sentiment trend visualization to TDR History view (sparkline or small chart across iterations)
- [ ] Test: manager with 5+ TDR sessions → portfolio insights identify patterns across deals
- [ ] Test: account researched 3 times → evolution summary describes what changed

**Definition of Done:** Manager gets AI-powered portfolio view. Deal health trends are visible over time.

---

### Sprint 10 — TDR Scoring Enrichment ⬜

> **Goal:** Intelligence data feeds into TDR scoring and Domo AI prompt.
> **Risk to app:** Moderate — modifies existing scoring logic. Test carefully.

- [ ] Add `techStackOverlap` critical factor to `tdrCriticalFactors.ts` (Tier 2, 10 pts — triggered by Sumble competitive tool detection)
- [ ] Add `strategicMomentum` critical factor (Tier 2, 8 pts — triggered by Perplexity strategic initiative findings)
- [ ] Enhance existing factor tooltips with intel validation (e.g., "Confirmed via Sumble: Account runs Snowflake" for `cloudPartner`)
- [ ] Enrich Domo AI prompt payload in `domoAi.ts` with cached intel (tech stack, recent signals)
- [ ] Add enrichment indicators to DealsTable: new "Why TDR?" pills for intelligence-based factors
- [ ] TDR Score tooltip notes when enrichment data contributed to the score
- [ ] Test: deal with competitive tech in Sumble → `techStackOverlap` pill appears, score increases by 10
- [ ] Test: Domo AI recommendations reference account tech stack in their reasoning

**Definition of Done:** TDR scores incorporate real-world account intelligence. AI recommendations are grounded in external data.

---

### Sprint 11 — Semantic Search & Analyst ⬜

> **Goal:** Search across all stored intelligence. Ask questions in natural language.
> **Risk to app:** None — new features on new UI elements.

- [ ] Deploy `findSimilarDeals`, `askAnalyst` to Code Engine
- [ ] Add `packageMapping` entries
- [ ] Build Cortex Analyst semantic model YAML over TDR tables
- [ ] Add "Similar Deals" section to Intelligence panel → shows deals with comparable tech profiles
- [ ] Add "Ask TDR" query bar to Command Center → natural language questions → table results
- [ ] (Stretch) Set up Cortex Search service over intel + TDR notes → search bar in Command Center
- [ ] Test: find similar deals for an enriched account → results show relevant matches
- [ ] Test: ask "Which accounts have Snowflake but no TDR?" → get accurate results

**Definition of Done:** Manager can find similar deals and ask questions about their portfolio in plain English.

---

### Sprint 12 — Migration & Cleanup ⬜

> **Goal:** Remove AppDB dependency. Snowflake is the single source of truth.
> **Risk to app:** Moderate — removes a persistence layer. Validate thoroughly.

- [ ] Build one-time AppDB → Snowflake migration Code Engine function
- [ ] Run migration: read all AppDB documents → INSERT into Snowflake tables → validate counts match
- [ ] Switch `snowflakeStore.ts` to Snowflake-only reads (remove AppDB fallback)
- [ ] Remove dual-write: stop writing to AppDB
- [ ] Remove `appDb.ts` (or mark as deprecated)
- [ ] Remove `enableAppDB` setting from `appSettings.ts`
- [ ] Update Settings page: remove AppDB toggle, add Snowflake connection status indicator
- [ ] (Stretch) Set up scheduled Cortex batch analysis via Snowflake Tasks (weekly win/loss correlation, competitive agg, stale intel detection)
- [ ] Final regression test: full TDR workflow end-to-end on Snowflake-only
- [ ] Version bump + deploy

**Definition of Done:** AppDB fully retired. All data lives in Snowflake. App is clean and future-proof.

---

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
| 7 | Cortex AI: Deal-Level | ⬜ Not Started | — | Sprints 3 + 6 | AI |
| **8** | **TDR Inline Chat** | ⬜ Not Started | — | Sprints 3 + 6 | **Experience** |
| 9 | Cortex AI: Portfolio & Sentiment | ⬜ Not Started | — | Sprint 7 | AI |
| 10 | TDR Scoring Enrichment | ⬜ Not Started | — | Sprint 6 | Scoring |
| 11 | Semantic Search & Analyst | ⬜ Not Started | — | Sprints 7 + 8 | AI |
| 12 | Migration & Cleanup | ⬜ Not Started | — | All above | Cleanup |

**Parallel tracks:** Sprints 2–3 (persistence) and 4–5 (intelligence) are independent tracks that converge at Sprint 6. Sprints 7 and 8 (Cortex deal-level and inline chat) can also run in parallel — both depend on persistence + intelligence but not on each other. They converge again at Sprint 11 (search & analyst).

```
Sprint 1 ──┬── Sprint 2 ── Sprint 3 ──┐
            │                           ├── Sprint 7 ── Sprint 9 ──┐
            ├── Sprint 4 ──┐            │                          │
            │               ├── Sprint 6 ┤                          ├── Sprint 11
            └── Sprint 5 ──┘      │      │                          │
                                  │      ├── Sprint 8 ─────────────┘
                                  │      │
                                  │      └── Sprint 10
                                  │
                                  └─────────────────── Sprint 12
```

---

## 19. Reference Links

| Resource | URL |
|----------|-----|
| Snowflake Cortex AI Functions | https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql |
| Cortex Code CLI | https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli |
| Cortex Cross-Region Inference | https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-cross-region-inference |
| Perplexity API Docs | https://docs.perplexity.ai/docs/getting-started/overview |
| Sumble API Docs | https://docs.sumble.com/api |
| Snowflake SQL API (Statements) | https://docs.snowflake.com/en/developer-guide/sql-api/reference |
| Domo Code Engine | https://developer.domo.com/portal/8k7stcm6lubfh-code-engine-overview |
| Domo AppDB API | https://developer.domo.com/portal/1l1fm2g0sfm69-app-db-api |
| Sample: aptSnowflakeCodeEngine.js | `samples/aptSnowflakeCodeEngine.js` (local) |
| Sample: cortexAnalystCodeEngine.js | `samples/cortexAnalystCodeEngine.js` (local) |

---

---

## 20. Solution Strategy Summary — The Five Pillars

This is the "elevator pitch" view. The final solution is built on five distinct pillars. Each pillar is independently valuable, but together they create a compounding effect: more data makes the chat smarter, chat interactions surface insights that improve scoring, scoring drives better TDR prioritization, and better prioritization means more valuable data is collected. It's a flywheel.

### Pillar 1: Persistent Memory (Sprints 1–3)
**What:** Every TDR session, every step input, every edit — stored in Snowflake with timestamps. Full history, never overwritten.
**Why it matters independently:** Even without AI, the team gains posterity. "What did we know about this deal in October?" becomes answerable. TDR reviews become auditable. Handoffs between SEs are seamless.
**Key outcome:** The app remembers everything.

### Pillar 2: External Intelligence (Sprints 4–6)
**What:** Sumble provides firmographic + technographic enrichment (what tech do they run?). Perplexity provides web-grounded research (what are they doing strategically?). Both cache to Snowflake. Both track iteration history.
**Why it matters independently:** Even without chat or Cortex, the SE Manager sees real-world context inside the TDR workflow instead of researching in browser tabs. The tech stack view alone transforms how competitive deals are prepared.
**Key outcome:** The app knows the account.

### Pillar 3: Inline Chat (Sprint 8)
**What:** A conversational AI panel in the TDR Workspace. Multi-turn. Context-aware (knows the deal, the inputs, the intel). Can answer from stored data (Cortex) or search the web on-demand (Perplexity). Every message persisted.
**Why it matters independently:** Even with minimal stored intel, the chat provides TDR methodology coaching, helps brainstorm positioning, and answers "what should I ask?" questions. With stored intel, it becomes a deal expert that cites its sources.
**Key outcome:** The app answers your questions.

### Pillar 4: Cortex AI Processing (Sprints 7, 9–11)
**What:** Snowflake Cortex processes stored data in-database. Generates TDR briefs (AI_COMPLETE). Classifies findings (AI_CLASSIFY). Extracts entities (AI_EXTRACT). Finds similar deals (AI_EMBED). Analyzes portfolio patterns (AI_AGG). Enables natural language SQL (Analyst). Full-text + semantic search (Search).
**Why it matters independently:** Even without external intelligence, Cortex can analyze patterns across historical TDR sessions, find deals that stalled at similar stages, and surface insights from the team's own notes. With external intelligence, it becomes a strategic advisor.
**Key outcome:** The app thinks about the data.

### Pillar 5: Enriched Scoring (Sprint 10)
**What:** TDR scores incorporate real-world signals. New critical factors (tech stack overlap, strategic momentum) fire based on external intelligence. The Domo AI prompt includes cached intel, making its recommendations grounded in reality rather than just SFDC fields.
**Why it matters independently:** Even if a manager never opens the TDR Workspace, the deals table shows better priorities. The "Why TDR?" pills tell a richer story. The AI recommends more actionable next steps.
**Key outcome:** The app prioritizes smarter.

### The Flywheel

```
                    ┌──────────────────────┐
                    │  Better Priorities   │
                    │  (Enriched Scoring)  │
                    └──────────┬───────────┘
                               │
                    Manager reviews the RIGHT deals
                               │
                               ▼
┌──────────────┐    ┌──────────────────────┐
│  Smarter AI  │◄───│  Richer TDR Reviews  │
│  (Cortex)    │    │  (Chat + Intel)      │
└──────┬───────┘    └──────────┬───────────┘
       │                       │
       │            More data flows into Snowflake
       │                       │
       ▼                       ▼
┌──────────────────────────────────────────┐
│       Deeper Persistent Memory           │
│  (Sessions, Inputs, Chat, Intel, Cortex) │
└──────────────────────────────────────────┘
       │
       └──── Feeds back into Cortex analysis,
             chat context, and scoring signals
```

### What This Means Practically

| If you build only... | The app becomes... |
|----------------------|-------------------|
| Pillar 1 (Persistence) | A reliable, auditable TDR system with history |
| Pillars 1 + 2 (+ Intelligence) | A context-rich TDR tool that knows the account |
| Pillars 1 + 2 + 3 (+ Chat) | An AI-assisted TDR workflow where you never leave the app |
| Pillars 1–4 (+ Cortex) | A strategic platform that generates insights across all deals |
| All 5 Pillars | A self-improving deal intelligence system that gets smarter with every review |

Each row is a valid stopping point. The app works and delivers value at every increment. But each pillar makes the next one exponentially more powerful.

---

*This document is a living strategy. Update it as decisions are made and phases are completed.*

