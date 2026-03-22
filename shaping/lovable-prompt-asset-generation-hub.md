# Lovable.dev Prompt — Asset Generation Hub

> Copy everything below the line into Lovable.dev as the initial project prompt.

---

Build a modern, professional web application called **"Asset Generation Hub"** — a multi-agent orchestration platform for managing AI-generated sales assets. The app ingests structured "recipe" specifications (Markdown files) from a GitHub repository, tracks which sales assets need to be generated for each deal, and manages the full lifecycle of those assets from draft through review to approval.

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui components
- Supabase for backend (auth, Postgres database, realtime subscriptions)
- React Router for navigation
- Lucide React for icons
- Recharts for analytics charts

## Design System

- Dark, professional theme with a slate/zinc base palette (similar to Linear, Vercel dashboard)
- Accent color: amber-500 for primary actions and active states
- Secondary accent: emerald-500 for success states, rose-500 for errors/alerts
- Card-based layout with subtle borders (border-slate-800) and glass-morphism effects on hover
- Rounded corners (rounded-lg), subtle shadows (shadow-sm), smooth transitions (transition-all duration-200)
- Typography: Inter or system font stack, clean hierarchy with font-medium for headings
- Responsive: works on desktop (primary) and tablet. Mobile is nice-to-have but not required.
- Minimal, data-dense UI — more dashboard than marketing site

## Database Schema (Supabase/Postgres)

### `recipes` table
```sql
create table recipes (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null,
  deal_name text not null,
  account text not null,
  acv numeric,
  stage text,
  recipe_version text,
  github_url text,
  raw_content text not null,
  parsed_meta jsonb,
  parsed_manifest jsonb,
  parsed_context jsonb,
  status text default 'active' check (status in ('active', 'archived')),
  ingested_at timestamptz default now(),
  created_at timestamptz default now()
);
```

### `asset_jobs` table
```sql
create table asset_jobs (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id),
  deal_id text not null,
  deal_name text not null,
  asset_type text not null,
  asset_name text not null,
  priority text default 'recommended' check (priority in ('critical', 'recommended', 'optional')),
  automation_level text default 'human_driven' check (automation_level in ('fully_automated', 'human_augmented', 'human_driven')),
  agent_id text,
  status text default 'queued' check (status in ('queued', 'generating', 'draft', 'in_review', 'revision_requested', 'approved', 'delivered', 'failed')),
  assigned_reviewer text,
  content text,
  version integer default 1,
  confidence numeric,
  generation_time_ms integer,
  skills_used text[],
  review_feedback text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### `agents` table
```sql
create table agents (
  id text primary key,
  name text not null,
  description text,
  supported_asset_types text[] not null,
  automation_level text not null check (automation_level in ('fully_automated', 'human_augmented', 'human_driven')),
  required_skills text[],
  invocation_type text default 'embedded_llm' check (invocation_type in ('embedded_llm', 'code_engine', 'github_action', 'external_api', 'manual')),
  status text default 'active' check (status in ('active', 'inactive', 'error')),
  config jsonb,
  created_at timestamptz default now()
);
```

### `skills` table
```sql
create table skills (
  id text primary key,
  name text not null,
  description text,
  skill_url text,
  applicable_assets text[],
  content text,
  last_fetched timestamptz,
  created_at timestamptz default now()
);
```

### `activity_log` table
```sql
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  deal_id text,
  recipe_id uuid references recipes(id),
  asset_job_id uuid references asset_jobs(id),
  agent_id text,
  user_id uuid,
  details jsonb,
  created_at timestamptz default now()
);
```

### `asset_versions` table
```sql
create table asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_job_id uuid references asset_jobs(id),
  version integer not null,
  content text not null,
  generated_by text,
  trigger text check (trigger in ('initial', 'human_edit', 'regeneration', 'context_update')),
  metadata jsonb,
  created_at timestamptz default now()
);
```

## Seed Data

Seed the database with realistic demo data so the app feels alive on first load:

### Seed Agents (13 agents)

```json
[
  { "id": "solution-writer", "name": "Solution Writer", "description": "Generates executive solution briefs and ROI frameworks from deal context", "supported_asset_types": ["U1", "U3"], "automation_level": "fully_automated", "required_skills": [], "invocation_type": "embedded_llm", "status": "active" },
  { "id": "competitive-analyst", "name": "Competitive Analyst", "description": "Creates feature-by-feature competitive positioning and differentiation materials", "supported_asset_types": ["S1"], "automation_level": "fully_automated", "required_skills": [], "invocation_type": "embedded_llm", "status": "active" },
  { "id": "stage-strategy", "name": "Stage Strategy Agent", "description": "Produces stage-appropriate strategy documents (discovery bridges, implementation packets)", "supported_asset_types": ["S6", "S7"], "automation_level": "fully_automated", "required_skills": [], "invocation_type": "embedded_llm", "status": "active" },
  { "id": "governance-analyst", "name": "Governance Analyst", "description": "Generates security and governance addendums based on compliance and regulatory signals", "supported_asset_types": ["S8"], "automation_level": "fully_automated", "required_skills": [], "invocation_type": "embedded_llm", "status": "active" },
  { "id": "pitch-architect", "name": "Pitch Architect", "description": "Drafts executive pitch deck outlines with narrative arc and talking points for human refinement", "supported_asset_types": ["U2"], "automation_level": "human_augmented", "required_skills": [], "invocation_type": "embedded_llm", "status": "active" },
  { "id": "app-builder", "name": "App Builder", "description": "Creates Domo app prototype specifications with UI/UX requirements, data models, and component architecture", "supported_asset_types": ["L5"], "automation_level": "human_augmented", "required_skills": ["domo-app-initial-build-playbook", "domo-js", "domo-manifest", "domo-dataset-query", "domo-appdb"], "invocation_type": "embedded_llm", "status": "active" },
  { "id": "integration-architect", "name": "Integration Architect", "description": "Designs integration architectures and automation playbooks with data flow diagrams", "supported_asset_types": ["L1", "L6"], "automation_level": "human_augmented", "required_skills": ["domo-code-engine", "domo-workflow", "domo-manifest"], "invocation_type": "embedded_llm", "status": "active" },
  { "id": "analytics-designer", "name": "Analytics Designer", "description": "Creates dashboard blueprints, data warehouse briefs, and analytics architecture documents", "supported_asset_types": ["L2", "L3"], "automation_level": "human_augmented", "required_skills": ["domo-dataset-query", "domo-data-api", "domo-performance-optimizations"], "invocation_type": "embedded_llm", "status": "active" },
  { "id": "embedded-architect", "name": "Embedded Analytics Architect", "description": "Designs Domo Everywhere architecture with multi-tenant isolation and embed strategy", "supported_asset_types": ["L4"], "automation_level": "human_augmented", "required_skills": ["domo-js", "domo-manifest"], "invocation_type": "embedded_llm", "status": "active" },
  { "id": "ai-solutions-architect", "name": "AI Solutions Architect", "description": "Maps deals across the AI Value Continuum and recommends Domo AI/ML capabilities at each applicable level", "supported_asset_types": ["L7"], "automation_level": "human_augmented", "required_skills": ["domo-ai-service-layer", "domo-code-engine", "domo-workflow"], "invocation_type": "embedded_llm", "status": "active" },
  { "id": "deal-strategist", "name": "Deal Strategist", "description": "Human-led creation of internal strategy playbooks and re-engagement plans with AI assistance", "supported_asset_types": ["U4", "S5"], "automation_level": "human_driven", "required_skills": [], "invocation_type": "manual", "status": "active" },
  { "id": "poc-planner", "name": "POC Planner", "description": "Human-led POC scoping and technical proof-of-concept planning with AI-generated templates", "supported_asset_types": ["S3"], "automation_level": "human_driven", "required_skills": [], "invocation_type": "manual", "status": "active" },
  { "id": "partner-lead", "name": "Partner Enablement Lead", "description": "Human-led partner co-sell strategy and enablement brief creation", "supported_asset_types": ["S2"], "automation_level": "human_driven", "required_skills": [], "invocation_type": "manual", "status": "active" }
]
```

### Seed Recipes (3 deals with varied asset manifests)

Create 3 realistic recipe records with different deal profiles:

1. **"Acme Corp Enterprise Expansion"** — ACV $2.4M, Stage 4, Domo Layers: Data Integration + Visualization/BI + AI/ML. 11 assets (U1–U4, L1, L3, L7, S1, S4, S7, S8). Mix of statuses across the pipeline.

2. **"TechStart Inc New Business"** — ACV $180K, Stage 2, Domo Layers: App Development + Embedded Analytics. 7 assets (U1–U4, L4, L5, S6). Mostly in early stages (queued/generating).

3. **"GlobalBank Risk Platform Renewal"** — ACV $890K, Stage 5, Domo Layers: Data Warehouse + Automation/Alerts + AI/ML. 9 assets (U1–U4, L2, L6, L7, S7, S8). Mostly approved/delivered (near completion).

### Seed Skills (17 skills)

```json
[
  { "id": "domo-app-initial-build-playbook", "name": "App Build Playbook", "description": "Kickoff sequence for new Domo app builds; routes to the right rules and skills in order" },
  { "id": "domo-js", "name": "Domo JS (ryuu.js)", "description": "ryuu.js usage, navigation/events, and import safety" },
  { "id": "domo-manifest", "name": "Domo Manifest", "description": "manifest.json mapping requirements and gotchas" },
  { "id": "domo-dataset-query", "name": "Dataset Query", "description": "Detailed @domoinc/query syntax and constraints" },
  { "id": "domo-data-api", "name": "Data API", "description": "High-level data-access routing skill; points to query skill" },
  { "id": "domo-appdb", "name": "AppDB", "description": "Toolkit-first AppDB CRUD/query patterns" },
  { "id": "domo-ai-service-layer", "name": "AI Service Layer", "description": "Toolkit-first AI client usage and parsing" },
  { "id": "domo-code-engine", "name": "Code Engine", "description": "Code Engine function invocation patterns and contracts" },
  { "id": "domo-workflow", "name": "Workflow", "description": "Workflow start/status patterns and input contracts" },
  { "id": "domo-performance-optimizations", "name": "Performance", "description": "Data query performance rules" },
  { "id": "domo-app-publish", "name": "App Publish", "description": "Build and publish flow (npm run build, cd dist, domo publish)" },
  { "id": "domo-toolkit-wrapper", "name": "Toolkit Wrapper", "description": "@domoinc/toolkit client usage and response handling" },
  { "id": "domo-custom-connector-ide", "name": "Custom Connector IDE", "description": "Connector IDE auth/data processing patterns" },
  { "id": "migrating-lovable-to-domo", "name": "Lovable → Domo Migration", "description": "Convert SSR-heavy generated apps to Domo-compatible client apps" },
  { "id": "migrating-googleai-to-domo", "name": "Google AI → Domo Migration", "description": "Convert AI Studio-origin projects to Domo static deploy contract" },
  { "id": "core-platform-rule", "name": "Core Platform Rule", "description": "Always-on Domo platform guardrails (applied to all agents)" },
  { "id": "domo-gotchas", "name": "Domo Gotchas", "description": "Common manifest, query, and toolkit pitfalls and troubleshooting" }
]
```

## Pages & Routes

### 1. `/` — Mission Control Dashboard

The landing page and primary "home base" view. Data-dense, scannable.

**Layout:**
- Top bar: App logo ("Asset Generation Hub" with a Sparkles icon), global search, notification bell with badge count, user avatar dropdown
- Left sidebar: Navigation links (Dashboard, Recipes, Pipeline, Review Queue, Agents, Skills, Activity, Settings) with icons. Collapsible to icon-only mode. Active state uses amber-500 left border + text highlight.

**Dashboard Content:**
- **Metric Cards Row (4 cards):** Total Recipes (count), Assets in Pipeline (count by stage as mini stacked bar), Agents Active (count with green dot), Avg Time to Approval (duration). Each card is a compact stat card with icon, value, and trend indicator (up/down arrow with percentage).
- **Deal Pipeline Table:** Full-width table showing all deals with active recipes. Columns: Deal Name (bold, clickable → deal detail), Account, ACV (formatted currency), Stage, Assets (progress bar showing completed/total, e.g., "7/11"), Status (badge: "Complete" green, "In Progress" amber, "Stalled" red, "New" blue), Last Activity (relative time). Sortable columns. Search/filter bar above.
- **Activity Feed (right sidebar or bottom section):** Last 20 events as a vertical timeline. Each event: icon (recipe = FileText, agent = Bot, review = Eye, approval = CheckCircle, error = AlertTriangle) + description + relative timestamp. Clicking an event navigates to the relevant detail page.
- **Quick Stats Row:** Assets by automation level (3 donut charts: Fully Automated, Human-Augmented, Human-Driven showing completed vs. in-progress), and a small area chart showing recipes ingested over the last 30 days.

### 2. `/recipes` — Recipe Browser

Browse and inspect all ingested recipes.

**Layout:**
- **Recipe List (left panel, ~40% width):** Cards showing each recipe. Card content: deal name (bold), account (muted), ACV, stage, ingested date (relative), asset count badge, status badge. Click to select.
- **Recipe Detail (right panel, ~60% width):** When a recipe is selected, show: Meta table (deal ID, account, ACV, stage, timestamp, version, GitHub link), Asset Manifest table (same format as in the recipe — # | Asset | Priority | Trigger | Audience), and collapsible sections for each context block (CRM Context, TDR Inputs, Gong Intelligence, Perplexity Research, Sumble Enrichment, AI Intelligence, AI Value Continuum, Skills, Constraints). Each section renders the Markdown content.
- **Top bar actions:** "Ingest New Recipe" button (opens modal with: GitHub URL input OR drag-and-drop file upload), "Refresh from GitHub" button.

### 3. `/pipeline` — Asset Pipeline (Kanban)

Kanban board showing all assets across their lifecycle stages.

**Layout:**
- **Filter bar:** Filter by deal, asset type, priority, automation level, agent. Dropdown filters with multi-select.
- **Kanban columns:** Queued | Generating | Draft | In Review | Approved | Delivered. Each column shows count in header.
- **Asset cards:** Compact cards within each column. Content: Asset name (e.g., "Solution Brief"), deal name (smaller, muted), priority badge (critical = rose, recommended = amber, optional = slate), automation level icon (Bot for automated, UserCheck for human-augmented, User for human-driven), assigned agent name, time in current stage. Cards are draggable between columns (updates status).
- **Card click:** Opens a slide-over panel with asset detail: full content (rendered Markdown), version history, generation metadata, review feedback, and action buttons appropriate to current status (e.g., "Start Review" for drafts, "Approve" / "Request Revision" for in-review).

### 4. `/review` — Review Queue

Prioritized list of assets awaiting human review.

**Layout:**
- **Queue list:** Table format. Columns: Deal Name, Asset Type, Priority (sorted critical first), Agent, Confidence (percentage with color coding: >80% green, 50-80% amber, <50% rose), Time in Queue (with stale highlighting if >24h), Assigned Reviewer, Actions (Open Review button).
- **Empty state:** "No assets awaiting review" with illustration.
- **Clicking "Open Review":** Navigates to `/review/:assetJobId` — the review workspace.

### 5. `/review/:id` — Review Workspace

Split-pane review interface for a single asset.

**Layout:**
- **Left pane (60%):** Asset content rendered as Markdown. Editable — clicking "Edit" toggles to a Markdown editor with toolbar (bold, italic, headers, lists, code blocks, links). "Diff" toggle shows changes from the original agent draft (green = additions, red = deletions). Version selector dropdown to compare any two versions.
- **Right pane (40%):** Recipe context, organized as collapsible accordion sections. The sections highlighted match the asset's `contextPriority` from the recipe (shown with amber left border). Sections: CRM Context, TDR Discovery Inputs, Gong Call Intelligence, Account Research, Account Enrichment, AI-Synthesized Intelligence, AI Value Continuum.
- **Bottom action bar:** Sticky bottom bar with: "Approve" (emerald button), "Request Revision" (amber button — opens text input for feedback), "Edit & Approve" (slate button — saves human edits as approved version), "Reject" (rose button — opens reason input). Also shows: agent name, generation time, confidence score, version number.
- **Comment thread (toggleable right drawer):** Comment thread for the asset. Input field at bottom. Comments show author avatar, name, timestamp, and content. Supports Markdown in comments.

### 6. `/deal/:dealId` — Deal Detail

Deep-dive into a single deal's asset generation.

**Layout:**
- **Header:** Deal name (large), account, ACV (formatted), stage badge, recipe version, ingested date. Link to GitHub recipe.
- **Progress overview:** Horizontal progress bar showing asset completion (approved / total). Text: "7 of 11 assets complete".
- **Asset grid:** Card grid (2-3 columns) showing each asset for this deal. Each card: asset name, status badge (color-coded), automation level icon, agent avatar/name, priority badge. Clicking opens the asset detail/review workspace.
- **AI Value Continuum section:** If the recipe includes an AI Value Continuum Assessment, render it as a visual: 4 horizontal bars representing the 4 levels (Process Automation, Traditional AI/ML, Generative AI, Agentic AI), with the assessed level(s) highlighted in amber and showing confidence percentage. Evidence bullets listed below each assessed level.
- **Recipe context (collapsible):** Same accordion sections as review workspace, showing all deal context from the recipe.

### 7. `/agents` — Agent Monitor

Overview of all registered agents and their status.

**Layout:**
- **Agent cards (grid, 3 columns):** Each agent as a card. Card content: Agent name (bold), description (muted, 2 lines truncated), automation level badge (color-coded: green = fully automated, amber = human-augmented, blue = human-driven), status indicator (green dot = active, red dot = error, gray dot = inactive), supported asset types as small badges (e.g., "U1", "U3"), required skills as small tags. Bottom of card: stats row — Assets Generated (count), Avg Confidence (%), Approval Rate (%).
- **Card click:** Opens agent detail view — full description, all supported assets, all required skills (linked to skills registry), performance chart (assets over time), and recent jobs table.

### 8. `/skills` — Skills Registry

Browsable catalog of Domo platform skills from stahura/domo-ai-vibe-rules.

**Layout:**
- **Header:** "Skills Registry" title, subtitle "Agent skills from stahura/domo-ai-vibe-rules", "Refresh All" button, last-fetched timestamp.
- **Skills grid (2 columns):** Each skill as a card. Card content: Skill ID (monospace, e.g., `domo-js`), display name, description (2-3 lines), applicable asset types as small badges, last-fetched timestamp. Expand button to show full SKILL.md content rendered as Markdown.
- **Rules section:** Separate section at bottom for `core-platform-rule.md` and `domo-gotchas.md` — these are always-on guardrails. Displayed as expandable cards with the rule content.
- **Search:** Filter skills by name, description, or applicable asset type.

### 9. `/activity` — Activity Feed

Full activity log with filtering.

**Layout:**
- **Timeline view:** Vertical timeline of all system events. Each event: timestamp (absolute + relative), event type icon (color-coded), description, linked entities (deal name clickable, asset type clickable, agent name clickable). Event types: recipe_ingested, agent_started, agent_completed, asset_draft_ready, review_started, revision_requested, asset_approved, asset_delivered, generation_failed.
- **Filters:** Event type multi-select, deal filter, agent filter, date range picker.
- **Pagination:** Infinite scroll or "Load More" at bottom.

### 10. `/settings` — Settings

Application configuration.

**Layout:**
- **Sections as tabs or accordion:**
  - **GitHub Integration:** Repository URL for recipes (default: `cassidythilton/tdr-asset-recipes`), repository URL for skills (default: `stahura/domo-ai-vibe-rules`), polling interval (dropdown: 1 min, 5 min, 15 min, manual only).
  - **Notifications:** Slack webhook URL, notification rules (checkboxes for each event type × channel).
  - **Agent Defaults:** Default automation level for new asset types, auto-start toggle for automated agents.
  - **Display:** Theme toggle (dark/light — dark default), density toggle (compact/comfortable).

## Key Interactions

1. **Recipe Ingestion Flow:** User clicks "Ingest New Recipe" → pastes GitHub URL or uploads .md file → system parses recipe → creates recipe record + asset_job records for each manifest entry → shows success toast with "X assets queued" → dashboard updates.

2. **Asset Lifecycle Transitions:** Asset cards in the kanban are draggable between status columns. Drag triggers a confirmation dialog for critical transitions (e.g., "Approve this asset?"). Status changes log to activity feed and trigger notifications.

3. **Review Workflow:** Reviewer sees badge count on "Review Queue" nav item → clicks → sees prioritized list → opens review workspace → reads asset + references context → takes action (approve/revise/edit/reject) → asset moves to next lifecycle stage → notification sent.

4. **Skill Resolution:** When viewing an agent's detail page, each required skill is a clickable link that navigates to that skill in the Skills Registry. When viewing an asset's generation metadata, the "Skills Used" field shows which skills were injected into the agent's prompt.

## Component Patterns

- Use shadcn/ui `Card`, `Badge`, `Table`, `Tabs`, `Accordion`, `DropdownMenu`, `Dialog`, `Sheet` (slide-over panels), `Tooltip`, `Progress`, `Avatar`, `Separator`
- Status badges should be consistent: queued = slate, generating = blue with pulse animation, draft = indigo, in_review = amber, revision_requested = orange, approved = emerald, delivered = green, failed = rose
- Priority badges: critical = rose-500 bg, recommended = amber-500 bg, optional = slate-500 bg
- Automation level badges: fully_automated = emerald outline with Bot icon, human_augmented = amber outline with UserCheck icon, human_driven = blue outline with User icon
- All data tables should be sortable and filterable
- Loading states: skeleton loaders for cards and tables, spinner for actions
- Empty states: illustrated empty states with helpful call-to-action text
- Toast notifications for all user actions (success = emerald, error = rose, info = blue)
- Responsive sidebar that collapses to icon-only on smaller screens

## Important Notes

- This app must use CLIENT-SIDE rendering only (no SSR, no getServerSideProps). It will eventually be deployed as a Domo custom app which requires pure client-side React.
- All external API calls (GitHub, LLM APIs) should go through Supabase Edge Functions, never directly from the client.
- The app should feel fast and responsive — use optimistic updates, skeleton loaders, and real-time subscriptions where possible.
- The Markdown rendering for recipe content and asset content should handle tables, code blocks, Mermaid diagrams (render as code blocks for now), and standard Markdown formatting.
- Every page should have a clear header with breadcrumb navigation and a consistent layout within the sidebar shell.
