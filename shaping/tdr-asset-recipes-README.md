# TDR Asset Recipes

A centralized repository for automated Sales Asset Generation Recipes exported from the **[Deal Inspect](https://github.com/cassidythilton/deal-inspect)** app.

## Overview

When a Technical Discovery & Review (TDR) is completed in Deal Inspect, the system aggregates a wealth of context about the deal:

- **Gong Transcripts** — digests and targeted excerpts from customer calls
- **TDR Inputs** — structured SE/SA assessments across 5 discovery steps
- **Perplexity Research** — web-grounded account intelligence (initiatives, tech signals, competitive landscape)
- **Sumble Enrichment** — technographic/firmographic data (tech stack, org profile, hiring signals, key people)
- **Cortex AI Analysis** — AI-generated brief, classified findings, extracted entities, structured extractions, action plans

Instead of manually synthesizing this data into sales materials, Deal Inspect generates a structured **Markdown Recipe** — a self-contained contract that tells a downstream agentic process exactly what assets to generate, with what context, using which skills.

## How It Works

```
Deal Inspect App                    This Repository               Downstream Agent
┌─────────────────┐                ┌──────────────────┐          ┌──────────────────┐
│ Gong transcripts │                │                  │          │                  │
│ TDR inputs       │  ──────────►  │  recipes/        │  ─────►  │  Asset Generator │
│ Perplexity       │  Push to      │  {dealId}.md     │  Reads   │  (Cursor, Claude │
│ Sumble           │  GitHub       │                  │  recipe  │   Code, CI/CD)   │
│ Cortex AI        │               │                  │          │                  │
└─────────────────┘                └──────────────────┘          └──────────────────┘
        │                                   │                            │
        │  Slack alert ──────────────────►  #tdr-channel                 │
        │                                                                │
        │                          Generated Assets                      │
        │                          ┌────────────────────────────────────┐│
        │                          │ Solution Brief, Pitch Deck,       ││
        │                          │ Architecture Diagrams, App Specs, ││
        │                          │ ROI Framework, AI/ML Architecture ││
        │                          └────────────────────────────────────┘│
```

1. **Export:** A user clicks the "Generate Asset Recipe" (Wand2 icon) in the Deal Inspect TDR Workspace.
2. **Compile:** The app compiles all deal context, runs the AI Value Continuum assessment, dynamically maps required assets, and resolves the latest agent skills.
3. **Push:** The resulting `.md` recipe is pushed to this repository at `recipes/{dealId}-{timestamp}.md` and an alert is sent to `#tdr-channel` in Slack.
4. **Generate:** A downstream agent picks up the recipe and generates the final sales assets.

## Recipe Structure

Each recipe follows this structure:

```
# Asset Generation Recipe: {dealName}

## Meta
Deal ID, account, ACV, stage, timestamp, recipe version

## System Instructions
Role prompt, quality standards, output expectations

## Asset Manifest
Table of assets to generate + per-asset instruction blocks

## AI Value Continuum Assessment
Proactive AI opportunity analysis (always present)

## Deal Context
  ### CRM Context
  ### TDR Discovery Inputs
  ### Gong Call Intelligence
  ### Account Research (Perplexity)
  ### Account Enrichment (Sumble)
  ### AI-Synthesized Intelligence

## Available Agent Skills
Skill reference table from stahura/domo-ai-vibe-rules

## Constraints & Guardrails
```

## Asset Catalog

### Universal Assets (every deal)

| # | Asset | Description | Audience |
|---|-------|-------------|----------|
| U1 | **Solution Brief** | Executive summary mapping Domo capabilities to customer's stated challenges and technology landscape. | Executive / Mixed |
| U2 | **Executive Pitch Deck Outline** | Slide-by-slide narrative: situation → challenges → vision → solution → differentiation → value → next steps. | Executive |
| U3 | **ROI / Business Case Framework** | Quantified value proposition: cost savings, efficiency gains, revenue enablement, scaffolded from deal data. | Executive / Finance |
| U4 | **Deal Strategy Playbook** | Internal coaching document: win themes, objection handling, stakeholder influence strategy, competitive counter-positioning. | SE/SA (internal) |

### Layer-Conditional Assets (triggered by Domo Layers in TDR)

| # | Asset | Trigger Layer | Key Skills |
|---|-------|---------------|------------|
| L1 | **Integration Architecture Diagram** | Data Integration | `domo-code-engine`, `domo-workflow`, `domo-manifest` |
| L2 | **Data Warehouse Design Brief** | Data Warehouse | `domo-dataset-query`, `domo-performance-optimizations` |
| L3 | **Dashboard & Analytics Blueprint** | Visualization / BI | `domo-dataset-query`, `domo-data-api` |
| L4 | **Embedded Analytics Design** | Embedded Analytics | `domo-js`, `domo-manifest` |
| L5 | **App Prototype Specification** | App Development | `domo-app-initial-build-playbook`, `domo-js`, `domo-manifest`, `domo-appdb` |
| L6 | **Automation & Alerting Playbook** | Automation / Alerts | `domo-workflow`, `domo-code-engine` |
| L7 | **AI/ML Solution Architecture** | AI / ML _or_ Cortex proactive assessment | `domo-ai-service-layer`, `domo-code-engine`, `domo-workflow` |

### Signal-Conditional Assets (triggered by deal context)

| # | Asset | Trigger Signal |
|---|-------|---------------|
| S1 | **Competitive Positioning Sheet** | Named competitors detected |
| S2 | **Partner Enablement Brief** | Partner deal identified |
| S3 | **Technical POC Plan** | Deal stage is POC/Pilot/Evaluation |
| S4 | **Executive Stakeholder Map** | High-complexity deal or multiple executives |
| S5 | **Re-Engagement Strategy** | Stalled deal |
| S6 | **Discovery-to-Demo Bridge** | Early-stage deal (stage ≤ 2) |
| S7 | **Implementation Readiness Packet** | Late-stage deal (stage ≥ 5) |
| S8 | **Security & Governance Addendum** | Governance layer or regulated industry |

## AI Value Continuum

The recipe includes a proactive AI opportunity assessment mapped to the **AI Value Continuum** — four levels of AI capability that Domo delivers:

| Level | Name | What It Does | Domo Capabilities |
|-------|------|-------------|-------------------|
| 1 | **Process Automation** | Executes rules — "if X then Y" at scale | Workflows, Buzz Alerts, Code Engine, Magic ETL |
| 2 | **Traditional AI & ML** | Predicts outcomes from historical data | `SNOWFLAKE.ML.CLASSIFICATION`, Cortex `AI_CLASSIFY`, AutoML, Model Registry |
| 3 | **Generative AI** | Creates text, summaries, and structured outputs from prompts | Cortex `AI_COMPLETE`, `AI_EXTRACT`, AI Service Layer, Cortex Search (RAG) |
| 4 | **Agentic AI** | Goal → Plan → Act → Reflect loops with tool calling | Workflows + Code Engine + AI Service Layer + AppDB |

The assessment analyzes Gong transcripts, Perplexity research, Sumble tech stack, and TDR inputs to identify AI opportunities — even when the SE/SA didn't explicitly surface them. This ensures no AI opportunity goes unidentified due to the user's lack of AI fluency.

## Agent Skills Integration

Recipes reference skills from the [Domo AI Vibe Rules](https://github.com/stahura/domo-ai-vibe-rules) repository. Each asset instruction includes specific skill IDs that the downstream agent should apply to ensure generated assets adhere to Domo platform best practices.

| Skill | Purpose |
|-------|---------|
| `domo-app-initial-build-playbook` | Kickoff sequence for new app builds |
| `domo-js` | ryuu.js usage, navigation, events |
| `domo-manifest` | manifest.json mapping and gotchas |
| `domo-dataset-query` | @domoinc/query syntax and constraints |
| `domo-data-api` | Data access routing |
| `domo-appdb` | AppDB CRUD/query patterns |
| `domo-ai-service-layer` | AIClient generation and parsing |
| `domo-code-engine` | Code Engine function invocation |
| `domo-workflow` | Workflow patterns and contracts |
| `domo-performance-optimizations` | Query performance rules |
| `domo-app-publish` | Build and publish flow |
| `rules/core-platform-rule.md` | Always-on platform guardrails |
| `rules/domo-gotchas.md` | Common pitfalls and fixes |

## Directory Structure

```
tdr-asset-recipes/
├── README.md           # This file
└── recipes/            # Generated recipe files
    ├── {dealId}-{timestamp}.md
    ├── {dealId}-{timestamp}.md
    └── ...
```

## For Downstream Agents

If you are an AI agent consuming a recipe from this repository:

1. **Read the recipe file** — it is fully self-contained.
2. **Follow the System Instructions** — they define your role, quality standards, and output expectations.
3. **Generate each asset in the Asset Manifest** — in priority order (Critical → Recommended → Optional).
4. **Use the specified skills** — install from `stahura/domo-ai-vibe-rules` via `npx skills add`.
5. **Weight context sections** as directed by each asset's `contextPriority` list.
6. **Respect constraints** — audience profile, output format, and no-go boundaries.
7. **Always include the AI Value Continuum Assessment** in any AI-related assets.

## Source

This repository is automatically populated by the [Deal Inspect](https://github.com/cassidythilton/deal-inspect) application via `src/lib/recipeGenerator.ts`. The recipe architecture is specified in `shaping/sales-asset-generation-recipe.md` within that repository.
