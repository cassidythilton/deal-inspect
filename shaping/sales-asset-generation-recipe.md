---
shaping: true
status: draft
appetite: large (1–2 weeks)
---

# Sales Asset Generation Recipe

## Source

> "in this app we now have full gong transcripts by deal, strategic and insightful inputs from the tdr process, enrichment data from perplexity, submle, etc. I now want to use this data as a means for generating assets that sellers (solutions engineers, solution architects) can use to close the deal more efficiently and to maximize the deal size. these assets could include solution briefs, app prototypes, solution architecture diagrams, pitch decks, etc. etc. (I want you to think deeply about the various, optional items that should be included here). These will all be very specific to the aforementioned context on the deal, and would be honed even further based on the Domo Layers entered in the TDR process (e.g. not every deal needs an app prototype or an integration strategy). Note i am working on specific skills, etc. that can be referenced for this purpose (which we can add to and further evolve as needed) here: [https://github.com/stahura/domo-ai-vibe-rules/tree/main](https://github.com/stahura/domo-ai-vibe-rules/tree/main) . Note these assets will likely be generated in a separate process/app but we need to provide a detailed plan/recipe that it can pick up and reference."

> "we should ensure the AI/ML solution is stupid and bullet proof. what i want is for options across this slide [AI Value Continuum] to be teased out e.g. does a simple rules based solution apply here? what types of ml models may be applicable? etc. also, we should not rely solely on the Domo Layers identified as AI is so prevalent with so much opportunity in so many different scenarios but oftentimes not necessarily surfaced in the TDR process due to the user's lack of skills around opportunity identification (perhaps cortex can be used here)?"

> "the repo is https://github.com/cassidythilton/tdr-asset-recipes and you'll need to add/update the readme.md in that repo so it's comprehensive and accurate."

> "we should do all the spec's in this app, to be referenced downstream."

> "let's build an automated reference of the repo [stahura/domo-ai-vibe-rules] for our efforts."

---

## Problem

The `deal-inspect` app has become a **rich intelligence hub** for every deal: five TDR steps capturing strategic context, Gong transcript digests capturing the buyer's own words, Perplexity research on the account's business landscape, Sumble enrichment on their tech stack and org structure, and Cortex AI extractions (entities, findings, structured fields, action plans). This is some of the most differentiated context a seller could ask for.

**But none of it flows forward into the deal-closing motion.** Today, an SE or SA receives a TDR readout PDF — a backward-looking document that summarizes what was discussed. There is no mechanism to convert this intelligence into **forward-looking, deal-specific deliverables**: the solution briefs that frame the value proposition, the architecture diagrams that prove technical fit, the pitch decks that tell the customer's own story back to them, the app prototypes that make the vision tangible. Sellers are left to manually synthesize TDR outputs, Gong excerpts, and enrichment data into these artifacts — a time-consuming process that results in generic materials rather than deeply contextualized ones.

The **Domo Layers** captured in the TDR process (Data Integration, Data Warehouse, Visualization / BI, Embedded Analytics, App Development, Automation / Alerts, AI / ML) create a natural taxonomy for which assets a deal actually needs. A pure BI deal doesn't need an app prototype spec. A data integration play doesn't need embedded analytics design docs. But today, this layer signal is unused beyond the TDR itself.

**AI opportunity is systematically under-identified.** The TDR form's AI/ML step relies on the SE/SA to recognize and articulate AI opportunities. But AI is pervasive — nearly every data problem has an AI angle (automation of manual loops, predictive scoring, generative document creation, agentic orchestration). SEs who lack deep AI fluency will mark "No AI Opportunity Identified" when there are clear signals in the Gong transcripts, Perplexity research, and tech stack data that an AI solution would add enormous value. **The system must proactively surface AI opportunities using Cortex analysis of all deal context** — not just passively accept the SE's self-assessment.

The opportunity is to compile a **structured, self-contained "Asset Generation Recipe"** that bundles all deal intelligence with explicit instructions on which assets to produce and how to produce them — then hand that recipe off to a downstream agentic process that generates the actual deliverables. The recipe is the **contract between deal-inspect (the intelligence collector) and the asset generator (the builder)**. All specs and instructions live in this app; the downstream process references them.

---

## Requirements

### R0: Produce a structured, self-contained Asset Generation Recipe for a given deal that a downstream agentic process can consume to generate deal-specific sales assets.

- R0.1: The recipe must aggregate all available deal context: TDR inputs (all steps/fields), Gong transcript digests, Perplexity research, Sumble enrichment, Cortex AI outputs (brief, entities, findings, action plan, structured extract), CRM fields (stage, ACV, competitors, forecast category), and org/hiring/people intelligence.
- R0.2: The recipe must explicitly declare which assets to generate (the "Asset Manifest") based on the deal's Domo Layers, AI level, deal signals, and stage context.
- R0.3: The recipe must be machine-readable by an LLM agent while remaining human-reviewable (Markdown prompt template format).
- R0.4: All asset specifications and generation instructions must live within deal-inspect; the downstream process references the recipe as a self-contained contract.

### R1: Dynamic, Multi-Signal Asset Selection

The asset manifest must not be one-size-fits-all. Asset selection must consider multiple signals:
- **Domo Layers** (primary trigger): which platform capabilities are in scope.
- **AI Level** from the AI/ML step: drives whether AI-specific assets are needed and at what depth.
- **Proactive AI Assessment** (Cortex-driven): override or supplement the SE's AI level selection when deal signals suggest AI opportunity.
- **Competitive context**: presence of named competitors triggers differentiation materials.
- **Partner involvement**: partner deals need co-sell enablement materials.
- **Deal stage**: early-stage deals get broader strategic assets; late-stage deals get implementation-focused assets.
- **Deal complexity / ACV**: high-value, high-complexity deals warrant deeper, more numerous assets.

### R2: Comprehensive, Extensible Asset Catalog

The catalog must cover the full spectrum of deliverables an SE/SA would use across deal stages and solution types. Assets are categorized as Universal (every deal), Layer-Conditional (triggered by Domo Layers), and Signal-Conditional (triggered by deal context signals). The catalog must be extensible — adding a new asset type should not require structural changes.

### R3: Per-Asset Generation Instructions

Each asset in the manifest must include: the asset type, a description of what to produce, which context sections from the recipe to prioritize, which Agent Skills from `stahura/domo-ai-vibe-rules` to apply, output format expectations, and any asset-specific constraints.

### R4: Integration with Domo Agent Skills

The recipe must reference the `stahura/domo-ai-vibe-rules` skill repository for downstream generation guidance. Skill references must be specific to each asset type (e.g., `domo-js` for app prototypes, `domo-manifest` for app scaffold specs, `domo-dataset-query` for dashboard blueprints). The skill list should be dynamically fetched and cached to stay current as the repository evolves.

### R5: Handoff to Downstream Process via GitHub + Slack

The recipe must be exportable via two channels: (a) push to `cassidythilton/tdr-asset-recipes` on GitHub with Slack notification to `#tdr-channel`, creating a trigger for a downstream agentic workflow, and (b) direct download as a `.md` file for manual use. The recipe must be fully self-contained — the downstream process needs nothing beyond the recipe file and access to the skills repo.

### R6: Gong Transcript Integration

The recipe must include Gong transcript intelligence: the digest summary, call count, and key excerpts. This provides the buyer's own language, stated pain points, and objections — which are critical for making generated assets resonate with the specific customer.

### R7: Structured Entity Leverage

The recipe must leverage the structured extractions already performed by Cortex AI (`TDR_STRUCTURED_EXTRACTS`): named competitors, technologies, stakeholders, risks, use cases, budget signals, and timeline references. These provide precise, machine-usable data points that should be injected into specific asset sections rather than relying on the downstream agent to re-extract them from prose.

### R8: Proactive AI Opportunity Identification

The system must not rely solely on the SE's `ai-level` selection to determine AI asset inclusion. Cortex AI must analyze all deal context — Gong transcripts (mentions of manual processes, data-driven decisions, automation desires), Perplexity research (technology signals, industry AI adoption), Sumble tech stack (presence of ML frameworks, data science tools, analytics platforms), and TDR inputs (customer goals, pain points) — to independently assess AI opportunity across all four levels of the AI Value Continuum. When Cortex identifies an AI opportunity that the SE did not surface, the recipe must include an AI recommendation section and may trigger AI-specific assets even without the "AI / ML" Domo Layer.

### R9: Automated Skills Repository Reference

The system must maintain an automated, cached reference of the `stahura/domo-ai-vibe-rules` repository — including the full list of available skills with their descriptions, and the rules. This reference is refreshed on demand and embedded in every recipe. The mechanism must gracefully degrade if the GitHub API is rate-limited or unreachable (fallback to last-known-good cache or hardcoded list).

---

## Solution Shape [A: Layered Recipe Architecture]

### A1: Asset Catalog & Trigger Matrix

| Part | Mechanism |
|------|-----------|
| **A1.1** | **Universal Asset Definitions.** Assets generated for every deal regardless of layers. Includes: **(1) Solution Brief** — executive summary of proposed Domo solution mapped to customer challenges, business initiatives, and technology signals; **(2) Executive Pitch Deck Outline** — slide-by-slide narrative arc customized to the deal's business context, stakeholders, and competitive positioning; **(3) ROI / Business Case Framework** — quantified value proposition scaffolded from ACV, deal complexity, stated business challenges, and industry benchmarks; **(4) Deal Strategy Playbook** — internal-only document with objection handling (mapped from Gong signals + risks), next-step recommendations (from action plan), and stakeholder influence map. |
| **A1.2** | **Layer-Conditional Asset Definitions.** Assets triggered by specific Domo Layers selected in `tech-architecture::domo-layers`. The mapping: **Data Integration** → Integration Architecture Diagram (connector inventory, pipeline design, ETL/ELT strategy, data flow visualization). **Data Warehouse** → Data Warehouse Design Brief (schema mapping from current-state architecture, Snowflake optimization strategy, migration considerations from `cloud-platform` field). **Visualization / BI** → Dashboard & Analytics Blueprint (dashboard wireframes, KPI hierarchy, metric definitions, data source mapping, user persona–based views). **Embedded Analytics** → Embedded Analytics Design (embed strategy, white-labeling approach, multi-tenant considerations, Domo Everywhere architecture, customer-facing UX). **App Development** → App Prototype Specification (UI/UX requirements, data model, component architecture, wireframes; downstream agent uses `domo-js`, `domo-manifest`, `domo-dataset-query` skills). **Automation / Alerts** → Automation & Alerting Playbook (alert rule definitions, workflow triggers, notification chains, escalation logic, Domo Workflows architecture). **AI / ML** → AI/ML Solution Architecture (see A1.5 for comprehensive breakdown). |
| **A1.3** | **Signal-Conditional Asset Definitions.** Assets triggered by deal context signals beyond layers: **Competitive Deal** (`isCompetitive` flag or `NAMED_COMPETITORS` in structured extract) → Competitive Positioning Sheet (feature-by-feature differentiation, win themes, competitor weakness mapping). **Partner Deal** (`isPartnerPlay` flag or `partner-name` field) → Partner Enablement Brief (co-sell strategy, partner capability alignment, joint value proposition, partner-specific messaging). **POC/Pilot Stage** (stage includes "POC", "Pilot", or "Evaluation") → Technical Proof-of-Concept Plan (scoped POC definition, success criteria, timeline, data requirements, resource plan). **High-Complexity Deal** (`dealComplexityIndex > 7` or `ACV > threshold`) → Executive Stakeholder Map & Messaging Guide (influence diagram, per-persona value messaging, objection anticipation by role). **Stalled Deal** (`isStalled` flag) → Re-Engagement Strategy Brief (stall diagnosis from Gong signals, revised value proposition, new urgency drivers from Perplexity research). **Early-Stage Deal** (`stageNumber <= 2`) → Discovery-to-Demo Bridge (structured demo script, discovery gap analysis, recommended next conversations). **Late-Stage / Closing** (`stageNumber >= 5`) → Implementation Readiness Packet (deployment timeline, resource requirements, onboarding milestones, customer success handoff). |
| **A1.4** | **Trigger Evaluation Engine.** A deterministic function in `recipeGenerator.ts` that evaluates all trigger conditions against the deal's data and produces the final `assetManifest[]`. Order of evaluation: (1) always include Universal assets, (2) evaluate each Domo Layer against layer-conditional map, (3) run the AI Value Continuum Assessment (A1.5) — may add AI assets even if "AI / ML" layer not selected, (4) evaluate deal signals against signal-conditional map, (5) de-duplicate and merge. Each entry in the manifest carries the asset ID, human-readable name, description, priority (critical / recommended / optional), relevant context sections, and applicable skill references. |
| **A1.5** | **AI Value Continuum Assessment Engine.** The most critical and comprehensive asset determination logic. This is NOT a simple layer trigger — it is a multi-signal, Cortex-augmented analysis that maps the deal across the four levels of the AI Value Continuum (see Asset Catalog Reference → AI Value Continuum section for full breakdown). **Input signals:** (a) `ai-level` field from TDR (explicit SE assessment), (b) `ai-signals` multi-select (manual loops, reactive decisions, stalled pilots, etc.), (c) `ai-problem` and `ai-value` textareas, (d) `ai-data` multi-select (structured/unstructured/none), (e) Gong transcript analysis (mentions of automation, reporting, predictions, AI, machine learning, data science, manual processes), (f) Perplexity research (technology signals, industry AI adoption patterns, competitor AI capabilities), (g) Sumble tech stack (presence of ML frameworks, data science tools, Python, R, TensorFlow, Spark, etc.), (h) `customer-goal` and `why-now` from deal-context (latent AI opportunity in stated problems). **Output:** An `aiValueContinuumAssessment` object embedded in the recipe with: assessed level(s) on the continuum (may span multiple), confidence score, evidence citations (which signals triggered the assessment), specific Domo capability recommendations per level, and whether the assessment differs from the SE's explicit `ai-level` selection (surfacing the gap). **Proactive identification:** When the SE selected "No AI Opportunity Identified" but Cortex finds signals (e.g., Gong mentions "we spend 20 hours a month manually compiling reports" → Process Automation opportunity; Perplexity shows the industry is adopting predictive analytics → Traditional AI/ML opportunity), the recipe includes a `## Proactive AI Opportunity Assessment` section with the Cortex-identified opportunities and the AI/ML Solution Architecture asset is triggered at "recommended" priority. |

### A2: Recipe Context Aggregation

| Part | Mechanism |
|------|-----------|
| **A2.1** | **CRM Context Block `[Cursor]`.** Extract from the `Deal` object: `dealName`, `account`, `stage`, `stageNumber`, `acv`, `closeDate`, `forecastCategory`, `dealType`, `competitors`, `numCompetitors`, `owner`, `accountExecutive`, `salesConsultant`, `seManager`, `partners`, `region`, `salesSegment`, `salesVertical`, `accountRevenue`, `accountEmployees`, `strategicAccount`, `dealComplexityIndex`, `servicesRatio`, `websiteDomain`. Formatted as a structured key-value block under `## CRM Context`. |
| **A2.2** | **TDR Inputs Block `[Cursor]`.** Iterate `TDR_STEP_INPUTS` for the session. Group by step ID (`deal-context`, `tech-architecture`, `risk-verdict`, `ai-ml`, `adoption`). For each step, emit step title, core question, and all field values with human-readable field labels (resolved from `stepInputConfigs` in `TDRInputs.tsx`). Multi-select values (like `domo-layers`) rendered as comma-separated lists. Formatted under `## TDR Discovery Inputs` with sub-sections per step. |
| **A2.3** | **Gong Intelligence Block `[Cursor]`.** Call `getGongTranscriptDigest(opportunityId)` to fetch the digest markdown. Include `callCount`, `transcriptExcerpt` (bounded), and the full `digest` string. Also call `searchGongTranscripts` with key queries derived from the deal context (e.g., customer's stated challenges, competitor mentions) to surface targeted excerpts. Formatted under `## Gong Call Intelligence` with sub-sections: Digest Summary, Call Metrics, Key Excerpts. |
| **A2.4** | **Perplexity Research Block `[Cursor]`.** From `accountIntel.getLatestIntel()`, extract the `PerplexityResearch` object: `summary`, `recentInitiatives[]`, `technologySignals[]`, `competitiveLandscape[]`, `keyInsights[]`, `citations[]`. Formatted under `## Account Research (Perplexity)` with each array rendered as a bulleted list. Citations provided for traceability. |
| **A2.5** | **Sumble Enrichment Block `[Cursor]`.** From `accountIntel.getLatestIntel()`, extract: `SumbleEnrichment` (technologies, techCategories), `SumbleOrgData` (industry, employee count, HQ, LinkedIn), `SumbleJobData` (job summaries — titles, functions, technologies, indicating where the org is investing), `SumblePeopleData` (key contacts — name, title, department, seniority, technologies, LinkedIn URLs). Formatted under `## Account Enrichment (Sumble)` with sub-sections: Tech Stack, Org Profile, Hiring Signals, Key People. |
| **A2.6** | **Cortex AI Analysis Block `[Cursor]`.** Aggregate pre-computed Cortex outputs: **(a)** `TDRBrief` — the executive brief synthesizing all TDR inputs. **(b)** `ClassifiedFindings` — findings categorized by type (risk, opportunity, gap, etc.). **(c)** `ExtractedEntities` — competitors, technologies, executives, budgets, timelines as structured arrays. **(d)** `StructuredExtract` — thesis, named competitors, Domo use cases, technology signals, stakeholder roles, risk factors, etc. from `TDR_STRUCTURED_EXTRACTS`. **(e)** `ActionPlan` — recommended next steps. **(f)** `AI Value Continuum Assessment` — the proactive AI opportunity analysis from A1.5. Formatted under `## AI-Synthesized Intelligence` with sub-sections per output type. Structured arrays rendered as tables where appropriate. |

### A3: Per-Asset Generation Instructions

| Part | Mechanism |
|------|-----------|
| **A3.1** | **Asset Instruction Template.** Each asset in the manifest includes a structured instruction block: `assetId` (machine key), `assetName` (human label), `description` (what to produce), `outputFormat` (markdown, slide outline, diagram spec, code scaffold, etc.), `contextPriority[]` (ordered list of which recipe context sections to weight most heavily), `skillRefs[]` (specific skill IDs from `stahura/domo-ai-vibe-rules`), `constraints[]` (what NOT to include, length limits, audience considerations), `audienceProfile` (who will consume this asset — executive, technical, mixed), `exampleStructure` (optional: a skeleton or table of contents the agent should follow). |
| **A3.2** | **Skill-to-Asset Mapping.** Concrete mappings: App Prototype Spec → `domo-js`, `domo-manifest`, `domo-dataset-query`, `domo-appdb`, `domo-app-initial-build-playbook`. Dashboard Blueprint → `domo-dataset-query`, `domo-data-api`, `domo-performance-optimizations`. Integration Architecture → `domo-code-engine`, `domo-workflow`, `domo-manifest`. AI/ML Architecture → `domo-ai-service-layer`, `domo-code-engine`. Embedded Analytics → `domo-js`, `domo-manifest`. Automation Playbook → `domo-workflow`, `domo-code-engine`. All assets → `rules/core-platform-rule.md`, `rules/domo-gotchas.md` as baseline guardrails. |
| **A3.3** | **Audience-Aware Generation Directives.** Each asset instruction includes audience calibration: Executive-audience assets (Pitch Deck, ROI Framework, Solution Brief) → business language, outcome-focused, minimal jargon, emphasize competitive differentiation and strategic alignment. Technical-audience assets (Architecture Diagrams, App Prototype Specs, Integration Designs) → precise technical language, reference specific Domo capabilities, include data models and API patterns. Mixed-audience assets (Deal Strategy Playbook) → layered structure with executive summary + technical appendix. |

### A4: Recipe Compilation & Export

| Part | Mechanism |
|------|-----------|
| **A4.1** | **Recipe Compiler `[Cursor]`.** Refactor `src/lib/recipeGenerator.ts` (v1 already exists — see Prior Work section) to implement the full recipe architecture. The `generateRecipeMarkdown()` function accepts a `Deal`, `TDRSessionSummary`, and resolved inputs, then: (1) calls context aggregation functions (A2.1–A2.6) to build each context block, (2) runs the AI Value Continuum Assessment (A1.5) — invoking Cortex if needed, (3) runs the trigger evaluation engine (A1.4) to produce the asset manifest, (4) attaches per-asset instructions (A3.1), (5) fetches current skill list from GitHub API (A4.2), (6) assembles the final Markdown document with a standard structure (see A4.3). |
| **A4.2** | **Automated Skills Repository Reference `[Cursor]`.** Extend `fetchAvailableSkills()` (already functional in v1) to build a comprehensive cached reference of `stahura/domo-ai-vibe-rules`. For each skill: fetch directory listing, parse `SKILL.md` frontmatter for `name` and `description`, and cache the result in memory for the session. Also fetch `rules/core-platform-rule.md` and `rules/domo-gotchas.md` descriptions. Store as a `SkillReference[]` array: `{ id, name, description, skillUrl }`. Fallback to hardcoded list if API unreachable. Refresh on-demand via a UI control. The full reference is embedded in every recipe under `## Available Agent Skills`. |
| **A4.3** | **Recipe Document Structure `[Cursor]`.** The final Markdown recipe follows this skeleton: `# Asset Generation Recipe: {dealName}` → `## Meta` (deal ID, account, ACV, stage, generated timestamp, recipe version, recipe generator version) → `## System Instructions` (role prompt + quality standards + output expectations) → `## Asset Manifest` (table of assets to generate with priority, then per-asset instruction blocks) → `## AI Value Continuum Assessment` (proactive AI analysis — always present, even if no AI opportunity found) → `## Deal Context` → `### CRM Context` → `### TDR Discovery Inputs` → `### Gong Call Intelligence` → `### Account Research (Perplexity)` → `### Account Enrichment (Sumble)` → `### AI-Synthesized Intelligence` → `## Available Agent Skills` (skill reference table with descriptions) → `## Constraints & Guardrails` (no-goes, branding guidelines, confidentiality). |
| **A4.4** | **GitHub Export `[Cursor]`.** `pushRecipeToGitHub()` writes the recipe `.md` to [`cassidythilton/tdr-asset-recipes`](https://github.com/cassidythilton/tdr-asset-recipes) at path `recipes/{dealId}-{timestamp}.md`. Uses GitHub API (or a Code Engine proxy for auth). On success, returns the raw GitHub URL. **Slack Notification:** `sendSlackNotification()` posts to `#tdr-channel` with deal name, ACV, asset count, and a link to the recipe. Together these create the trigger for the downstream agentic workflow. |
| **A4.5** | **UI Integration `[Cursor]`.** On the TDR Workspace page, the existing Wand2 icon in the top-right action bar (next to PDF export and Slack share). Clicking opens a dropdown with two actions: (1) "Push to GitHub & Notify Slack" — calls `pushRecipeToGitHub` + `sendSlackNotification`, shows success toast with link. (2) "Download Recipe (.md)" — generates and downloads the file directly. Loading state via `recipeLoading` state with spinner. Error handling with retry. (v1 UI already implemented — see Prior Work.) |
| **A4.6** | **GitHub Repository README `[Cursor]`.** Update the README.md in `cassidythilton/tdr-asset-recipes` to comprehensively document: the recipe format, the full asset catalog (Universal + Layer-Conditional + Signal-Conditional + AI Value Continuum), the context aggregation pipeline, the trigger logic, the skills integration, and the expected downstream workflow. This README serves as the human-readable documentation for anyone consuming recipes from the repo. |

---

## AI Value Continuum — Comprehensive Breakdown

The AI/ML Solution Architecture asset (L7) is the most complex asset in the catalog. It must map across the four levels of the AI Value Continuum, assessing which level(s) apply to the deal and providing concrete recommendations at each applicable level. This section defines exactly what each level means in Domo context and how the recipe instructs the downstream agent.

### Level 1: Process Automation (Rules & Automation)

**What it is:** Deterministic logic that executes predefined rules. No learning, no models — just "if X then Y" at scale.

**Domo capabilities:** Domo Workflows (trigger → action chains), Buzz alerts, scheduled dataset refreshes with conditional routing, Code Engine functions for business logic, Magic ETL conditional branching, Beast Mode calculated fields with rule logic.

**Signals that suggest this level:** Gong mentions of "manual reporting", "copy-paste between systems", "someone checks this every morning", "we email spreadsheets", "our team spends hours compiling". TDR `ai-signals` includes "manual loops" or "reactive decisions". Customer goal mentions efficiency, time savings, or eliminating manual work.

**Recipe instruction for downstream agent:** "Design a rules-based automation architecture using Domo Workflows and/or Code Engine. Identify the specific manual processes from the Gong transcripts and TDR inputs. For each process, map: current manual step → automated trigger → Domo action → notification/output. Include a Workflow diagram (Mermaid) showing the full chain."

### Level 2: Traditional AI & ML (Predictive / Classification)

**What it is:** Statistical models trained on historical data to predict outcomes or classify entities. Learns from data patterns.

**Domo capabilities:** `SNOWFLAKE.ML.CLASSIFICATION` and `SNOWFLAKE.ML.FORECAST` (native SQL, no Python needed), Snowpark ML for custom models, Domo AutoML (built-in model training), Cortex `AI_CLASSIFY` for categorization, R/Python tiles in Magic ETL, Model Registry for deployment.

**Applicable model types to assess:**
- **Classification** — Will this deal close? Is this customer likely to churn? Is this transaction fraudulent? (binary or multi-class)
- **Regression** — What will revenue be next quarter? How many support tickets will we get? (continuous prediction)
- **Forecasting** — Time-series prediction: demand planning, revenue forecasting, capacity planning
- **Clustering** — Customer segmentation, product affinity grouping, anomaly detection
- **Recommendation** — Next-best-action, product recommendations, content personalization

**Signals that suggest this level:** Customer has historical data, mentions forecasting or prediction needs, discusses segmentation or scoring, has an existing analytics practice they want to evolve. TDR `ai-data` includes "structured data". Sumble tech stack includes analytics/BI tools. Perplexity shows competitors using predictive analytics.

**Recipe instruction for downstream agent:** "Design a predictive/classification ML architecture. Assess data readiness from the Sumble tech stack and TDR `ai-data` field. Recommend specific model type(s) from the list above based on the customer's stated problems. For each recommended model: describe the prediction target, required features, training data requirements, Domo/Snowflake implementation path (prefer `SNOWFLAKE.ML.CLASSIFICATION` for simplicity), and expected business impact. Include a feature engineering diagram and model pipeline flow."

### Level 3: Generative AI (LLM-Powered Content & Analysis)

**What it is:** Large language models that generate text, images, summaries, or structured outputs from prompts. Explains, summarizes, and creates.

**Domo capabilities:** Cortex `AI_COMPLETE` (prompt → response), Cortex `AI_EXTRACT` (structured extraction from unstructured text), Cortex `AI_CLASSIFY` (text classification), Domo AI Service Layer (`AIClient.generate_text`, `text_to_sql`), Code Engine with LLM orchestration, Cortex Search for RAG patterns.

**Applicable use cases to assess:**
- **Document generation** — Automated report writing, contract summaries, executive briefings
- **Text-to-SQL** — Natural language querying of data
- **Summarization** — Meeting notes, ticket summaries, research digests
- **Extraction** — Pull structured fields from unstructured documents (invoices, contracts, emails)
- **Classification at scale** — Sentiment analysis, intent detection, ticket routing
- **RAG (Retrieval-Augmented Generation)** — Answering questions grounded in company-specific data

**Signals that suggest this level:** Customer discusses document processing, unstructured data, natural language interfaces, chatbots, or content generation. TDR `ai-data` includes "unstructured data". Gong mentions "our team reads through hundreds of..." or "we need to summarize...". Perplexity shows industry adoption of generative AI.

**Recipe instruction for downstream agent:** "Design a generative AI architecture using Domo Cortex functions and/or the AI Service Layer. Map each identified use case to a specific Cortex function or AI endpoint. For RAG patterns, specify the data ingestion pipeline (Cortex Search service creation, chunking strategy, embedding model). Include prompt templates for each use case. Address model selection (frontier models via Cortex: openai-gpt-4.1, claude-4-sonnet, etc.) and cost/latency tradeoffs."

### Level 4: Agentic AI (Autonomous, Tool-Calling Systems)

**What it is:** AI systems that receive a goal, plan their approach, take actions using tools, and reflect on results. The AI doesn't just respond — it *does work* autonomously within a governance framework.

**Domo capabilities:** Domo Workflows (orchestration layer), Code Engine (tool execution), AI Service Layer (reasoning), AppDB (state management), Cortex functions (intelligence), Domo API ecosystem (actions). The agent pattern: Goal → Plan (LLM reasoning) → Act (Code Engine / Workflow / API calls) → Reflect (evaluate results) → loop until goal met, with governance & security guardrails.

**Applicable architectures to assess:**
- **Data pipeline agents** — Monitor data quality, auto-fix issues, route anomalies
- **Customer service agents** — Triage tickets, pull relevant data, draft responses, escalate
- **Analytics agents** — Receive a business question, query data, build visualizations, narrate findings
- **Operations agents** — Monitor KPIs, detect deviations, trigger corrective workflows
- **Multi-agent orchestration** — Specialized agents coordinated by a supervisor agent

**Signals that suggest this level:** Customer describes workflows that require judgment + action, mentions "we want the system to handle this end-to-end", discusses AI that can "take action" or "make decisions", has mature data infrastructure (prerequisite for agentic). TDR `ai-level` explicitly selects "Autonomous AI (Agentic)". Advanced technology signals in Sumble (orchestration frameworks, API-heavy architecture).

**Recipe instruction for downstream agent:** "Design an agentic AI architecture using Domo's platform primitives. Map the Goal → Plan → Act → Reflect loop to specific Domo components: Workflows for orchestration, Code Engine for tool execution, AI Service Layer for reasoning, AppDB for state. Define the governance boundary: what can the agent do autonomously vs. what requires human approval. Include a systems integration diagram showing all external tools/APIs the agent needs access to. Address security, audit logging, and rollback mechanisms."

### Cross-Continuum: Multi-Level Recommendations

Most deals benefit from capabilities at multiple levels. The recipe should recommend the pragmatic starting point and the aspiration path:

| Pattern | Recommendation |
|---------|---------------|
| Mature data, no AI today | Start at Level 1 (automate manual processes) → Level 2 (predictive models on clean data) |
| Unstructured data dominant | Start at Level 3 (extraction/summarization) → Level 1 (automate the extracted insights) |
| Advanced analytics team | Start at Level 2 (productionize their models in Domo) → Level 3 (augment with generative) |
| Digital transformation initiative | Start at Level 1 + 3 in parallel → Level 4 as maturity grows |
| "We want AI but don't know where" | Cortex proactive assessment determines highest-impact starting point |

---

## Asset Catalog Reference

### Universal Assets (every deal)

| # | Asset | Description | Output Format | Primary Context | Audience |
|---|-------|-------------|---------------|-----------------|----------|
| U1 | Solution Brief | Executive summary mapping Domo capabilities to customer's stated challenges, business initiatives, and technology landscape. Positions Domo within their existing architecture. | Markdown (2–4 pages) | TDR Brief, Perplexity Summary, CRM Context | Executive / Mixed |
| U2 | Executive Pitch Deck Outline | Slide-by-slide narrative: customer situation → challenges → vision → Domo solution → differentiation → value → next steps. Each slide has talking points and data references. | Markdown (slide outline) | Gong Digest, TDR Inputs (deal-context, risk-verdict), Competitive Landscape, ROI signals | Executive |
| U3 | ROI / Business Case Framework | Quantified value proposition: cost savings, efficiency gains, revenue enablement. Scaffolded from ACV, deal complexity, industry benchmarks, and customer's stated business challenges. | Markdown (structured framework with fillable sections) | CRM (ACV, deal type), TDR (customer-goal, why-now), Perplexity (business initiatives) | Executive / Finance |
| U4 | Deal Strategy Playbook | Internal-only coaching document: win themes, objection handling (mapped from Gong + TDR risks), stakeholder influence strategy, recommended next steps, competitive counter-positioning. | Markdown (internal document) | Gong Excerpts, Risk-Verdict inputs, Extracted Entities (competitors, stakeholders), Action Plan | SE/SA (internal) |

### Layer-Conditional Assets

| # | Asset | Trigger Layer | Description | Output Format | Key Skills |
|---|-------|---------------|-------------|---------------|------------|
| L1 | Integration Architecture Diagram | Data Integration | Data flow diagram: source systems → connectors → Domo pipelines → transformations → output. References customer's current-state architecture and technology signals. | Markdown (diagram spec + Mermaid/PlantUML notation) | `domo-code-engine`, `domo-workflow`, `domo-manifest` |
| L2 | Data Warehouse Design Brief | Data Warehouse | Schema mapping from current cloud platform to Domo + Snowflake architecture. Migration considerations, optimization strategies, data modeling approach. | Markdown (technical brief) | `domo-dataset-query`, `domo-performance-optimizations` |
| L3 | Dashboard & Analytics Blueprint | Visualization / BI | Dashboard wireframes, KPI hierarchy, metric definitions, data source mapping, user persona–based view recommendations. Includes suggested Domo card types and layout. | Markdown (wireframes + metric definitions) | `domo-dataset-query`, `domo-data-api`, `domo-performance-optimizations` |
| L4 | Embedded Analytics Design | Embedded Analytics | Domo Everywhere architecture: embed strategy, white-labeling approach, multi-tenant data isolation (PDP), customer-facing UX patterns, authentication flow. | Markdown (architecture document) | `domo-js`, `domo-manifest` |
| L5 | App Prototype Specification | App Development | Full app spec: UI/UX requirements, component architecture, data model, wireframes, navigation flow, manifest configuration. Actionable enough for an agent to scaffold the app. | Markdown (detailed spec) + optional code scaffold | `domo-app-initial-build-playbook`, `domo-js`, `domo-manifest`, `domo-dataset-query`, `domo-appdb` |
| L6 | Automation & Alerting Playbook | Automation / Alerts | Alert rule definitions, workflow triggers, notification chains, escalation logic, SLA monitoring. Maps to Domo Workflows and Buzz architecture. | Markdown (playbook) | `domo-workflow`, `domo-code-engine` |
| L7 | AI/ML Solution Architecture | AI / ML layer OR Cortex proactive assessment | Comprehensive architecture document mapped to the AI Value Continuum. Assesses which level(s) apply, recommends specific Domo capabilities at each level, includes data readiness evaluation, model type recommendations (for Level 2), prompt strategies (for Level 3), and agent architecture (for Level 4). See AI Value Continuum section above for full specification. | Markdown (architecture document with diagrams) | `domo-ai-service-layer`, `domo-code-engine`, `domo-workflow` |

### Signal-Conditional Assets

| # | Asset | Trigger Signal | Description | Output Format |
|---|-------|---------------|-------------|---------------|
| S1 | Competitive Positioning Sheet | `isCompetitive` OR `NAMED_COMPETITORS` present | Feature-by-feature differentiation, win themes, competitor weakness mapping, objection counters. Specific to the named competitors in the deal. | Markdown (comparison matrix + narrative) |
| S2 | Partner Enablement Brief | `isPartnerPlay` OR `partner-name` populated | Co-sell strategy, partner capability alignment, joint value proposition, partner-specific messaging, roles & responsibilities for the engagement. | Markdown (co-sell brief) |
| S3 | Technical POC Plan | Stage contains "POC", "Pilot", or "Evaluation" OR explicitly flagged | Scoped POC definition: success criteria, timeline, data requirements, resource plan, evaluation rubric, risk mitigations. | Markdown (structured plan) |
| S4 | Executive Stakeholder Map | `dealComplexityIndex > 7` OR multiple executives in `extractedEntities` | Influence diagram (Mermaid), per-persona value messaging, objection anticipation by role, engagement sequence recommendation. | Markdown (map + messaging guide) |
| S5 | Re-Engagement Strategy | `isStalled` flag | Stall diagnosis from Gong signals + TDR risk assessment, revised value proposition, new urgency drivers from Perplexity research, recommended re-engagement sequence. | Markdown (strategy brief) |
| S6 | Discovery-to-Demo Bridge | `stageNumber <= 2` | Structured demo script aligned to discovered pain points, discovery gap analysis (what's still unknown), recommended next conversations with talking points. | Markdown (demo script + gap analysis) |
| S7 | Implementation Readiness Packet | `stageNumber >= 5` | Deployment timeline, resource requirements, onboarding milestones, customer success handoff criteria, training plan outline, go-live checklist. | Markdown (implementation plan) |
| S8 | Security & Governance Addendum | `Governance` layer OR regulated industry detected | Data governance framework, RBAC/PDP design, compliance mapping (SOC2, HIPAA, GDPR as applicable), data classification, audit trail architecture. | Markdown (governance document) |

---

## Fit Check: R × A

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | Produce a structured, self-contained Asset Generation Recipe for a given deal that a downstream agentic process can consume to generate deal-specific sales assets. | Core goal | ✅ (A4.1, A4.3) |
| R0.1 | The recipe must aggregate all available deal context: TDR inputs, Gong digests, Perplexity research, Sumble enrichment, Cortex AI outputs, CRM fields, and org/hiring/people intelligence. | Core goal | ✅ (A2.1–A2.6) |
| R0.2 | The recipe must explicitly declare which assets to generate based on Domo Layers, AI level, deal signals, and stage context. | Core goal | ✅ (A1.4, A4.3) |
| R0.3 | The recipe must be machine-readable by an LLM agent while remaining human-reviewable. | Core goal | ✅ (A4.3) |
| R0.4 | All asset specifications and generation instructions must live within deal-inspect; the downstream process references the recipe as a self-contained contract. | Core goal | ✅ (A3.1, A4.3) |
| R1 | Dynamic, multi-signal asset selection considering Domo Layers, AI level, proactive AI assessment, competitive context, partner involvement, deal stage, and deal complexity/ACV. | Must-have | ✅ (A1.1–A1.5) |
| R2 | Comprehensive, extensible asset catalog covering Universal, Layer-Conditional, and Signal-Conditional categories. | Must-have | ✅ (A1.1–A1.3, Asset Catalog Reference) |
| R3 | Per-asset generation instructions with context priority, skill references, output format, audience profile, and constraints. | Must-have | ✅ (A3.1–A3.3) |
| R4 | Integration with Domo Agent Skills (`stahura/domo-ai-vibe-rules`) with per-asset skill mapping and dynamic skill resolution. | Must-have | ✅ (A3.2, A4.2) |
| R5 | Handoff to downstream process via push to `cassidythilton/tdr-asset-recipes` + Slack notification, and direct download. | Must-have | ✅ (A4.4, A4.5) |
| R6 | Gong transcript integration including digest, call count, and key excerpts. | Must-have | ✅ (A2.3) |
| R7 | Leverage structured entity extractions (competitors, technologies, stakeholders, risks, use cases, budgets, timelines) as precise data points rather than re-extracting from prose. | Must-have | ✅ (A2.6) |
| R8 | Proactive AI opportunity identification via Cortex analysis of all deal signals, independent of SE's explicit `ai-level` selection. | Must-have | ✅ (A1.5) |
| R9 | Automated, cached reference of `stahura/domo-ai-vibe-rules` with skill descriptions, refreshed on demand, embedded in every recipe. | Must-have | ✅ (A4.2) |

**Notes:**
- All requirements are satisfied by the single shape. The architecture separates concerns cleanly: A1 handles asset taxonomy, selection logic, and the AI Value Continuum engine; A2 handles context aggregation; A3 handles per-asset instructions; A4 handles compilation, skills reference, and delivery.

---

## Resolved Questions

1. **What format should the recipe be?** → **Markdown prompt template.** Human-reviewable, LLM-consumable, version-controllable in Git, and compatible with any downstream agent framework. The recipe is structured as a mega-prompt with clearly delineated sections that can be parsed programmatically or read linearly.

2. **Where does the actual asset generation happen?** → **Outside deal-inspect, in a separate agentic process.** Deal-inspect compiles the recipe (intelligence + instructions) and exports it. A downstream agent (Cursor, Claude Code, or a CI/CD pipeline triggered by the GitHub push to `cassidythilton/tdr-asset-recipes`) picks up the recipe and generates the assets. This separation keeps deal-inspect focused on intelligence collection and avoids context window / timeout constraints of generating 5+ large assets synchronously.

3. **How should the asset catalog be extended?** → **Configuration-driven.** The `ASSET_CATALOG` object in `recipeGenerator.ts` defines all assets with their trigger conditions. Adding a new asset type means adding an entry to the catalog with its trigger function, description, skill references, and output format — no structural changes to the compiler.

4. **Should the recipe include raw Gong transcripts?** → **No — use digests and targeted excerpts.** Raw transcripts would overwhelm the downstream agent's context window. The recipe includes the pre-computed digest (from `getGongTranscriptDigest`) and targeted search excerpts (from `searchGongTranscripts` with queries derived from deal context). This provides the buyer's language without the noise.

5. **How should Cortex AI outputs be included?** → **As pre-computed structured data, plus a live AI Value Continuum assessment.** The brief, classified findings, extracted entities, and structured extract are already computed and stored — included as-is. The AI Value Continuum assessment (A1.5) is the one component that may require a live Cortex call to analyze deal signals for proactive AI opportunity identification.

6. **Should the recipe include the `ReadoutPayload`?** → **No — compose from the same sources, but with a different shape.** The `ReadoutPayload` (from `assembleTDRReadout`) is optimized for PDF rendering. The recipe needs a different structure optimized for downstream generation: more context breadth, per-asset instructions, skill references, and the AI Value Continuum assessment. However, the recipe compiler should call the same underlying data-fetching functions to ensure consistency.

7. **How do we handle deals with incomplete data?** → **Graceful degradation.** Each context section is optional. If Gong data is unavailable, the section notes "No Gong data available for this deal" and the downstream agent works with what it has. The asset manifest still generates based on available signals — missing enrichment doesn't suppress asset generation, it just means those assets will be less contextually rich.

8. **What determines asset priority?** → **Three tiers: Critical (always generate first), Recommended (generate if context supports), Optional (generate if time/budget allows).** Universal assets are Critical. Layer-conditional assets matching selected layers are Recommended. Signal-conditional assets are Optional unless the signal is strong (e.g., `isStalled` with high ACV → Critical re-engagement strategy).

9. **Where should asset specs live?** → **All specs in deal-inspect.** The recipe compiler, asset catalog, trigger logic, per-asset instructions, and AI Value Continuum framework all live in `src/lib/recipeGenerator.ts` and supporting files within the deal-inspect codebase. The downstream process receives the compiled recipe (Markdown) and the skills repo reference — it does not need access to deal-inspect source code.

10. **What about the AI/ML asset when the SE selects "No AI Opportunity"?** → **Cortex overrides when warranted.** The AI Value Continuum Assessment (A1.5) runs regardless of the SE's `ai-level` selection. If Cortex finds strong AI signals in Gong transcripts, Perplexity research, or the Sumble tech stack that the SE missed, the recipe includes a `## Proactive AI Opportunity Assessment` section explaining what was found and why AI assets are recommended despite the SE's assessment. This addresses the gap where SEs under-identify AI opportunities due to lack of AI fluency.

11. **Where are recipes pushed?** → **[`cassidythilton/tdr-asset-recipes`](https://github.com/cassidythilton/tdr-asset-recipes).** Recipes are written to `recipes/{dealId}-{timestamp}.md`. The repo README documents the full recipe format, asset catalog, and expected downstream workflow.

---

## Rabbit Holes

- **Don't build an asset generator inside deal-inspect.** The temptation to "just add one more button that generates the actual Solution Brief" will lead to context window overflow, API timeout cascades, and a UX that takes 5 minutes to load. Stick to the recipe — the contract between collector and builder.

- **Don't dump all raw data indiscriminately.** Concatenating 10 raw Gong transcripts, 50 Sumble technology entries, and every chat message will produce a 100K-token recipe that overwhelms the downstream agent. Curate: use digests, summaries, and structured extractions. Raw data is for Snowflake queries, not for prompt injection.

- **Don't try to template the actual assets.** The recipe tells the downstream agent *what* to build and gives it *context*, but doesn't prescribe the exact format of each asset's output. The downstream agent (using the skills repo) decides the best format. Over-templating produces rigid, generic-feeling outputs.

- **Don't over-index on skill references.** Not every asset needs 5 skills. Some assets (Solution Brief, Pitch Deck) are pure prose generation that don't need Domo platform skills at all. Only reference skills when the asset involves Domo-specific technical implementation (app specs, query patterns, manifests, etc.).

- **Don't build custom GitHub/Slack integrations from scratch.** Use Domo Code Engine or Domo Workflows for the GitHub push and Slack notification. These are server-side operations that need auth tokens — don't expose them client-side.

- **Don't make the AI Value Continuum assessment a blocking operation.** If Cortex is slow or unavailable, the recipe should still generate with the SE's explicit `ai-level` as the fallback. The proactive assessment is additive, not a gate.

---

## No-Gos

- No synchronous generation of final assets within the deal-inspect UI
- No inclusion of raw, unbounded Gong transcripts in the recipe (use digests + bounded excerpts only)
- No hardcoding of assets that don't apply to the deal's context
- No exposure of GitHub tokens or Slack webhook URLs in client-side code
- No re-generation of Cortex AI outputs during recipe compilation — use pre-computed results (exception: AI Value Continuum assessment which is a new analysis)
- No assumption that all context sections will be populated — graceful degradation is mandatory
- No reliance solely on SE's AI assessment — Cortex must independently evaluate AI opportunity

---

## Prior Work (v1 Implementation)

Sprint 37 (v1) delivered a working skeleton of the recipe system. The following components exist and should be extended, not rewritten:

### `src/lib/recipeGenerator.ts` `[Cursor]`
- **`ASSET_CATALOG`**: 6 entries (Data Apps, Data Integration, BI & Analytics, Governance, Default, Pitch). Needs expansion to full 19-asset catalog (U1–U4, L1–L7, S1–S8).
- **`generateRecipeMarkdown(deal, session, inputs)`**: Basic aggregation of deal info, TDR inputs, and partial enrichment (Perplexity/Sumble via `accountIntel.getLatestIntel()`). Missing: Gong integration (placeholder only), Cortex AI outputs, structured entities, per-asset instructions, AI Value Continuum assessment.
- **`fetchAvailableSkills()`**: Functional — fetches skill directory from GitHub API with hardcoded fallback list. Needs extension to fetch skill descriptions.
- **`pushRecipeToGitHub()`**: Stub (setTimeout mock). Needs real implementation targeting `cassidythilton/tdr-asset-recipes`.
- **`sendSlackNotification()`**: Stub (setTimeout mock). Needs real implementation.

### `src/pages/TDRWorkspace.tsx` `[Cursor]`
- **Wand2 icon** in top-right action bar (alongside PDF export and Slack share buttons).
- **Dropdown menu** with two actions: "Push to GitHub & Slack" and "Download Markdown".
- **`recipeLoading` state** with spinner feedback during generation.
- **`generateRecipeMarkdown()`** call and Markdown download via blob URL.

---

## CURRENT State Reference

### Existing Data Sources (available for recipe aggregation)

| Source | Storage | Access Pattern | Key Fields |
|--------|---------|----------------|------------|
| TDR Session | `TDR_SESSIONS` (Snowflake) | `snowflakeStore.getSessionsByDeal()` | sessionId, opportunityId, status, outcome, iteration, completedSteps, notes |
| TDR Inputs | `TDR_STEP_INPUTS` (Snowflake) | `snowflakeStore.getLatestInputs()` | stepId, fieldId, fieldValue (string; JSON for multi-selects) |
| Gong Transcripts | Code Engine proxy to Gong API | `gongTranscripts.getGongTranscriptDigest()`, `.searchGongTranscripts()` | digest (markdown), callCount, transcriptExcerpt, score |
| Perplexity Research | `ACCOUNT_INTEL_PERPLEXITY` (Snowflake) | `accountIntel.getLatestIntel()` | summary, recentInitiatives[], technologySignals[], competitiveLandscape[], keyInsights[], citations[] |
| Sumble Enrichment | `ACCOUNT_INTEL_SUMBLE` + `_ORG` / `_JOBS` / `_PEOPLE` | `accountIntel.getLatestIntel()` | technologies, techCategories, orgProfile, jobSummaries, peopleSummaries |
| Cortex AI Brief | `CORTEX_ANALYSIS_RESULTS` (Snowflake) | `cortexAi.generateTDRBrief()` | content (markdown), modelUsed |
| Classified Findings | `CORTEX_ANALYSIS_RESULTS` | `cortexAi.classifyFindings()` | findings[] with finding + category |
| Extracted Entities | `CORTEX_ANALYSIS_RESULTS` | `cortexAi.extractEntities()` | competitors[], technologies[], executives[], budgets[], timelines[] |
| Structured Extract | `TDR_STRUCTURED_EXTRACTS` (Snowflake) | `cortexAi.extractStructuredTDR()` | THESIS, NAMED_COMPETITORS, DOMO_USE_CASES, TECHNOLOGY_SIGNALS, STAKEHOLDER_ROLES, RISK_FACTORS, etc. |
| Action Plan | `CORTEX_ANALYSIS_RESULTS` | `cortexAi.generateActionPlan()` | actionPlan (markdown), modelUsed |
| CRM Fields | Opportunity dataset (Domo) | `fetchOpportunities()` via `OPPORTUNITY_FIELD_MAP` | stage, ACV, competitors, forecastCategory, dealType, and 40+ additional fields |

### TDR Steps & Domo Layers (current schema)

| Step ID | Title | Key Fields for Recipe |
|---------|-------|-----------------------|
| `deal-context` | Deal Context | `strategic-value`, `customer-goal`, `why-now`, `key-technical-stakeholders`, `timeline` |
| `tech-architecture` | Technical Architecture | `cloud-platform`, `current-state`, `target-state`, **`domo-layers`** (multi-select: Data Integration, Data Warehouse, Visualization / BI, Embedded Analytics, App Development, Automation / Alerts, AI / ML), `out-of-scope`, `why-domo` |
| `risk-verdict` | Risk & Verdict | `top-risks`, `key-assumption`, `verdict`, `partner-name`, `partner-posture` |
| `ai-ml` | AI & ML Opportunity | `ai-level` (Rules & Automation → Predictive AI → Generative AI → Autonomous AI (Agentic) → No AI Opportunity Identified), `ai-signals`, `ai-problem`, `ai-data`, `ai-value` |
| `adoption` | Adoption & Success | `expected-users`, `adoption-success` |

### Domo Layer Values (trigger keys for Layer-Conditional assets)

1. Data Integration
2. Data Warehouse
3. Visualization / BI
4. Embedded Analytics
5. App Development
6. Automation / Alerts
7. AI / ML

### Agent Skills Repository (`stahura/domo-ai-vibe-rules`)

| Skill | Description | Relevant Assets |
|-------|-------------|----------------|
| `domo-app-initial-build-playbook` | Kickoff sequence for new Domo app builds | App Prototype Spec (L5) |
| `domo-js` | ryuu.js usage, navigation/events, import safety | App Prototype Spec (L5), Embedded Analytics Design (L4) |
| `domo-manifest` | manifest.json mapping requirements and gotchas | App Prototype Spec (L5), Integration Architecture (L1), Embedded Analytics (L4) |
| `domo-dataset-query` | @domoinc/query syntax and constraints | Dashboard Blueprint (L3), Data Warehouse Brief (L2), App Prototype Spec (L5) |
| `domo-data-api` | High-level data-access routing | Dashboard Blueprint (L3) |
| `domo-appdb` | Toolkit-first AppDB CRUD/query patterns | App Prototype Spec (L5) |
| `domo-ai-service-layer` | AIClient patterns for generation, text-to-sql | AI/ML Solution Architecture (L7) |
| `domo-code-engine` | Code Engine function invocation and contracts | Integration Architecture (L1), Automation Playbook (L6), AI/ML Architecture (L7) |
| `domo-workflow` | Workflow start/status patterns and input contracts | Integration Architecture (L1), Automation Playbook (L6) |
| `domo-performance-optimizations` | Data query performance rules | Dashboard Blueprint (L3), Data Warehouse Brief (L2) |
| `domo-app-publish` | Build and publish flow | All app-related assets |
| `domo-toolkit-wrapper` | @domoinc/toolkit client usage | All technical assets |
| `domo-custom-connector-ide` | Connector IDE auth/data processing | Integration Architecture (L1) — when custom connectors needed |
| `migrating-lovable-to-domo` | Convert SSR apps to Domo-compatible | App Prototype Spec (L5) — when migrating existing app |
| `migrating-googleai-to-domo` | Convert AI Studio projects to Domo | AI/ML Architecture (L7) — when migrating AI workloads |
| `rules/core-platform-rule.md` | Always-on platform guardrails | All technical assets (baseline) |
| `rules/domo-gotchas.md` | Manifest, query, toolkit gotchas | All technical assets (error avoidance) |

### Downstream Recipe Repository

**Repository:** [`cassidythilton/tdr-asset-recipes`](https://github.com/cassidythilton/tdr-asset-recipes)
**Structure:** `recipes/{dealId}-{timestamp}.md`
**Trigger:** GitHub push + Slack notification to `#tdr-channel`
**Consumer:** Downstream agentic process (Cursor, Claude Code, CI/CD pipeline, or bespoke agent)
