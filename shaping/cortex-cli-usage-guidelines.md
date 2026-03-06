---
shaping: true
status: accepted
appetite: ongoing (operational guideline — not a sprint)
---

# Cortex CLI Usage Guidelines

## Problem

The project has two distinct development domains: **Snowflake infrastructure** (DDL, views, stored procedures, ML models, Tasks, grants, AI functions) and **application code** (Code Engine JavaScript, frontend TypeScript/React, Python notebooks, manifest configuration, git operations). These domains share data but have completely different tooling, patterns, and expertise boundaries.

**Cortex Code CLI** (`cortex`) is a Snowflake-native agent installed locally (`~/.local/bin/cortex`, v1.0.6). It has direct access to the live Snowflake account, official Snowflake documentation, and all Cortex AI capabilities. It is extremely effective at Snowflake operations — but it has zero knowledge of the Domo App Studio ecosystem, Code Engine SDK patterns, React component architecture, or the application's TypeScript interfaces.

**The failure mode is routing the wrong work to the wrong tool.** When Cortex CLI is asked to generate Code Engine functions, it produces code that doesn't follow the `executeSql` pattern, doesn't understand JWT keypair auth, and doesn't know the `manifest.json` `packageMapping` format. When Cursor is asked to write raw DDL or debug Snowflake-specific behavior, it guesses at Snowflake syntax instead of querying the live account.

**This is a boundary enforcement problem, not a feature request.** The tools exist. The boundary just needs to be clear, documented, and consistently applied — especially as Sprint 28 (ML model) introduces significant new Snowflake infrastructure.

---

## Requirements

### R1: One rule — the line is clear

If it runs **IN Snowflake** → Cortex CLI.
If it runs **OUTSIDE Snowflake** → Cursor / direct authoring.

No exceptions, no gray areas. This applies to every sprint, every sub-sprint, every task.

### R2: Cortex CLI is the first choice for Snowflake inquiries

Before searching the web for Snowflake-specific questions (model availability, SQL syntax, Cortex function behavior, warehouse sizing, package availability), ask Cortex CLI. It has direct access to official Snowflake documentation and the live account's metadata. It is faster and more accurate than web searches for Snowflake-scoped questions.

### R3: Cortex CLI never touches application code

Cortex CLI must not be asked to:
- Generate Code Engine JavaScript functions
- Write frontend TypeScript or React components
- Create or edit `manifest.json` entries
- Author Python notebooks
- Install packages (`pip`, `npm`, `brew`)
- Make git operations
- Run tests, builds, or CI

These are application-domain operations. Cortex CLI will produce output that doesn't integrate correctly because it lacks knowledge of Domo-specific patterns, the app's component architecture, and the frontend/backend separation.

### R4: Execution model — ask, don't script

Cortex CLI operates conversationally. You execute queries by asking in natural language:

- "Create table DEAL_ML_PREDICTIONS in TDR_APP.TDR_DATA with columns..."
- "Show me the 10 most recent rows in ML_MODEL_METADATA"
- "What's the AUC_ROC for the deployed DEAL_CLOSE_PROPENSITY model?"
- "Grant CORTEX_USER to TDR_APP_ROLE"

No SQL authoring required for most operations. Cortex CLI translates intent to SQL, executes it, and returns results. For complex DDL or stored procedures, it generates and runs the SQL directly in Snowflake.

### R5: Every Snowflake-touching sprint step must label the tool

Each sub-sprint checklist item that involves Snowflake must explicitly indicate `[Cortex CLI]` or `[Cursor]` so a naive reader knows which tool to use. This was added for Sprint 28 and should continue for all future sprints.

### R6: Cortex CLI is NOT the source of ML architecture decisions

ML *strategy* decisions (model selection, feature engineering approach, label design, ensemble vs. single model, threshold calibration) are human judgment calls informed by domain expertise and shaped in documents like this one. Cortex CLI can answer "What Python packages does Snowpark support?" or "How does SNOWFLAKE.ML.CLASSIFICATION handle class imbalance?" — but it should not be the source of architectural decisions. It is an executor, not an architect.

---

## Solution Shape

### The Boundary Model

```
┌──────────────────────────────────────────────────────────────────┐
│                    SNOWFLAKE DOMAIN                              │
│                                                                  │
│   DDL · Views · Stored Procedures · Tasks · Alerts · Streams    │
│   Grants · Stages · ML Functions · Model Registry               │
│   Data Queries · AI Functions (AI_COMPLETE, AI_CLASSIFY, etc.)  │
│   Architecture Questions · SQL Debugging · Schema Validation    │
│   SNOWFLAKE.ML.CLASSIFICATION · Feature Store Views             │
│   Batch Scoring Tasks · Retraining Procedures                   │
│                                                                  │
│   Tool: Cortex CLI                                              │
│   Auth: ~/.snowflake/connections.toml (externalbrowser SSO)     │
│   Invocation: `cortex` (interactive) or `cortex -p "..."` (one-shot) │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                   APPLICATION DOMAIN                             │
│                                                                  │
│   Code Engine JavaScript (codeengine/*.js)                      │
│   Frontend TypeScript / React (src/)                            │
│   Python Notebooks (notebooks/)                                 │
│   manifest.json (dataset mappings, packageMapping)              │
│   Library Installation (pip, npm, brew)                         │
│   Git Operations                                                │
│   Testing / CI / Build                                          │
│   Application Architecture Decisions                            │
│                                                                  │
│   Tool: Cursor / direct authoring                               │
│   Patterns: follow existing codebase conventions                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Sprint-by-Sprint Tool Assignment

This table maps every Snowflake-touching sprint (past and future) to the correct tool usage:

| Sprint | Snowflake Work (Cortex CLI) | Application Work (Cursor) |
|--------|---------------------------|--------------------------|
| 1 (Foundation) | DDL: database, schema, warehouse, 6 tables, grants | Code Engine: `tdr-snowflake-persistence`. Frontend: `snowflakeStore.ts` |
| 2–3 (Persistence) | — | Code Engine wiring, TDRInputs.tsx, TDRWorkspace.tsx |
| 4–6 (Intelligence) | — | Code Engine: `tdr-account-intel`. Frontend: `accountIntel.ts` |
| 7, 9–11 (Cortex AI) | Test AI_COMPLETE prompts, validate embeddings, set up Search/Analyst | Code Engine: `tdr-cortex-ai`, `cortexAnalystCodeEngine.js`. Frontend: `cortexAi.ts` |
| 12 (Migration) | Validate data post-migration, verify table integrity | Code Engine: migration function. Frontend: remove AppDB |
| **28a (Dataset Swap)** | — | Manifest field mappings, DomoOpportunity interface, OPPORTUNITY_FIELD_MAP, Deal type |
| **28b (EDA)** | Query live Snowflake table for label distribution, feature completeness, null rates | Notebook authoring, visualization, go/no-go analysis |
| **28c (ML Infrastructure)** | ALL: ML_FEATURE_STORE view, ML_TRAINING_DATA view, DEAL_ML_PREDICTIONS table, ML_MODEL_METADATA table, grants, CREATE SNOWFLAKE.ML.CLASSIFICATION, SHOW_EVALUATION_METRICS, SHOW_FEATURE_IMPORTANCE, RETRAIN procedure, Tasks | — |
| **28d (Code Engine)** | Tasks: nightly batch scoring, weekly retrain. Procedure: RETRAIN_PROPENSITY_MODEL | Code Engine functions: getWinProbability, batchScoreDeals, getModelMetrics, retrainModel. Manifest packageMapping. Frontend: mlPredictions.ts |
| **28e (Frontend)** | — | Propensity column, quadrant scatter, SHAP factors, Intelligence Panel, portfolio metrics |

### Invocation Patterns

**Interactive mode** — for exploration, debugging, multi-step operations:
```bash
cortex
# Then conversationally:
# "Show me all tables in TDR_APP.TDR_DATA"
# "Create view ML_FEATURE_STORE as SELECT ..."
# "What Cortex AI_COMPLETE models are available in my region?"
```

**One-shot mode** (`-p` flag) — for scripted checks, quick validation:
```bash
cortex -p "Count rows in DEAL_ML_PREDICTIONS where SCORED_AT > DATEADD(day, -1, CURRENT_TIMESTAMP())"
cortex -p "Show the schema of ML_FEATURE_STORE"
cortex -p "What's the latest model version in ML_MODEL_METADATA?"
```

**Prompt testing** — validate AI prompts before Code Engine:
```bash
cortex -p "SELECT AI_COMPLETE('claude-4-sonnet', 'You are a deal analyst. Given these features: ... What is the likely outcome?')"
```

### Anti-Patterns (Mistakes to Never Repeat)

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Asking Cortex CLI to generate Code Engine functions | Doesn't know Domo SDK, `executeSql` pattern, JWT auth, `packageMapping` format | Author in Cursor following `codeengine/*.js` patterns |
| Asking Cortex CLI to write React components | No knowledge of app's component architecture, hooks, TypeScript interfaces, design system | Author in Cursor following `src/` patterns |
| Asking Cortex CLI for ML architecture decisions | ML strategy is human judgment; CLI is an executor, not an architect | Shape in documents (this repo's `shaping/` directory), then execute via CLI |
| Asking Cortex CLI to edit manifest.json | Domo manifest format is application-specific | Author directly in Cursor following existing manifest structure |
| Searching the web for Snowflake syntax before asking CLI | CLI has direct access to official docs + live account metadata; it's faster and more accurate | Ask CLI first, web search only if CLI can't answer |
| Writing raw SQL manually for DDL | Error-prone, no validation | Ask CLI conversationally: "Create table X with columns Y, Z" — it generates, validates, and executes |

---

## Fit Check

| Requirement | Addressed By |
|------------|-------------|
| R1: Clear line | Boundary model diagram + sprint tool assignment table |
| R2: Cortex CLI first for Snowflake | Invocation patterns + anti-pattern table (row 5) |
| R3: Never touches app code | Anti-pattern table + explicit "Application Domain" box in boundary model |
| R4: Ask, don't script | Invocation patterns section (interactive + one-shot + prompt testing) |
| R5: Label tool per sprint step | Sprint-by-sprint tool assignment table + Sprint 28 sub-sprint annotations in IMPLEMENTATION_STRATEGY.md |
| R6: Not the architect | Anti-pattern table (row 3) + R6 requirement text |

---

## Open Questions (Resolved)

**Q1: Should there be a Cursor rule that enforces this?**
→ **Yes.** `.cursor/rules/cortex-cli.mdc` exists with `alwaysApply: true`. It fires on every conversation and contains the cardinal rule, USE/DON'T USE lists, and "The Line." References this shaping document and IMPLEMENTATION_STRATEGY.md Section 16.7.

**Q2: What about hybrid steps like Sprint 28d (Code Engine + Tasks)?**
→ **Split by domain.** Code Engine function authoring → Cursor. Task/Procedure creation → Cortex CLI. The sprint step annotation explicitly labels both: `[Cursor for CE code + Cortex CLI for Tasks/Procedures]`.

**Q3: What if Cortex CLI's Snowflake documentation is outdated?**
→ **CLI auto-updates its knowledge.** Cortex Code CLI pulls from current Snowflake documentation. If a question genuinely can't be answered by CLI (rare), fall back to web search — but always try CLI first.

**Q4: Does the EDA notebook (28b) use Cortex CLI?**
→ **Partially.** Cortex CLI is used to query the live Snowflake table for raw data exploration (label counts, null rates, feature distributions). The notebook itself (Python, pandas, matplotlib, analysis logic) is authored in Cursor. The notebook may also connect to Snowflake directly via `snowflake-connector-python` for in-notebook queries.

---

## Rabbit Holes

**1. Cortex CLI for code review.** Don't ask Cortex CLI to review Code Engine functions or frontend code. It will produce feedback that sounds plausible but misses Domo-specific patterns. Code review stays in Cursor.

**2. Cortex CLI for test data generation.** Cortex CLI can INSERT test rows into Snowflake tables (useful for validation), but should not be asked to generate mock data for frontend unit tests. Those follow frontend patterns.

**3. Over-reliance on one-shot mode.** The `-p` flag is great for quick checks, but complex multi-step operations (create view → verify → grant → test) benefit from interactive mode where the CLI maintains context across steps.

---

## Relationship to Existing Documentation

| Document | What It Contains | Role |
|----------|-----------------|------|
| `.cursor/rules/cortex-cli.mdc` | Always-applied Cursor rule with USE/DON'T USE lists | Enforcement — fires on every conversation |
| `IMPLEMENTATION_STRATEGY.md` Section 16.1–16.7 | Installation, version, use cases, best practices, anti-patterns, engagement model, Sprint 28 workflow | Comprehensive reference |
| **This document** (`shaping/cortex-cli-usage-guidelines.md`) | Problem framing, requirements, boundary model, sprint tool assignment, invocation patterns, fit check | Shaped specification — the "why" and "how" behind the boundary |
