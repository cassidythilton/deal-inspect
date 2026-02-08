# TDR Deal Inspection

> A Domo-embedded sales engineering workspace for identifying, scoring, and reviewing deals that need a **Technical Deal Review (TDR)**.

**Version:** 1.22.0 · **Platform:** Domo Custom App · **Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Recharts

---

## Table of Contents

1. [What Is This App?](#1-what-is-this-app)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Sources & Manifest](#3-data-sources--manifest)
4. [Data Flow Pipeline](#4-data-flow-pipeline)
5. [TDR Index — Scoring Engine](#5-tdr-index--scoring-engine)
6. [Domo AI Recommendation Engine](#6-domo-ai-recommendation-engine)
7. [AppDB — TDR Session Persistence](#7-appdb--tdr-session-persistence)
8. [Pages & Navigation](#8-pages--navigation)
9. [Command Center (Dashboard)](#9-command-center-dashboard)
10. [TDR Workspace](#10-tdr-workspace)
11. [Filters & Dropdowns](#11-filters--dropdowns)
12. [Recommended Deals Table](#12-recommended-deals-table)
13. [Charts](#13-charts)
14. [SE Mapping & Team Enrichment](#14-se-mapping--team-enrichment)
15. [Design System & Color Palette](#15-design-system--color-palette)
16. [Settings](#16-settings)
17. [Development & Deployment](#17-development--deployment)
18. [File Structure](#18-file-structure)

---

## 1. What Is This App?

The TDR Deal Inspection app helps SE (Sales Engineer) managers and leaders identify which deals in the pipeline would benefit most from a structured **Technical Deal Review**. A TDR exists to:

- **Protect deal integrity** — validate technical architecture before decisions lock in
- **Enable account expansion** — ensure the solution scope matches the customer's long-term vision
- **Align partner strategy** — validate cloud partner (Snowflake, Databricks, BigQuery) integration approaches

The app surfaces the right deals at the right time by combining a deterministic scoring engine with Domo AI-powered recommendations, then provides a structured workspace to conduct the review.

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Domo Platform                                │
│                                                                      │
│   ┌─────────────────┐   ┌──────────────┐   ┌──────────────────┐     │
│   │ opportunitiesmagic│   │  semapping   │   │    AppDB         │     │
│   │   (8,000+ opps)  │   │ (29 SE→Mgr)  │   │ (TDR Sessions)  │     │
│   └────────┬─────────┘   └──────┬───────┘   └────────┬─────────┘     │
│            │                    │                     │               │
│            │  /data/v1/...      │  /data/v1/...       │  /domo/       │
│            │                    │                     │  datastores/  │
│            ▼                    ▼                     ▼               │
│   ┌─────────────────────────────────────────────────────────────┐     │
│   │              TDR Deal Inspection (React SPA)                │     │
│   │                                                             │     │
│   │  ┌──────────────┐  ┌────────────┐  ┌────────────────────┐  │     │
│   │  │ useDomo.ts   │  │ appDb.ts   │  │   domoAi.ts        │  │     │
│   │  │ (data hooks) │  │ (AppDB)    │  │   (AI recs)        │  │     │
│   │  └──────┬───────┘  └─────┬──────┘  └────────┬───────────┘  │     │
│   │         │                │                   │              │     │
│   │         ▼                ▼                   ▼              │     │
│   │  ┌──────────────────────────────────────────────────────┐   │     │
│   │  │  CommandCenter → DealsTable → Charts → Agenda        │   │     │
│   │  │  TDRWorkspace → TDRSteps → TDRInputs → Intelligence │   │     │
│   │  │  TDRHistory → Settings                               │   │     │
│   │  └──────────────────────────────────────────────────────┘   │     │
│   └─────────────────────────────────────────────────────────────┘     │
│                                                                      │
│   ┌──────────────────┐                                               │
│   │ Domo AI          │  POST /domo/ai/v1/text/chat                   │
│   │ (text/chat LLM)  │  ← 17-factor TDR Framework prompt            │
│   └──────────────────┘  → JSON array of recommendations              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Sources & Manifest

The app connects to **4 Domo datasets** declared in `manifest.json`:

| Alias | Dataset ID | Purpose | Key Fields |
|-------|-----------|---------|------------|
| `opportunitiesmagic` | `6f12ec25-...` | Primary pipeline data — all open opportunities | Opportunity Id, Account Name, Stage, ACV (USD), Likely, Close Date, Sales Consultant, PoC Sales Consultant, Deal Code, Partners Involved, Snowflake Team Picklist, Number of Competitors, Domo Forecast Category, Type |
| `forecastsmagic` | `79b2d8a2-...` | Forecast data — manager-level forecast calls | Mgr Forecast Name, Forecast Quarter, Likely Call, High Call |
| `wcpweekly` | `62c805ae-...` | Weekly commit pipeline snapshots | Mgr Forecast Name, Forecast Category, SFDC ACV, Likely |
| `semapping` | `6c2d47a4-...` | SE-to-Manager lookup table (29 rows) | `se` → SE name, `se_manager` → their manager |

### Manifest Field Aliasing

Each dataset maps Domo column names to aliases. The `domo.ts` data layer normalizes both alias and canonical names to ensure resilience against Domo API returning either format.

---

## 4. Data Flow Pipeline

```
1. fetchOpportunities()
   └── GET /data/v1/opportunitiesmagic
   └── Pre-filter: Stage Age ≤ 365 days
   └── Normalize field names (alias → canonical)
   └── Returns: DomoOpportunity[]

2. fetchSEMapping()          (direct useEffect, bypasses React Query)
   └── GET /data/v1/semapping
   └── Auto-detect column keys (se, se_manager)
   └── Returns: DomoSEMapping[]

3. transformOpportunityToDeal()
   └── Maps each raw record → Deal object
   └── Parses stage number, calculates risk level
   └── Extracts partner signal, competitive flags

4. SE Manager Join
   └── Build lookup: se_name (lowercase) → se_manager
   └── Match deal.salesConsultant → lookup → deal.seManager
   └── Fallback: try deal.pocSalesConsultant → lookup

5. calculateTDRScore(deal)
   └── 9-component scoring engine → tdrScore (0-100)

6. AppDB Join
   └── appDb.getTDRSessionsByDeal() → Map<opportunityId, TDRSession[]>
   └── Enrich each deal with tdrSessions[] (up to 5 per deal)

7. Domo AI Call (async, parallel)
   └── generateTDRRecommendations(opportunities)
   └── Returns top 5 candidates with scores, reasons, risk flags
   └── Auto-pins to Agenda on first load

8. Filter Options Extraction
   └── SE Managers: from semapping dataset
   └── Sales Engineers: unique "Sales Consultant" values from opportunities
   └── PoC Architects: unique "PoC Sales Consultant" values from opportunities
   └── Quarters: unique "Close Date FQ" and "Current FQ" values
   └── Forecast Managers: filtered by ALLOWED_MANAGERS constant
```

---

## 5. TDR Index — Scoring Engine

**File:** `src/lib/tdrCriticalFactors.ts`

### Philosophy

- Base score starts at **0**. Every point must be **earned**.
- Most deals should land **LOW (0–24)** or **MEDIUM (25–49)**.
- Only complex, high-value, strategically important deals reach **HIGH (50–74)**.
- **CRITICAL (75+)** is reserved for deals with multiple Tier 1 signals converging.

### The 9 Scoring Components

| # | Component | Range | Source Field(s) | Logic |
|---|-----------|-------|-----------------|-------|
| 1 | **ACV Significance** | 0–20 | `ACV (USD)` / `Likely` | ≥$250K → 20 · ≥$100K → 15 · ≥$50K → 10 · ≥$25K → 5 · ≥$10K → 2 |
| 2 | **Stage TDR Value** | 0–15 | `Stage` | Stage 2 (Determine Needs) → 15 · Stage 3 (Demonstrate Value) → 12 · Stage 1 → 8 · Stage 4 → 4 |
| 3 | **Cloud Partner Alignment** | 0–15 | `Snowflake Team Picklist`, `Partners Involved`, `Partner Influence`, `Primary Partner Role` | Cloud platform detected → 15 · Co-sell + Partner Influence → 8 · Partner Influence only → 4 |
| 4 | **Competitive Pressure** | 0–10 | `Number of Competitors` | ≥2 competitors → 10 · 1 competitor → 5 |
| 5 | **Deal Type Signal** | 0–10 | `Type` | New Logo / New Business → 10 · Acquisition → 8 · Upsell / Expansion → 3 |
| 6 | **Forecast Momentum** | 0–10 | `Domo Forecast Category` | Probable → 10 · Best Case → 8 · Pipeline → 6 · Commit → 4 |
| 7 | **Stage Freshness** | −10 to +5 | `Stage Age` | ≤14 days → +5 · ≤45 days → +3 · ≤90 days → 0 · ≤180 days → −5 · >180 days → −10 |
| 8 | **Deal Complexity** | 0–10 | `Deal Code` | PA prefix → +5 · P prefix → +3 · Multi-component → +3 · E02+ → +2 |
| 9 | **Partner Role Strength** | 0–5 | `Primary Partner Role` | Co-sell → 5 · Reseller → 3 · Referral → 1 |

**Maximum theoretical score: ~100** — requires a $250K+ new-logo deal in Stage 2 with a cloud partner, 2+ competitors, probable forecast, fresh stage, partner-architecture deal code, and co-sell partner role.

### Priority Thresholds

| Priority | Score Range | Meaning |
|----------|------------|---------|
| **CRITICAL** | ≥ 75 | Immediate TDR required — multiple high-value signals converging |
| **HIGH** | 50–74 | TDR strongly recommended — good intervention opportunity |
| **MEDIUM** | 25–49 | TDR beneficial — monitor for escalation |
| **LOW** | < 25 | Standard process, no urgent TDR need |

### "WHY TDR?" Tags (Critical Factor Detection)

The `detectCriticalFactors()` function evaluates each deal against 11 defined factors and returns matching ones for display as colored pills in the UI.

**Tier 1 Factors** (highest priority):
- **Material Deal** ($100K+ ACV) — blue pill
- **Cloud Platform** (Snowflake/Databricks/BigQuery) — cyan pill
- **Architecture Shaping Window** (Stage 2–3) — emerald pill
- **Competitive Displacement** (competitors present) — amber pill
- **Greenfield / New Logo** — violet pill

**Tier 2 Factors** (complexity indicators):
- **Partner Play** (active co-sell) — cyan pill
- **Forecast Momentum** (Probable/Best Case) — blue pill
- **Enterprise Scale** (complex deal code) — blue pill

**Tier 3 Factors** (context signals / risks):
- **Stalling in Stage** (60–180 days) — orange pill
- **Deal Stalled** (180+ days) — orange pill
- **Late Stage** (Stage 4+, negative points) — secondary pill

Each pill includes:
- **Icon** — visual indicator of the factor category (DollarSign, Cloud, Zap, Swords, etc.)
- **Label** — dynamically generated based on deal data
- **Tooltip** — detailed description + recommended strategy
- **Color** — categorized by factor type

---

## 6. Domo AI Recommendation Engine

**File:** `src/lib/domoAi.ts`

### How It Works

```
1. After opportunities load, useDomo triggers generateTDRRecommendations()
2. Pre-filter: ACV ≥ $100K, exclude closed
3. Sort by ACV descending, take top 40
4. Shape compact JSON payload (id, name, acv, stage, partners, etc.)
5. POST /domo/ai/v1/text/chat with 17-factor TDR Framework prompt
6. Parse JSON response → TDRRecommendation[]
7. Top 5 with score ≥ 50 → suggestedDealIds
8. Auto-pin to Agenda on first load (one-time)
```

### The API Call

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /domo/ai/v1/text/chat` |
| **Temperature** | 0.3 (low variance for consistency) |
| **System prompt** | 17-factor TDR Framework with scoring guidance |
| **User prompt** | JSON array of top 40 deals by ACV |
| **Response** | JSON array of recommendations |

### The 17-Factor Framework (System Prompt)

The AI is instructed to score deals against 17 factors in 4 tiers:

**Tier 1 — High Priority Triggers (25 pts each):**
1. Material ACV (≥$150K, high priority ≥$300K)
2. Partner Platform (Snowflake/Databricks/BigQuery)
3. Strategic Account (Enterprise segment, revenue >$1B)
4. Competitive Displacement
5. **Early-Stage + Strong Signal** (Stage 2–3 + ACV ≥$150K = "the sweet spot")
6. Forecast Momentum

**Tier 2 — Complexity Indicators (15 pts each):**
7. Deal Type (New Business / Upsell)
8. Partner Alignment (Partner Influence, Premium tier)
9. Vertical Depth (Financial Services, Healthcare, etc.)
10. Architecture Decision Window (early stage + partner platform)
11. Stale Signals (Stage Age >60 days)

**Tier 3 — Risk Flags (10 pts each):**
12. Champion Gap
13. Multi-Stakeholder complexity
14. Partner Co-Sell (architecture not validated)
15. Expansion Dynamics
16. Late-Stage Warning (Stage ≥4)

**Tier 4 — Future-State (5 pts each):**
17. AI/Agentic Scope
18. Cloud Compute strategy

### AI Response Format

```json
[
  {
    "opportunityId": "006...",
    "score": 85,
    "priority": "CRITICAL",
    "reasons": [
      "Material ACV: $350K deal with strategic importance",
      "Partner Platform: Snowflake architecture alignment needed",
      "Early-Stage Sweet Spot: Stage 2 — maximum shaping opportunity"
    ],
    "riskFlags": [
      "Competitive pressure from Tableau"
    ],
    "suggestedActions": [
      "Schedule architecture workshop with Snowflake SA",
      "Prepare competitive differentiation deck"
    ]
  }
]
```

### Auto-Pinning Logic

1. AI returns up to 5 recommendations with `score ≥ 50`.
2. Their opportunity IDs are collected into `suggestedDealIds`.
3. On first load (before user interaction), these IDs are added to the pinned set.
4. The Agenda section displays them with a ✨ "AI Suggested" badge.
5. Users can un-pin any deal manually — auto-pin only fires once per session.

### Deterministic vs. AI Scoring

| Aspect | Deterministic (`calculateTDRScore`) | AI (`generateTDRRecommendations`) |
|--------|--------------------------------------|-----------------------------------|
| **Speed** | Instant (client-side) | ~2–5 seconds (API call) |
| **Consistency** | Identical every render | May vary slightly (temperature 0.3) |
| **Depth** | 9 quantitative factors | 17+ factors with qualitative reasoning |
| **Output** | Numeric score (0–100) | Score + reasons + risk flags + actions |
| **Usage** | All deals (table, charts, pills) | Top 5 pinned candidates |
| **Fallback** | Always available | Gracefully degrades if AI unavailable |

---

## 7. AppDB — TDR Session Persistence

**File:** `src/lib/appDb.ts`

### Overview

TDR sessions are persisted via the [Domo AppDB API](https://developer.domo.com/portal/1l1fm2g0sfm69-app-db-api). Each session records whether a TDR has been completed (or is in-progress) for a given opportunity.

- **Collection:** `TDRSessions`
- **Storage:** Domo AppDB in production, `localStorage` in development
- **Capacity:** Up to 5 TDR sessions per deal

### TDRSession Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | STRING | Auto-generated document ID |
| `opportunityId` | STRING | Salesforce Opportunity ID (unique key for matching) |
| `opportunityName` | STRING | Deal name for display |
| `accountName` | STRING | Account name |
| `acv` | DOUBLE | Deal ACV at time of TDR |
| `stage` | STRING | Deal stage at time of TDR |
| `status` | STRING | `in-progress` or `completed` |
| `owner` | STRING | AE who owns the deal |
| `createdBy` | STRING | User who created the TDR session |
| `createdAt` | STRING | ISO timestamp of creation |
| `updatedAt` | STRING | ISO timestamp of last update |
| `completedSteps` | STRING | JSON-serialized array of completed step IDs |
| `notes` | STRING | Free-text notes from the TDR |

### API Operations

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Create collection | POST | `/domo/datastores/v1/collections` |
| List all sessions | GET | `/domo/datastores/v1/collections/TDRSessions/documents` |
| Get one session | GET | `/domo/datastores/v1/collections/TDRSessions/documents/{id}` |
| Create session | POST | `/domo/datastores/v1/collections/TDRSessions/documents` |
| Update session | PUT | `/domo/datastores/v1/collections/TDRSessions/documents/{id}` |
| Delete session | DELETE | `/domo/datastores/v1/collections/TDRSessions/documents/{id}` |

### Multi-TDR Indicator (UI)

Each deal in the Recommended Deals table has a "TDRs" column with **5 small circles**:

- ⚫ **Gray** — no session (empty slot)
- 🟢 **Green** — completed TDR
- 🟡 **Amber** — in-progress TDR

Hovering shows a tooltip with the count and dates of each session.

---

## 8. Pages & Navigation

The app uses a collapsible sidebar (`AppSidebar`) with 5 routes:

| Route | Page | Description |
|-------|------|-------------|
| `/` | Command Center | Main dashboard with metrics, charts, and deals table |
| `/agenda` | Agenda view | Same as Command Center but filtered to pinned deals |
| `/workspace` | TDR Workspace | Three-panel layout for conducting a TDR on a specific deal |
| `/history` | TDR History | Past TDR reviews with search and outcome filters |
| `/settings` | Settings | App configuration (managers, ACV thresholds, feature flags) |

### Sidebar

- **Collapsed:** 56px wide, icon-only
- **Expanded:** 208px wide on hover
- **Background:** Deep aubergine (`#2A1F2D`)
- **Text:** White
- **Active state:** Slightly lighter aubergine background

---

## 9. Command Center (Dashboard)

**File:** `src/pages/CommandCenter.tsx`

The main dashboard is organized into 4 zones:

### Zone 1: Metrics Row (4 cards)

| Metric | What It Shows |
|--------|--------------|
| **Eligible ACV** | Total ACV of all filtered deals |
| **Recommended** | ACV of top 10 deals by TDR score |
| **Agenda** | ACV of pinned deals |
| **At-Risk** | ACV of deals with risk level red/yellow |

### Zone 2: Charts Row (3 charts)

1. **Top TDR Candidates** — horizontal bar chart, top 5 by TDR score
2. **TDR Priority** — donut chart showing deal distribution by priority tier
3. **TDR Pipeline by Close** — stacked area chart showing pipeline by close date

### Zone 3: Recommended Deals Table

Full table with columns: Deal/Account, Stage, Age, ACV, TDR Score, TDRs (dots), SE Team, Partner, Why TDR?, Action.

### Zone 4: Agenda Section

- Pinned deals for the next TDR meeting
- AI-suggested candidates (if Domo AI is enabled)

### View Toggle

Three views in the TopBar:
- **Recommended** — top 10 deals sorted by TDR score
- **Agenda** — only pinned deals
- **All Eligible** — all filtered deals

---

## 10. TDR Workspace

**File:** `src/pages/TDRWorkspace.tsx`

A three-panel layout for conducting a Technical Deal Review:

### Left Panel — TDR Steps

9 structured steps with progress tracking:

1. Deal Context & Stakes
2. Business Decision
3. Current Architecture
4. Target Architecture
5. Domo Role
6. Partner Alignment
7. AI Strategy
8. Technical Risk
9. Usage & Adoption

### Center Panel — TDR Inputs

Free-form input area for the active step. Content is contextual to the selected step.

### Right Panel — Intelligence

- **Deal Info** — account name, deal name, ACV, stage
- **Deal Team** — Account Executive, SE Manager, Sales Consultant (SE), PoC Sales Consultant
- **Readiness Score** — green/yellow/red indicator
- **Risk Flags** — contextual risks based on deal data
- **Missing Information** — gaps that need to be filled
- **Evidence Links** — quick links to CRM and technical assessment
- **Final Outcome** — select review outcome (Approved, Needs Work, Deferred, At-Risk)
- **Actions** — Save Draft, Finalize TDR, Generate Summary

### Header Pills

The workspace header shows deal team members as pills:
- **Manager** — gray pill with the AE manager name
- **SE Manager** — violet pill (shown when `seManager` is populated)
- **SE** — gray pill with the Sales Consultant name
- **PoC SE** — emerald pill (shown when `pocSalesConsultant` is populated)

---

## 11. Filters & Dropdowns

**File:** `src/components/TopBar.tsx`

The TopBar provides 5 filter dimensions:

| Filter | Type | Source | Styling When Active |
|--------|------|--------|-------------------|
| **Quarter** | Multi-select checkboxes | `Close Date FQ` from opportunities | Green tint |
| **Manager** | Single select | `ALLOWED_MANAGERS` constant | Green tint |
| **SE Manager** | Single select | `semapping` dataset | Violet tint |
| **SE / PoC SE** | Single select with groups | `Sales Consultant` + `PoC Sales Consultant` from opportunities | Sky (SE) or Teal (PoC) tint |
| **TDR Priority** | Single select | Computed from `tdrScore` | Red/Orange/Amber tint based on level |

### SE Dropdown Grouping

The SE dropdown combines two groups with headers:

```
All SEs
─── SALES ENGINEERS ───
  Alice Smith
  Bob Johnson
  ...
─── POC ARCHITECTS ───
  Charlie Wilson
  Diana Lee
  ...
```

- Selecting a Sales Engineer filters on `deal.salesConsultant`
- Selecting a PoC Architect filters on `deal.pocSalesConsultant`
- Values are prefixed (`se:` or `poc:`) internally for disambiguation

### Allowed Managers

Only deals belonging to these AE managers are shown:

1. Andrew Rich
2. John Pasalano
3. Keith White
4. Taylor Rust
5. Casey Morgan

This list is configurable via the Settings page.

---

## 12. Recommended Deals Table

**File:** `src/components/DealsTable.tsx`

### Column Layout

| Column | Width | Content |
|--------|-------|---------|
| Deal / Account | 18% | Account name (bold) + deal name (muted) |
| Stage | 10% | Colored badge: `[02] Determine Needs` with CheckCircle icon |
| Age | 5% | Days in stage — green (<30d), amber (30–60d), red (60d+) |
| ACV | 7% | Formatted currency ($150K, $1.2M) |
| TDR | 5% | Score badge (0–100) with priority coloring |
| TDRs | 6% | 5 small circles (gray/green/amber) showing session history |
| SE Team | 12% | Sales Consultant name + PoC SE if present |
| Partner | 5% | Dynamic icon based on partner type |
| Why TDR? | 24% | Up to 2 colored pills with icons, labels, and strategy tooltips |
| Action | 10% | Pin/Unpin button (appears on hover) |

### Partner Icons (Dynamic)

Icons vary based on deal characteristics:

| Deal Code Prefix | Icon | Color | Meaning |
|-----------------|------|-------|---------|
| `PA` | Cloud | Sky blue | Partner Architecture (cloud platform deal) |
| `P` | Users | Violet | Partner deal (co-sell or reseller) |
| `E` | Building2 | Amber | Enterprise deal |
| Other/None | RefreshCcw | Muted | Standard deal |

### Brand-Specific Pill Colors

| Platform | Hex | Usage |
|----------|-----|-------|
| Snowflake | `#00B9ED` | Cloud platform pill background |
| Databricks | `#CB2B1D` | Cloud platform pill background |
| Google BigQuery | `#4285F4` | Cloud platform pill background |

### Tooltips

All tooltips are **dynamic** — they show deal-specific information:
- **Stage tooltip** — contextual guidance based on stage number
- **TDR Score tooltip** — lists the top contributing factors
- **TDRs tooltip** — count and dates of completed/in-progress sessions
- **SE Team tooltip** — shows SE Manager hierarchy
- **Partner tooltip** — shows partner name, platform, role, deal code, and strategy
- **Why TDR? tooltip** — factor description + recommended action

---

## 13. Charts

### Top TDR Candidates (`TopTDRCandidatesChart.tsx`)

- **Type:** Horizontal bar chart (Recharts `BarChart` with `layout="vertical"`)
- **Data:** Top 5 deals by TDR score
- **Colors:** Emerald (Critical), Teal (High), Amber (Medium), Gray-blue (Low)
- **Y-Axis:** Account name (truncated to 18 chars)
- **Labels:** Score value displayed to the right of each bar
- **Tooltip:** Account name, deal name, TDR score, priority, ACV, stage

### TDR Priority Distribution (`TDRPriorityChart.tsx`)

- **Type:** Donut chart (Recharts `PieChart` with `Pie innerRadius/outerRadius`)
- **Data:** Deal count by priority tier (Critical, High, Medium, Low)
- **Center label:** Total deal count
- **Legend:** Right side with priority name, pipeline ACV, and deal count
- **Tooltip:** Priority description, pipeline ACV, deal count, strategy guidance

### TDR Pipeline by Close (`PipelineByCloseChart.tsx`)

- **Type:** Stacked area chart (Recharts `AreaChart`)
- **Data:** Pipeline ACV grouped by close date period, stacked by TDR priority
- **Time views:** Day (D), Week (W), Month (M) — toggleable
- **Gradient fills:** Each priority tier has a gradient from colored to transparent
- **Tooltip:** Period label, ACV breakdown by priority, total ACV

---

## 14. SE Mapping & Team Enrichment

### The SE Mapping Dataset

A 29-row lookup table with 2 columns:

| `se` (SE Name) | `se_manager` (Manager Name) |
|-----------------|---------------------------|
| John Smith | Dan Wentworth |
| Jane Doe | Mike Johnson |
| ... | ... |

### Auto-Detection Logic

The `domo.ts` file implements a 3-method auto-detection strategy to identify SE and Manager columns, regardless of how Domo returns them:

1. **Known candidates** — tries a list of common aliases (`se`, `SE`, `SalesConsultant`, etc.)
2. **Heuristic** — any key containing `manager` or `mgr` is the manager column
3. **2-column heuristic** — the column with fewer unique values is the manager (since there are ~4 managers for ~29 SEs)

### Join Logic

```
For each deal:
  1. Try deal.salesConsultant → lowercase → lookup in seLookup → set deal.seManager
  2. If no match AND deal.pocSalesConsultant exists → try that → set deal.seManager
```

### SE Categorization

- **Sales Engineers** — individuals listed in the `Sales Consultant` field of opportunities
- **PoC Architects** — individuals listed in the `PoC Sales Consultant` field of opportunities
- Anyone appearing in both lists is placed in PoC Architects only (deduplicated)

---

## 15. Design System & Color Palette

### Color Palette

Source: [coolors.co/palette/56e39f-59c9a5-5b6c5d-3b2c35-2a1f2d](https://coolors.co/palette/56e39f-59c9a5-5b6c5d-3b2c35-2a1f2d)

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| Emerald | `#56E39F` | 152 73% 62% | Success states, Critical priority |
| Teal | `#59C9A5` | 161 50% 57% | Accents, High priority, ring focus |
| Sage | `#5B6C5D` | 127 9% 39% | Muted foregrounds, borders |
| Plum | `#3B2C35` | 324 15% 20% | Primary color (buttons, badges) |
| Aubergine | `#2A1F2D` | 281 19% 15% | Sidebar background, deep surfaces |

### CSS Custom Properties

The design system is built on CSS variables defined in `src/index.css`:

- **Light mode:** Warm off-white canvas (`40 20% 97%`), clean white cards
- **Dark mode:** Deep aubergine backgrounds (`281 19% 8%`), muted sage text
- **Sidebar:** Always dark (aubergine) with white text

### Component Classes

| Class | Usage |
|-------|-------|
| `.stat-card` | Metric cards with subtle border |
| `.table-row-tight` | Compact table rows with hover |
| `.status-ready` / `.status-warning` / `.status-critical` | Status pill variants |
| `.section-header` | Small uppercase tracking headers |
| `.nav-item` / `.nav-item-active` | Sidebar navigation items |
| `.panel` | Card-like containers with rounded borders |
| `.step-dot` / `.step-dot-active` / `.step-dot-complete` | TDR step indicators |

### Typography

- **Font:** System font stack with OpenType features (`cv02`, `cv03`, `cv04`, `cv11`)
- **Tabular nums:** `font-variant-numeric: tabular-nums` for aligned numbers
- **Sizes:** `text-2xs` (10px), `text-xs` (12px), `text-sm` (14px), `text-base` (16px)

---

## 16. Settings

**File:** `src/pages/Settings.tsx`

Settings are persisted in `localStorage` under key `tdrAppSettings`.

### Available Settings

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| **Allowed Managers** | string[] | 5 managers | Controls which managers appear in the filter dropdown |
| **Min ACV Threshold** | number | $100,000 | Minimum ACV for TDR eligibility |
| **Default to Current Quarter** | boolean | true | Auto-filter to current fiscal quarter on load |
| **AI Recommendations** | boolean | true | Enable/disable Domo AI TDR candidate suggestions |
| **AppDB Persistence** | boolean | true | Enable/disable TDR session storage in Domo AppDB |
| **Excluded Forecast Categories** | string[] | 6.Omitted, Closed Won, Closed Lost | Categories filtered out from deal tables |

### API

```typescript
import { getAppSettings, saveAppSettings, resetAppSettings } from '@/lib/appSettings';

const settings = getAppSettings();       // Read (merged with defaults)
saveAppSettings({ minTDRACV: 50000 });   // Patch
resetAppSettings();                       // Reset to defaults
```

---

## 17. Development & Deployment

### Prerequisites

- Node.js 18+
- npm 9+
- Domo CLI (`npm install -g @domoinc/ryuu`)

### Local Development

```bash
npm install
npm run dev          # Start Vite dev server at localhost:5173
```

In dev mode:
- Domo SDK is unavailable → data hooks return empty arrays
- AppDB falls back to `localStorage`
- AI recommendations return mock data based on local TDR scoring
- Mock deals are loaded from `src/data/mockData.ts`

### Build

```bash
npm run build        # Production build → dist/
```

### Deploy to Domo

```bash
npm run deploy       # Build + publish to Domo
# or
npm run deploy:zip   # Build + create ZIP for manual upload
```

### Deploy Checklist

```bash
npm run deploy:check  # Verify manifest, thumbnail, and SDK reference
```

### Version Bumping

Update the version in **3 files** before deploying:

1. `package.json` → `"version": "x.y.z"`
2. `manifest.json` → `"version": "x.y.z"`
3. `public/manifest.json` → `"version": "x.y.z"` (copied to `dist/` on build)

### Testing

```bash
npm run test         # Run Vitest tests
npm run test:watch   # Watch mode
```

---

## 18. File Structure

```
deal-inspect/
├── manifest.json                    # Domo app manifest (datasets, ID, version)
├── public/
│   ├── manifest.json                # Copy of manifest for build
│   └── thumbnail.png               # App icon in Domo
├── src/
│   ├── App.tsx                      # Router + providers
│   ├── main.tsx                     # Entry point
│   ├── index.css                    # Design system (CSS variables, components)
│   │
│   ├── types/
│   │   └── tdr.ts                   # Core types: Deal, TDRStep, TDRSessionSummary
│   │
│   ├── lib/
│   │   ├── domo.ts                  # Domo data fetching (opportunities, SE mapping)
│   │   ├── domoAi.ts                # Domo AI text/chat integration (17-factor prompt)
│   │   ├── appDb.ts                 # AppDB CRUD for TDR sessions
│   │   ├── appSettings.ts           # localStorage settings management
│   │   ├── tdrCriticalFactors.ts    # Scoring engine + factor detection
│   │   ├── constants.ts             # Allowed managers, thresholds, TDR steps
│   │   └── utils.ts                 # cn() helper (clsx + tailwind-merge)
│   │
│   ├── hooks/
│   │   └── useDomo.ts               # Main data hook (fetch, join, enrich, filter)
│   │
│   ├── pages/
│   │   ├── CommandCenter.tsx         # Dashboard (metrics, charts, table, agenda)
│   │   ├── TDRWorkspace.tsx          # 3-panel TDR review workspace
│   │   ├── TDRHistory.tsx            # Past TDR reviews
│   │   ├── Settings.tsx              # App configuration
│   │   └── NotFound.tsx              # 404 page
│   │
│   ├── components/
│   │   ├── TopBar.tsx                # Filter bar (quarter, manager, SE, priority)
│   │   ├── AppSidebar.tsx            # Collapsible navigation sidebar
│   │   ├── DealsTable.tsx            # Recommended deals table with pills + tooltips
│   │   ├── AgendaSection.tsx         # Pinned deals + AI suggestions
│   │   ├── TDRSteps.tsx              # Step progress panel (workspace left)
│   │   ├── TDRInputs.tsx             # Step input area (workspace center)
│   │   ├── TDRIntelligence.tsx       # Deal intelligence panel (workspace right)
│   │   ├── TDRSummaryModal.tsx       # AI-generated TDR summary modal
│   │   ├── MetricsGrid.tsx           # Reusable metrics grid
│   │   └── charts/
│   │       ├── TopTDRCandidatesChart.tsx    # Horizontal bar chart
│   │       ├── TDRPriorityChart.tsx         # Donut chart
│   │       └── PipelineByCloseChart.tsx     # Stacked area chart
│   │
│   ├── layouts/
│   │   └── MainLayout.tsx            # Sidebar + <Outlet /> wrapper
│   │
│   └── data/
│       └── mockData.ts               # Mock deals for local development
│
├── samples/                          # Reference documents
│   ├── TDR Framework.pdf             # Original TDR methodology
│   └── ...                           # Sample dataset exports
│
├── dist/                             # Build output (deployed to Domo)
├── tailwind.config.ts                # Tailwind configuration
├── vite.config.ts                    # Vite configuration
└── package.json                      # Dependencies and scripts
```
