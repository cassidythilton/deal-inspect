# TDR Deal Inspection — Implementation Strategy

> Account Intelligence, Snowflake Persistence, Cortex AI, and Inline TDR Chat

**Status:** In Progress · **Version:** Draft 3.8 · **Date:** February 10, 2026 · **Sprints Completed:** 1, 2, 3, 4, 5, 5.5, 6, 6.5, 7, 8, 9, 10, 11, 12, 13, 17, 17.5, 17.6, 18

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
20. [Solution Strategy Summary — The Six Pillars](#20-solution-strategy-summary--the-six-pillars)
21. [TDR Readout: Executive PDF & Distribution](#21-tdr-readout-executive-pdf--distribution)

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

### Sprint 6.5 — Sumble Deep Intelligence Expansion ✅ *(completed 2026-02-09)*

> **Goal:** Expand Sumble integration from basic tech enrichment (Tier 1) to a multi-tiered intelligence model using Organizations Find, Jobs Find, and People Find endpoints. Each tier provides progressively deeper insight into the account, mapped directly to TDR framework steps and scoring factors.
> **Risk to app:** None — new buttons in existing Intelligence panel. Existing enrich flow unchanged.
> **Dependencies:** Sprint 6 (intel infrastructure)
> **Credit sensitivity:** HIGH — each tier consumes Sumble credits. All calls user-initiated. Credit counters displayed.

**Rationale — Why This Matters for TDR:**
The current Enrich endpoint answers *"What technologies do they use?"* — but TDR requires deeper context:
- **Organizations Find** answers *"How big are they, what industry, and how deeply do they use each technology?"*
- **Jobs Find** answers *"What are they actively building, hiring for, and investing in?"* (the most honest signal of technology strategy)
- **People Find** answers *"Who are the technical champions, evaluators, and decision-makers?"*

These map directly to TDR Framework sections: Deal Context (§1), Business Decision (§2), Current Architecture (§3), Target Architecture (§4), Partner Alignment (§6), AI Strategy (§7), Technical Risk (§8), and Usage & Adoption (§9). See §8.1 for full mapping.

**Snowflake DDL:**
- [x] Create `ACCOUNT_INTEL_SUMBLE_ORG` table (firmographic data)
- [x] Create `ACCOUNT_INTEL_SUMBLE_JOBS` table (job posting intelligence)
- [x] Create `ACCOUNT_INTEL_SUMBLE_PEOPLE` table (key person data)

**Code Engine Functions:**
- [x] `enrichSumbleOrg(opportunityId, accountName, domain, calledBy)` → calls `POST /v3/organizations/find`, stores in `ACCOUNT_INTEL_SUMBLE_ORG`
- [x] `enrichSumbleJobs(opportunityId, accountName, domain, calledBy)` → calls `POST /v3/jobs/find` scoped to org domain, stores in `ACCOUNT_INTEL_SUMBLE_JOBS`
- [x] `enrichSumblePeople(opportunityId, accountName, domain, calledBy)` → calls `POST /v3/people/find` scoped to org domain, stores in `ACCOUNT_INTEL_SUMBLE_PEOPLE`
- [x] Update `getLatestIntel` to also return latest org, jobs, and people data
- [ ] Update `getIntelHistory` to include org/jobs/people pull history (deferred — current history dialog is functional)
- [x] Add `packageMapping` entries for all 3 new functions in `manifest.json` (v1.30.0)

**Frontend — Intelligence Panel Expansion:**
- [x] Add tiered enrichment buttons in TDRIntelligence panel:
  - "Enrich Tech Stack" (existing Tier 1 — unchanged)
  - "Profile" → fires Tier 2 (org firmographics)
  - "Hiring" → fires Tier 3 (job postings)
  - "People" → fires Tier 4 (people)
- [x] Organization Profile section: industry, employee count, HQ location, LinkedIn link, tech adoption depth (people/teams/jobs counts per technology)
- [x] Hiring Signals section: hiring velocity indicator (emerald high / amber moderate / slate low), competitive technology job posts flagged in red, AI/ML job posts highlighted, top roles and key project descriptions
- [x] Key People section: list of matched individuals with title, department, seniority, LinkedIn links, and technology associations
- [x] Credit consumption displayed after each call: "Used 45 credits · 1,230 remaining"
- [ ] Update "View Research History" dialog to include org/jobs/people pull history (deferred)

**TDR Scoring Integration (prep for Sprint 10):**
- [x] Data is persisted in Snowflake tables for scoring factors to consume
- [ ] Wire scoring factors (`strategicAccount`, `verticalDepth`, `hiringMomentum`, `deepTechAdoption`, `competitorConfirmed`, `aiInvestmentSignal`) into `calculateTDRScore` — requires reading from deep intel tables in Code Engine scoring function (deferred to post-sprint enhancement)

**Testing:**
- [ ] Test: Tier 2 (org) for a known company → verify industry, employee count, tech depth displayed correctly
- [ ] Test: Tier 3 (jobs) for a company with active hiring → verify job count, competitive signals, hiring velocity indicator
- [ ] Test: Tier 4 (people) for a company with known tech people → verify name, title, technologies displayed
- [ ] Test: Credit counters update after each tier call
- [ ] Test: All 3 new data types appear in Research History dialog with correct timestamps

**Implementation Details:**
- **Code Engine:** 3 new functions in `consolidated-sprint4-5.js`: `enrichSumbleOrg` (organizations/find), `enrichSumbleJobs` (jobs/find), `enrichSumblePeople` (people/find). Each function persists raw response + structured summary to its own Snowflake table, logs API usage, and handles errors gracefully.
- **getLatestIntel expanded:** Now runs 5 parallel queries (Sumble + Perplexity + Org + Jobs + People) with `.catch()` fallbacks for tables that don't exist yet (graceful degradation).
- **Frontend service:** `accountIntel.ts` extended with 3 new types (`SumbleOrgData`, `SumbleJobData`, `SumblePeopleData`), 3 new methods, and dev-mode mock data.
- **UI:** Three-column button row appears after Tier 1 enrichment succeeds. Each tier renders its own collapsible section: Organization Profile (firmographics grid + tech adoption depth), Hiring Signals (velocity badge + competitive/AI signals + job listings), Key People (person cards with avatar, title, department, technologies, LinkedIn).
- **Credit visibility:** Each section footer shows "Used X credits · Y remaining" from the Sumble response.
- **Jobs intelligence:** Hiring velocity computed from posts in last 90 days (≥10 = high, ≥5 = moderate, <5 = low). Competitive tech and AI/ML tech automatically flagged from matched technologies.

**Files Modified:**
- `sql/bootstrap.sql` — Added 3 tables: `ACCOUNT_INTEL_SUMBLE_ORG`, `ACCOUNT_INTEL_SUMBLE_JOBS`, `ACCOUNT_INTEL_SUMBLE_PEOPLE`
- `codeengine/consolidated-sprint4-5.js` — Added `enrichSumbleOrg`, `enrichSumbleJobs`, `enrichSumblePeople` functions; expanded `getLatestIntel` to include deep intel; updated version to 1.30.0
- `manifest.json` — Added 3 new `packageMapping` entries; version bumped to 1.30.0
- `src/lib/accountIntel.ts` — Added `SumbleOrgData`, `SumbleJobData`, `SumblePeopleData` interfaces; extended `AccountIntelligence`; added 3 enrichment methods with mock data
- `src/components/TDRIntelligence.tsx` — Added state, handlers, and UI for 3 deep intelligence tiers (org profile, hiring signals, key people)

**Definition of Done:** ✅ The SE Manager can progressively drill into an account's firmographics, hiring patterns, and key people — all from within the TDR Intelligence panel. Each depth tier is an explicit user action. All results persist to Snowflake with full iteration history. Credit consumption is visible and tracked.

---

### Sprint 7 — Cortex AI: Deal-Level Intelligence ✅ *(completed 2026-02-10)*

> **Goal:** AI-generated TDR briefs, auto-classified findings, entity extraction.
> **Risk to app:** None — new features behind buttons.

- [x] Deploy `generateTDRBrief`, `classifyFindings`, `extractEntities`, `getLatestBrief` to Code Engine
- [x] Add `packageMapping` entries to `manifest.json` (4 entries: `generateTDRBrief`, `classifyFindings`, `extractEntities`, `getLatestBrief`)
- [x] Create `src/lib/cortexAi.ts` front-end service with dev-mode mocks
- [x] Add "Generate TDR Brief" button to TDR Intelligence panel → renders structured brief (executive summary, risks, recommendations)
- [x] Auto-classify Perplexity findings after each research pull → color-coded category badges in UI
- [x] Auto-extract entities after each research pull → competitor names, technologies, and executives displayed
- [x] Store all Cortex outputs in `CORTEX_ANALYSIS_RESULTS` via Code Engine
- [x] Pass `sessionId` from `TDRWorkspace.tsx` → `TDRIntelligence.tsx` for Cortex calls
- [x] Sync `dist/manifest.json` and production build
- [x] Brief persistence: cached brief loads on app reload → "View TDR Brief" / "Regenerate" workflow
- [x] Markdown rendering for AI-generated TDR briefs (bold, italic, lists, newlines)
- [x] "Perplexity Research" button clearly labeled with icon and subtitle
- [x] Updated Cortex model from `llama3.1-70b` → `llama3.3-70b` for improved brief quality
- [x] Test: generate brief → reload app → button shows "View TDR Brief" ✅
- [x] Test: classified findings show distinct categories ✅

**Implementation Details:**
- **Code Engine:** Added `generateTDRBrief` (AI_COMPLETE joining sessions + inputs + intel), `classifyFindings` (AI_CLASSIFY on Perplexity KEY_INSIGHTS), `extractEntities` (AI_EXTRACT on Perplexity prose), `getLatestBrief` (cached brief retrieval) — all with `CORTEX_ANALYSIS_RESULTS` persistence.
- **Also added (future sprints):** `getPortfolioInsights` (AI_AGG), `summarizeIntelHistory` (AI_SUMMARIZE_AGG), `findSimilarDeals` (AI_EMBED + AI_SIMILARITY), `getSentimentTrend` (AI_SENTIMENT), `askAnalyst` (Cortex Analyst).
- **Frontend service:** `cortexAi.ts` wraps Code Engine calls with dev-mode mock data for local development.
- **UI:** Three new collapsible sections in Intelligence panel — AI Brief (markdown-rendered), Classified Findings (category badges), Extracted Entities (pills for competitors, technologies, executives).

**Bugs Fixed During Sprint 7:**
1. **`PARSE_JSON` in `VALUES` clause** — Snowflake doesn't allow `PARSE_JSON()` inside `INSERT INTO ... VALUES(...)`. The `generateTDRBrief` INSERT was silently failing. Fixed by changing to `INSERT INTO ... SELECT` pattern (consistent with Sumble/Perplexity INSERTs).
2. **`sfTimestampToISO` scope bug** — The timestamp helper was defined as a local function inside `getLatestIntel()` but was also referenced by `getLatestBrief()`. This caused a `ReferenceError` when retrieving cached briefs. Fixed by promoting `sfTimestampToISO` to a top-level utility function.
3. **`CORTEX_ANALYSIS_RESULTS` table** — Table existed in `sql/bootstrap.sql` but needed to be verified/created in Snowflake. Confirmed via Cortex CLI.

**Definition of Done:** AI generates actionable TDR briefs grounded in real account intelligence. Briefs persist to Snowflake and reload without re-generation. Findings are automatically categorized and entities extracted.

---

### Sprint 8 — TDR Inline Chat ✅

> **Goal:** Embed a multi-provider, context-aware conversational AI in the TDR Workspace. The manager picks their preferred LLM (Cortex, Perplexity, or Domo) and model, asks questions about the deal — and the AI answers with full context.
> **Risk to app:** None — new panel in existing workspace. All existing functionality untouched.

**Provider & Model Infrastructure:**
- [x] Deploy `sendChatMessage`, `getChatHistory` Code Engine functions with multi-provider routing (Cortex, Perplexity, Domo) — consolidated into `codeengine/consolidated-sprint4-5.js`
- [x] Add `packageMapping` entries for both functions in `manifest.json` (v1.28.0)
- [x] Chat functions consolidated into `codeengine/consolidated-sprint4-5.js` (no separate `chat.js` needed)
- [x] Define `LLMProvider` and `LLMModel` registry in `src/config/llmProviders.ts` (3 providers, extensible)
- [x] Cortex: 5 models (llama3.3-70b, llama3.1-405b, mistral-large2, claude-3-5-sonnet, snowflake-arctic)
- [x] Perplexity: 2 models (sonar-pro, sonar)
- [x] Domo AI: 1 model (domo-default, no selection needed)

**Front-End Chat UI:**
- [x] Create `src/lib/tdrChat.ts` — front-end service for chat orchestration + context assembly (multi-provider routing, Domo AI direct frontend call, Cortex/Perplexity via Code Engine)
- [x] Build `src/components/TDRChat.tsx` — chat panel component (message list, auto-resize input, provider/model dropdowns, send button, suggestion chips, markdown rendering, citation links)
- [x] Integrate chat panel as a tab in the TDR Workspace right panel: [🧠 Intelligence] [💬 Chat]
- [x] Provider selector dropdown: ❄️ Cortex | 🔍 Perplexity | 🤖 Domo — remembers last selection
- [x] Model selector dropdown: appears next to provider, shows available models with cost tier badges. Hidden for Domo (single model).
- [x] Provider badge on each assistant message with color-coded styling (cyan for Cortex, violet for Perplexity, amber for Domo)

**Context & Behavior:**
- [x] Implement context assembly in Code Engine: gathers deal info, TDR inputs, cached Sumble/Perplexity intel, current step → system prompt
- [x] Persist all messages to `TDR_CHAT_MESSAGES` with `PROVIDER` + `MODEL_USED` + `TOKENS_IN/OUT` + `CITED_SOURCES`
- [x] Load chat history on session open via `getChatHistory`; display provider badges on historical messages
- [x] Step-aware input placeholder: varies by provider + shows current context step
- [x] Contextual suggestion chips: "Summarize deal risks", "Competitive positioning", "Technical fit analysis", "Next steps"
- [x] Perplexity responses show clickable citation URLs (numbered source links)
- [x] Token usage counter in header: running total of tokens consumed in session
- [ ] Rate limit: 30 msgs/day overall, 10/day for Perplexity (configurable) — deferred to Sprint 9

**Settings:**
- [ ] Add chat settings to Settings page: default provider, default Cortex model, daily limits, enabled providers — deferred to Sprint 9

**Testing:**
- [ ] Test: select Cortex + llama3.3-70b → ask "What BI tools does this account use?" → get answer citing Sumble data
- [ ] Test: switch to Perplexity + sonar-pro → ask about current events → get response with citations
- [ ] Test: switch to Domo → ask about TDR methodology → get methodology guidance
- [ ] Test: close workspace, reopen → chat history persists with provider badges

**Files Created/Modified:**
- `src/config/llmProviders.ts` — Provider & model registry (3 providers, 8 models, cost tiers)
- `src/lib/tdrChat.ts` — Frontend chat service (multi-provider routing, mock dev mode, Code Engine integration)
- `src/components/TDRChat.tsx` — Full chat UI (messages, input, dropdowns, suggestion chips, markdown, citations, token counter)
- `src/pages/TDRWorkspace.tsx` — Added Tabs component for Intelligence/Chat switching
- `codeengine/consolidated-sprint4-5.js` — Added `sendChatMessage` + `getChatHistory` + `mapChatMessageRow`
- `manifest.json` — Added `sendChatMessage` (9 params) + `getChatHistory` (1 param) package mappings
- `sql/bootstrap.sql` — `TDR_CHAT_MESSAGES` table (already present from schema design)

**UI Polish (completed Feb 9, 2026):**
- Replaced all emoji icons (❄️🔍🤖🧠💬) with Lucide interface icons (`Snowflake`, `Search`, `Cpu`, `Brain`, `MessageSquare`)
- Chat message rendering now matches TDR Brief typography: `text-xs`, `text-slate-400`, `leading-relaxed`, proper `<ul>/<li>` lists, heading support, inline code rendering
- Tightened entire chat layout: compact dropdowns, smaller avatars, refined spacing
- Provider badges use icon components with color-coded borders (cyan/violet/amber)

**Definition of Done:** SE Manager can have a multi-turn, context-aware conversation with their choice of 3 LLM providers and 8 models. Chat persists with full provider/model attribution. Adding a new provider in the future is a ~30-minute task.

---

### Sprint 9 — Cortex AI: Portfolio & Sentiment ✅ *(completed 2026-02-09)*

> **Goal:** Cross-deal portfolio analysis, intelligence evolution summaries, sentiment tracking.
> **Risk to app:** None — new features on existing pages.

- [x] Deploy `getPortfolioInsights`, `summarizeIntelHistory`, `getSentimentTrend` to Code Engine
- [x] Add `packageMapping` entries (3 entries in manifest.json v1.29.0)
- [x] Add "Portfolio Insights" card to Command Center → AI-generated analysis across all manager's TDR sessions (expandable, markdown rendered)
- [x] Add "Intelligence Evolution" dialog to TDR Intelligence panel (visible when intel exists, uses AI_SUMMARIZE_AGG)
- [x] Add sentiment trend mini-chart to TDR Intelligence panel (bar per iteration, color-coded emerald/amber, trending arrow)
- [x] Frontend service: `cortexAi.ts` extended with 3 new methods + TypeScript types + dev-mode mocks
- [x] Test: manager with 5+ TDR sessions → portfolio insights identify patterns across deals
- [x] Test: account researched 3 times → evolution summary describes what changed

**Implementation Details:**
- **Code Engine:** Added 3 functions to `consolidated-sprint4-5.js`: `getPortfolioInsights` (AI_AGG), `summarizeIntelHistory` (AI_SUMMARIZE_AGG), `getSentimentTrend` (AI_SENTIMENT). All functions use existing Snowflake tables — no new DDL required.
- **Portfolio Insights:** New card in Command Center between charts and deals table. "Analyze Portfolio" button triggers AI_AGG across all manager's TDR sessions joined with Sumble + Perplexity data. Expandable/collapsible with simple markdown rendering.
- **Intelligence Evolution:** Dialog in TDR Intelligence panel. "Intelligence Evolution" button (BookOpen icon, cyan) shows how account intelligence changed across research pulls. Uses AI_SUMMARIZE_AGG on `ACCOUNT_INTEL_PERPLEXITY` table.
- **Sentiment Trend:** Mini bar chart in TDR Intelligence panel. Each bar represents one TDR iteration, scored -1 to +1 via AI_SENTIMENT on concatenated step inputs. Color: emerald for positive, amber for negative. Trailing trending arrow.

**Definition of Done:** Manager gets AI-powered portfolio view. Deal health trends are visible over time. ✅

---

### Sprint 10 — TDR Scoring Enrichment ✅ *(completed 2026-02-09)*

> **Goal:** Intelligence data feeds into TDR scoring and Domo AI prompt. Deal type (New Logo vs Upsell) becomes a first-class scoring dimension with type-specific TDR guidance aligned to the TDR Framework.
> **Risk to app:** Moderate — modifies existing scoring logic. Test carefully.

**Intelligence-Enriched Factors** *(partial — intel-based factors deferred to after Sprint 6.5)*
- [ ] Add `techStackOverlap` critical factor to `tdrCriticalFactors.ts` (Tier 2, 10 pts — needs Sprint 6.5 Sumble deep intel)
- [ ] Add `strategicMomentum` critical factor (Tier 2, 8 pts — needs Sprint 6.5 Perplexity strategic initiative data)
- [ ] Enhance existing factor tooltips with intel validation (e.g., "Confirmed via Sumble: Account runs Snowflake")
- [x] Enrich Domo AI prompt payload in `domoAi.ts` with deal type context and type-specific guidance
- [x] Add enrichment indicators to DealsTable: new "Why TDR?" pills for deal-type factors (`upsellExpansion`, `newLogoRisk`)
- [ ] TDR Score tooltip notes when enrichment data contributed to the score (deferred to Sprint 6.5)

**Deal Type Scoring Enrichment (New Logo vs Upsell)** ✅

Per the [TDR Framework](samples/TDR%20Framework.pdf), deal type fundamentally changes the TDR posture:

| Dimension | New Logo | Upsell / Expansion |
|-----------|----------|-------------------|
| **Architecture review** | Full review required — no existing relationship or integration baseline | Incremental review — existing architecture known, focus on expansion delta |
| **Competitive risk** | High — incumbent competitor has full relationship | Lower — Domo already in place, defend and expand |
| **Partner alignment** | Must establish — "How would a Snowflake architect describe this?" (§6) | May already exist — validate partner posture hasn't shifted |
| **Current usage** (§9) | N/A — no existing usage | Critical — connectors, products, adoption signals inform expansion strategy |
| **AI/Agentic scope** (§7) | Greenfield opportunity — can position Agent Catalyst early | Expansion play — layer AI on existing data estate |
| **Stakeholder complexity** | Unknown org chart — "Who owns this architecture internally?" (§1) | Known relationships — focus on new buying center for expansion module |

Scoring adjustments:
- [x] Refine component 5 (Deal Type Signal) in `calculateTDRScore` (now 0-23 max):
  - **New Logo** (10 pts base + bonuses):
    - +3 pts if `numCompetitors > 0` (displacement scenario per §8)
    - +2 pts if `stageNum ≤ 2` (early shaping window for greenfield per §3/§4)
    - +8 pts if `numCompetitors ≥ 1 OR stageAge > 60` (New Logo Risk — facing hurdles early)
  - **Upsell** (3 pts base → context-dependent):
    - 6 pts if `acv ≥ 100K` (material expansion worth reviewing)
    - +2 pts if `hasCloudPartner` (partner expansion alignment per §6)
- [x] Add new critical factor `newLogoRisk` (Tier 1, 8 pts):
  - Fires when: `dealType = 'New Logo'` AND (`numCompetitors ≥ 1` OR `stageAge > 60`)
  - Label: "New Logo at Risk" / dynamic labels: "New + competitive", "New logo at risk"
  - Full tdrPrep guidance for competitive pressure, stalling, and differentiation
- [x] Add new critical factor `upsellExpansion` (Tier 2, 6 pts):
  - Fires when: `dealType = 'Upsell'` or `dealType = 'Expansion'`
  - Label: "Upsell Expansion" / dynamic: "Material upsell" when ACV ≥ $100K
  - Full tdrPrep guidance for expansion validation, partner re-alignment, current usage review
- [x] Update `detectCriticalFactors` to include type-specific factors in "Why TDR?" pills
- [x] `getDynamicFactorLabel` and `getDynamicFactorDescription` in `DealsTable.tsx` — context-sensitive labels/descriptions for `upsellExpansion` and `newLogoRisk`
- [x] Domo AI prompt enhancement: detailed New Logo vs Upsell guidance in SYSTEM_PROMPT, `dealType` field added to payload

**Tests**
- [x] Test: New Logo deal with competitor → `newLogoRisk` pill appears, score increases by 8+
- [x] Test: Upsell deal with high ACV → `upsellExpansion` pill appears, score reflects expansion value
- [ ] Test: deal with competitive tech in Sumble → `techStackOverlap` pill appears (deferred to Sprint 6.5)
- [x] Test: Domo AI recommendations reference deal type context (new logo vs expansion)

**Definition of Done:** TDR scores incorporate deal type context. New logos and upsells receive type-appropriate scoring, "Why TDR?" tags, and AI recommendations aligned to the TDR Framework's guidance for each deal posture. ✅ *(intel-based factors deferred to after Sprint 6.5 provides the enrichment data)*

---

### Sprint 11 — Semantic Search & Analyst ✅ *(completed 2026-02-09)*

> **Goal:** Search across all stored intelligence. Ask questions in natural language.
> **Risk to app:** None — new features on new UI elements.

- [x] Merge `findSimilarDeals`, `askAnalyst` into consolidated Code Engine file
- [x] Add `packageMapping` entries (manifest v1.31.0)
- [x] Build frontend service methods in `cortexAi.ts` (types, mocks, API methods)
- [x] Add "Similar Deals" section to Intelligence panel → shows deals with comparable tech profiles (AI_EMBED + AI_SIMILARITY)
- [x] Add "Ask TDR" query bar to Command Center → natural language questions → AI-generated SQL → table results + natural language answer
- [ ] (Stretch) Build Cortex Analyst semantic model YAML over TDR tables (deferred — using AI_COMPLETE text-to-SQL fallback)
- [ ] (Stretch) Set up Cortex Search service over intel + TDR notes (deferred)
- [ ] Test: find similar deals for an enriched account → results show relevant matches
- [ ] Test: ask "Which accounts have Snowflake but no TDR?" → get accurate results

**Implementation Details:**
- **`findSimilarDeals`:** Uses `AI_EMBED('e5-base-v2')` to build vector embeddings from Perplexity + Sumble enrichment data per deal, then `AI_SIMILARITY` to compare against all other enriched deals. Returns top 5 matches with similarity scores. Requires at least one Perplexity research pull on the source deal and at least one other enriched deal.
- **`askAnalyst`:** Uses `AI_COMPLETE('llama3.3-70b')` as a text-to-SQL engine (fallback until a formal Cortex Analyst semantic model is deployed). Receives a natural language question, generates a SELECT query against TDR tables, executes it, then generates a natural language answer from the results. Safety: only SELECT statements are executed; INSERT/UPDATE/DELETE are rejected.
- **Similar Deals UI:** Added to Intelligence panel after Sentiment Trend. Shows a list of matched accounts with similarity percentage bars and a target icon if the matched deal has a TDR session.
- **Ask TDR UI:** Full-width query bar in Command Center (Zone 4) between Portfolio Insights and the Deals Table. Features: text input with Enter-to-submit, suggestion chips for common queries, expandable results panel with natural language answer + collapsible SQL + data table (max 20 rows).

**Files Modified:**
- `codeengine/consolidated-sprint4-5.js` — Added `findSimilarDeals` and `askAnalyst` functions; added `embed` model to `CORTEX_MODELS`; version → 1.31.0
- `manifest.json` — Added 2 new `packageMapping` entries; version → 1.31.0
- `src/lib/cortexAi.ts` — Added `SimilarDeal`, `SimilarDealsResult`, `AnalystResult` types; mock data; 2 new public API methods
- `src/components/TDRIntelligence.tsx` — Added Similar Deals section with state, handler, and UI
- `src/pages/CommandCenter.tsx` — Added Ask TDR query bar with state, handler, suggestion chips, and expandable results panel

**Definition of Done:** ✅ Manager can find similar deals and ask questions about their portfolio in plain English.

---

### Sprint 12 — Migration & Cleanup ✅ *(completed 2026-02-09)*

> **Goal:** Remove AppDB dependency. Snowflake is the single source of truth.
> **Risk to app:** Moderate — removes a persistence layer. Validate thoroughly.

- [x] Remove AppDB fallback from `useDomo.ts` `fetchTDRStatus` — Snowflake-only path
- [x] Simplify persistence check in `useTDRSession.ts` — removed `enableAppDB` branch
- [x] Remove `enableAppDB` from `AppSettings` interface and defaults in `appSettings.ts`
- [x] Remove AppDB toggle from Settings page; updated Snowflake persistence description
- [x] Mark `appDb.ts` as `@deprecated` — retained only for `TDRSession` type export used by `snowflakeStore.toAppDbSession()`
- [x] Updated `snowflakeStore.ts` header comment to reflect it's now the single persistence layer
- [x] Build succeeds; bundle size reduced by ~4KB from removing AppDB code paths
- [ ] (Stretch) Build one-time AppDB → Snowflake migration Code Engine function (not needed — all data already in Snowflake)
- [ ] (Stretch) Set up scheduled Cortex batch analysis via Snowflake Tasks (deferred)
- [ ] Final regression test: full TDR workflow end-to-end on Snowflake-only

**Files Modified:**
- `src/hooks/useDomo.ts` — Removed `appDb` import; removed AppDB fallback code path
- `src/hooks/useTDRSession.ts` — Simplified persistence check (Snowflake-only)
- `src/lib/appSettings.ts` — Removed `enableAppDB` from interface and defaults
- `src/pages/Settings.tsx` — Removed AppDB toggle; updated Snowflake persistence description
- `src/lib/appDb.ts` — Marked `@deprecated`; retained for type export only
- `src/lib/snowflakeStore.ts` — Updated header comment

**Definition of Done:** ✅ AppDB fully retired. All data lives in Snowflake. App is clean and future-proof.

---

### Sprint 13 — TDR Readout: Content Assembly & PDF Engine ✅ COMPLETE

> **Goal:** Generate a polished, executive-ready PDF that captures the entire TDR lifecycle as the canonical artifact of record.
> **Risk to app:** None — new export feature on existing workspace. No changes to existing data flows.
> **Completed:** February 10, 2026

**Content Assembly (Code Engine: `assembleTDRReadout`)**
- [x] Build Code Engine function that pulls ALL data for a session into one payload:
  - `TDR_SESSIONS` → session metadata, status, outcome, iteration
  - `TDR_STEP_INPUTS` → all user inputs, ordered by step
  - `ACCOUNT_INTEL_SUMBLE` → latest firmographic/technographic enrichment
  - `ACCOUNT_INTEL_PERPLEXITY` → latest research, citations, competitive landscape
  - `CORTEX_ANALYSIS_RESULTS` → TDR brief, classified findings, extracted entities
  - `TDR_CHAT_MESSAGES` → top 10 recent chat exchanges (shown in chronological order)
  - `ACCOUNT_INTEL_SUMBLE_ORG` → organization firmographics (industry, employees, HQ)
  - `ACCOUNT_INTEL_SUMBLE_JOBS` → hiring signals (job count, summary)
  - `ACCOUNT_INTEL_SUMBLE_PEOPLE` → key people (people count, summary)
- [x] Add `packageMapping` entry for `assembleTDRReadout` (input: `sessionId` string → output: object)
- [x] Function returns a `ReadoutPayload` object with all sections pre-structured and camelCase-normalized

**PDF Rendering Engine (Frontend)**
- [x] Install `@react-pdf/renderer` (code-split to ~524KB gzipped chunk, loaded only on export)
- [x] Create `src/components/pdf/readoutTypes.ts` — TypeScript interfaces for the readout payload
- [x] Create `src/components/pdf/TDRReadoutDocument.tsx` — root PDF `<Document>` component
- [x] Implement PDF page components with branded theming:
  - **Cover Page** — Account name, opportunity name, ACV, stage, status, iteration, owner, date, confidentiality notice
  - **§1 Executive Summary** — AI-generated narrative from cached TDR brief, with model attribution
  - **§2 Deal Context & Stakes** — All TDR step inputs grouped by step, in card format
  - **§3 Account Intelligence** — Org profile table, tech stack tags (categorized or flat), Perplexity research narrative with recent initiatives, competitive landscape, and citations
  - **§4 Risk Assessment & Classified Findings** — Findings table with category column
  - **§5 Extracted Entities** — Competitors, technologies, executives, timelines as tag groups
  - **§6 Hiring & People Signals** — Job count, people count from Sumble deep intelligence
  - **§7 AI Chat Highlights** — Curated user/assistant exchanges with provider/model attribution
  - **§8 Appendix — Generation Metadata** — Session ID, opportunity ID, generation date, input counts, intel sources, AI analysis summary
- [x] Implement branded theming system:
  - Configurable color palette (default: Domo purple `#6929C4` / deep navy `#1B1630` / cyan accent `#22D3EE`)
  - Inter font family (400, 600, 700 weights loaded from Google Fonts)
  - Consistent typography: section titles (14pt bold purple), subtitles (11pt semibold), body (10pt), captions (8pt muted)
  - Page headers: "CONFIDENTIAL — TDR Readout — {account}" + "Generated by TDR Deal Inspection"
  - Page footers: generation date + page number / total pages
- [x] Implement table rendering: org profile table, findings table, metadata table
- [x] Implement tag rendering: tech stack tags, entity tags in tag rows
- [x] Handle graceful degradation: sections with no data show italic "Not yet completed" placeholder
- [x] Handle long content: automatic page breaks via react-pdf, multi-paragraph brief with markdown detection (bold headers, bullet lists)

**UI Integration**
- [x] Add "Export PDF" button to TDR Workspace header (next to session status)
  - Icon: `FileDown` from Lucide (`outline` variant, 7px height)
  - Shows `Loader2` spinner during assembly + render
  - Disabled when session is local/fallback or missing
- [x] One-click download: `blob:` URL + programmatic `<a>` click → saves as `TDR-Readout-{Account}-{Date}.pdf`
- [x] Error handling: shows "Export failed" badge on error
- [x] Dynamic import of `@react-pdf/renderer` and `TDRReadoutDocument` to avoid initial bundle bloat

**Frontend Service (`src/lib/tdrReadout.ts`)**
- [x] `assembleReadout(sessionId)` — calls CE function in Domo, returns mock data in dev mode
- [x] `generatePDF(payload)` — dynamic import of react-pdf, renders document to blob
- [x] `downloadReadout(sessionId, accountName)` — one-click assemble + generate + download

**Snowflake Schema Additions**
- [x] `TDR_READOUTS` table — tracks every generated readout (readout_id, session_id, opportunity_id, generated_at, generated_by, file_name, file_size_bytes, included_sections, metadata)
- [x] `TDR_DISTRIBUTIONS` table — tracks distribution events (distribution_id, readout_id, distributed_at, distributed_by, channel_type, channel_target, summary_generated, summary_text)

**Files Changed:**
- `codeengine/consolidated-sprint4-5.js` — Added `assembleTDRReadout` function (lines 2099–2272)
- `manifest.json` — Added `assembleTDRReadout` package mapping; version bumped to `1.32.0`
- `src/components/pdf/readoutTypes.ts` — New: `ReadoutPayload`, `ReadoutSession`, `ReadoutInput`, `ReadoutSumble`, `ReadoutPerplexity`, `ReadoutBrief`, `ReadoutChatMessage`, `ReadoutOrgProfile`, `ReadoutHiringSignals`, `ReadoutKeyPeople`, `ReadoutTheme`, `DEFAULT_THEME`
- `src/components/pdf/TDRReadoutDocument.tsx` — New: Full PDF document component with cover page + 8 content pages
- `src/lib/tdrReadout.ts` — New: Frontend readout service with assemble, generate, download
- `src/pages/TDRWorkspace.tsx` — Added Export PDF button, `exportLoading` state, `handleExportReadout` handler
- `sql/bootstrap.sql` — Added `TDR_READOUTS` and `TDR_DISTRIBUTIONS` tables (tables 10–11)

**Definition of Done:** ✅ One-click PDF generation from TDR Workspace. The PDF tells a coherent executive-ready story from deal context through final recommendation. Every section is sourced from real persisted data. The readout is the canonical artifact of record — not a summary, not a snapshot. Code-split loading ensures the react-pdf library doesn't bloat the initial bundle.

---

### Sprint 14 — TDR Readout: Slack Distribution & Executive Summary ⏸ PAUSED

> **Goal:** Push TDR readouts to Slack channels with AI-generated summaries and PDF attachments.
> **Risk to app:** Low — new outbound integration. Slack API failure doesn't affect core app.
> **Decision:** Slack-only distribution (Teams evaluated and deferred). PDF attachment is a hard requirement.
> **Status:** Paused as of Feb 10, 2026. All prerequisite infrastructure (tables, readout assembly, PDF engine) is complete. Implementation is ready to resume when Slack integration is prioritized.

**Architecture: Slack Bot Token**
- Auth: Single Slack Bot Token (`xoxb-...`) stored in Domo Account (Account ID configured in CE)
- Required OAuth scopes: `chat:write`, `files:write`, `channels:read`
- Two-call pattern: `files.uploadV2` (upload PDF) → `chat.postMessage` (send Block Kit message with file permalink)
- Rate limits: 1 msg/sec per channel (well above our needs)

**AI Executive Summary Generation**
- [ ] Build Code Engine function `generateReadoutSummary`:
  - Input: `sessionId` (string)
  - Uses `AI_COMPLETE` (Cortex) to generate a 3–5 sentence executive summary from the assembled readout data
  - Summary is structured: one sentence on deal context, one on key findings, one on recommendation, one on risk
  - Cached in `CORTEX_ANALYSIS_RESULTS` with `analysis_type = 'readout_summary'`
- [ ] Add `packageMapping` entry

**Slack Integration**
- [ ] Build Code Engine function `distributeToSlack`:
  - Input: `sessionId` (string), `channel` (string), `summary` (string), `pdfBase64` (string)
  - Step 1: Decode base64 → upload PDF via Slack `files.uploadV2` API
  - Step 2: Post rich Block Kit message via `chat.postMessage`:
    - Header: "TDR Readout: {Account Name}"
    - Section: AI-generated executive summary
    - Fields: ACV, Stage, Decision, Deal Type, Account Executive
    - Context: TDR Score, generated timestamp
    - Action: "View in TDR App" deep link button
    - File: attached PDF permalink
  - Step 3: Log distribution in `TDR_DISTRIBUTIONS`
- [ ] Build Code Engine function `getSlackChannels`:
  - Input: none (uses stored Bot Token)
  - Calls Slack `conversations.list` API to fetch available channels
  - Returns `{ channels: [{ id, name }] }` for the channel picker
- [ ] Add `packageMapping` entries for `distributeToSlack` and `getSlackChannels`
- [ ] Handle Slack API errors: channel not found, bot not in channel, rate limit, file too large (>1GB)

**Frontend UI**
- [ ] Add "Share to Slack" button next to "Export PDF" in workspace header (icon: `Share2` from Lucide)
- [ ] Share dialog (`TDRShareDialog.tsx`) with:
  - Auto-generated executive summary textarea (editable before send)
  - "Generate Summary" button to trigger AI summary via `generateReadoutSummary`
  - Channel picker dropdown (fetched from `getSlackChannels` CE function)
  - "Include PDF attachment" toggle (default: on, always on per requirement)
  - "Send to Slack" button with loading state and confirmation
- [ ] Post-distribution: toast notification with "Sent to #channel-name" confirmation
- [ ] Distribution history: small log showing past distributions (who, when, where) accessible from the dialog

**Settings Integration**
- [ ] Add "Slack" section to Settings page:
  - Connection status indicator (connected / not connected)
  - Default distribution channel (saved in Snowflake or localStorage)
  - Info text about required Slack App setup

**Snowflake Tables**
- `TDR_READOUTS` — already created in Sprint 13
- `TDR_DISTRIBUTIONS` — already created in Sprint 13 (tracks distribution_id, readout_id, method, channel, status, etc.)

**Tests**
- [ ] Test: generate summary → coherent 3–5 sentence overview
- [ ] Test: send to Slack → message appears in channel with correct Block Kit formatting
- [ ] Test: PDF attachment received in Slack → opens and renders correctly
- [ ] Test: distribution logged in `TDR_DISTRIBUTIONS`
- [ ] Test: error handling → bot not in channel shows helpful message
- [ ] Test: re-distribute same readout → new row in distribution log (not overwrite)

**New Code Engine Functions (3)**

| Function | Inputs | Output | Domo CE Types |
|----------|--------|--------|---------------|
| `generateReadoutSummary` | `sessionId` (string) | `{ success, summary, model, error }` (object) | Input: string, Output: object |
| `distributeToSlack` | `sessionId` (string), `channel` (string), `summary` (string), `pdfBase64` (string) | `{ success, messageTs, fileId, error }` (object) | Input: 4× string, Output: object |
| `getSlackChannels` | (none — uses stored token) | `{ success, channels: [{id, name}], error }` (object) | Input: none, Output: object |

**Definition of Done:** SE Manager can generate an executive-ready PDF and push it to Slack in under 10 seconds. The Slack message includes an AI-written summary that a VP can read without opening the PDF. The PDF is attached as a downloadable file. Every distribution is logged for audit.

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
| **6.5** | **Sumble Deep Intelligence Expansion** | ✅ Complete | Feb 9, 2026 | Sprint 6 | **Intelligence** |
| 7 | Cortex AI: Deal-Level | ✅ Complete | Feb 10, 2026 | Sprints 3 + 6 | AI |
| 8 | TDR Inline Chat | ✅ Complete | Feb 9, 2026 | Sprints 3 + 6 | Experience |
| 9 | Cortex AI: Portfolio & Sentiment | ✅ Complete | Feb 9, 2026 | Sprint 7 | AI |
| 10 | TDR Scoring Enrichment | ✅ Complete | Feb 9, 2026 | Sprints 6 + 6.5 | Scoring |
| 11 | Semantic Search & Analyst | ✅ Complete | Feb 9, 2026 | Sprints 7 + 8 | AI |
| 12 | Migration & Cleanup | ✅ Complete | Feb 9, 2026 | All above | Cleanup |
| **13** | **TDR Readout: PDF Engine** | ✅ Complete | Feb 10, 2026 | Sprints 3 + 7; enriched by 10 | **Artifact** |
| **14** | **TDR Readout: Slack Distribution** | ⏸ Paused | — | Sprint 13 | **Distribution** |
| **15** | **AG Grid Table, Deal Search & Filter Rethink** | 🔄 In Progress | — | None (frontend-only) | **UX** |
| **17** | **Lean TDR Refactor** | ✅ Complete | Feb 10, 2026 | Sprints 3 + 7 | **UX** |
| **17.5** | **Structured TDR Analytics Extraction Pipeline** | ✅ Complete | Feb 10, 2026 | Sprint 17 | **Analytics** |
| **17.6** | **TDR Portfolio Analytics Page + NLQ** | ✅ Complete | Feb 10, 2026 | Sprint 17.5 | **Analytics / UX** |
| **18** | **TDR Score v2 (Pre-TDR & Post-TDR)** | ✅ Complete | Feb 10, 2026 | Sprints 17.5 + 6.5 | **Scoring** |

**Post-Sprint Bug Fixes (Feb 10, 2026):**
- Fixed `getSentimentTrend` crash: `AI_SENTIMENT` returns NULL for sessions without inputs → `parseFloat(null)` → NaN → serialized as `null` in JSON → `.toFixed()` crash. Added null-filtering in handler and `?? 0` fallback at render.
- Fixed `askAnalyst` "not a SELECT" error: AI model returned preamble text before SQL. Added regex extraction to strip commentary and find the actual `SELECT`/`WITH` statement. Improved prompt to be more explicit. Added CTE (`WITH`) support.
- Fixed `askAnalyst` SQL compilation error with unexpected `"`: Same root cause as above — model output contains Snowflake-incompatible quoting. The preamble extraction fix resolves this.
- Removed Portfolio Insights and Ask TDR Analyst UI sections from Command Center (CE functions retained for future use).
- `findSimilarDeals` returns empty results as expected — requires multiple deals with Perplexity enrichment data to compare against. Not a bug.
- **Fixed Perplexity `RAW_RESPONSE` JSON escaping (Base64):** Perplexity responses containing special characters (newlines, quotes, unicode) caused Snowflake `DML operation failed: Error parsing JSON: unterminated string` errors. Updated `sqlJsonExpr()` in `consolidated-sprint4-5.js` (and `copiedDomoCEfunctions.js`) to Base64-encode JSON values using `TRY_PARSE_JSON(BASE64_DECODE_STRING('...'))` instead of raw string literals.
- **Fixed Sumble/Perplexity infinite retry loop:** When Sumble (422 — missing `organization`/`filters` fields due to outdated deployed CE function) or Perplexity (422 — JSON parse failure) returned errors, the frontend retried indefinitely on every React re-render. Added error state tracking (`sumbleError`, `perplexityError`) to `TDRIntelligence.tsx` to display errors to the user and prevent repeated attempts.
- **Code Engine file synchronization:** Identified that `copiedDomoCEfunctions.js` was significantly out of date compared to `consolidated-sprint4-5.js`. Synchronized all functions from Sprints 8, 6.5, 9, 11, 13, 17.5 including the `sqlJsonExpr` Base64 fix and `extractStructuredTDR` function. Going forward, `consolidated-sprint4-5.js` is the source of truth.

**Parallel tracks:** Sprints 2–3 (persistence) and 4–5 (intelligence) are independent tracks that converge at Sprint 6. Sprint 6.5 (Sumble deep intelligence) extends the intelligence track and feeds Sprint 10 (scoring enrichment). Sprints 7 and 8 (Cortex deal-level and inline chat) can also run in parallel — both depend on persistence + intelligence but not on each other. They converge again at Sprint 11 (search & analyst). Sprint 6.5 can run in parallel with 7/8. **Sprints 13–14 (TDR Readout)** have a hard dependency on Sprints 3 + 7 (both complete) and a soft enrichment dependency on Sprint 10 (scoring enrichment). The PDF engine can start immediately with graceful degradation for missing scoring data, but the §6 scoring section reaches full fidelity only after Sprint 10. Sprint 12 (migration) remains last.

```
Sprint 1 ──┬── Sprint 2 ── Sprint 3 ──┬── Sprint 7 ── Sprint 9 ──┐
            │                           │                          │
            ├── Sprint 4 ──┐            │                          ├── Sprint 11
            │               ├── Sprint 6 ┤                          │
            └── Sprint 5 ──┘      │      ├── Sprint 8 ─────────────┘
                                  │      │
                                  │      └── Sprint 6.5 ── Sprint 10
                                  │                              │
                                  │                    (enriches ▼)
                                  │      Sprint 3 + 7 ── Sprint 13 ── Sprint 14
                                  │                       (PDF Engine)  (Slack)
                                  │
                                  └──────────────────── Sprint 12 (last)

Sprint 17 ── Sprint 17.5 ──┬── Sprint 17.6 (Analytics + NLQ)
                            │
                            └── Sprint 18 (Score v2: Pre/Post-TDR)
```

---

### Sprint 15 — AG Grid Table, Deal Search & Filter Rethink 🔄

> **Goal:** Replace the static HTML deals table with an interactive AG Grid table, add a global deal search, and rationalize the TopBar filters by moving person-based filters into the grid columns.
> **Risk to app:** Low — frontend-only changes. No backend, Code Engine, or Snowflake changes.
> **Dependencies:** None — purely a UX upgrade on top of existing data pipeline.

**Problem Statement:**
1. The current `DealsTable` is a custom HTML `<table>` with fixed columns, no sorting, no column reordering, no pagination, and no inline filtering. With hundreds of deals, this is hard to navigate.
2. The TopBar has 6 filter controls (Quarter, Manager, SE Manager, SE/PoC, Priority, 3-tab view toggle). With AG Grid's built-in column-level sorting and filtering, 4 of these become redundant.
3. There is no way to search for a specific deal outside the current filter gates (ALLOWED_MANAGERS, Quarter, 365-day stage age cutoff).

**Solution:**

#### 1. AG Grid Table (replaces DealsTable)

Replace the HTML `<table>` with AG Grid Community (free, MIT license). Preserve all existing badge, pill, tooltip, and custom rendering.

**Column Plan (13 columns, ordered with people grouped together):**

| # | Column | Field | AG Grid Type | Sortable | Filterable | Cell Renderer | Notes |
|---|--------|-------|-------------|----------|------------|---------------|-------|
| 1 | Deal / Account | `account`, `dealName` | Custom | ✅ (account) | ✅ (text) | `DealAccountCell` | Account bold + deal subtitle + New/Upsell badge + intel icon |
| 2 | AE Manager | `owner` | Text | ✅ | ✅ (set filter — ALLOWED_MANAGERS) | Default | **Replaces TopBar Manager dropdown** |
| 3 | AE | `accountExecutive` | Text | ✅ | ✅ (text) | Default | Account Executive — currently hidden, now visible |
| 4 | SE Manager | `seManager` | Text | ✅ | ✅ (set filter) | Default | **Replaces TopBar SE Manager dropdown** |
| 5 | SE Team | `salesConsultant`, `pocSalesConsultant` | Custom | ✅ (SE name) | ✅ (text) | `SETeamCell` | **Two-line layout preserved** — SE on line 1, `PoC: {name}` on line 2. Replaces TopBar SE/PoC dropdown. |
| 6 | Stage | `stage`, `stageNumber` | Custom | ✅ (stage number) | ✅ (set filter) | `StageBadgeCell` | `[02] Discovery` badge + color + rich tooltip |
| 7 | Age | `stageAge` | Number | ✅ | ✅ (number range) | `AgeDaysCell` | Red/amber/default color coding |
| 8 | ACV | `acv` | Number | ✅ | ✅ (number range) | `CurrencyCell` | `$38.5K` / `$1.2M` formatting |
| 9 | TDR Score | `tdrScore` | Custom | ✅ | ✅ (number range) | `TDRScoreCell` | Colored circle badge + rich tooltip with factor breakdown. **Replaces TopBar Priority dropdown** — filter by score range directly. |
| 10 | TDRs | `tdrSessions` | Custom | ✅ (count) | No | `TDRDotsCell` | 5-dot indicator: completed/in-progress/empty |
| 11 | Partner | `partnerSignal` | Custom | ✅ | ✅ (set: strong/moderate/none) | `PartnerIconCell` | Dynamic icon per deal code + rich tooltip |
| 12 | Why TDR? | computed factors | Custom | No | No | `WhyTDRCell` | Factor pills with icons + rich tooltips |
| 13 | Action | — | Custom | No | No | `PinActionCell` | Pin button, pinned right |

**AG Grid configuration:**
- **Default sort:** TDR Score descending
- **Pagination:** 25 rows per page
- **Row click:** Navigate to `/workspace?deal={id}`
- **Row height:** 44px (matches current compact density)
- **Theme:** Custom `ag-theme-tdr` with CSS overrides to match existing design tokens
- **Suppress:** Default toolbar, status bar, context menu — clean, minimal appearance
- **Pinned column:** Action (right)

#### 2. TopBar Simplification

**Remove from TopBar (move into AG Grid columns):**
- ❌ Manager (AE Manager) dropdown → becomes "AE Manager" column filter
- ❌ SE Manager dropdown → becomes "SE Manager" column filter
- ❌ SE / PoC dropdown → becomes "SE Team" column filter
- ❌ TDR Priority dropdown → becomes "TDR Score" column filter + sort
- ❌ Three-tab view toggle (Recommended / Agenda / All Eligible) → "All Eligible" is now the default grid view; "Recommended" is the default sort; "Agenda" becomes a toggle

**Keep in TopBar:**
- ✅ Quarter multi-select — this is a *scope* control (which quarter's pipeline), not a column filter
- ✅ Agenda toggle — small pill button "Agenda · N pinned" to toggle between all deals and pinned-only

**Revised TopBar layout:**
```
┌──────────────────────────────────────────────────────────────────────────┐
│  [Quarter ▾ 2026-Q1]   [Agenda: 3 pinned ○]                       👤   │
└──────────────────────────────────────────────────────────────────────────┘
```

#### 3. Deal Search (grid-level)

**Location:** Toolbar row directly above the AG Grid, inside the same panel — *not* in the TopBar.

```
┌─── Deals Grid Section ──────────────────────────────────────────────────┐
│  🔍 Search all deals...  ⌘K                          Showing 247 deals │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  AG Grid                                                         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data source:** Full raw opportunities (~10K) — bypasses Quarter, ALLOWED_MANAGERS, and Stage Age filters
- **Searchable fields:** Account Name, Deal Name, Opportunity ID, AE name, SE name
- **Trigger:** 2+ characters → debounced fuzzy match (150ms)
- **Results:** Floating dropdown overlay, max 10 results. Each row: Account (bold), Deal name (muted), Stage badge, ACV, AE
- **Action:** Click → navigate to `/workspace?deal={id}`
- **Shortcut:** `⌘K` (Mac) / `Ctrl+K` (Windows) to focus

#### 4. Data Flow

```
fetchOpportunities()              →  ~8,476 deals (stage age ≤ 365)
                                      │
                    ┌─────────────────┤
                    ▼                 ▼
            rawDeals              baseDeals (ALLOWED_MANAGERS filter)
            (for search)               │
                                  Quarter filter (TopBar)
                                       │
                                  AG Grid (sort, column-filter, paginate)
                                       │
                                  Displayed rows
```

`useDomo` exposes `rawDeals` — all deals after `transformOpportunityToDeal()` but *before* the ALLOWED_MANAGERS gate — for the search to query.

**Files Changed:**

| File | Change |
|------|--------|
| `package.json` | Add `ag-grid-community`, `ag-grid-react` |
| `src/components/DealsTable.tsx` | **Rewrite** — AG Grid with 13 ColDefs + 8 custom cell renderers |
| `src/components/DealSearch.tsx` | **New** — Typeahead search with `⌘K` shortcut |
| `src/components/TopBar.tsx` | **Simplify** — remove 4 dropdowns + 3-tab toggle, keep Quarter + Agenda toggle |
| `src/pages/CommandCenter.tsx` | Remove `activeView`, SE filter state. Simplify to Quarter + Agenda toggle. Add search data pass-through. |
| `src/hooks/useDomo.ts` | Expose `rawDeals` for search |
| `src/index.css` | AG Grid CSS + `ag-theme-tdr` overrides |

**No backend changes.** No Code Engine, Snowflake, or manifest updates.

**Elegance preservation rules:**
1. Row height 44px, same typography scale (text-sm/xs/2xs)
2. Shadcn `<Tooltip>` in cell renderers — identical tooltips to current table
3. All badges, pills, and color coding rendered identically in cell renderers
4. Custom AG Grid theme removes all default chrome — no toolbar, no status bar, no column menu icons
5. Row hover matches current `group cursor-pointer` behavior
6. Grid panel uses same `panel` class as current `DealsTable` wrapper

**Definition of Done:** The table is interactive (sort, filter, paginate, resize columns), the search finds any deal regardless of filters, and the visual quality is indistinguishable from (or better than) the current table.

---

### Sprint 16 — Fix Similar Deals Vector Error ✅ COMPLETE

> **Goal:** Fix the `AI_SIMILARITY` function type mismatch that prevents "Find Similar Deals" from working.
> **Risk to app:** None — Code Engine fix only, no frontend changes.
> **Completed:** February 10, 2026

**Root Cause:**
The error `Invalid argument types for function 'AI_SIMILARITY_1024$V6': (VECTOR(FLOAT, 768), VECTOR(FLOAT, 768))` indicates a dimension mismatch. The Snowflake environment's `AI_SIMILARITY` function is typed for 1024-dimension vectors, but the `e5-base-v2` embedding model produces 768-dimension vectors. The function signature `AI_SIMILARITY_1024$V6` confirms this.

**Fix:**
Replace `AI_SIMILARITY(t.EMBEDDING, o.EMBEDDING)` with `VECTOR_COSINE_SIMILARITY(t.EMBEDDING, o.EMBEDDING)` in the `findSimilarDeals` Code Engine function. `VECTOR_COSINE_SIMILARITY` is dimension-agnostic — it accepts any matching vector pairs without requiring a specific dimension count.

**Changes:**

| File | Change |
|------|--------|
| `codeengine/consolidated-sprint4-5.js` | Replace `AI_SIMILARITY` → `VECTOR_COSINE_SIMILARITY` in `findSimilarDeals` SQL |

**Definition of Done:** `findSimilarDeals` returns similar deal results without SQL errors when an account has Perplexity/Sumble enrichment data.

**Post-Sprint 16 Fix — Sentiment Trend NULL Handling:**
- `getSentimentTrend` Code Engine function now checks for existing TDR inputs before calling `AI_SENTIMENT`, returns `noInputs: true` flag when no step data exists
- Frontend shows three distinct states: pre-click prompt, no-inputs message, and rendered sentiment bars
- Files changed: `codeengine/consolidated-sprint4-5.js`, `src/lib/cortexAi.ts`, `src/components/TDRIntelligence.tsx`

---

### Sprint 17 — Lean TDR Refactor ✅ COMPLETE

> **Goal:** Compress the 9-step TDR from a heavy documentation exercise into a 30-minute thinking exercise. 5 required sections, 4 optional/collapsible — same 9 underlying step IDs, just UI changes.
> **Completed:** February 10, 2026

**Design Philosophy:**
TDR is not a documentation exercise. It is a thinking exercise. Every required section answers one of five questions:
1. Do we understand why the customer is buying?
2. Do we respect the existing stack?
3. Is Domo positioned correctly as a composable component?
4. Are we aligned with partners?
5. Are we taking intelligent risk?

**Section Structure (maps to existing 9 step IDs):**

| Section | Required? | Maps to Existing Steps | Time Target | Core Question |
|---------|-----------|----------------------|-------------|---------------|
| **Thesis** (always-visible field) | ✅ Required | New field (top of workspace) | 1 min | "In one sentence: Why does Domo belong in this architecture?" |
| **0. Deal Context & Stakes** | ✅ Required | Step 1 (Context & Stakes) | 2-3 min | "Why is this deal worth technical inspection?" |
| **1. Business Decision** | ✅ Required | Step 2 (Business Decision) | 5 min | One sentence: "The customer is trying to decide X so they can Y." |
| **2. Architecture (Current + Target)** | ✅ Required | Steps 3+4 combined (Current Architecture + Target Architecture) | 8-10 min | "What architectural truth must we accept in this account?" |
| **3. Domo's Composable Role** | ✅ Required | Step 5 (Domo Role) | 10 min | Entry layer, in-scope, out-of-scope, why this composition makes sense now |
| **4. Risk & Next Steps** | ✅ Required | Step 9 (Usage & Adoption) repurposed | 5 min | Top 1-2 risks, 1 assumption that must be true |
| *Partner & AI Implications* | Optional | Step 6 (Partner Alignment) + Step 7 (AI Readiness) | — | Collapsed by default, expandable |
| *Usage & Adoption Detail* | Optional | Step 8 (Data Science) + Step 9 (Usage) | — | Deferred post-TDR |
| *Competitive Strategy* | Optional | Step 8 (Technical Risk) | — | Auto-populated from enrichment when available |

**UI Changes:**

1. **Thesis Field:** Always visible at the top of the TDR Workspace, above the step flow. Not a gating blocker (TDR proceeds regardless), but the first thing an SE sees and should fill.
2. **Required Steps:** Rendered as a linear flow (accordion or stepper). All 5 must be at least visited to mark TDR "complete."
3. **Optional Steps:** Collapsed section below the required flow. Label: "Additional Context (optional)". Each step expands on click. Greyed-out status dot until filled.
4. **Field Reduction within Required Steps:**
   - Business Decision: Compress to ONE primary textarea ("In one sentence, what is the customer trying to decide?") + optional supporting fields (metrics, timeline)
   - Architecture: Combine Current + Target into one flow with a "Current → Target" visual divider. Keep key fields (system of record, cloud platform, key integration). Remove verbose inventories.
   - Domo Role: Keep as-is — this is the TDR heart. Entry layer, in-scope layers, out-of-scope, why now.
   - Risk: Compress to Top 2 risks + 1 assumption. Remove full risk registers.
5. **Progress Indicator:** Required steps show green checkmarks. Optional show "+" icon.

**No Snowflake Schema Changes:**
- Same `TDR_STEP_INPUTS` table structure
- Same `stepSchemaVersion: 'v1'` — the 9 step IDs are unchanged
- Required vs. optional is purely a frontend concern

**Files Changed:**

| File | Change |
|------|--------|
| `src/pages/TDRWorkspace.tsx` | Add Thesis field, restructure step layout (required vs optional) |
| `src/components/TDRInputs.tsx` | Reclassify which fields are required vs optional, add "forcing questions" as placeholders |
| `src/lib/tdrSteps.ts` (or equivalent) | Define `REQUIRED_STEPS` vs `OPTIONAL_STEPS` mapping |
| `src/index.css` | Styles for collapsed optional section, thesis field prominence |

**Definition of Done:** TDR Workspace shows 5 required sections + collapsible optional section. Existing sessions load correctly. Thesis field is always visible. Total TDR time target: ~30 minutes.

**Implementation Summary:**

| File | Change |
|------|--------|
| `src/types/tdr.ts` | Added `required` and `coreQuestion` fields to `TDRStep` interface |
| `src/data/mockData.ts` | Reclassified 9 steps: 5 required (Context, Decision, Architecture, Domo Role, Risk & Verdict) + 4 optional (Target Detail, Partner & AI, AI Strategy, Usage). Added `coreQuestion` to each. Combined Current + Target Architecture into one required "Architecture" step. Renamed "Usage & Adoption" step to "Risk & Verdict" (repurposed). |
| `src/components/TDRSteps.tsx` | Rewritten: Required steps shown as primary list, optional steps in collapsible "Additional Context" section with chevron toggle. Progress bar tracks required steps only. Optional steps show `+` icon when incomplete. |
| `src/components/TDRInputs.tsx` | Lean field configs: Context (3 fields), Decision (3 fields, forcing question), Architecture (5 fields including system-of-record, cloud platform, architectural truth, target change), Domo Role (4 fields — entry layer, in-scope, out-of-scope, why now), Risk & Verdict (3 fields — top risks, key assumption, verdict dropdown). Added `hint` and `optional` field properties. Core Question banner rendered above fields. |
| `src/pages/TDRWorkspace.tsx` | Added always-visible Thesis bar between header and three-panel layout. Thesis field saves to Snowflake via `thesis::domo-thesis` key. Violet accent styling with italicized guidance text. |

---

### Sprint 17.5 — Structured TDR Analytics Extraction Pipeline ✅ COMPLETE

> **Goal:** Transform free-text TDR inputs into structured, queryable analytical data using Cortex AI extraction. Produce a flat one-row-per-session table that enables cross-deal analytics, trend detection, and portfolio-level reporting — without changing the SE-facing input experience.
> **Completed:** February 10, 2026
> **Risk to app:** None — purely additive. No changes to input flow, EAV storage, or existing UI.
> **Effort:** ~1 day
> **Dependencies:** Sprint 17 (lean TDR step schema must be stable)

**Problem Statement:**

TDR inputs are stored in an EAV (Entity-Attribute-Value) model:

```
SESSION_ID + STEP_ID + FIELD_ID → VARCHAR FIELD_VALUE
```

This is perfect for the app — flexible, append-only, schema-tolerant. But it's **terrible for analytics**. Today you cannot answer:
- "What % of TDRs cite Snowflake as the cloud platform?" (select field, but buried in EAV)
- "Which deals mention Sigma as a competitor?" (locked in free text across multiple fields)
- "What are the top 5 risks cited across all TDRs?" (free-text only, no normalization)
- "How many deals have Domo positioned as Data Integration vs. Embedded Analytics?" (select, but in EAV)
- "Which architectural patterns appear most often?" (free text, needs AI extraction)
- "Are there patterns in why Domo compositions succeed?" (free text, cross-session analysis)

**Two-Tier Extraction Strategy:**

| Tier | Source | Method | Fields |
|------|--------|--------|--------|
| **Tier 1: Direct** | Select/dropdown fields (already structured) | Direct read from `TDR_STEP_INPUTS` | `strategic-value`, `cloud-platform`, `entry-layer`, `timeline`, `partner-posture`, `ai-reality`, `verdict` |
| **Tier 2: Cortex AI** | Free-text textarea fields | Cortex `AI_COMPLETE` structured extraction prompt | Competitors, technologies, stakeholders, risk categories, use cases, architectural patterns, deal complexity |

**Current Field Inventory (what we're extracting from):**

| Step | Field ID | Type | Tier | Analytical Dimension |
|------|----------|------|------|---------------------|
| `context` | `strategic-value` | select | 1 | Strategic Value (High/Medium/Low) |
| `context` | `why-now` | textarea | 2 | Urgency drivers → classified by Cortex |
| `context` | `key-stakeholders` | text | 2 | Named stakeholders → extracted by Cortex |
| `decision` | `customer-goal` | textarea | 2 | Decision type → classified by Cortex |
| `decision` | `timeline` | select | 1 | Decision Timeline |
| `current-arch` | `system-of-record` | textarea | 2 | Named technologies → extracted by Cortex |
| `current-arch` | `cloud-platform` | select | 1 | Cloud Platform |
| `current-arch` | `arch-truth` | textarea | 2 | Architectural constraints → classified |
| `current-arch` | `target-change` | textarea | 2 | Migration pattern → classified |
| `domo-role` | `entry-layer` | select | 1 | Entry Layer |
| `domo-role` | `in-scope` | textarea | 2 | Domo use cases → extracted |
| `domo-role` | `out-of-scope` | textarea | 2 | Boundary definition → classified |
| `domo-role` | `why-composition` | textarea | 2 | Value proposition → extracted |
| `risk` | `top-risks` | textarea | 2 | Risk categories → classified |
| `risk` | `key-assumption` | textarea | 2 | Key assumptions → extracted |
| `risk` | `verdict` | select | 1 | Verdict |
| `partner` | `partner-name` | text | 1 | Partner Name (direct text) |
| `partner` | `partner-posture` | select | 1 | Partner Posture |
| `ai-strategy` | `ai-reality` | select | 1 | AI Maturity |
| `thesis` | `domo-thesis` | text | 1 | Thesis (stored as-is) |

**New Snowflake Table: `TDR_STRUCTURED_EXTRACTS`**

One flat row per TDR session — denormalized for analytical queries.

```sql
CREATE TABLE IF NOT EXISTS TDR_STRUCTURED_EXTRACTS (
  EXTRACT_ID           VARCHAR PRIMARY KEY,       -- UUID
  SESSION_ID           VARCHAR NOT NULL UNIQUE,    -- FK → TDR_SESSIONS (one extract per session)
  OPPORTUNITY_ID       VARCHAR NOT NULL,

  -- ═══ Tier 1: Direct from select/text fields ═══
  THESIS               VARCHAR,                   -- The one-liner thesis
  STRATEGIC_VALUE      VARCHAR,                   -- 'High' | 'Medium' | 'Low'
  CLOUD_PLATFORM       VARCHAR,                   -- 'Snowflake' | 'Databricks' | 'BigQuery' | etc.
  ENTRY_LAYER          VARCHAR,                   -- 'Data Integration' | 'Visualization / BI' | etc.
  DECISION_TIMELINE    VARCHAR,                   -- 'This Quarter' | 'Next Quarter' | '6+ Months'
  PARTNER_NAME         VARCHAR,                   -- Free-text partner name
  PARTNER_POSTURE      VARCHAR,                   -- 'Amplifying' | 'Neutral' | 'Conflicting' | 'None'
  AI_MATURITY          VARCHAR,                   -- 'Production today' | 'Piloting' | etc.
  VERDICT              VARCHAR,                   -- 'Proceed' | 'Proceed with Corrections' | 'Rework'

  -- ═══ Tier 2: Cortex AI extracted from free-text ═══
  NAMED_COMPETITORS    VARIANT,                   -- JSON array: ['Sigma', 'Tableau', 'Power BI']
  NAMED_TECHNOLOGIES   VARIANT,                   -- JSON array: ['Snowflake', 'dbt', 'Fivetran', 'Kafka']
  NAMED_STAKEHOLDERS   VARIANT,                   -- JSON array: [{ "name": "...", "role": "..." }]
  RISK_CATEGORIES      VARIANT,                   -- JSON array: ['competitive_displacement', 'integration_risk']
  DOMO_USE_CASES       VARIANT,                   -- JSON array: ['embedded analytics', 'MagicETL', 'app dev']
  ARCHITECTURAL_PATTERN VARCHAR,                  -- 'cloud-native' | 'hybrid' | 'on-prem-migration' | 'lakehouse' | 'warehouse-first' | 'data-mesh' | 'embedded'
  DEAL_COMPLEXITY      VARCHAR,                   -- 'Simple' | 'Moderate' | 'Complex'
  KEY_DIFFERENTIATORS  VARIANT,                   -- JSON array: ['governance layer', 'no-code integration', 'app platform']
  CUSTOMER_DECISION_TYPE VARCHAR,                 -- 'replace-existing' | 'greenfield' | 'augment-stack' | 'consolidate'
  URGENCY_DRIVERS      VARIANT,                   -- JSON array: ['contract renewal', 'exec mandate', 'compliance deadline']

  -- ═══ Metadata ═══
  EXTRACTION_MODEL     VARCHAR,                   -- 'claude-sonnet-4-5' | 'llama3.1-70b' | etc.
  EXTRACTION_VERSION   VARCHAR DEFAULT 'v1',      -- For re-extraction when prompt evolves
  EXTRACTED_AT         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  RAW_EXTRACTION       VARIANT                    -- Full Cortex response (for debugging/reprocessing)
);
```

**New Analytical View: `V_TDR_ANALYTICS`**

Joins the structured extracts with session metadata, Sumble, and Perplexity data for a single queryable analytical surface.

```sql
CREATE OR REPLACE VIEW V_TDR_ANALYTICS AS
SELECT
  -- Session context
  s.SESSION_ID,
  s.OPPORTUNITY_ID,
  s.ACCOUNT_NAME,
  s.OPPORTUNITY_NAME,
  s.ACV,
  s.STAGE,
  s.STATUS AS SESSION_STATUS,
  s.OUTCOME,
  s.OWNER AS AE_NAME,
  s.CREATED_BY AS SE_NAME,
  s.ITERATION,

  -- Structured TDR extracts (Tier 1 + Tier 2)
  e.THESIS,
  e.STRATEGIC_VALUE,
  e.CLOUD_PLATFORM,
  e.ENTRY_LAYER,
  e.DECISION_TIMELINE,
  e.VERDICT,
  e.PARTNER_NAME,
  e.PARTNER_POSTURE,
  e.AI_MATURITY,
  e.NAMED_COMPETITORS,
  e.NAMED_TECHNOLOGIES,
  e.NAMED_STAKEHOLDERS,
  e.RISK_CATEGORIES,
  e.DOMO_USE_CASES,
  e.ARCHITECTURAL_PATTERN,
  e.DEAL_COMPLEXITY,
  e.KEY_DIFFERENTIATORS,
  e.CUSTOMER_DECISION_TYPE,
  e.URGENCY_DRIVERS,

  -- Enrichment overlay
  sm.INDUSTRY AS SUMBLE_INDUSTRY,
  sm.EMPLOYEE_COUNT AS SUMBLE_EMPLOYEE_COUNT,
  sm.REVENUE AS SUMBLE_REVENUE,
  sm.TECHNOLOGIES AS SUMBLE_TECH_STACK,
  p.SUMMARY AS PERPLEXITY_SUMMARY,
  p.COMPETITIVE_LANDSCAPE AS PERPLEXITY_COMPETITORS,
  p.TECHNOLOGY_SIGNALS AS PERPLEXITY_TECH_SIGNALS,

  -- Temporal
  s.CREATED_AT AS TDR_STARTED,
  s.UPDATED_AT AS TDR_LAST_UPDATED,
  e.EXTRACTED_AT,
  DATEDIFF('day', s.CREATED_AT, s.UPDATED_AT) AS TDR_DURATION_DAYS

FROM TDR_SESSIONS s
LEFT JOIN TDR_STRUCTURED_EXTRACTS e ON s.SESSION_ID = e.SESSION_ID
LEFT JOIN (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY OPPORTUNITY_ID ORDER BY PULLED_AT DESC) AS rn
  FROM ACCOUNT_INTEL_SUMBLE
) sm ON s.OPPORTUNITY_ID = sm.OPPORTUNITY_ID AND sm.rn = 1
LEFT JOIN (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY OPPORTUNITY_ID ORDER BY PULLED_AT DESC) AS rn
  FROM ACCOUNT_INTEL_PERPLEXITY
) p ON s.OPPORTUNITY_ID = p.OPPORTUNITY_ID AND p.rn = 1;
```

**Example Analytical Queries (what this unlocks):**

```sql
-- 1. Cloud platform distribution across all TDRs
SELECT CLOUD_PLATFORM, COUNT(*) AS deals, SUM(ACV) AS total_acv
FROM V_TDR_ANALYTICS
WHERE SESSION_STATUS = 'completed'
GROUP BY CLOUD_PLATFORM ORDER BY total_acv DESC;

-- 2. Most common competitors
SELECT c.VALUE::VARCHAR AS competitor, COUNT(*) AS mentions
FROM V_TDR_ANALYTICS, LATERAL FLATTEN(input => NAMED_COMPETITORS) c
GROUP BY competitor ORDER BY mentions DESC;

-- 3. Domo entry layer × deal outcome
SELECT ENTRY_LAYER, VERDICT, COUNT(*) AS deals, AVG(ACV) AS avg_acv
FROM V_TDR_ANALYTICS
WHERE VERDICT IS NOT NULL
GROUP BY ENTRY_LAYER, VERDICT ORDER BY ENTRY_LAYER;

-- 4. Risk category frequency
SELECT r.VALUE::VARCHAR AS risk, COUNT(*) AS occurrences
FROM V_TDR_ANALYTICS, LATERAL FLATTEN(input => RISK_CATEGORIES) r
GROUP BY risk ORDER BY occurrences DESC;

-- 5. Deals with competitive displacement risk + high ACV
SELECT ACCOUNT_NAME, ACV, NAMED_COMPETITORS, VERDICT
FROM V_TDR_ANALYTICS
WHERE ARRAY_CONTAINS('competitive_displacement'::VARIANT, RISK_CATEGORIES)
  AND ACV > 50000
ORDER BY ACV DESC;

-- 6. Architectural pattern trends over time
SELECT DATE_TRUNC('month', TDR_STARTED) AS month,
       ARCHITECTURAL_PATTERN, COUNT(*) AS deals
FROM V_TDR_ANALYTICS
GROUP BY month, ARCHITECTURAL_PATTERN
ORDER BY month;
```

**New Code Engine Function: `extractStructuredTDR`**

```
extractStructuredTDR(sessionId)
```

**Logic:**
1. Fetch all latest step inputs for the session (reuse `getLatestInputs` SQL)
2. Fetch thesis value (stored as `thesis::domo-thesis`)
3. **Tier 1**: Read select field values directly from step inputs — no AI needed
4. **Tier 2**: Concatenate all free-text field values into a structured prompt
5. Call Cortex `AI_COMPLETE('claude-sonnet-4-5', prompt)` with a structured extraction prompt
6. Parse the JSON response
7. MERGE into `TDR_STRUCTURED_EXTRACTS` (upsert — re-extraction overwrites)

**Cortex Extraction Prompt:**

```
You are a data structuring assistant for Technical Deal Reviews (TDRs) at Domo, a data analytics platform.

Given the following TDR inputs from a Solutions Engineer, extract structured analytical fields.

TDR INPUTS:
{key: value pairs for all step fields}

DEAL METADATA:
Account: {accountName}, ACV: {acv}, Stage: {stage}

Extract ONLY what is explicitly mentioned. Return valid JSON with these fields:

{
  "namedCompetitors": ["company/product names competing with Domo"],
  "namedTechnologies": ["specific platforms, databases, tools, frameworks mentioned"],
  "namedStakeholders": [{"name": "...", "role": "..."}],
  "riskCategories": ["from: competitive_displacement, technical_complexity, timeline_pressure, resource_constraint, organizational_change, integration_risk, adoption_risk, pricing_risk, data_quality, security_compliance"],
  "domoUseCases": ["specific Domo capabilities: MagicETL, App Studio, Dashboards, Alerts, Governance, Writeback, etc."],
  "architecturalPattern": "one of: cloud-native, hybrid, on-prem-migration, lakehouse, warehouse-first, data-mesh, embedded, standalone",
  "dealComplexity": "one of: Simple, Moderate, Complex",
  "keyDifferentiators": ["what makes Domo win in THIS specific deal"],
  "customerDecisionType": "one of: replace-existing, greenfield, augment-stack, consolidate",
  "urgencyDrivers": ["what's creating time pressure"]
}

Rules:
- Only include items EXPLICITLY mentioned in the inputs
- If a field has no data, use [] for arrays or null for scalars
- For competitors, include both company and product names (e.g., "Sigma Computing", "Tableau")
- For technologies, be specific (e.g., "Snowflake" not "cloud data warehouse")
- Return ONLY the JSON object — no commentary, no markdown fences
```

**Trigger Points:**
1. **Auto-trigger**: When a TDR session status changes to `completed` (all required steps visited)
2. **Manual trigger**: "Extract Analytics" button in the TDR Workspace Intelligence panel
3. **Re-extraction**: If inputs change after initial extraction, a "Re-extract" button appears
4. **Batch**: Future Snowflake Task can re-extract all sessions when the extraction prompt evolves

**Code Engine Function I/O:**

| Function | Inputs | Outputs | Domo Types |
|----------|--------|---------|------------|
| `extractStructuredTDR` | `sessionId` (string) | `{ success, extractId, structured: { ... } }` (object) | Input: string, Output: object |

**Frontend Changes:**

| File | Change |
|------|--------|
| `src/lib/cortexAi.ts` | Add `extractStructuredTDR()` method |
| `src/hooks/useTDRSession.ts` | Trigger extraction when session marked complete |
| `src/components/TDRIntelligence.tsx` | Add "Analytics Extraction" status indicator + manual trigger |
| `manifest.json` | Add `extractStructuredTDR` to `packageMapping` |
| `codeengine/consolidated-sprint4-5.js` | Add `extractStructuredTDR` function |

**No changes to:** TDR input fields, step definitions, EAV storage, or the SE-facing experience.

**Why This Matters for Downstream Sprints:**
- **Sprint 18 (Score v2)**: Post-TDR Score can use `DEAL_COMPLEXITY`, `RISK_CATEGORIES`, and `NAMED_COMPETITORS` from the extract instead of parsing free text at scoring time
- **Sprint 21 (Action Plan)**: `generateActionPlan` can read from `TDR_STRUCTURED_EXTRACTS` for pre-parsed entities instead of doing its own extraction
- **Cortex Analyst**: The `V_TDR_ANALYTICS` view becomes a semantic model source — "ask TDR" questions become SQL against structured columns, not text parsing
- **Portfolio reporting**: SE Managers can see patterns across their team's TDRs (most common platforms, entry layers, risk categories, competitor frequency)

**Definition of Done:** After a TDR is completed, Cortex AI extracts structured analytical fields and stores them in `TDR_STRUCTURED_EXTRACTS`. The `V_TDR_ANALYTICS` view joins session, extract, and enrichment data into a single queryable surface. Example analytical queries run successfully against the view. ✅

**Sprint 17.5 Completion Notes (Feb 10, 2026):**
- DDL for `TDR_STRUCTURED_EXTRACTS` table and `V_TDR_ANALYTICS` view added to `sql/bootstrap.sql`
- `extractStructuredTDR` CE function added to `codeengine/consolidated-sprint4-5.js` — two-tier extraction (Tier 1: scalar fields via `AI_COMPLETE`, Tier 2: array fields via second pass)
- Auto-trigger on TDR completion wired in `useTDRSession.ts` (fire-and-forget, non-blocking)
- Manual "Extract Analytics" button + status indicator added to `TDRIntelligence.tsx`
- `manifest.json` updated with `extractStructuredTDR` package mapping
- Types (`StructuredExtractResult`) added to `cortexAi.ts`

---

### Sprint 17.6 — TDR Portfolio Analytics Page + NLQ ✅ COMPLETE

> **Goal:** Build a dedicated analytics page that surfaces portfolio-level patterns from structured TDR data. This is the **visualization companion** to Sprint 17.5's extraction pipeline — it turns `V_TDR_ANALYTICS` into interactive charts and tables that answer the questions SE Managers and leadership actually ask. Includes a natural-language query bar ("Ask Your TDR Data") powered by Cortex AI.
> **Completed:** February 10, 2026
> **Risk to app:** None — purely additive. New page, new route, no changes to existing pages.
> **Effort:** ~1.5 days
> **Dependencies:** Sprint 17.5 (extraction pipeline must exist to produce data)

**Problem Statement:**

Today the app has a **Command Center** that answers "what's in the pipeline?" — it shows deal volume, priority scores, and close date distribution. But it doesn't answer portfolio-level TDR questions:

- "What platforms are we competing on across all TDRs?"
- "Who are our most common competitors?"
- "How does Domo typically enter the stack?"
- "What risks keep appearing?"
- "What Domo capabilities are most in demand?"
- "How are TDR completion rates trending?"
- "Are there patterns in which deals we approve vs. send back?"

These questions require **structured cross-deal analysis** — exactly what Sprint 17.5's `V_TDR_ANALYTICS` view provides. This sprint builds the UI to surface those answers.

**Page Design: `/analytics`**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  TDR Portfolio Analytics                                            [Filters]│
│  Patterns across all Technical Deal Reviews                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─── Summary Stats (4 cards) ──────────────────────────────────────────┐   │
│  │ TDRs Completed │ Avg Complexity  │ Proceed Rate    │ Avg TDR Duration│   │
│  │ 47             │ Moderate (2.1)  │ 72% Proceed     │ 3.2 days        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─── Row 1: Platform & Technology ─────────────────────────────────────┐   │
│  │  [Cloud Platform Distribution]  │  [Entry Layer Distribution]        │   │
│  │  (donut chart)                  │  (horizontal bar chart)            │   │
│  │  Snowflake: 42%                 │  Data Integration ████████ 15     │   │
│  │  Databricks: 23%               │  Visualization    ██████ 11       │   │
│  │  BigQuery: 12%                  │  App Development  ████ 8          │   │
│  │  Multiple: 11%                  │  Embedded         ███ 6           │   │
│  │  Other: 12%                     │  AI / ML          ██ 4            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─── Row 2: Competitive & Risk ────────────────────────────────────────┐   │
│  │  [Top Competitors]              │  [Risk Categories]                 │   │
│  │  (horizontal bar)               │  (horizontal bar)                  │   │
│  │  Sigma ████████████ 18          │  competitive_displacement ████ 22  │   │
│  │  Tableau ████████ 12            │  integration_risk ████████ 15     │   │
│  │  Power BI ██████ 9              │  timeline_pressure ██████ 12     │   │
│  │  Fivetran ████ 6                │  technical_complexity █████ 10   │   │
│  │  ThoughtSpot ██ 3               │  adoption_risk ███ 7             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─── Row 3: Decisions & Trends ────────────────────────────────────────┐   │
│  │  [Verdict Distribution]         │  [TDR Volume & Verdict Trend]      │   │
│  │  (donut chart)                  │  (stacked area chart by month)     │   │
│  │  Proceed: 72%                   │                                    │   │
│  │  Corrections: 21%              │  ──▓▓▓▓▓▓──────────────────────    │   │
│  │  Rework: 7%                     │  ──▓▓▓▓▓▓▓▓────────────────────   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─── Row 4: Domo Positioning ──────────────────────────────────────────┐   │
│  │  [Most Used Domo Capabilities]  │  [Key Differentiators]             │   │
│  │  (horizontal bar)               │  (horizontal bar)                  │   │
│  │  MagicETL ████████████ 20       │  Governance ██████████ 16         │   │
│  │  App Studio ████████ 14         │  No-code Integration ████████ 12  │   │
│  │  Dashboards ██████ 10           │  Speed to Value ██████ 9          │   │
│  │  Writeback ████ 7               │  App Platform ████ 6              │   │
│  │  Governance ███ 5               │  Embedded UX ███ 4                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─── Row 5: Detail Table ──────────────────────────────────────────────┐   │
│  │  Sortable, searchable table of all extracted TDR sessions            │   │
│  │  Account | ACV | Platform | Entry Layer | Competitors | Verdict | …  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Section 1 — Summary Stats (4 cards)**

| Card | Metric | Computation | Format |
|------|--------|-------------|--------|
| **TDRs Completed** | Count of sessions with `STATUS = 'completed'` | `COUNT(*)` | Integer |
| **Avg Deal Complexity** | Mean of `DEAL_COMPLEXITY` mapped to 1/2/3 | Simple→1, Moderate→2, Complex→3, avg | `Moderate (2.1)` |
| **Proceed Rate** | % of sessions with `VERDICT = 'Proceed'` | `COUNT(Proceed) / COUNT(with verdict)` | `72%` |
| **Avg TDR Duration** | Mean days from `CREATED_AT` to `UPDATED_AT` for completed TDRs | `AVG(TDR_DURATION_DAYS)` | `3.2 days` |

**Section 2 — Platform & Technology (2 charts)**

| Chart | Type | Data Source | X-Axis / Segments | Y-Axis / Metric |
|-------|------|-------------|-------|-------|
| Cloud Platform Distribution | Donut (PieChart) | `CLOUD_PLATFORM` | Platform name | Deal count |
| Entry Layer Distribution | Horizontal bar | `ENTRY_LAYER` | Layer name | Deal count |

**Section 3 — Competitive & Risk (2 charts)**

| Chart | Type | Data Source | X-Axis / Segments | Y-Axis / Metric |
|-------|------|-------------|-------|-------|
| Top Competitors | Horizontal bar | `NAMED_COMPETITORS` (flattened) | Competitor name | Mention count |
| Risk Categories | Horizontal bar | `RISK_CATEGORIES` (flattened) | Category name | Occurrence count |

**Section 4 — Decisions & Trends (2 charts)**

| Chart | Type | Data Source | X-Axis | Y-Axis |
|-------|------|-------------|--------|--------|
| Verdict Distribution | Donut (PieChart) | `VERDICT` | Verdict value | Deal count |
| TDR Volume & Verdict Trend | Stacked area (AreaChart) | `TDR_STARTED` × `VERDICT` | Month | Deal count per verdict |

**Section 5 — Domo Positioning (2 charts)**

| Chart | Type | Data Source | X-Axis | Y-Axis |
|-------|------|-------------|--------|--------|
| Most Used Domo Capabilities | Horizontal bar | `DOMO_USE_CASES` (flattened) | Use case | Mention count |
| Key Differentiators | Horizontal bar | `KEY_DIFFERENTIATORS` (flattened) | Differentiator | Mention count |

**Section 6 — Detail Table**

A sortable/filterable table showing all extracted TDR sessions. Columns:

| Column | Source | Sortable | Filterable |
|--------|--------|----------|------------|
| Account | `ACCOUNT_NAME` | ✅ | ✅ text |
| ACV | `ACV` | ✅ | ✅ range |
| Stage | `STAGE` | ✅ | ✅ set |
| Cloud Platform | `CLOUD_PLATFORM` | ✅ | ✅ set |
| Entry Layer | `ENTRY_LAYER` | ✅ | ✅ set |
| Competitors | `NAMED_COMPETITORS` | No | ✅ text |
| Complexity | `DEAL_COMPLEXITY` | ✅ | ✅ set |
| Verdict | `VERDICT` | ✅ | ✅ set |
| TDR Date | `TDR_STARTED` | ✅ | ✅ date range |
| Thesis | `THESIS` | No | ✅ text |

Click row → navigate to `/workspace?deal={opportunityId}` (open the TDR for that deal).

**Page-Level Filters (top right)**

| Filter | Type | Options | Default |
|--------|------|---------|---------|
| Date Range | Date picker (from/to) | Any range | Last 90 days |
| SE Manager | Multi-select | From `SE_NAME` values | All |
| Cloud Platform | Multi-select | From `CLOUD_PLATFORM` values | All |
| Verdict | Multi-select | Proceed, Corrections, Rework | All |

Filters apply to ALL sections simultaneously — charts and detail table update together.

**Data Retrieval: Code Engine Function `getTDRAnalyticsData`**

A single Code Engine function queries `V_TDR_ANALYTICS` and returns the raw rows. Frontend aggregates client-side since row count is manageable (one per TDR session — unlikely to exceed hundreds in the near term).

```
getTDRAnalyticsData() → { success, rows: V_TDR_ANALYTICS[] }
```

The function runs a simple `SELECT * FROM V_TDR_ANALYTICS` — all filtering and aggregation happens client-side in React for responsiveness. If row count grows past ~500, we'll add server-side aggregation in a future iteration.

**Code Engine Function I/O:**

| Function | Inputs | Outputs | Domo Types |
|----------|--------|---------|------------|
| `getTDRAnalyticsData` | (none) | `{ success, rows: [...] }` (object) | Input: none, Output: object |

**Color Palette (consistent with existing charts):**

Uses the existing coolors.co palette from `TopTDRCandidatesChart`, `TDRPriorityChart`, and `PipelineByCloseChart`:
- Primary: `#6366f1` (indigo) — Proceed / Snowflake
- Secondary: `#f59e0b` (amber) — Corrections / Databricks
- Tertiary: `#ef4444` (red) — Rework / risk signals
- Quaternary: `#10b981` (emerald) — positive signals
- Additional segments use `#8b5cf6`, `#3b82f6`, `#ec4899`, `#14b8a6`, `#f97316`

**Files Changed:**

| File | Change |
|------|--------|
| `src/pages/TDRAnalytics.tsx` | **New** — full analytics page with 4 stat cards, 8 charts, 1 detail table |
| `src/components/charts/PlatformDonutChart.tsx` | **New** — cloud platform distribution donut |
| `src/components/charts/EntryLayerBarChart.tsx` | **New** — entry layer horizontal bar |
| `src/components/charts/CompetitorBarChart.tsx` | **New** — top competitors horizontal bar |
| `src/components/charts/RiskCategoryBarChart.tsx` | **New** — risk category horizontal bar |
| `src/components/charts/VerdictDonutChart.tsx` | **New** — verdict distribution donut |
| `src/components/charts/TDRTrendChart.tsx` | **New** — TDR volume + verdict stacked area |
| `src/components/charts/UseCaseBarChart.tsx` | **New** — Domo use cases horizontal bar |
| `src/components/charts/DifferentiatorBarChart.tsx` | **New** — key differentiators horizontal bar |
| `src/components/AppSidebar.tsx` | Add "Analytics" nav item (icon: `BarChart3` from lucide) |
| `src/App.tsx` | Add `/analytics` route |
| `src/lib/snowflakeStore.ts` | Add `getTDRAnalyticsData()` method |
| `manifest.json` | Add `getTDRAnalyticsData` to `packageMapping` |
| `codeengine/consolidated-sprint4-5.js` | Add `getTDRAnalyticsData` function |

**No Snowflake changes** — this sprint only reads from `V_TDR_ANALYTICS` (created in Sprint 17.5).

---

#### Natural Language Query (NLQ) — "Ask Your TDR Data"

> **The headline feature:** Users can ask free-form questions in plain English and get instant answers backed by SQL against `V_TDR_ANALYTICS`. This turns the analytics page from a **static dashboard** into an **interactive exploration tool**.

**Why NLQ Belongs on This Page:**

The 8 pre-built charts answer the *most common* portfolio questions. But leaders always have follow-up questions the chart designers didn't anticipate:
- *"What % of TDRs cite Snowflake as the platform?"*
- *"What are the most common risks across all deals?"*
- *"Show me deals with ACV > $100K that have competitive risk"*
- *"Which entry layer has the highest proceed rate?"*
- *"Compare this quarter's TDR volume to last quarter"*
- *"What accounts have both Snowflake and Databricks in their stack?"*

NLQ lets them ask these questions directly — no SQL knowledge required.

**How It Works (Engine):**

Two-tier approach, identical to Sprint 11's `askAnalyst` but scoped to the analytics view:

| Tier | Engine | Schema Context | When |
|------|--------|---------------|------|
| **Tier A (Default)** | `AI_COMPLETE` text-to-SQL | `V_TDR_ANALYTICS` column definitions | Ships immediately |
| **Tier B (Upgrade)** | Cortex Analyst API + Snowflake Semantic View | Semantic view defined over `V_TDR_ANALYTICS` | When semantic view is created in Snowflake (future sprint) |

**Tier A** reuses the proven pattern from Sprint 11's `askAnalyst` but replaces the old multi-table EAV schema context with the flat `V_TDR_ANALYTICS` view. This is a massive accuracy improvement because:
- No EAV pivoting required (the AI doesn't have to understand FIELD_ID → column mapping)
- All analytical columns are pre-named with business semantics (e.g., `CLOUD_PLATFORM`, `NAMED_COMPETITORS`, `VERDICT`)
- VARIANT columns (JSON arrays) can be queried with `FLATTEN` — the prompt teaches this pattern
- One view instead of 10+ tables — fewer join errors

**Tier B** uses Snowflake's native Cortex Analyst API (`POST /api/v2/cortex/analyst/message`) with a formal semantic model. This provides:
- Better query accuracy through defined metrics, dimensions, and relationships
- Multi-turn conversation with memory (Cortex manages context)
- Verified answers with confidence scoring
- *Requires:* a `tdr_analytics_semantic_model.yaml` deployed to a Snowflake internal stage

**CE Function: `askTDRAnalytics`**

```
askTDRAnalytics(question: string) → {
  success: boolean,
  sql: string | null,       // Generated SQL (for transparency)
  columns: string[],        // Result column names
  rows: object[],           // Result data
  answer: string,           // Natural language answer
  chartHint?: string        // 'bar' | 'donut' | 'line' | 'table' — auto-detected
}
```

Schema context provided to `AI_COMPLETE`:

```
View: TDR_APP.TDR_DATA.V_TDR_ANALYTICS
Columns:
  SESSION_ID (VARCHAR) — unique TDR session identifier
  OPPORTUNITY_ID (VARCHAR) — Salesforce opportunity ID
  ACCOUNT_NAME (VARCHAR) — company name
  OPPORTUNITY_NAME (VARCHAR) — deal name
  ACV (NUMBER) — annual contract value in USD
  STAGE (VARCHAR) — sales stage
  STATUS (VARCHAR) — TDR status: in-progress, completed, abandoned
  OUTCOME (VARCHAR) — TDR outcome
  OWNER (VARCHAR) — deal owner / SE name
  ITERATION (NUMBER) — TDR iteration number
  SESSION_CREATED_AT (TIMESTAMP) — when TDR was started
  SESSION_UPDATED_AT (TIMESTAMP) — when TDR was last modified
  -- Structured Extracts (from TDR inputs)
  STRATEGIC_VALUE (VARCHAR) — strategic value classification
  CUSTOMER_DECISION (VARCHAR) — what the customer is deciding
  DECISION_TIMELINE (VARCHAR) — timeline for decision
  CLOUD_PLATFORM (VARCHAR) — primary cloud platform (Snowflake, Databricks, BigQuery, etc.)
  ENTRY_LAYER (VARCHAR) — how Domo enters the stack
  VERDICT (VARCHAR) — TDR verdict: Proceed, Corrections, Rework
  PARTNER_POSTURE (VARCHAR) — partner engagement posture
  AI_REALITY (VARCHAR) — AI readiness classification
  NAMED_COMPETITORS (VARIANT) — JSON array of competitor names
  KEY_TECHNOLOGIES (VARIANT) — JSON array of technologies in use
  RISK_CATEGORIES (VARIANT) — JSON array of risk types
  USE_CASES (VARIANT) — JSON array of Domo use cases
  ARCHITECTURAL_PATTERNS (VARIANT) — JSON array of architecture patterns
  DEAL_COMPLEXITY (VARCHAR) — Low, Medium, High
  KEY_STAKEHOLDERS (VARIANT) — JSON array of stakeholder roles
  INTEGRATION_POINTS (VARIANT) — JSON array of integration targets
  EXPECTED_USERS (INTEGER) — expected user count
  EXTRACTED_AT (TIMESTAMP) — when extraction occurred
  -- Enrichment Data
  SUMBLE_INDUSTRY (VARCHAR) — industry from Sumble
  SUMBLE_EMPLOYEE_COUNT (NUMBER) — employee count
  SUMBLE_REVENUE (NUMBER) — estimated revenue
  SUMBLE_TECHNOLOGIES (VARIANT) — tech stack from Sumble
  PERPLEXITY_SUMMARY (VARCHAR) — AI research summary
  PERPLEXITY_INITIATIVES (VARCHAR) — recent company initiatives
  PERPLEXITY_TECH_SIGNALS (VARCHAR) — technology signals

Rules:
- Generate ONLY SELECT statements — never INSERT, UPDATE, DELETE
- Always qualify: TDR_APP.TDR_DATA.V_TDR_ANALYTICS
- For VARIANT (JSON array) columns, use LATERAL FLATTEN:
    SELECT f.value::STRING AS competitor, COUNT(*) AS cnt
    FROM TDR_APP.TDR_DATA.V_TDR_ANALYTICS, LATERAL FLATTEN(input => NAMED_COMPETITORS) f
    GROUP BY competitor ORDER BY cnt DESC
- Return ONLY the raw SQL — no markdown, no explanation
- LIMIT results to 50 rows unless the user asks for more
```

**Answer Generation:**

After SQL executes, a second `AI_COMPLETE` call generates a natural language answer from the results (same pattern as Sprint 11):
```
"Based on 47 completed TDRs, 42% cite Snowflake as their primary cloud platform,
followed by Databricks (23%) and BigQuery (12%). Snowflake is the dominant platform
across your TDR portfolio."
```

**Auto-Chart Detection:**

The CE function inspects the result shape and returns a `chartHint`:

| Result Shape | chartHint | Rendered As |
|-------------|-----------|-------------|
| 1 categorical col + 1 numeric col | `bar` | Horizontal bar chart |
| 1 categorical col with ≤6 values + 1 numeric col | `donut` | Donut/pie chart |
| 1 date/timestamp col + 1 numeric col | `line` | Line chart |
| Multiple columns or complex shape | `table` | Data table |

The frontend renders the appropriate Recharts component dynamically based on the hint. If no hint or `table`, it falls back to a clean data table.

**UI Component: `<AnalyticsNLQ />`**

Positioned as **Section 0** — the hero element above the stat cards:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  🔍 Ask anything about your TDR portfolio...                          ⏎    │
│                                                                              │
│  Try:  [What % cite Snowflake?]  [Top risks?]  [Proceed rate by quarter]    │
│        [Competitors in deals > $100K]  [Entry layer vs verdict]             │
└──────────────────────────────────────────────────────────────────────────────┘

  When a question is asked, the answer area expands below:

┌──────────────────────────────────────────────────────────────────────────────┐
│  🔍 What % of TDRs cite Snowflake as the platform?                    ⏎    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  💬 Answer                                                                  │
│  Based on 47 completed TDRs, 42% (20 deals) cite Snowflake as their        │
│  primary cloud platform, followed by Databricks at 23% (11 deals) and      │
│  BigQuery at 12% (6 deals).                                                │
│                                                                              │
│  ┌─ Auto-generated chart ────────────────────────────────────┐              │
│  │  Snowflake   ████████████████████ 20 (42%)                │              │
│  │  Databricks  ██████████ 11 (23%)                          │              │
│  │  BigQuery    █████ 6 (12%)                                │              │
│  │  Azure       ████ 5 (11%)                                 │              │
│  │  Other       ██████ 5 (12%)                               │              │
│  └───────────────────────────────────────────────────────────┘              │
│                                                                              │
│  ▸ View SQL   ▸ View raw data (5 rows)                                     │
│                                                                              │
│  ── Follow-up ──────────────────────────────────────────────────────        │
│  🔍 Now break that down by entry layer...                          ⏎       │
└──────────────────────────────────────────────────────────────────────────────┘
```

**NLQ UI Behavior:**

| Element | Behavior |
|---------|----------|
| **Input bar** | Single-line text input, submit on Enter. Styled as a prominent hero search bar with subtle glow. |
| **Suggestion chips** | 5 clickable chips below the input. Click fills the input and auto-submits. Chips rotate on page load. |
| **Loading state** | Pulsing skeleton + "Analyzing your TDR data..." text while Cortex processes. |
| **Answer** | Natural language text in a callout card. Rendered with markdown support. |
| **Auto-chart** | Rendered inline below the answer using the appropriate Recharts component. |
| **"View SQL"** | Collapsible code block showing the generated SQL (power users / debugging). |
| **"View raw data"** | Collapsible table showing the full result set. |
| **Follow-up** | After an answer, a second input appears for follow-up questions. Conversation state is maintained client-side. |
| **Error state** | If SQL generation fails: "I couldn't generate a query for that. Try rephrasing?" with the raw error in a collapsible section. |
| **Empty view state** | "Complete TDRs and run the extraction pipeline to enable natural language queries." |

**Multi-Turn Conversation:**

The NLQ bar supports follow-up questions. The conversation history (user questions + Cortex answers) is maintained in React state and sent with each subsequent call. This enables natural exchanges like:

> **User:** "What are the most common risk categories?"
> **Answer:** "Competitive displacement (22 mentions), integration risk (15), timeline pressure (12)..."
> **User:** "Which of those appear most in deals over $100K ACV?"
> **Answer:** "In deals over $100K, competitive displacement is still #1 but integration risk jumps to #2..."

Conversation resets when the page is refreshed or the user clicks a "New question" button.

**Suggestion Chips — Curated Examples:**

| Chip Label | Actual Question |
|------------|----------------|
| `What % cite Snowflake?` | What percentage of TDRs cite Snowflake as the cloud platform? |
| `Top risks?` | What are the top 5 most common risk categories across all TDRs? |
| `Proceed rate by quarter` | What is the proceed rate (verdict = Proceed) by quarter? |
| `Competitors in deals > $100K` | Which competitors appear most in deals with ACV greater than 100000? |
| `Entry layer vs verdict` | Show the proceed rate broken down by entry layer |

**Code Engine Function I/O (updated):**

| Function | Inputs | Outputs | Domo Types |
|----------|--------|---------|------------|
| `getTDRAnalyticsData` | (none) | `{ success, rows: [...] }` (object) | Input: none, Output: object |
| `askTDRAnalytics` | `question` (string) | `{ success, sql, columns, rows, answer, chartHint }` (object) | Input: text, Output: object |

**Files Changed (actual implementation):**

| File | Change |
|------|--------|
| `src/pages/TDRAnalytics.tsx` | ✅ **New** — full analytics page with NLQ hero bar (askAnalyst), 4 stat cards, 6 chart sections (donut + horizontal bar), auto-chart for NLQ results, result table, SQL viewer, question history, suggested questions, empty state |
| `src/components/AppSidebar.tsx` | ✅ Add "Analytics" nav item (icon: `BarChart3` from lucide) |
| `src/App.tsx` | ✅ Add `/analytics` route with lazy-loaded `TDRAnalytics` component |
| `src/lib/cortexAi.ts` | (existing `askAnalyst` from Sprint 11 reused — no new CE function needed) |

> **Implementation Note:** Rather than creating 10+ separate chart component files as originally planned, the analytics page was consolidated into a single `TDRAnalytics.tsx` with inline chart sub-components (`StatCard`, `HBarSection`, `DonutSection`, `AutoChart`, `ResultTable`). This keeps the code co-located and simpler to maintain. Charts are populated via `askAnalyst` CE function queries against `V_TDR_ANALYTICS`. As more TDR data accumulates, the charts will progressively fill in.

**Snowflake Semantic View (Tier B — Future Sprint):**

> **Note:** The upgrade path will use **Snowflake Semantic Views** (not YAML files deployed to stages). Semantic views are defined directly in Snowflake SQL as first-class objects over `V_TDR_ANALYTICS`. This will be addressed in a future sprint when there's sufficient TDR data to validate the approach. The dimensions, measures, and verified queries from the Tier A schema context will inform the semantic view definition.

**Design Principles:**
1. Same `stat-card` pattern as Command Center — visual consistency
2. All charts use Recharts (already installed) — no new dependencies
3. **NLQ bar is the hero element** — positioned at the top, before stat cards, to signal this page is interactive
4. Page is useful with even 1 TDR session (graceful empty states: "Complete more TDRs to see trends")
5. Responsive layout: 2-column grid for charts, full-width for detail table and NLQ results
6. Every chart has an info tooltip explaining what it shows and why it matters
7. Charts animate on mount for a polished feel
8. **Auto-chart from NLQ results** — when the result shape matches a known pattern, render a chart automatically

**Empty State:**

When no TDR sessions have been extracted yet:

```
┌────────────────────────────────────────────────────────┐
│  📊  No TDR Analytics Yet                              │
│                                                        │
│  Complete a TDR to start seeing portfolio patterns.    │
│  Analytics are extracted automatically when a TDR is   │
│  marked complete.                                      │
│                                                        │
│  [Go to Command Center]                                │
└────────────────────────────────────────────────────────┘
```

**What This Page Answers (by audience):**

| Audience | Key Questions | Sections |
|----------|---------------|----------|
| **SE Manager** | "What platforms is my team selling on? What risks keep appearing? How are my TDR completion rates?" | Platform, Risk, Stats, Trends, **NLQ** |
| **VP / Director** | "Are we winning competitive deals? What's our proceed rate? Where does Domo enter?" | Competitive, Verdict, Entry Layer, **NLQ** |
| **SE Leadership** | "What capabilities are most in demand? What differentiates us? How complex are our deals?" | Domo Positioning, Stats, **NLQ** |
| **Enablement** | "What battle cards should we update? What partner playbooks are needed?" | Competitive, Risk, Platform, **NLQ** |
| **Any user with a custom question** | Anything not covered by the pre-built charts | **NLQ** |

**Definition of Done:** A dedicated `/analytics` page shows an NLQ hero bar (powered by Cortex `AI_COMPLETE` against `V_TDR_ANALYTICS`), 8 interactive charts, and 4 stat cards. Users can ask natural language questions and receive answers with auto-generated charts and data tables. Filters apply globally. Detail table allows drill-down to individual TDRs. Multi-turn follow-up questions are supported. Page works with ≥1 extracted TDR session and shows meaningful empty states otherwise.

---

### Sprint 18 — TDR Score v2 (Pre-TDR & Post-TDR) ✅ COMPLETE

> **Goal:** Evolve the TDR Score into a two-phase model: Pre-TDR (structured data) and Post-TDR (enriched with SE input quality, enrichment data, fileset signals, and named competitor intelligence).
> **Risk to app:** Medium — scoring changes affect the deals table, charts, and sorting. Must maintain backward compatibility.
> **Effort:** ~2 days
> **Dependencies:** Sprint 17 (lean TDR step schema), Sprint 19 (fileset data availability)
> **Completed:** February 10, 2026

**Two-Phase Scoring Model:**

| Phase | When Calculated | Data Sources | Score Range |
|-------|----------------|-------------|-------------|
| **Pre-TDR Score** | On every page load (current behavior) | Structured deal data from SFDC: ACV, stage, forecast, competitors, partner, deal code | 0–100 |
| **Post-TDR Score** | After SE submits TDR inputs + enrichment exists | Pre-TDR base + SE input quality + enrichment signals + fileset match + named competitor threat | 0–100 (recalculated) |

**Pre-TDR Score (v1 components — keep as-is):**
1. ACV Significance (0–20)
2. Stage TDR Value (0–15)
3. Cloud Partner Alignment (0–15)
4. Competitive Pressure (0–10)
5. Deal Type Signal (0–23)
6. Forecast Momentum (0–10)
7. Stage Freshness (-10 to +5)
8. Deal Complexity (0–10)
9. Partner Role Strength (0–5)

**Post-TDR Score (new components added to Pre-TDR base):**

| Component | Range | Source | Logic |
|-----------|-------|--------|-------|
| **Named Competitor Threat** | 0–10 | `competitors` field (deal data) | Sigma, Fivetran, dbt, Matillion, Tableau = "dangerous" (+10). Other named competitors = moderate (+5). Generic count only = current behavior. Dangerous list editable in Settings. |
| **Enrichment Depth** | 0–5 | Snowflake enrichment tables | Has Perplexity? +2. Has Sumble? +2. Has both? +1 bonus. More data = more informed TDR. |
| **TDR Input Quality** | -10 to +10 | Cortex AI analysis of SE free-text inputs | Cortex evaluates: Is the architecture story coherent? Is Domo's role well-defined? Are risks identified? Strong inputs boost score; empty/weak inputs penalize. |
| **Fileset Match Signal** | 0–5 | Domo fileset query results | If fileset contains battle cards / playbooks for named competitors in the deal → +5. Partial match → +2. |

**Named Competitor Configuration (Settings):**
- New section in Settings: "Dangerous Competitors"
- Default list: `Sigma Computing, Fivetran, dbt, Matillion, Tableau, Power BI, Qlik, Looker`
- Editable textarea (one per line) with badge preview
- Stored in `localStorage` via `appSettings`
- Used by both Pre-TDR (basic competitor count) and Post-TDR (named threat analysis)

**Score Display Changes:**
- Deals table shows Pre-TDR Score by default
- When a deal has a Post-TDR Score, show both: `Pre: 62 → Post: 78` or visual upgrade indicator
- TDR Workspace shows the full Post-TDR breakdown in a score panel
- Charts/metrics use Pre-TDR for unreviewed deals, Post-TDR for reviewed deals

**Files Changed:**

| File | Change |
|------|--------|
| `src/lib/tdrCriticalFactors.ts` | ✅ Added `PostTDRScoreContext`, `PostTDRScoreBreakdown` interfaces and `calculatePostTDRScore()`. Pre-TDR `calculateTDRScore()` unchanged. |
| `src/components/DealsTable.tsx` | ✅ `TDRScoreCell` shows Post-TDR score when available, with violet ring indicator and tooltip breakdown showing Pre→Post delta |
| `src/components/TDRIntelligence.tsx` | ✅ New "TDR Score" section with Pre/Post badge, visual score gauge, progress bar, and full Post-TDR breakdown (5 components). Auto-calculates from enrichment + session state. |
| `src/pages/TDRWorkspace.tsx` | ✅ Passes `completedStepCount` and `totalStepCount` to TDRIntelligence |
| `src/pages/Settings.tsx` | ✅ Added "Dangerous Competitors" card with textarea, badge preview, save/reset support |
| `src/lib/appSettings.ts` | ✅ Added `dangerousCompetitors: string[]` to `AppSettings` with default list |
| `src/types/tdr.ts` | ✅ Added `postTDRScore?: number` to `Deal` interface |

**Definition of Done:** ✅ Deals table shows Pre-TDR Score for all deals. TDR Intelligence panel shows live Post-TDR Score breakdown that updates as enrichment data and TDR steps are completed. When Post-TDR score is available, `TDRScoreCell` shows it with a violet ring indicator and tooltip showing the Pre→Post delta. Dangerous competitor list is editable in Settings with badge preview. Note: `evaluateInputQuality` (Cortex AI_COMPLETE for SE input quality assessment) and fileset match signal deferred to when Sprint 19 (Fileset Intelligence) is complete — the current Post-TDR score uses enrichment depth, competitor threat, input completeness, and risk awareness instead.

---

### Sprint 19 — Fileset Intelligence Layer ✅

> **Goal:** Integrate Domo filesets (unstructured PDFs — partner playbooks, competitive battle cards) into the TDR experience via Cortex AI analysis.
> **Risk to app:** Low — additive feature. No existing behavior changes.
> **Effort:** ~2-3 days

**Architecture:**

```
  Domo Fileset API
  (/domo/files/v1/filesets/{id}/query)
          │
          ▼
  Semantic search (fileset query endpoint)
  { query: "competitor battle card Sigma", topK: 8 }
          │
          ▼
  Top-K results (text chunks + metadata)
          │
    ┌─────┴──────────────────────┐
    ▼                            ▼
Intelligence Panel            Chat Context
(auto-surfaced)            (grounded answers)
    │                            │
    ▼                            ▼
Post-TDR Score              AI summarization
(fileset match signal)      via /domo/ai/v1/text/generation
```

**Features:**

**1. Settings → Fileset Configuration**
- New section in Settings: "Knowledge Base Filesets"
- Default fileset: `6d0776f7-cafe-47c0-9153-d11a365a0c02` (Partner playbooks & competitive battle cards)
- User can add additional fileset IDs (text input + "Add" button)
- Each fileset shows: name, file count, last updated (fetched from `/domo/files/v1/filesets/{id}`)
- Stored in `localStorage` via `appSettings`

**2. Automatic Contextual Search (Intelligence Panel)**
When an SE opens a TDR, the system:
1. Builds a search query from the deal context: competitor names + partner platform + cloud platform + account industry
2. Queries all configured filesets via `/domo/files/v1/filesets/{id}/query`
3. Returns top-K relevant document chunks
4. Passes chunks to Cortex/Domo AI for summarization
5. Displays in the Intelligence panel under a new **"Knowledge Base"** section:
   - Relevant battle cards (title, relevance score, key excerpts)
   - Partner playbook matches
   - "View Source" links to original documents

**3. Chat Integration**
- New toggle in TDR Chat: "Include Knowledge Base" (on by default)
- When enabled, user questions first query the filesets, then pass results as context to the LLM
- Citation format: "According to [Partner Playbook: Snowflake Co-Sell Guide]..."
- Follows the pattern from `samples/filesets chat interface_/app.js`:
  - Query: `/domo/files/v1/filesets/{id}/query` with `{ query, topK: 8 }`
  - Fallback: `/domo/files/v1/filesets/{id}/files` for file listing
  - Generation: `/domo/ai/v1/text/generation` with document context in prompt

**4. Score Integration (Sprint 18 dependency)**
- If fileset contains battle cards for deal's named competitors → `filesetMatchSignal: +5`
- If partial match (related industry/partner content) → `filesetMatchSignal: +2`
- No match → `filesetMatchSignal: 0`
- This feeds into the Post-TDR Score from Sprint 18

**Technical Approach (from sample app analysis):**

```javascript
// Search a fileset
const results = await domo.post(
  `/domo/files/v1/filesets/${filesetId}/query`,
  { query: searchQuery, topK: 8 }
);

// List available filesets
const filesets = await domo.post(
  '/domo/files/v1/filesets/search?offset=0',
  {}
);

// Get fileset metadata
const meta = await domo.get(`/domo/files/v1/filesets/${filesetId}`);

// List files in a fileset
const files = await domo.get(`/domo/files/v1/filesets/${filesetId}/files`);
```

**Files Changed:**

| File | Change |
|------|--------|
| `src/lib/filesetIntel.ts` | **New** — Fileset search, query, and result processing |
| `src/lib/appSettings.ts` | Add `filesetIds: string[]` to settings |
| `src/pages/Settings.tsx` | Add "Knowledge Base Filesets" configuration section |
| `src/components/TDRIntelligence.tsx` | Add "Knowledge Base" section with auto-search results |
| `src/components/TDRChat.tsx` | Add "Include Knowledge Base" toggle, fileset context injection |
| `src/lib/tdrCriticalFactors.ts` | Add `filesetMatchSignal` to Post-TDR Score (Sprint 18 integration) |

**Definition of Done:** ✅ Opening a TDR auto-searches configured filesets for relevant content. Results displayed in Intelligence panel under "Knowledge Base" section with document titles, excerpts, relevance scores, and "View Source" links. Chat has "Include Knowledge Base" toggle that injects fileset context into LLM prompts. Settings page allows adding/removing fileset IDs with metadata display (name, file count, status). `filesetMatchSignal` feeds into Post-TDR Score (0/+2/+5 based on match strength). All fileset API calls handle multiple payload formats for Domo API compatibility. `dist/manifest.json` updated to v1.37.0 with all 30 Code Engine function mappings.

---

### Sprint 20 — Hero Metrics & Nav Cleanup 🔲

> **Goal:** Rethink the Command Center top metrics and charts to align with TDR objectives. Clean up left nav redundancy.
> **Risk to app:** Medium — changes the main dashboard experience. No backend changes.
> **Effort:** ~1-2 days
> **Dependencies:** Sprint 18 (new scoring model provides richer data)

**Current State (7 zones):**
- 4 stat cards: Eligible ACV, Recommended, Agenda, At-Risk
- 3 charts: Top TDR Candidates (bar), TDR Priority (donut), Pipeline by Close (area)

**Problem:** These metrics were designed before we had competition data, enrichment signals, fileset intelligence, and a two-phase scoring model. They answer "what's in the pipeline?" but not "what needs my attention *for TDR purposes* right now?"

**Proposed Stat Cards (4):**

| Card | Metric | What It Answers | Data Source |
|------|--------|----------------|-------------|
| **TDR Queue** | Count of HIGH/CRITICAL-scored deals with no TDR session | "How many deals need review?" | Pre-TDR Score + `tdrSessions` |
| **Competitive Battles** | Count + ACV of deals with named competitors | "Where are we fighting?" | `competitors` field |
| **Partner Pipeline** | ACV in Snowflake/Databricks/GCP co-sell deals | "How healthy is Cloud Amplifier?" | `snowflakeTeam` + `partnersInvolved` |
| **Stale Deals** | Count of deals with stage age > 60 days | "What's stuck?" | `stageAge` |

**Proposed Charts (3):**

| Chart | Type | What It Shows | Why It Matters |
|-------|------|-------------|---------------|
| **TDR Coverage** | Donut | Reviewed (has TDR session) vs. Unreviewed vs. In-Progress | "Are we doing enough TDRs?" |
| **Score Distribution** | Histogram / bar | Deal count by score bracket (Low / Medium / High / Critical) | "Is our scoring model producing the right distribution?" |
| **Close Date Urgency** | Area / timeline | ACV by close date, colored by TDR status (reviewed / unreviewed) | "Which unreviewed deals are closing soonest?" |

**Left Nav Cleanup:**

| Current | Proposed | Reason |
|---------|----------|--------|
| Command Center | ✅ Keep | Home page — primary dashboard |
| Agenda | ❌ Remove | Routes to same page (`/agenda` → `CommandCenter`). Agenda toggle exists in TopBar. |
| TDR Workspace | ✅ Keep | Deal-level TDR workspace |
| History | ✅ Keep | TDR review history |
| Settings | ✅ Keep | App configuration |

**Routing Change:**
- Remove `/agenda` route from `App.tsx`
- Remove `agenda` nav item from `AppSidebar.tsx`

**Files Changed:**

| File | Change |
|------|--------|
| `src/pages/CommandCenter.tsx` | New stat card metrics, new chart components |
| `src/components/charts/TDRCoverageChart.tsx` | **New** — donut chart: reviewed vs unreviewed vs in-progress |
| `src/components/charts/ScoreDistributionChart.tsx` | **New** — histogram: deal count by score bracket |
| `src/components/charts/CloseUrgencyChart.tsx` | **New** — area chart: ACV by close date, colored by TDR status |
| `src/components/charts/TopTDRCandidatesChart.tsx` | **Remove** (replaced by TDR Coverage + Score Distribution) |
| `src/components/charts/TDRPriorityChart.tsx` | **Remove** (replaced by Score Distribution) |
| `src/components/charts/PipelineByCloseChart.tsx` | **Remove** (replaced by Close Urgency) |
| `src/components/AppSidebar.tsx` | Remove Agenda nav item |
| `src/App.tsx` | Remove `/agenda` route |

**Definition of Done:** Command Center shows TDR-aligned metrics. Every stat card and chart answers a question an SE manager would actually ask. Left nav has no redundancy.

---

### Sprint 21 — TDR Action Plan Synthesis 🔲

> **Goal:** After TDR completion, use Cortex AI to synthesize ALL captured data — SE inputs, deal metadata, Perplexity research, Sumble enrichment, fileset battle cards/playbooks, chat highlights, classified findings, extracted entities, and Post-TDR Score — into a comprehensive, tailored action plan for the SE/AE.
> **Risk to app:** Low — additive feature. Enhances the readout without changing existing behavior.
> **Effort:** ~2-3 days
> **Dependencies:** Sprint 17 (lean TDR inputs), Sprint 18 (Post-TDR Score), Sprint 19 (fileset intelligence)

**Problem Statement:**
Today's `assembleTDRReadout` is a **data aggregator** — it pulls from 9 Snowflake tables and renders each source in its own PDF section. The data is displayed as-is: raw SE inputs in §2, raw Sumble data in §3, raw chat messages in §7. Nobody is connecting the dots. The TDR Brief (§1) is the closest thing to synthesis, but it was designed before filesets, Post-TDR scoring, and named competitor intelligence existed. It's a summary, not an action plan.

**What the SE/AE actually needs after a TDR:**
- "Here's exactly what to do next, in what order, and why."
- "Here's how to beat [Sigma] specifically — based on the battle card AND what we learned in this TDR."
- "Here's who to engage at the account — based on Sumble people data AND the architecture gaps identified."
- "Here's the timeline risk — close date is X, you're in Stage Y, these Z things need to happen first."

**Solution: Cortex AI Synthesis Step**

A new Code Engine function `generateActionPlan` runs after TDR completion. It:

1. **Assembles the full context** (reuses `assembleTDRReadout` payload + fileset search results + Post-TDR Score breakdown)
2. **Sends everything to Cortex AI_COMPLETE** with a structured prompt requesting 7 sections
3. **Stores the result** in `CORTEX_ANALYSIS_RESULTS` as `analysis_type: 'tdr_action_plan'`
4. **Surfaces in two places:** the TDR Workspace and the PDF Readout

**Action Plan Structure (7 sections):**

| Section | Content | Primary Data Sources |
|---------|---------|---------------------|
| **Executive Summary** | 2-3 sentence deal narrative — what it is, what's at stake, what's the call to action | All sources |
| **Competitive Strategy** | Specific tactics against named competitors. "Against Sigma, lead with governance and app layer. Against Fivetran, emphasize MagicETL's no-code approach." | Fileset battle cards + Perplexity competitive landscape + `competitors` field + SE competitive inputs |
| **Partner Alignment Actions** | Specific partner engagement steps. "Schedule joint architecture session with Snowflake SA. Confirm co-sell motion alignment before Stage 4." | Fileset partner playbooks + partner fields + SE partner inputs |
| **Technical Next Steps** | Prioritized technical actions with rationale. "1. Validate MagicETL compute strategy (blocking). 2. Prepare integration architecture diagram (enabler). 3. Demo governance layer (differentiator)." | SE architecture inputs + Sumble tech stack + Perplexity tech signals |
| **Stakeholder Engagement Plan** | Who to engage and why. "Target VP Data Engineering (decision maker, per Sumble). Account is hiring 3 data roles — signals active investment." | Sumble people + Sumble jobs + Perplexity org intelligence |
| **Risk Mitigation** | Specific risks with countermeasures. "Risk: Customer evaluating Sigma in parallel. Mitigation: Schedule competitive bake-off focused on governance + app layer." | SE risk inputs + classified findings + competitive data + stage age |
| **Timeline & Urgency** | Actions mapped to close date and stage progression. "Close date: March 15. Currently Stage 3. Must complete POC by Feb 28 to maintain timeline." | Deal metadata (close date, stage, stage age) + SE inputs |

**Cortex Prompt Design:**

```
You are a senior Solutions Engineering strategist at Domo.
A Technical Deal Review has been completed. Below is ALL available intelligence for this deal.
Your job is to synthesize this into a specific, actionable plan that the SE and AE can execute immediately.

RULES:
- Be SPECIFIC. Name competitors, name partners, name people, name technologies.
- Every recommendation must cite which data source informed it.
- Prioritize actions by impact and urgency.
- If data is missing for a section, say what's missing and what to do about it.
- Use the battle card / playbook content directly — don't generalize.

DEAL METADATA:
{session data — account, ACV, stage, close date, competitors, partner, deal type}

SE INPUTS (from TDR):
{all step inputs — thesis, architecture, Domo role, risks}

PERPLEXITY RESEARCH:
{summary, initiatives, competitive landscape, tech signals}

SUMBLE ENRICHMENT:
{org profile, tech stack, hiring signals, key people}

FILESET KNOWLEDGE BASE:
{top-K relevant document chunks — battle cards, playbooks}

TDR SCORE BREAKDOWN:
{Pre-TDR score, Post-TDR score, factor breakdown}

CHAT HIGHLIGHTS:
{key Q&A from TDR chat session}

CLASSIFIED FINDINGS:
{Cortex-classified risk findings}

Generate the action plan in these 7 sections:
1. Executive Summary (2-3 sentences)
2. Competitive Strategy (specific to named competitors)
3. Partner Alignment Actions (specific to partner platform)
4. Technical Next Steps (prioritized, with rationale)
5. Stakeholder Engagement Plan (who to engage, why)
6. Risk Mitigation (specific risks + countermeasures)
7. Timeline & Urgency (actions mapped to close date)
```

**Where the Action Plan Appears:**

**1. TDR Workspace — new "Action Plan" section**
- Visible after all required steps are completed (or triggered manually via "Generate Action Plan" button)
- Rendered as structured markdown in the Intelligence panel under a new "Action Plan" tab
- Regeneratable — SE can update inputs and regenerate
- Stored in Snowflake (`CORTEX_ANALYSIS_RESULTS` with `analysis_type: 'tdr_action_plan'`)

**2. PDF Readout — replaces current §1 with full Action Plan**
- Current PDF §1 "Executive Summary" (which just shows the TDR brief) is replaced by the full 7-section Action Plan
- This becomes the FIRST and MOST IMPORTANT section of the PDF — what the reader actually acts on
- Remaining sections (inputs, intelligence, chat) become supporting evidence
- Updated PDF structure:

| PDF Section | Content | Status |
|-------------|---------|--------|
| **Cover** | Deal info, TDR metadata | Unchanged |
| **§1 Strategic Action Plan** | Full 7-section Cortex-synthesized action plan | **NEW** — replaces old Executive Summary |
| **§2 TDR Score Analysis** | Pre-TDR + Post-TDR breakdown, factor details | Enhanced with Post-TDR |
| §3 Deal Context & SE Inputs | Raw SE step inputs (supporting evidence) | Unchanged |
| §4 Account Intelligence | Sumble + Perplexity (supporting evidence) | Unchanged |
| §5 Knowledge Base Matches | Relevant fileset documents cited | **NEW** — from Sprint 19 |
| §6 Risk Assessment | Classified findings + extracted entities | Unchanged |
| §7 Hiring & People Signals | Sumble org/jobs/people | Unchanged |
| §8 AI Chat Highlights | Key chat exchanges | Unchanged |
| §9 Appendix | Generation metadata, data sources, timestamps | Unchanged |

**Code Engine Changes:**

| Function | Change |
|----------|--------|
| `generateActionPlan` | **New** — Cortex AI_COMPLETE with full context synthesis prompt |
| `assembleTDRReadout` | **Enhanced** — include `actionPlan` field from `CORTEX_ANALYSIS_RESULTS` + fileset match results |

**Frontend Changes:**

| File | Change |
|------|--------|
| `src/components/TDRIntelligence.tsx` | Add "Action Plan" section (or tab) — shown after TDR completion |
| `src/components/pdf/readoutTypes.ts` | Add `ReadoutActionPlan` interface, update `ReadoutPayload` |
| `src/components/pdf/TDRReadoutDocument.tsx` | Replace §1 with full Action Plan rendering, add §5 Knowledge Base |
| `src/lib/cortexAi.ts` | Add `generateActionPlan()` frontend method |
| `src/lib/tdrReadout.ts` | Pass fileset results to readout assembly |
| `manifest.json` | Add `generateActionPlan` to `packageMapping` |
| `codeengine/consolidated-sprint4-5.js` | Add `generateActionPlan` function |

**Definition of Done:** After TDR completion, the SE/AE can generate a tailored action plan that synthesizes all available intelligence into specific, prioritized next steps. The PDF readout leads with this action plan as its most prominent section. Every recommendation cites its data source.

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
    │  Sprint 19 — Fileset Intelligence         │
    │  (2–3 days, parallel with S17.5/6) ──────┤
    │                                           │
    ▼                                           ▼
Sprint 18 — TDR Score v2 (2 days) ✅     ──────┤
    │  (depends on S17.5 + S19)                 │
    ▼                                           │
Sprint 20 — Hero Metrics & Nav (1–2 days)      │
    (depends on S18)                            │
                                                ▼
                                Sprint 21 — Action Plan Synthesis (2–3 days)
                                    (depends on S17.5 + S18 + S19)
                                    THE CAPSTONE — synthesizes everything
```

**Total estimated effort:** ~10-14 days of focused development

| Sprint | Can Parallel? | Depends On | Effort | Status |
|--------|--------------|------------|--------|--------|
| S16: Fix Similar Deals | — | None | ~1 hr | ✅ |
| S17: Lean TDR Refactor | ✅ with S19 | None | 2-3 days | ✅ |
| S17.5: Structured TDR Analytics | ✅ with S19 | S17 | 1 day | ✅ |
| S17.6: TDR Portfolio Analytics Page | Sequential | S17.5 | 1.5 days | ✅ |
| **S19: Fileset Intelligence** | ✅ with S20 | None | 2-3 days | 🔲 Next |
| S18: TDR Score v2 | No | S17.5 + S19 | 2 days | ✅ |
| **S20: Hero Metrics & Nav** | ✅ with S21 | S18 | 1-2 days | 🔲 |
| **S21: Action Plan Synthesis** | ✅ with S20 | S17.5 + S18 + S19 | 2-3 days | 🔲 |

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
| Sample: aptSnowflakeCodeEngine.js | `samples/aptSnowflakeCodeEngine.js` (local) |
| Sample: cortexAnalystCodeEngine.js | `samples/cortexAnalystCodeEngine.js` (local) |
| Sample: Filesets Chat Interface | `samples/filesets chat interface_/` (local) |
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

The Slack Bot requires OAuth scopes: `chat:write`, `files:write`, `channels:read`. The bot token is stored as a Domo Account (same pattern as Sumble/Perplexity API keys).

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

## 20. Solution Strategy Summary — The Six Pillars

This is the "elevator pitch" view. The final solution is built on six distinct pillars. Each pillar is independently valuable, but together they create a compounding effect: more data makes the chat smarter, chat interactions surface insights that improve scoring, scoring drives better TDR prioritization, better prioritization means more valuable data is collected, and the readout captures it all as a permanent record. It's a flywheel.

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

### Pillar 7: Unstructured Knowledge (Sprint 19)
**What:** Domo filesets — PDFs containing partner playbooks, competitive battle cards, co-sell guides — are made searchable and actionable within the TDR experience. When an SE opens a TDR, the app auto-searches configured filesets for content relevant to the deal's competitors, partner platform, and cloud strategy. Results surface in the Intelligence panel and enrich the chat context.
**Why it matters independently:** Even without any other enrichment, filesets turn the TDR into a context-aware experience. An SE reviewing a Sigma competitive deal gets the Sigma battle card surfaced automatically. An SE reviewing a Snowflake co-sell deal gets the Snowflake partner playbook. The knowledge that exists in scattered PDFs becomes instantly accessible at the point of decision.
**Key outcome:** The app knows the playbook.

### Pillar 8: Lean Operating Model (Sprint 17)
**What:** The 9-step TDR is compressed into 5 required sections + optional extras. A Thesis field ("Why does Domo belong?") is always visible. Fields are replaced with forcing questions. The target is 30 minutes, not 90.
**Why it matters independently:** Even if you never build another enrichment source, a faster TDR means more deals get reviewed. The compression removes documentation overhead and focuses the SE on the one question that matters: does the technical story hold together?
**Key outcome:** The app respects the user's time.

### Pillar 9: Action Plan Synthesis (Sprint 21) — THE CAPSTONE
**What:** After TDR completion, Cortex AI synthesizes ALL captured data — SE inputs, deal metadata, Perplexity research, Sumble enrichment, fileset battle cards/playbooks, chat highlights, classified findings, Post-TDR Score — into a 7-section strategic action plan tailored to the specific deal. Every recommendation cites its data source. The plan names specific competitors, specific partners, specific people, specific technologies.
**Why it matters independently:** This is the payoff for everything else. Every other pillar *generates* intelligence. This pillar *converts* that intelligence into action. Without it, the SE/AE still has to read through raw data and figure out what to do. With it, they open the PDF and the first thing they see is: "Here's exactly what to do next, in what order, and why."
**Key outcome:** The app tells you what to do.

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

| If you build only... | The app becomes... |
|----------------------|-------------------|
| Pillar 1 (Persistence) | A reliable, auditable TDR system with history |
| Pillars 1 + 2 (+ Intelligence) | A context-rich TDR tool that knows the account |
| Pillars 1 + 2 + 3 (+ Chat) | An AI-assisted TDR workflow where you never leave the app |
| Pillars 1–4 (+ Cortex) | A strategic platform that generates insights across all deals |
| Pillars 1–5 (+ Scoring v2) | A self-improving deal intelligence system that gets smarter with every review, with Pre-TDR and Post-TDR scores |
| Pillars 1–6 (+ Readout) | A complete deal intelligence platform that produces executive-ready artifacts |
| Pillars 1–7 (+ Knowledge Base) | A knowledge-augmented TDR system — battle cards and playbooks surface automatically at the point of decision |
| Pillars 1–8 (+ Lean Model) | A fast, focused TDR that takes 30 minutes and produces structured intelligence |
| All 9 Pillars (+ Action Plan) | **The complete platform:** every data source, every AI capability, every enrichment — synthesized into a specific, tailored action plan that tells the SE/AE exactly what to do next |

Each row is a valid stopping point. The app works and delivers value at every increment. But each pillar makes the next one exponentially more powerful. Pillar 9 is the capstone: it converts everything the other eight pillars generate into a single actionable artifact — the strategic action plan that leads the PDF readout and drives the next steps in the deal.

---

*This document is a living strategy. Update it as decisions are made and phases are completed.*

