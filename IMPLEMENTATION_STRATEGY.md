# TDR Deal Inspection — Implementation Strategy

> Account Intelligence, Snowflake Persistence, and Cortex AI Integration

**Status:** Planning · **Version:** Draft 1.0 · **Date:** February 8, 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Baseline](#2-current-architecture-baseline)
3. [Strategic Goals](#3-strategic-goals)
4. [Snowflake Schema Design](#4-snowflake-schema-design)
5. [Code Engine Functions](#5-code-engine-functions)
6. [Perplexity Integration](#6-perplexity-integration)
7. [Sumble Integration](#7-sumble-integration)
8. [Snowflake Cortex Integration](#8-snowflake-cortex-integration)
9. [Front-End Architecture Changes](#9-front-end-architecture-changes)
10. [TDR Scoring Enrichment](#10-tdr-scoring-enrichment)
11. [API Cost & Rate Limit Strategy](#11-api-cost--rate-limit-strategy)
12. [Migration Plan (AppDB → Snowflake)](#12-migration-plan-appdb--snowflake)
13. [Risks & Considerations](#13-risks--considerations)
14. [Implementation Phases](#14-implementation-phases)
15. [Reference Links](#15-reference-links)

---

## 1. Executive Summary

This document describes the strategy for transforming the TDR Deal Inspection app from an internally-scoped scoring tool into an intelligence-enriched review platform. Three new capabilities are introduced:

1. **External Account Intelligence** — Perplexity (web research) and Sumble (firmographic/technographic enrichment) provide real-world context about each account's technology stack, strategic initiatives, and competitive landscape.

2. **Snowflake Persistence** — All TDR session data, step inputs, and account intelligence move from Domo AppDB to Snowflake. Every write is append-only with timestamps, enabling full iteration history and cross-deal analytics.

3. **Snowflake Cortex AI** — Cortex AI SQL functions (`AI_COMPLETE`, `AI_AGG`, `AI_SUMMARIZE_AGG`, `AI_CLASSIFY`, `AI_EXTRACT`, `AI_EMBED`, Cortex Analyst, Cortex Search) process stored data directly in Snowflake to generate TDR summaries, cross-deal insights, competitive intelligence aggregation, and semantic search across all account research.

The architecture routes all external API calls and Snowflake operations through **Domo Code Engine functions**, keeping API keys server-side and the front-end stateless.

---

## 2. Current Architecture Baseline

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

## 3. Strategic Goals

| # | Goal | Metric |
|---|------|--------|
| 1 | **Eliminate manual account research** | SE Manager can see tech stack + strategic context without leaving the app |
| 2 | **Persist all TDR work product in Snowflake** | Every input, every research pull, every iteration — queryable via SQL |
| 3 | **Enable cross-deal intelligence** | Cortex AI surfaces patterns across the full portfolio, not just one deal at a time |
| 4 | **Control API costs** | Perplexity + Sumble calls are user-triggered, cached, and metered |
| 5 | **Maintain graceful degradation** | App works on SFDC data alone if any external service is unavailable |

---

## 4. Snowflake Schema Design

All tables live in a dedicated schema (e.g., `TDR_APP.PUBLIC` or `TDR_APP.TDR_DATA`). All writes are append-only with timestamps to support iteration tracking.

### Table 1: `TDR_SESSIONS`

Replaces Domo AppDB `TDRSessions` collection.

```sql
CREATE TABLE IF NOT EXISTS TDR_SESSIONS (
  SESSION_ID         VARCHAR PRIMARY KEY,     -- UUID generated client-side
  OPPORTUNITY_ID     VARCHAR NOT NULL,        -- SFDC Opportunity Id
  OPPORTUNITY_NAME   VARCHAR,
  ACCOUNT_NAME       VARCHAR,
  ACV                NUMBER(12,2),
  STAGE              VARCHAR,
  STATUS             VARCHAR,                 -- 'in-progress' | 'completed'
  OUTCOME            VARCHAR,                 -- 'approved' | 'needs-work' | 'deferred' | 'at-risk'
  OWNER              VARCHAR,                 -- AE who owns the deal
  CREATED_BY         VARCHAR,                 -- Domo user who initiated
  ITERATION          INTEGER DEFAULT 1,       -- Which TDR pass (1st, 2nd, etc.)
  CREATED_AT         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  UPDATED_AT         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);
```

**Why `ITERATION`?** — When a deal goes through multiple TDR cycles (e.g., initial review, then a re-review after stalling), each cycle is a separate session with an incrementing iteration number. This lets you query "how did TDR findings change between the 1st and 3rd review?"

### Table 2: `TDR_STEP_INPUTS`

Stores every field value from every TDR step. Append-only — every save creates a new row.

```sql
CREATE TABLE IF NOT EXISTS TDR_STEP_INPUTS (
  INPUT_ID           VARCHAR PRIMARY KEY,     -- UUID
  SESSION_ID         VARCHAR NOT NULL,        -- FK → TDR_SESSIONS
  OPPORTUNITY_ID     VARCHAR NOT NULL,
  STEP_ID            VARCHAR NOT NULL,        -- 'context' | 'decision' | 'current-arch' | ...
  FIELD_ID           VARCHAR NOT NULL,        -- 'strategic-value' | 'business-impact' | ...
  FIELD_VALUE        VARCHAR,                 -- The user's input
  SAVED_AT           TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  SAVED_BY           VARCHAR
);
```

**Querying the latest value per field:**

```sql
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY SESSION_ID, STEP_ID, FIELD_ID
    ORDER BY SAVED_AT DESC
  ) AS rn
  FROM TDR_STEP_INPUTS
  WHERE SESSION_ID = :sid
) WHERE rn = 1;
```

**Viewing edit history for a single field:**

```sql
SELECT FIELD_VALUE, SAVED_AT, SAVED_BY
FROM TDR_STEP_INPUTS
WHERE SESSION_ID = :sid AND STEP_ID = 'current-arch' AND FIELD_ID = 'existing-systems'
ORDER BY SAVED_AT;
```

### Table 3: `ACCOUNT_INTEL_SUMBLE`

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

### Table 4: `ACCOUNT_INTEL_PERPLEXITY`

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

### Table 5: `API_USAGE_LOG`

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

### Table 6: `CORTEX_ANALYSIS_RESULTS`

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

---

## 5. Code Engine Functions

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
├── functions.js        ← Main entry point. Exports all 21 functions.
├── snowflakeAuth.js    ← Shared JWT auth + SQL execution (from cortexAnalystCodeEngine.js)
├── persistence.js      ← TDR session + step input CRUD (8 functions)
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
        { "alias": "fieldId", "type": "string", "nullable": false, "isList": false, "children": null },
        { "alias": "fieldValue", "type": "string", "nullable": false, "isList": false, "children": null },
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
| **Domo I/O Type** | Input: 6× `string` → Output: `object` |
| **SQL** | `INSERT INTO TDR_STEP_INPUTS (INPUT_ID, SESSION_ID, OPPORTUNITY_ID, STEP_ID, FIELD_ID, FIELD_VALUE, SAVED_BY)` |

**Input:**
- `sessionId` (string)
- `opportunityId` (string)
- `stepId` (string): e.g. `"context"`, `"current-arch"`, `"target-arch"`
- `fieldId` (string): e.g. `"strategic-value"`, `"existing-systems"`
- `fieldValue` (string): the user's input text
- `savedBy` (string): Domo username

**Output:** `{ "success": true, "inputId": "uuid" }`

> **Key design:** This is **append-only**. Every save creates a new row. The latest value per field is determined by `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY SAVED_AT DESC)`.

##### `getLatestInputs`

| | |
|---|---|
| **Purpose** | Get the most recent value for every field in a session |
| **Domo I/O Type** | Input: `string` → Output: `object[]` |
| **SQL** | ROW_NUMBER window query (see Section 4, Table 2) |

**Input:** `sessionId` (string)

**Output:** Array of `{ stepId, fieldId, fieldValue, savedAt, savedBy }`

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

## 6. Perplexity Integration

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
| User opens TDR Workspace for a deal | **Maybe** | Checks Snowflake for cached intel first. Only calls if no data or stale (> cache TTL) |
| User clicks "Research Account" button | **Yes** | Explicit user intent. New row appended to Snowflake |
| User clicks "Refresh Research" button | **Yes** | Explicit re-pull. Previous data preserved for comparison |
| Tooltip hover | **No** | Tooltips show cached/scored data only |

---

## 7. Sumble Integration

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

## 8. Snowflake Cortex Integration

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

## 9. Front-End Architecture Changes

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
| **Enable Account Research** | boolean | `true` | Master toggle |
| **Auto-Enrich on TDR Start** | boolean | `true` | Auto-fetch intel when opening workspace |
| **Cache Duration (hours)** | number | `24` | TTL for cached intelligence |
| **Monthly API Calls** | read-only | — | Current month Perplexity + Sumble call count (from `API_USAGE_LOG`) |

API keys are NOT in the Settings page — they live as Domo Account secrets accessed only by Code Engine.

### 9.7 Deals Table Indicators (`DealsTable.tsx`)

- 🔍 icon next to account name when `AccountIntelligence` exists in Snowflake
- New "Why TDR?" pills for enrichment-based factors (see Section 10)
- TDR Score tooltip notes when enrichment data contributed to the score

---

## 10. TDR Scoring Enrichment

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

## 11. API Cost & Rate Limit Strategy

### Call Budget

| API | Rate Limit | Expected Monthly Usage | Trigger Model |
|-----|-----------|----------------------|---------------|
| **Sumble** | 10 req/sec | 50–100 enrichments | User-initiated only |
| **Perplexity** | Per-plan | 50–100 research pulls | User-initiated only |
| **Cortex AI** | Per-credit (compute) | ~200 function calls | User-initiated + scheduled batch |
| **Domo AI** | Domo-managed | ~50 recommendation runs | On page load (existing) |

### Cost Control Mechanisms

1. **User-triggered only** — Perplexity and Sumble are NEVER called automatically on page load or batch. Only when a user explicitly opens a TDR or clicks "Research."

2. **Cache-first architecture** — Every call checks Snowflake for cached results before making an API call. Default TTL: 24 hours.

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

## 12. Migration Plan (AppDB → Snowflake)

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

## 13. Risks & Considerations

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

---

## 14. Implementation Phases

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
- [ ] Implement cache-first architecture with configurable TTL

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

## 15. Sprint Plan & Progress Tracker

Each sprint is a focused work session (2–4 hours). The app remains fully functional after every sprint — no sprint leaves the app in a broken state. Sprints are ordered by dependency: each builds on the one before it.

### Sprint 1 — Snowflake Foundation ⬜

> **Goal:** Stand up the Snowflake environment. Zero app changes.
> **Risk to app:** None — purely infrastructure.

- [ ] Run bootstrap DDL: create `TDR_APP` database, `TDR_DATA` schema, `TDR_APP_WH` warehouse (XS, auto-suspend 60s), `TDR_APP_ROLE` role
- [ ] Run table DDL: create all 6 tables (`TDR_SESSIONS`, `TDR_STEP_INPUTS`, `ACCOUNT_INTEL_SUMBLE`, `ACCOUNT_INTEL_PERPLEXITY`, `API_USAGE_LOG`, `CORTEX_ANALYSIS_RESULTS`)
- [ ] Grant permissions: `TDR_APP_ROLE` gets USAGE + ALL on schema/tables/warehouse + `CORTEX_USER` database role
- [ ] Deploy `snowflakeAuth.js` shared infrastructure to Code Engine (JWT auth + `executeSql` + `mapRows`)
- [ ] Validate: run a test SQL (`SELECT CURRENT_TIMESTAMP()`) from Code Engine → confirm it returns successfully
- [ ] Verify: `INSERT` + `SELECT` on `TDR_SESSIONS` from Code Engine → confirm round-trip works

**Definition of Done:** Code Engine can authenticate to Snowflake and execute SQL against all 6 tables.

---

### Sprint 2 — Session Persistence (Dual-Write) ⬜

> **Goal:** TDR sessions save to Snowflake AND AppDB. Reads prefer Snowflake, fall back to AppDB.
> **Risk to app:** Low — dual-write means AppDB is still the safety net.

- [ ] Deploy persistence functions to Code Engine: `createSession`, `updateSession`, `getSessionsByOpp`, `getAllSessions`, `deleteSession`
- [ ] Add `packageMapping` entries for the 5 session functions to `manifest.json`
- [ ] Create `src/lib/snowflakeStore.ts` — front-end service wrapping Code Engine calls
- [ ] Capture user identity: call `/domo/users/v1/me` on app init, store in React context
- [ ] Wire `TDRWorkspace.tsx`: session create/update → `snowflakeStore` (with AppDB dual-write)
- [ ] Wire `useDomo.ts`: session fetch → try Snowflake first, fall back to AppDB
- [ ] Test: create a TDR session in the app → verify row appears in Snowflake AND AppDB
- [ ] Test: load deals table → verify TDR status column still populates correctly

**Definition of Done:** Sessions persist to both Snowflake and AppDB. Users see no difference in behavior.

---

### Sprint 3 — Step Input Persistence ⬜

> **Goal:** TDR step field values save to Snowflake (append-only). Edit history becomes available.
> **Risk to app:** Low — additive only.

- [ ] Deploy remaining persistence functions: `saveStepInput`, `getLatestInputs`, `getInputHistory`
- [ ] Add `packageMapping` entries for the 3 input functions
- [ ] Wire `TDRInputs.tsx`: on field blur/change → debounced `saveStepInput` call
- [ ] Wire `TDRWorkspace.tsx`: on session open → `getLatestInputs` to populate fields
- [ ] Add "View edit history" button per field → calls `getInputHistory`, shows modal with timestamped changes
- [ ] Test: fill out TDR steps, close workspace, reopen → fields restore from Snowflake
- [ ] Test: edit a field 3 times → "View history" shows all 3 values with timestamps

**Definition of Done:** All TDR step inputs persist to Snowflake with full edit history. Fields auto-populate on session open.

---

### Sprint 4 — Sumble Account Enrichment ⬜

> **Goal:** Enrich accounts with firmographic + technographic data from Sumble.
> **Risk to app:** None — new feature, no existing behavior changes.

- [ ] Create Domo Account for Sumble API key (store `apiKey` property)
- [ ] Deploy `enrichSumble`, `getLatestIntel`, `getIntelHistory` functions to Code Engine
- [ ] Add `packageMapping` entries
- [ ] Create `src/lib/accountIntel.ts` — front-end orchestration service
- [ ] Add domain input field to TDR Workspace (editable, with heuristic pre-fill from account name)
- [ ] Add "Enrich Account" button → calls `enrichSumble` → displays tech stack as categorized badges
- [ ] Add "Account Intelligence" section to `TDRIntelligence.tsx` — industry, revenue, employee count, tech stack
- [ ] Test: click "Enrich Account" for a real deal → see Sumble data in workspace AND in Snowflake table
- [ ] Test: click again → see 2 pulls in `ACCOUNT_INTEL_SUMBLE`

**Definition of Done:** SE Manager can enrich an account with one click. Tech stack displays in workspace. Data persists with timestamps.

---

### Sprint 5 — Perplexity Web Research ⬜

> **Goal:** Research accounts via web to surface strategic context, competitive landscape, and technology signals.
> **Risk to app:** None — new feature, no existing behavior changes.

- [ ] Create Domo Account for Perplexity API key (store `apiKey` property)
- [ ] Deploy `researchPerplexity` function to Code Engine
- [ ] Add `packageMapping` entry
- [ ] Add "Account Research" step to TDR Workspace (new Step 2 between Deal Context and Business Decision)
- [ ] Research view: summary, recent initiatives, technology signals, competitive landscape, key insights, citations
- [ ] "Research Account" button → calls `researchPerplexity` with deal context
- [ ] "Refresh Research" button → appends new row (doesn't overwrite)
- [ ] Show citation URLs as clickable links
- [ ] Test: research a well-known company → see structured findings with sources
- [ ] Test: research twice → both pulls visible in history

**Definition of Done:** SE Manager can research any account from the workspace. Findings are structured, sourced, and persisted.

---

### Sprint 6 — Caching, Settings & Usage Tracking ⬜

> **Goal:** Add cache-first reads, configurable TTL, and API usage visibility. Prevent unnecessary API calls.
> **Risk to app:** None — new Settings card, no existing behavior changes.

- [ ] Deploy `getUsageStats` function to Code Engine
- [ ] Implement cache-first logic in `accountIntel.ts`: check `getLatestIntel` before calling APIs
- [ ] Add configurable cache TTL to `AppSettings` interface (default 24 hours)
- [ ] Add "Account Intelligence" card to Settings page: enable/disable toggle, auto-enrich on TDR start toggle, cache duration slider
- [ ] Add monthly API usage counter to Settings page (calls `getUsageStats`)
- [ ] Implement `getIntelHistory` UI: "View Research History" button showing timestamped pulls with diff highlights
- [ ] Add 🔍 icon to DealsTable account name column when cached intel exists
- [ ] Test: open workspace for a previously-enriched deal → intel loads from cache (no API call)
- [ ] Test: Settings page shows accurate call counts

**Definition of Done:** API calls only happen when cache is stale or user explicitly requests refresh. Usage is visible.

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

### Sprint 8 — Cortex AI: Portfolio & Sentiment ⬜

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

### Sprint 9 — TDR Scoring Enrichment ⬜

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

### Sprint 10 — Semantic Search & Analyst ⬜

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

### Sprint 11 — Migration & Cleanup ⬜

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

| Sprint | Name | Status | Dependencies |
|--------|------|--------|-------------|
| 1 | Snowflake Foundation | ⬜ Not Started | None |
| 2 | Session Persistence (Dual-Write) | ⬜ Not Started | Sprint 1 |
| 3 | Step Input Persistence | ⬜ Not Started | Sprint 2 |
| 4 | Sumble Account Enrichment | ⬜ Not Started | Sprint 1 |
| 5 | Perplexity Web Research | ⬜ Not Started | Sprint 1 |
| 6 | Caching, Settings & Usage | ⬜ Not Started | Sprints 4 + 5 |
| 7 | Cortex AI: Deal-Level | ⬜ Not Started | Sprints 3 + 6 |
| 8 | Cortex AI: Portfolio & Sentiment | ⬜ Not Started | Sprint 7 |
| 9 | TDR Scoring Enrichment | ⬜ Not Started | Sprint 6 |
| 10 | Semantic Search & Analyst | ⬜ Not Started | Sprint 7 |
| 11 | Migration & Cleanup | ⬜ Not Started | All above |

**Parallel tracks:** Sprints 4 and 5 (Sumble + Perplexity) can run in parallel — they both depend on Sprint 1 but not on each other. Similarly, Sprints 2–3 (persistence) and 4–5 (intelligence) are independent tracks that converge at Sprint 6.

```
Sprint 1 ──┬── Sprint 2 ── Sprint 3 ──┐
            │                           ├── Sprint 7 ── Sprint 8
            ├── Sprint 4 ──┐            │        │
            │               ├── Sprint 6 ┘        ├── Sprint 10
            └── Sprint 5 ──┘      │               │
                                  └── Sprint 9     │
                                                   │
                                         Sprint 11 ┘
```

---

## 16. Reference Links

| Resource | URL |
|----------|-----|
| Snowflake Cortex AI Functions | https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql |
| Cortex Code CLI | https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli |
| Perplexity API Docs | https://docs.perplexity.ai/docs/getting-started/overview |
| Sumble API Docs | https://docs.sumble.com/api |
| Snowflake SQL API (Statements) | https://docs.snowflake.com/en/developer-guide/sql-api/reference |
| Domo Code Engine | https://developer.domo.com/portal/8k7stcm6lubfh-code-engine-overview |
| Domo AppDB API | https://developer.domo.com/portal/1l1fm2g0sfm69-app-db-api |
| Sample: aptSnowflakeCodeEngine.js | `samples/aptSnowflakeCodeEngine.js` (local) |
| Sample: cortexAnalystCodeEngine.js | `samples/cortexAnalystCodeEngine.js` (local) |

---

*This document is a living strategy. Update it as decisions are made and phases are completed.*

