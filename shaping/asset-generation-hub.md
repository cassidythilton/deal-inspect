---
shaping: true
status: draft
appetite: large (1–2 weeks)
---

# Asset Generation Hub — Multi-Agent Orchestration Platform

## Source

> "I'm currently working on a downstream app/solution that contains multiple agents which will perform a multitude of functions to produce assets including integrations, data pipelines, apps, decks, solution briefs etc. I would like the app to be the 'home base' knowing that some of the agents will be fully automated and some will be driven, overseen or augmented by humans/engineers. Specs/recipes/candidate solutions will land in and be referenced at https://github.com/cassidythilton/tdr-asset-recipes."

> "See https://github.com/stahura/domo-ai-vibe-rules/tree/main — these are specific skills that can be referenced for this purpose."

> "We should ensure the AI/ML solution is stupid and bullet proof. What I want is for options across the AI Value Continuum to be teased out."

> "Let's build an automated reference of the repo [stahura/domo-ai-vibe-rules] for our efforts."

> "We should do all the spec's in this app [deal-inspect], to be referenced downstream."

> "The recipes will be by deal/account. That's how things should be viewed/aggregated/etc. We'll have a team of SAs working on executing and building solutions (via the agents in the downstream app) for customers/accounts. This app [deal-inspect / TDR Inspection] produces the 'spec sheets.'"

---

## Problem

The entire process flows from **deal-inspect (TDR Inspection)** — which produces the "spec sheets" — into a downstream execution layer. Deal-inspect captures all the intelligence about a deal/account (TDR inputs, Gong transcripts, Perplexity research, Sumble enrichment, Cortex AI outputs) and compiles it into a structured **Asset Generation Recipe** — a self-contained Markdown contract that specifies exactly which sales assets to generate, with what context, using which agent skills. The recipe lands in `cassidythilton/tdr-asset-recipes` and a Slack notification fires to `#tdr-channel`. This is the handoff point.

**But there is nothing on the receiving end.** Today, when a recipe arrives, a human (SE, SA, or engineer) must manually pick it up, read through the entire spec, decide which assets to tackle first, open separate tools (Cursor, Claude Code, Google Slides, Lucidchart), paste context, reference the right skills, and generate each asset one at a time. There is no orchestration, no status tracking, no visibility into what's been generated vs. what's pending, and no way for a manager to see pipeline-wide asset generation progress.

**The work is organized by deal/account, but there's no tool that reflects this.** Recipes arrive per deal. SAs think in terms of "my accounts" and "my deals." A team of SAs is responsible for executing and building solutions for customers — each SA owns a portfolio of deals and needs to see their workload, prioritize across accounts, and track progress for each. Today, this coordination happens over Slack threads and spreadsheets. **There is no "home base" where an SA can see all their assigned deals, what assets are pending, what needs review, and what's been delivered.**

**The agent landscape is heterogeneous by design.** Some assets are pure LLM generation (solution briefs, ROI frameworks) that can be fully automated. Some require deep Domo platform expertise and human engineering (app prototypes, integration architectures) — these need human-in-the-loop oversight where an agent drafts and a human refines. Some are inherently collaborative (pitch decks, deal strategy playbooks) where the agent provides structure and the human provides judgment. **A one-size-fits-all automation approach will fail.** The system must support the full spectrum: fully automated agents, human-augmented agents (AI drafts → human reviews → AI refines), and human-driven workflows (human leads, AI assists).

**Skills and tools are fragmented.** The `stahura/domo-ai-vibe-rules` repository contains 16+ specialized skills for building Domo assets, but there's no unified interface to discover, apply, and orchestrate them. An engineer building an app prototype needs `domo-app-initial-build-playbook`, `domo-js`, `domo-manifest`, `domo-dataset-query`, and `domo-appdb` — but must manually install and chain them. The Hub should make skill discovery and application seamless.

**There is no asset lifecycle management.** Once an asset is generated, there's no system of record: no versioning, no approval workflow, no way to trace an asset back to the recipe and deal that spawned it, no way to regenerate a single asset when deal context changes. Assets exist as loose files scattered across local machines and Slack threads.

The opportunity is a **centralized, deal/account-organized orchestration platform** — the "home base" — where a team of SAs picks up recipes, works with specialized agents (automated or human-augmented) to generate deal-specific assets, tracks progress per deal, and delivers completed solution packages to close business.

---

## Requirements

### R0: Provide a centralized "home base" application that ingests Asset Generation Recipes, orchestrates multiple specialized agents (automated and human-augmented), and manages the full lifecycle of generated sales assets.

- R0.1: The hub must ingest recipes from `cassidythilton/tdr-asset-recipes` (GitHub) automatically via webhook or polling, and support manual recipe upload.
- R0.2: The hub must parse each recipe's Asset Manifest and create a trackable work queue of assets to generate.
- R0.3: The hub must dispatch each asset to the appropriate agent based on asset type, automation level, and available skills.
- R0.4: The hub must provide real-time visibility into agent status, generation progress, and asset pipeline health.

### R1: Multi-Modal Agent Orchestration

The system must support three distinct agent modes, assignable per asset type:
- **Fully Automated** — Agent generates asset end-to-end without human intervention. Triggered automatically on recipe ingestion. Used for: Solution Briefs (U1), ROI Frameworks (U3), Competitive Positioning Sheets (S1), Discovery-to-Demo Bridges (S6).
- **Human-Augmented** — Agent generates a draft, human reviews/edits, agent incorporates feedback and refines. Used for: Executive Pitch Deck Outlines (U2), AI/ML Solution Architecture (L7), App Prototype Specs (L5), Embedded Analytics Designs (L4), Executive Stakeholder Maps (S4).
- **Human-Driven** — Human leads the process with AI assistance on demand. Agent provides templates, context summaries, and on-call generation. Used for: Deal Strategy Playbooks (U4), Technical POC Plans (S3), Implementation Readiness Packets (S7), Re-Engagement Strategies (S5).

### R2: Recipe-to-Asset Traceability

Every generated asset must be traceable back to: the recipe that spawned it, the deal it serves, the agent that generated it, the skills applied, the human reviewers involved, and the generation timestamp. This chain must be queryable and auditable.

### R3: Skills Registry & Dynamic Resolution

The hub must maintain a live, cached registry of all available skills from `stahura/domo-ai-vibe-rules` — including skill descriptions, applicable asset types, and installation status. Agents must be able to resolve and apply skills dynamically during generation. The registry must refresh automatically and support manual refresh.

### R4: Asset Lifecycle Management

Assets must progress through a defined lifecycle: `queued` → `generating` → `draft` → `in_review` → `approved` → `delivered`. Each transition must be logged. Assets can be regenerated (creates a new version, preserves history). Approved assets can be exported/downloaded or pushed to a delivery channel.

### R5: Pipeline Visibility & Analytics

The hub must provide dashboard-level visibility into: total recipes ingested, assets in each lifecycle stage, agent utilization, average generation time by asset type, human review queue depth, and deals with pending assets. This is the "mission control" view for managers.

### R6: Deal Context Passthrough

When an agent generates an asset, it must receive the full deal context from the recipe (CRM, TDR inputs, Gong intelligence, Perplexity research, Sumble enrichment, Cortex AI outputs, AI Value Continuum assessment) in a structured format. The hub must parse and index recipe context sections so agents can query specific sections rather than processing the entire recipe.

### R7: Human Review Workflow

For human-augmented and human-driven assets, the hub must provide: an inline editor for reviewing/editing agent drafts, a diff view showing agent changes vs. previous version, an approval/rejection mechanism with feedback that flows back to the agent, and a comment thread per asset for collaborative refinement.

### R8: Extensible Agent Architecture

Adding a new agent type or asset type must not require structural changes to the hub. Agents should be registerable via configuration (agent ID, name, supported asset types, automation level, required skills, endpoint/invocation pattern). The hub must support agents running as: local processes (Cursor/Claude Code sessions), remote APIs (Code Engine functions), CI/CD pipeline steps (GitHub Actions), or embedded LLM calls (direct Cortex/OpenAI API).

### R9: Notification & Handoff

The hub must notify relevant stakeholders at key lifecycle transitions: recipe ingested (Slack → #tdr-channel), draft ready for review (Slack DM to assigned reviewer + in-app notification), asset approved (Slack → deal channel), generation failed (Slack → #tdr-channel + in-app alert). Must also support webhook-based triggers for downstream systems.

### R10: Deal/Account-Centric Organization

The deal/account is the primary organizing unit. All views, navigation, and aggregation must center on deals — not on agents, pipeline stages, or asset types. A recipe arrives *for a deal*. Assets are generated *for a deal*. An SA is assigned *to a deal*. The dashboard must show deals as the top-level entity, with assets, agents, and progress nested beneath. Users should be able to drill from deal → assets → individual asset detail. Cross-deal views (pipeline, review queue) are secondary lenses on the same deal-centric data.

### R11: SA Team Management & Assignment

The hub must support a team of SAs as the human operators who execute and build solutions. Each recipe/deal must be assignable to an SA. SAs must have a "My Work" view showing all their assigned deals and the status of assets within each. Managers must have a "Team" view showing SA workload distribution (deals per SA, assets pending per SA, completion rates). The system must support: SA profiles, deal assignment (manual or auto-suggested based on workload/expertise), workload balancing visibility, and per-SA performance tracking.

---

## Solution Shape [A: Hub-and-Spoke Orchestration]

### A1: Recipe Ingestion & Parsing Engine

| Part | Mechanism |
|------|-----------|
| **A1.1** | **GitHub Webhook Listener.** A webhook endpoint (or polling job as fallback) monitors `cassidythilton/tdr-asset-recipes` for new `.md` files pushed to `recipes/`. On detection, fetches the raw Markdown content via GitHub API. Also supports manual upload via drag-and-drop in the UI. |
| **A1.2** | **Recipe Parser.** Parses the recipe Markdown into a structured object: `RecipeMeta` (deal ID, account, ACV, stage, timestamp, version), `AssetManifest[]` (asset entries with priority, trigger, audience, per-asset instructions), `DealContext` (CRM, TDR, Gong, Perplexity, Sumble, Cortex sections), `AIValueContinuumAssessment`, `SkillReferences[]`, `Constraints[]`. The parser uses heading-level sectioning + table parsing — recipes follow a strict structural contract defined by `deal-inspect`. |
| **A1.3** | **Recipe Store.** Parsed recipes are stored in a database (Supabase/Postgres or Domo AppDB) with full-text search capability. Each recipe record links to the source GitHub URL, the parsed manifest, and all spawned asset records. Recipes are immutable once ingested — updates are new recipe versions. |

### A2: Agent Registry & Dispatch

| Part | Mechanism |
|------|-----------|
| **A2.1** | **Agent Registry.** A configuration-driven registry of available agents. Each agent entry: `agentId`, `name`, `description`, `supportedAssetTypes[]` (e.g., `['U1', 'U3', 'S1']`), `automationLevel` (`fully_automated` | `human_augmented` | `human_driven`), `requiredSkills[]` (skill IDs from `stahura/domo-ai-vibe-rules`), `invocationType` (`embedded_llm` | `code_engine` | `github_action` | `external_api` | `manual`), `endpoint` (URL or function name), `status` (`active` | `inactive` | `error`). Initial agents are seeded from the asset catalog mapping (see Agent Catalog below). |
| **A2.2** | **Dispatch Engine.** When a recipe is ingested, the dispatch engine iterates the Asset Manifest and for each entry: (1) resolves the assigned agent from the registry by `assetType`, (2) creates an `AssetJob` record (`jobId`, `recipeId`, `dealId`, `assetType`, `agentId`, `priority`, `status: 'queued'`), (3) for `fully_automated` agents, immediately enqueues the job for execution, (4) for `human_augmented` agents, enqueues the job but also notifies the assigned human reviewer, (5) for `human_driven` agents, creates the job in `awaiting_human` status with context pre-loaded. Dispatch respects priority ordering from the manifest (critical → recommended → optional). |
| **A2.3** | **Agent Execution Runtime.** The runtime that executes agent jobs. For `embedded_llm` agents: calls the configured LLM API (Cortex AI_COMPLETE, OpenAI, Anthropic) with the asset's instruction block + relevant context sections + applicable skill content as the prompt. For `code_engine` agents: invokes a Domo Code Engine function with the recipe payload. For `github_action` agents: triggers a GitHub Actions workflow with the recipe as input. For `external_api` agents: POSTs to the configured endpoint. All agents return structured output: `{ content: string, format: string, metadata: object, confidence: number }`. |
| **A2.4** | **Skill Injector.** Before dispatching to an agent, the skill injector resolves all `requiredSkills` from the Skills Registry (A3), fetches their SKILL.md content, and prepends it to the agent's context/prompt. This ensures every agent operates with the correct Domo platform guardrails without the agent needing to fetch skills itself. |

### A3: Skills Registry

| Part | Mechanism |
|------|-----------|
| **A3.1** | **Skills Cache.** Maintains a local cache of all skills from `stahura/domo-ai-vibe-rules`. Structure: `{ skillId, name, description, skillUrl, content (full SKILL.md text), lastFetched, applicableAssets[] }`. Refreshes on app startup, on manual trigger, and on a configurable interval (default: daily). Falls back to last-known-good cache if GitHub API is unreachable. |
| **A3.2** | **Skills Browser UI.** A searchable, filterable view of all available skills. Each skill card shows: name, description, applicable asset types, last-fetched timestamp. Clicking a skill expands to show the full SKILL.md content rendered as Markdown. Supports "Refresh All" and per-skill refresh. |
| **A3.3** | **Rules Integration.** `rules/core-platform-rule.md` and `rules/domo-gotchas.md` are always injected into every agent's context as baseline guardrails, regardless of the asset type. These are fetched and cached alongside skills. |

### A4: Asset Lifecycle & Storage

| Part | Mechanism |
|------|-----------|
| **A4.1** | **Asset Store.** Each generated asset is stored as a versioned record: `assetId`, `jobId`, `recipeId`, `dealId`, `assetType`, `version` (auto-incrementing per asset), `content` (Markdown/text), `format`, `status` (`draft` | `in_review` | `revision_requested` | `approved` | `delivered`), `generatedBy` (agent ID), `reviewedBy` (user ID, nullable), `createdAt`, `updatedAt`, `metadata` (confidence score, generation time, token count, skills used). |
| **A4.2** | **Version History.** Every regeneration creates a new version of the asset, preserving all prior versions. Diff view between any two versions. Rollback to any prior version. Version metadata includes: trigger (initial generation, human edit, regeneration request, context update). |
| **A4.3** | **Export & Delivery.** Approved assets can be: (1) downloaded as individual files (Markdown, PDF via client-side rendering), (2) bundled as a deal package (ZIP of all approved assets for a deal), (3) pushed to a delivery channel (Slack, email, Google Drive — configurable per asset type). |

### A5: Human Review Interface

| Part | Mechanism |
|------|-----------|
| **A5.1** | **Review Queue.** A prioritized queue of assets awaiting human review. Filterable by deal, asset type, priority, assigned reviewer. Each queue entry shows: deal name, asset type, priority, time in queue, agent confidence score. Clicking opens the review workspace. |
| **A5.2** | **Review Workspace.** Split-pane view: left side shows the generated asset content (rendered Markdown), right side shows the relevant recipe context (collapsible sections: CRM, TDR, Gong, Perplexity, Sumble, Cortex). Inline editing with Markdown toolbar. Diff toggle showing changes from the agent's original draft. Actions: Approve, Request Revision (with feedback text → agent re-generates incorporating feedback), Edit & Approve (human edits are saved as the approved version), Reject (with reason). |
| **A5.3** | **Collaboration Thread.** Per-asset comment thread for multi-person review. Supports @mentions and inline code/quote references. Thread is preserved across asset versions for audit trail. |

### A6: Pipeline Dashboard & Analytics

| Part | Mechanism |
|------|-----------|
| **A6.1** | **Mission Control Dashboard.** The landing page, organized deal/account-first. Top-level metrics: active deals (count), assets in pipeline (by stage), team utilization (SAs with active work), average time-to-delivery. The primary surface is a **deal roster table** — every deal with an active recipe — showing: deal name, account, assigned SA (avatar + name), ACV, stage, asset progress (completed/total as progress bar), deal status badge (Complete / In Progress / Stalled / Unassigned), last activity. Sortable and filterable by SA, account, stage, status. Clicking a deal opens the deal detail view (A6.2). |
| **A6.2** | **Deal Detail View.** Drill-down from the dashboard into a single deal. Shows the recipe meta, the full asset manifest as a kanban board (columns = lifecycle stages), each card showing asset type + assigned agent + status. Clicking a card opens the asset (draft, review workspace, or approved version depending on status). |
| **A6.3** | **Agent Performance Analytics.** Per-agent metrics: assets generated, average generation time, average confidence score, human approval rate (approved on first draft vs. required revision), error rate. Comparative view across agents to identify which need tuning. |
| **A6.4** | **Activity Feed.** Real-time feed of system events: recipe ingested, agent started/completed, asset moved to review, asset approved, generation failed. Filterable by deal, agent, event type. Supports both in-app display and Slack relay. |

### A7: Notification Engine

| Part | Mechanism |
|------|-----------|
| **A7.1** | **Event-Driven Notifications.** Configurable notifications on lifecycle transitions. Channels: in-app toast/badge, Slack (via webhook), email (optional). Default rules: recipe ingested → Slack #tdr-channel, draft ready → Slack DM to assigned SA, asset approved → Slack deal channel, generation failed → Slack #tdr-channel + in-app alert. Rules are configurable per notification type. |
| **A7.2** | **Stale Job Alerts.** Monitor for jobs that have been in `generating` state beyond a timeout threshold (configurable, default 10 minutes for automated, 48 hours for human-augmented). Alert the assigned SA via Slack and in-app notification. |

### A8: Team Management & Deal Assignment

| Part | Mechanism |
|------|-----------|
| **A8.1** | **SA Profiles.** Each SA has a profile record: `userId`, `name`, `email`, `avatarUrl`, `role` (`sa` | `lead` | `admin`), `expertise[]` (e.g., `['ai-ml', 'integrations', 'embedded']`), `status` (`active` | `away`). Profiles are seeded from Supabase Auth users and enrichable with expertise tags. |
| **A8.2** | **Deal Assignment.** Every recipe/deal must have an `assignedSa` (foreign key to SA profile). Assignment can be: (1) manual — a lead/admin assigns via the deal detail page, (2) auto-suggested — system recommends an SA based on current workload (fewest active deals) and expertise match (SA expertise tags vs. deal's Domo Layers), (3) self-assigned — SA claims an unassigned deal from the dashboard. Unassigned deals are highlighted with an amber "Unassigned" badge on the dashboard. |
| **A8.3** | **My Work View.** A personalized page (`/my-work`) showing the logged-in SA's assigned deals. Grouped by deal, each showing: deal name, account, ACV, asset progress (completed/total), next action needed (e.g., "Review Solution Brief draft", "Start POC Plan"), and urgency indicator based on stale assets or approaching close dates. This is the SA's daily operating view — their personal home base within the team home base. |
| **A8.4** | **Team Workload View.** A manager-facing page (`/team`) showing all SAs and their workload distribution. Per-SA row: name, active deals (count), assets in progress, assets awaiting review, completion rate, average time-to-delivery. Bar chart comparing deal load across the team. Drill-down into any SA's My Work view. Used for workload balancing and identifying bottlenecks. |
| **A8.5** | **Deal-Centric Dashboard.** The landing page (`/`) organizes around deals as the top-level entity. The primary table is a deal roster — every deal with an active recipe — grouped or sortable by account, assigned SA, ACV, stage, and asset completion. Clicking a deal opens the deal detail view. The dashboard does not lead with agents or pipeline stages — those are secondary lenses available via filters and dedicated pages. |

---

## Agent Catalog

The initial set of agents, mapped from the recipe's 19-asset catalog:

### Fully Automated Agents

| Agent | Asset Types | Skills | Invocation | Rationale |
|-------|-------------|--------|-----------|-----------|
| **Solution Writer** | U1 (Solution Brief), U3 (ROI Framework) | — | `embedded_llm` (Cortex / Anthropic) | Pure prose generation from structured context. High-confidence LLM task. |
| **Competitive Analyst** | S1 (Competitive Positioning) | — | `embedded_llm` | Structured comparison from extracted entities + Perplexity landscape. Deterministic enough for full automation. |
| **Stage Strategy Agent** | S6 (Discovery-to-Demo Bridge), S7 (Implementation Readiness) | — | `embedded_llm` | Stage-specific templates filled from deal context. Formulaic structure. |
| **Governance Analyst** | S8 (Security & Governance Addendum) | — | `embedded_llm` | Compliance framework mapping from industry + tech signals. Rule-driven. |

### Human-Augmented Agents

| Agent | Asset Types | Skills | Invocation | Rationale |
|-------|-------------|--------|-----------|-----------|
| **Pitch Architect** | U2 (Pitch Deck Outline) | — | `embedded_llm` → human review | Narrative arc requires human judgment on emphasis, tone, and omission. Agent drafts structure + talking points; human refines story. |
| **App Builder** | L5 (App Prototype Spec) | `domo-app-initial-build-playbook`, `domo-js`, `domo-manifest`, `domo-dataset-query`, `domo-appdb` | `embedded_llm` → human review | Technical spec requires engineer validation of feasibility, data model accuracy, and UX appropriateness. |
| **Integration Architect** | L1 (Integration Architecture), L6 (Automation Playbook) | `domo-code-engine`, `domo-workflow`, `domo-manifest` | `embedded_llm` → human review | Architecture decisions need human validation. Agent provides the diagram and rationale; engineer validates connector choices and pipeline design. |
| **Analytics Designer** | L2 (Data Warehouse Brief), L3 (Dashboard Blueprint) | `domo-dataset-query`, `domo-data-api`, `domo-performance-optimizations` | `embedded_llm` → human review | Dashboard wireframes and KPI hierarchies need human validation against customer-specific metric definitions. |
| **Embedded Analytics Architect** | L4 (Embedded Analytics Design) | `domo-js`, `domo-manifest` | `embedded_llm` → human review | Multi-tenant architecture decisions require engineer sign-off on PDP strategy and auth flow. |
| **AI Solutions Architect** | L7 (AI/ML Solution Architecture) | `domo-ai-service-layer`, `domo-code-engine`, `domo-workflow` | `embedded_llm` → human review | Most complex asset. AI continuum mapping requires human judgment on feasibility and customer readiness. Agent provides the framework; SA validates the recommendations. |
| **Stakeholder Strategist** | S4 (Executive Stakeholder Map) | — | `embedded_llm` → human review | Influence mapping requires human knowledge of organizational dynamics beyond what data reveals. |

### Human-Driven Agents

| Agent | Asset Types | Skills | Invocation | Rationale |
|-------|-------------|--------|-----------|-----------|
| **Deal Strategist** | U4 (Deal Strategy Playbook), S5 (Re-Engagement Strategy) | — | `manual` + on-demand AI | Internal strategy documents require human judgment on win themes, political dynamics, and tactical sequencing. AI provides context summaries and objection-counter suggestions on demand. |
| **POC Planner** | S3 (Technical POC Plan) | — | `manual` + on-demand AI | POC scoping requires real-time negotiation with the customer and deep knowledge of implementation constraints. AI drafts structure; human fills in commitments. |
| **Partner Enablement Lead** | S2 (Partner Enablement Brief) | — | `manual` + on-demand AI | Partner relationship dynamics require human insight. AI provides capability alignment suggestions; human shapes the co-sell narrative. |

---

## Fit Check: R × A

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | Provide a centralized "home base" application that ingests recipes, orchestrates agents, and manages asset lifecycle. | Core goal | ✅ (A1, A2, A4, A6) |
| R0.1 | Ingest recipes from GitHub automatically and support manual upload. | Core goal | ✅ (A1.1) |
| R0.2 | Parse recipe Asset Manifest and create trackable work queue. | Core goal | ✅ (A1.2, A2.2) |
| R0.3 | Dispatch each asset to the appropriate agent by type and automation level. | Core goal | ✅ (A2.1, A2.2) |
| R0.4 | Real-time visibility into agent status and pipeline health. | Core goal | ✅ (A6.1, A6.3, A6.4) |
| R1 | Multi-modal agent orchestration: fully automated, human-augmented, and human-driven. | Must-have | ✅ (A2.1, A2.2, A2.3, Agent Catalog) |
| R2 | Recipe-to-asset traceability across the full chain. | Must-have | ✅ (A1.3, A4.1) |
| R3 | Live skills registry from `stahura/domo-ai-vibe-rules` with dynamic resolution. | Must-have | ✅ (A3.1, A3.2, A2.4) |
| R4 | Asset lifecycle management with defined stages and version history. | Must-have | ✅ (A4.1, A4.2) |
| R5 | Pipeline visibility and analytics dashboard. | Must-have | ✅ (A6.1, A6.2, A6.3) |
| R6 | Deal context passthrough from recipe to agents with section-level indexing. | Must-have | ✅ (A1.2, A2.3) |
| R7 | Human review workflow with inline editing, diff view, and feedback loop. | Must-have | ✅ (A5.1, A5.2, A5.3) |
| R8 | Extensible agent architecture via configuration-driven registry. | Must-have | ✅ (A2.1) |
| R9 | Notification and handoff at lifecycle transitions via Slack and in-app. | Must-have | ✅ (A7.1, A7.2) |
| R10 | Deal/account is the primary organizing unit for all views, navigation, and aggregation. | Must-have | ✅ (A8.5, A6.2) |
| R11 | SA team management with assignment, My Work view, and team workload visibility. | Must-have | ✅ (A8.1, A8.2, A8.3, A8.4) |

**Notes:**
- All requirements satisfied by the single shape. The architecture cleanly separates: A1 (ingestion/parsing), A2 (agent orchestration), A3 (skills), A4 (asset lifecycle), A5 (human review), A6 (visibility), A7 (notifications), A8 (team & assignment). R10 (deal-centric organization) is a cross-cutting concern addressed by A8.5 (dashboard structure) and A6.2 (deal detail view) — every surface leads with the deal/account, not with agents or pipeline stages.

---

## Resolved Questions

1. **Is this a Domo custom app or a standalone web app?** → **Start as a standalone web app (Lovable.dev → React), with a path to Domo deployment.** The hub needs capabilities (webhooks, long-running agent processes, GitHub API integration) that are easier to build outside Domo initially. The `migrating-lovable-to-domo` skill from `stahura/domo-ai-vibe-rules` provides a documented path for Domo deployment when ready. The UI should be built Domo-compatible from the start (no SSR, client-side rendering, compatible with `ryuu.js` injection).

2. **Where do generated assets live?** → **In the hub's database, not in GitHub.** The `tdr-asset-recipes` repo stores *recipes* (input). Generated *assets* (output) live in the hub's storage with metadata, versions, and lifecycle state. Approved assets can be exported to any channel (download, Slack, email, Google Drive) but the hub is the system of record.

3. **How do agents authenticate to LLM APIs?** → **Server-side only, via environment variables.** API keys for Cortex, OpenAI, Anthropic never touch the client. Agent execution happens server-side (or via Code Engine when deployed to Domo). The frontend only sees job status and results.

4. **What happens when a recipe is updated (new version pushed for the same deal)?** → **New recipe creates new asset jobs.** Existing approved assets are not overwritten. The UI shows the latest recipe version and allows the user to "regenerate from latest recipe" for any asset, creating a new version linked to the new recipe.

5. **Should the hub auto-start generation on recipe ingestion?** → **Configurable.** Default: fully automated agents start immediately; human-augmented agents are queued with notification; human-driven agents await manual trigger. A global "auto-pilot" toggle can enable/disable auto-start for automated agents.

6. **How does the hub connect to `deal-inspect`?** → **One-directional via the recipe.** The recipe is the contract. The hub does not call back to `deal-inspect` and does not need access to deal-inspect's database, APIs, or Snowflake tables. All context needed for generation is embedded in the recipe. This keeps the systems decoupled.

7. **Should agents run in parallel or sequentially?** → **Parallel by default, with dependency overrides.** Most assets are independent and can be generated concurrently. If a dependency is declared (e.g., "generate Solution Brief before Pitch Deck to reference it"), the dispatch engine respects ordering. Default: all same-priority assets dispatch in parallel.

8. **What's the tech stack for the MVP?** → **React (Vite) + Tailwind + shadcn/ui for frontend (Lovable.dev generates this). Supabase for backend (auth, Postgres, realtime subscriptions, edge functions for agent execution). GitHub API for recipe ingestion and skills resolution.** This stack is compatible with eventual Domo deployment (swap Supabase for Domo AppDB + Code Engine).

9. **What is the primary organizing unit — agents, pipeline stages, or deals?** → **Deals/accounts.** Recipes arrive per deal. SAs are assigned to deals. All views lead with the deal as the top-level entity. Pipeline (kanban), agent monitor, and skills registry are *secondary lenses* — useful for cross-deal analysis but not the daily operating view. An SA's day starts at "My Work" (their deals) or the dashboard (all deals), not at the agent monitor.

10. **Who are the users?** → **A team of SAs (Solutions Architects / Solutions Engineers) who execute and build solutions for customers.** They are the operators. A lead/manager oversees team workload and deal assignment. The hub is their workspace — not a passive monitoring tool but an active workbench where they use agents to build deliverables for their accounts.

11. **How does the process flow end-to-end?** → **TDR Inspection (deal-inspect) → Recipe (spec sheet) → GitHub repo → Asset Generation Hub → SA team builds solutions via agents → Deliverables to customer.** Deal-inspect is the intelligence collector and spec writer. The hub is the builder and delivery engine. The recipe is the contract between them. SAs are the operators in the hub.

---

## Rabbit Holes

- **Don't build the agents first.** The hub is the *orchestration layer*, not the agents themselves. Start with the UI, recipe ingestion, and manual asset creation/upload. Agent automation is additive — the system must work with humans doing all the generation before any agent is wired up.

- **Don't try to render generated assets as their final format (slides, PDFs, diagrams) inside the hub.** The hub works in Markdown. Final format conversion (Markdown → Google Slides, Markdown → PDF, Mermaid → SVG) is a downstream concern handled by the delivery pipeline, not the review workspace.

- **Don't build a custom LLM orchestration framework.** Use direct API calls (Cortex `AI_COMPLETE`, Anthropic Messages API) with the recipe context + skill content as the prompt. The recipe IS the orchestration spec — the agent just follows the per-asset instructions embedded in it. No LangChain, no custom agent loops for v1.

- **Don't over-engineer the agent registry.** Start with a static config file mapping asset types to agents. Dynamic agent registration, health checks, and auto-scaling are Phase 2. For MVP, agents are LLM API calls with skill-augmented prompts.

- **Don't build custom auth from scratch.** Supabase Auth (or Domo SSO when deployed) handles user identity. The hub needs role-based access (admin, reviewer, viewer) but not a bespoke auth system.

- **Don't conflate the hub with `deal-inspect`.** They are separate applications with a clean contract (the recipe). The hub should not import from or depend on deal-inspect code. Shared understanding flows through the recipe format spec, not code coupling.

---

## No-Gos

- No server-side rendering (must remain compatible with Domo custom app deployment)
- No exposure of API keys or tokens in client-side code
- No deletion of recipes or assets — soft-delete/archive only (auditability)
- No direct database access to deal-inspect's Snowflake tables (recipe is the contract)
- No synchronous generation that blocks the UI (all agent work is async with polling/subscription)
- No assumption that all recipe sections are populated — graceful degradation inherited from recipe format
- No hardcoded agent-to-asset mappings in the frontend — all resolution via the agent registry

---

## End-to-End Process Flow

```
  UPSTREAM (Intelligence)              CONTRACT              DOWNSTREAM (Execution)
┌─────────────────────────┐         ┌──────────┐         ┌──────────────────────────┐
│  deal-inspect            │         │          │         │  Asset Generation Hub     │
│  (TDR Inspection App)    │         │  Recipe  │         │  (SA Team Home Base)      │
│                          │ ──────► │  (.md)   │ ──────► │                          │
│  • TDR inputs            │  Push   │          │  Ingest │  • Deal roster (by acct)  │
│  • Gong transcripts      │  to     │  Lives   │  from   │  • SA assignment          │
│  • Perplexity research   │  GitHub │  in      │  GitHub │  • Agent dispatch         │
│  • Sumble enrichment     │         │  tdr-    │         │  • Asset generation       │
│  • Cortex AI outputs     │         │  asset-  │         │  • Human review           │
│  • CRM context           │         │  recipes │         │  • Delivery to customer   │
│  • AI Value Continuum    │         │          │         │                          │
│                          │         │          │         │  USERS: SA team           │
│  USERS: SE Managers      │         │          │         │  (build solutions)        │
│  (capture intelligence)  │         │          │         │                          │
└─────────────────────────┘         └──────────┘         └──────────────────────────┘
```

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     ASSET GENERATION HUB                        │
│                     (React + Supabase)                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  Dashboard    │  │  My Work     │  │  Deal Detail          │ │
│  │  (Deal Roster │  │  (SA's       │  │  (Assets per deal,    │ │
│  │   by Account) │  │   deals)     │  │   kanban lifecycle)   │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  Team        │  │  Review      │  │  Skills Registry      │ │
│  │  (Workload   │  │  Workspace   │  │  & Agent Monitor      │ │
│  │   by SA)     │  │              │  │                       │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              ORCHESTRATION ENGINE (Server)                  ││
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐  ││
│  │  │ Recipe  │  │ Dispatch│  │ Skill   │  │ Notification │  ││
│  │  │ Parser  │  │ Engine  │  │ Injector│  │ Engine       │  ││
│  │  └─────────┘  └─────────┘  └─────────┘  └──────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │ GitHub       │ │ LLM APIs     │ │ Slack        │
   │ (recipes +   │ │ (Cortex,     │ │ (webhook     │
   │  skills repo)│ │  Anthropic,  │ │  notifs)     │
   │              │ │  OpenAI)     │ │              │
   └──────────────┘ └──────────────┘ └──────────────┘
```

---

## Upstream Dependency: `deal-inspect` Recipe Format

The hub consumes the recipe format defined in `shaping/sales-asset-generation-recipe.md` and implemented in `src/lib/recipeGenerator.ts`. The recipe is the contract:

| Section | Purpose | Hub Usage |
|---------|---------|-----------|
| `## Meta` | Deal identification, ACV, stage, timestamp | Recipe indexing, deal-level grouping |
| `## System Instructions` | Role prompt, quality standards | Injected into every agent's prompt |
| `## Asset Manifest` | Table of assets + per-asset instructions | Drives dispatch engine — one job per manifest entry |
| `## AI Value Continuum Assessment` | Proactive AI opportunity analysis | Context for L7 agent; also displayed in deal detail view |
| `## Deal Context` (all sub-sections) | CRM, TDR, Gong, Perplexity, Sumble, Cortex | Indexed by section; agents receive only their `contextPriority` sections |
| `## Available Agent Skills` | Skill reference table | Cross-referenced with Skills Registry for resolution |
| `## Constraints & Guardrails` | Generation boundaries | Injected into every agent's prompt as constraints |

---

## Phase Plan

### Phase 1: Foundation (MVP) — Lovable.dev + Supabase

Build the frontend shell and manual workflow. Deal/account-centric from day one.

- Deal roster dashboard (all deals, grouped/filtered by account and assigned SA)
- SA auth + profiles (Supabase Auth with role + expertise tags)
- My Work page (SA's assigned deals with asset progress and next actions)
- Team workload page (manager view of SA assignments and capacity)
- Recipe ingestion (from GitHub, parse, display; organized by deal)
- Deal detail page (assets as kanban within a deal)
- Manual asset creation (human writes/uploads asset for a manifest entry)
- Asset lifecycle tracking (status transitions, version history)
- Skills registry browser (fetched from GitHub)
- Basic notification (in-app toasts)

### Phase 2: Agent Wiring

Connect automated agents to the dispatch engine.

- Agent registry (configuration-driven)
- Dispatch engine (auto-queue on recipe ingestion)
- Embedded LLM agents for fully automated assets (U1, U3, S1, S6, S7, S8)
- Skill injection into agent prompts
- Generation status tracking (realtime updates)

### Phase 3: Human-in-the-Loop

Build the collaborative review workflow.

- Review queue with priority sorting
- Review workspace (split-pane: asset + context)
- Inline editing with diff view
- Approve/revise/reject workflow with feedback loop
- Comment threads per asset
- Slack notifications for review lifecycle

### Phase 4: Advanced Agents & Analytics

Wire up human-augmented agents and build analytics.

- Human-augmented agents (draft → review → refine cycle)
- Agent performance analytics
- Pipeline analytics dashboard
- Export/delivery channels (ZIP bundles, Slack push, email)
- Activity feed with real-time updates

### Phase 5: Domo Deployment

Migrate to Domo custom app platform.

- Apply `migrating-lovable-to-domo` skill
- Swap Supabase → Domo AppDB + Code Engine
- Integrate Domo SSO
- Agent execution via Code Engine functions
- Publish as Domo custom app
