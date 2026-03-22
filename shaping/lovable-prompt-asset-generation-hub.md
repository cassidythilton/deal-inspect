# Lovable.dev Prompt — Asset Generation Hub

> Copy everything below the line into Lovable.dev as the initial project prompt.

---

Build a modern, professional web application called **"Asset Generation Hub"** — the home base for a team of Solutions Architects (SAs) who build deal-specific sales assets using AI agents. The app is organized around **deals/accounts** as the primary unit — recipes (structured Markdown spec sheets) arrive per deal from an upstream intelligence app, and SAs are assigned to deals to execute asset generation using a mix of automated agents and hands-on engineering.

The end-to-end flow: **TDR Inspection App (upstream)** → captures deal intelligence → compiles a Recipe (spec sheet) → pushes to GitHub → **Asset Generation Hub (this app)** → SA team picks up recipes → agents + humans generate assets → deliverables to customer.

Everything should be viewed, filtered, and aggregated by deal/account. SAs think in terms of "my deals" and "my accounts." Managers think in terms of "team workload" and "deal coverage."

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

### `team_members` table
```sql
create table team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  avatar_url text,
  role text default 'sa' check (role in ('sa', 'lead', 'admin')),
  expertise text[] default '{}',
  status text default 'active' check (status in ('active', 'away', 'inactive')),
  created_at timestamptz default now()
);
```

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
  assigned_sa uuid references team_members(id),
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
  assigned_sa uuid references team_members(id),
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

### Seed Team Members (5 SAs + 1 lead)

```json
[
  { "name": "Sarah Chen", "email": "sarah.chen@domo.com", "role": "lead", "expertise": ["ai-ml", "integrations", "architecture"], "status": "active" },
  { "name": "Marcus Rivera", "email": "marcus.rivera@domo.com", "role": "sa", "expertise": ["app-development", "embedded-analytics", "visualization"], "status": "active" },
  { "name": "Priya Sharma", "email": "priya.sharma@domo.com", "role": "sa", "expertise": ["ai-ml", "data-warehouse", "automation"], "status": "active" },
  { "name": "Jake Thompson", "email": "jake.thompson@domo.com", "role": "sa", "expertise": ["integrations", "data-warehouse", "visualization"], "status": "active" },
  { "name": "Lisa Park", "email": "lisa.park@domo.com", "role": "sa", "expertise": ["embedded-analytics", "app-development", "ai-ml"], "status": "active" },
  { "name": "David Okafor", "email": "david.okafor@domo.com", "role": "sa", "expertise": ["automation", "integrations", "governance"], "status": "active" }
]
```

### Seed Recipes (4 deals with varied asset manifests, assigned to SAs)

Create 4 realistic recipe records with different deal profiles and SA assignments:

1. **"Acme Corp Enterprise Expansion"** — Account: Acme Corp. ACV $2.4M, Stage 4, Domo Layers: Data Integration + Visualization/BI + AI/ML. 11 assets (U1–U4, L1, L3, L7, S1, S4, S7, S8). Mix of statuses across the pipeline. Assigned to **Jake Thompson**.

2. **"TechStart Inc New Business"** — Account: TechStart Inc. ACV $180K, Stage 2, Domo Layers: App Development + Embedded Analytics. 7 assets (U1–U4, L4, L5, S6). Mostly in early stages (queued/generating). Assigned to **Marcus Rivera**.

3. **"GlobalBank Risk Platform Renewal"** — Account: GlobalBank. ACV $890K, Stage 5, Domo Layers: Data Warehouse + Automation/Alerts + AI/ML. 9 assets (U1–U4, L2, L6, L7, S7, S8). Mostly approved/delivered (near completion). Assigned to **Priya Sharma**.

4. **"Meridian Health Systems Data Modernization"** — Account: Meridian Health. ACV $1.1M, Stage 3, Domo Layers: Data Integration + Data Warehouse + AI/ML + Automation/Alerts. 10 assets (U1–U4, L1, L2, L6, L7, S1, S8). Unassigned — no SA yet (used to demo the "Unassigned" state and claim flow).

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

The app is organized deal/account-first. The SA's daily operating view is "My Work" (their deals). The manager's view is "Team" (workload distribution). Everything else supports these two primary surfaces.

### 1. `/` — Deal Dashboard (Mission Control)

The landing page. Organized around **deals/accounts** as the top-level entity — not agents, not pipeline stages.

**Layout:**
- Top bar: App logo ("Asset Generation Hub" with a Sparkles icon), global search (searches deals by name, account, or SA), notification bell with badge count, logged-in user avatar dropdown (name, role, "My Work" shortcut, sign out)
- Left sidebar: Navigation links with icons, in this order: **Deals** (LayoutGrid), **My Work** (User), **Team** (Users), **Review Queue** (ClipboardCheck), **Recipes** (FileText), **Agents** (Bot), **Skills** (Wrench), **Activity** (Clock), **Settings** (Settings). Collapsible to icon-only mode. Active state uses amber-500 left border + text highlight. "My Work" has a badge showing the user's pending action count.

**Dashboard Content:**
- **Metric Cards Row (4 cards):** Active Deals (count of deals with recipes), Assets Pending (total across all deals in queued/generating/draft/in_review), Unassigned Deals (count with no SA — amber highlight if > 0), Avg Time to Delivery (days from recipe ingestion to all assets approved). Each card is a compact stat card with icon, value, and trend indicator.
- **Deal Roster Table (primary surface — full width):** The main table showing all deals with active recipes, **grouped by account** when multiple deals exist for the same account. Columns: Deal Name (bold, clickable → deal detail), Account, Assigned SA (avatar + name; shows amber "Unassigned" badge if null — clicking opens assignment dropdown), ACV (formatted currency), Stage, Assets (segmented progress bar: green = approved, amber = in progress, slate = queued, with "7/11" text), Deal Status (badge: "Complete" green, "In Progress" amber, "Needs Attention" rose, "New" blue, "Unassigned" orange), Last Activity (relative time). Sortable by any column. **Filters above:** SA (multi-select with team member avatars), Account (text search), Stage (multi-select), Status (multi-select).
- **Activity Sidebar (right, collapsible ~25% width):** Last 15 events as a compact vertical timeline. Each event: colored icon + one-line description + deal name + relative timestamp. Clicking navigates to relevant detail. Shows a "View All" link to `/activity`.

### 2. `/my-work` — My Work (SA's Personal View)

The SA's daily operating view. Shows only their assigned deals and what needs attention.

**Layout:**
- **Header:** "My Work" title with the SA's name and avatar. Summary stat row: Active Deals (count), Assets To Review (count in `draft` or `in_review` for their deals), Assets In Progress (count in `generating`), Delivered This Week (count).
- **Deal Cards (vertical stack, full width):** One card per assigned deal, ordered by urgency (deals with stale assets or approaching close dates first). Each deal card contains:
  - **Card header:** Deal name (bold, clickable → deal detail), account (muted), ACV, stage badge
  - **Asset progress bar:** Segmented bar (green/amber/slate) with "X of Y complete" text
  - **Next Actions list:** 2-3 most urgent items for this deal, e.g., "Review Solution Brief draft (2h ago)", "Start POC Plan (manual)", "Integration Architecture generating...". Each action is clickable → opens the relevant asset/review workspace.
  - **Quick action buttons:** "View Deal" (→ deal detail), "Open Review Queue" (→ review queue filtered to this deal)
- **Unassigned Deals Section (bottom):** If there are unassigned deals, show them under a "Claim a Deal" heading. Each unassigned deal card shows deal name, account, ACV, asset count, and a "Claim" button that assigns the deal to the current SA.
- **Empty state:** If no deals assigned, show "No deals assigned yet — check the dashboard for unassigned deals" with a link to `/`.

### 3. `/team` — Team Workload (Manager View)

Manager/lead view showing SA workload distribution and team capacity.

**Layout:**
- **Header:** "Team" title with team summary: Total SAs (count), Total Active Deals (count), Deals per SA (average), Total Assets in Pipeline.
- **SA Workload Cards (grid, 2-3 columns):** One card per SA. Each card:
  - SA avatar, name, role badge, status indicator (green dot = active, gray = away)
  - Expertise tags (small badges, e.g., "AI/ML", "Integrations")
  - Stats grid: Active Deals (count), Assets Pending (count), Assets Approved (count), Completion Rate (%)
  - Mini bar chart: deal load visualization (1 bar per deal showing asset completion)
  - "View Work" button → navigates to that SA's My Work view (filtered)
- **Workload Distribution Chart:** Horizontal bar chart comparing deal count and asset count per SA. Highlights imbalances (e.g., one SA has 5 deals while another has 1).
- **Unassigned Deals Alert:** If any deals are unassigned, show a prominent amber alert bar at the top: "X deals need an SA assignment" with a "View & Assign" button that scrolls to the dashboard's unassigned filter.
- **Team Activity Table (bottom):** Recent activity across all SAs. Columns: SA Name, Action (e.g., "Approved Solution Brief"), Deal, Timestamp.

### 4. `/deal/:dealId` — Deal Detail

The deep-dive into a single deal. This is where the SA works on a specific account's assets.

**Layout:**
- **Header:** Deal name (large), account (subtitle), ACV (formatted), stage badge, assigned SA (avatar + name, with "Reassign" option), recipe version, ingested date. Link to GitHub recipe. "Export All" button (ZIP of approved assets).
- **Progress overview:** Horizontal segmented progress bar showing asset completion (approved / total). Text: "7 of 11 assets complete". Below: count by status (e.g., "3 approved, 2 in review, 4 queued, 2 generating").
- **Asset Board (primary surface, tabs: "Board" | "List"):**
  - **Board view (default):** Kanban with columns = lifecycle stages (Queued | Generating | Draft | In Review | Approved | Delivered). Each column shows count. Asset cards within columns show: asset name (e.g., "Solution Brief"), asset type badge (U1, L3, etc.), priority badge, automation level icon, assigned agent name. Cards are draggable between columns. Clicking a card opens a slide-over with asset detail + review workspace.
  - **List view (toggle):** Table format with columns: Asset Name, Type, Priority, Agent, Status, Automation Level, Last Updated. Sortable. More scannable for deals with many assets.
- **AI Value Continuum section (collapsible card):** If the recipe includes an AI Value Continuum Assessment, render as 4 horizontal bars representing the 4 levels (Process Automation, Traditional AI/ML, Generative AI, Agentic AI), with assessed level(s) highlighted in amber + confidence %. Evidence bullets listed below each assessed level.
- **Recipe Context (collapsible accordion, below the asset board):** CRM Context, TDR Discovery Inputs, Gong Call Intelligence, Account Research (Perplexity), Account Enrichment (Sumble), AI-Synthesized Intelligence. Each section renders Markdown content from the parsed recipe.

### 5. `/review` — Review Queue

Prioritized list of assets awaiting the current SA's review (or all reviews for leads/admins).

**Layout:**
- **Toggle:** "My Reviews" (default — filtered to current SA's deals) | "All Reviews" (for leads/admins)
- **Queue table:** Columns: Deal Name (clickable → deal detail), Account, Asset Type, Priority (sorted critical first), Agent, Confidence (percentage with color coding: >80% green, 50-80% amber, <50% rose), Time in Queue (with stale highlighting if >24h amber, >48h rose), Status (draft / in_review / revision_requested), Actions ("Open Review" button).
- **Empty state:** "All caught up — no assets awaiting review" with check illustration.
- **Clicking "Open Review":** Navigates to `/review/:assetJobId`.

### 6. `/review/:id` — Review Workspace

Split-pane review interface for a single asset.

**Layout:**
- **Breadcrumb:** Deals > {Deal Name} > {Asset Name}
- **Left pane (60%):** Asset content rendered as Markdown. Editable — clicking "Edit" toggles to a Markdown editor with toolbar (bold, italic, headers, lists, code blocks, links). "Diff" toggle shows changes from the original agent draft (green = additions, red = deletions). Version selector dropdown to compare any two versions.
- **Right pane (40%):** Recipe context for this deal, organized as collapsible accordion sections. The sections highlighted match the asset's `contextPriority` from the recipe (shown with amber left border). Sections: CRM Context, TDR Discovery Inputs, Gong Call Intelligence, Account Research, Account Enrichment, AI-Synthesized Intelligence, AI Value Continuum.
- **Bottom action bar:** Sticky bottom bar with: "Approve" (emerald button), "Request Revision" (amber button — opens text input for feedback), "Edit & Approve" (slate button — saves human edits as approved version), "Reject" (rose button — opens reason input). Also shows: deal name, agent name, generation time, confidence score, version number.
- **Comment thread (toggleable right drawer):** Comment thread for the asset. Input field at bottom. Comments show author avatar, name, timestamp, and content. Supports Markdown in comments.

### 7. `/recipes` — Recipe Browser

Browse and inspect all ingested recipes, organized by deal.

**Layout:**
- **Recipe List (left panel, ~40% width):** Cards showing each recipe, **grouped by account**. Card content: deal name (bold), account (muted), assigned SA (avatar), ACV, stage, ingested date (relative), asset count badge. Click to select.
- **Recipe Detail (right panel, ~60% width):** When a recipe is selected, show: Meta table (deal ID, account, ACV, stage, assigned SA, timestamp, version, GitHub link), Asset Manifest table (# | Asset | Priority | Trigger | Audience), and collapsible sections for each context block rendered as Markdown.
- **Top bar actions:** "Ingest New Recipe" button (opens modal with: GitHub URL input OR drag-and-drop file upload), "Refresh from GitHub" button.

### 8. `/agents` — Agent Monitor

Overview of all registered agents and their status. Secondary view — not the daily operating surface.

**Layout:**
- **Agent cards (grid, 3 columns):** Each agent as a card. Card content: Agent name (bold), description (muted, 2 lines truncated), automation level badge (color-coded: green = fully automated, amber = human-augmented, blue = human-driven), status indicator (green dot = active, red dot = error, gray dot = inactive), supported asset types as small badges (e.g., "U1", "U3"), required skills as small tags. Bottom of card: stats row — Assets Generated (count), Avg Confidence (%), Approval Rate (%).
- **Card click:** Opens agent detail view — full description, all supported assets, all required skills (linked to skills registry), performance chart (assets over time), and recent jobs table (showing which deals the agent worked on).

### 9. `/skills` — Skills Registry

Browsable catalog of Domo platform skills from stahura/domo-ai-vibe-rules.

**Layout:**
- **Header:** "Skills Registry" title, subtitle "Agent skills from stahura/domo-ai-vibe-rules", "Refresh All" button, last-fetched timestamp.
- **Skills grid (2 columns):** Each skill as a card. Card content: Skill ID (monospace, e.g., `domo-js`), display name, description (2-3 lines), applicable asset types as small badges, last-fetched timestamp. Expand button to show full SKILL.md content rendered as Markdown.
- **Rules section:** Separate section at bottom for `core-platform-rule.md` and `domo-gotchas.md` — always-on guardrails. Displayed as expandable cards.
- **Search:** Filter skills by name, description, or applicable asset type.

### 10. `/activity` — Activity Feed

Full activity log, filterable by deal and SA.

**Layout:**
- **Timeline view:** Vertical timeline of all system events. Each event: timestamp (absolute + relative), event type icon (color-coded), description, linked entities (deal name clickable, SA name clickable, asset type clickable, agent name clickable). Event types: recipe_ingested, deal_assigned, agent_started, agent_completed, asset_draft_ready, review_started, revision_requested, asset_approved, asset_delivered, generation_failed.
- **Filters:** Deal (search), SA (multi-select), Event type (multi-select), Date range picker.
- **Pagination:** Infinite scroll or "Load More" at bottom.

### 11. `/settings` — Settings

Application configuration.

**Layout:**
- **Sections as tabs or accordion:**
  - **GitHub Integration:** Repository URL for recipes (default: `cassidythilton/tdr-asset-recipes`), repository URL for skills (default: `stahura/domo-ai-vibe-rules`), polling interval.
  - **Team Management:** Add/remove team members, edit roles and expertise tags. (Leads and admins only.)
  - **Notifications:** Slack webhook URL, notification rules (checkboxes for each event type × channel).
  - **Agent Defaults:** Default automation level for new asset types, auto-start toggle for automated agents.
  - **Display:** Theme toggle (dark/light — dark default), density toggle (compact/comfortable).

## Key Interactions

1. **Recipe Ingestion Flow:** User clicks "Ingest New Recipe" → pastes GitHub URL or uploads .md file → system parses recipe → creates recipe record + asset_job records for each manifest entry → deal appears in dashboard as "New" + "Unassigned" → shows success toast with "X assets queued for {deal name}" → dashboard updates.

2. **Deal Assignment Flow:** On the dashboard, unassigned deals show an amber "Unassigned" badge. Lead/admin clicks the SA column → dropdown of team members appears (sorted by workload, fewest deals first) → selects SA → deal is assigned → SA receives notification → deal appears in SA's My Work page. SAs can also self-assign from the "Claim a Deal" section on My Work.

3. **SA Daily Workflow:** SA opens app → lands on My Work → sees their deals ordered by urgency → clicks the most urgent deal → opens deal detail → sees asset board (kanban) → reviews drafts, kicks off manual assets, monitors automated generation → uses review workspace for human-augmented assets → approves completed assets → exports deal package when all assets are approved.

4. **Asset Lifecycle Transitions:** On the deal detail page, asset cards in the kanban are draggable between status columns. Drag triggers a confirmation dialog for critical transitions (e.g., "Approve this asset?"). Status changes log to activity feed and trigger notifications.

5. **Review Workflow:** SA sees badge count on "My Work" or "Review Queue" nav items → opens review queue (auto-filtered to their deals) → sees prioritized list → opens review workspace → reads asset content alongside recipe context → takes action (approve/revise/edit/reject) → asset moves to next stage → notification sent.

6. **Skill Resolution:** When viewing an agent's detail page, each required skill is a clickable link to the Skills Registry. When viewing an asset's generation metadata, "Skills Used" shows which skills were injected into the agent's prompt.

7. **Deal Package Export:** When all assets for a deal reach "approved" status, a "Download Deal Package" button appears on the deal detail page. Clicking generates a ZIP file containing all approved assets as Markdown files, plus a cover page with deal metadata.

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
