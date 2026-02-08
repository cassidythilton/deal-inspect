# TDR Index — Scoring & AI Recommendation Architecture

## Overview

The TDR (Technical Deal Review) Index is a composite score from **0–100** assigned to every deal in the pipeline. It quantifies how urgently a deal would benefit from a structured technical review by a Sales Engineer Subject Matter Expert (SE SME).

The score serves two purposes:

1. **Deterministic ranking** — the client-side scoring engine (`tdrCriticalFactors.ts`) calculates a repeatable score from deal data on every render.
2. **AI-augmented suggestion** — the Domo AI endpoint enriches the top candidates with contextual reasoning, risk flags, and suggested actions.

---

## 1. Deterministic TDR Score (`calculateTDRScore`)

**File:** `src/lib/tdrCriticalFactors.ts`

### Philosophy

- Base score starts at **0**. Every point must be **earned**.
- Most deals should land **LOW (0–24)** or **MEDIUM (25–49)**.
- Only complex, high-value, strategically important deals reach **HIGH (50–74)**.
- **CRITICAL (75+)** is reserved for deals with multiple Tier 1 signals converging.

### Scoring Components

| # | Component | Range | Source Field(s) | Logic |
|---|-----------|-------|-----------------|-------|
| 1 | **ACV Significance** | 0–20 | `ACV (USD)` / `Likely` | ≥$250K → 20 · ≥$100K → 15 · ≥$50K → 10 · ≥$25K → 5 · ≥$10K → 2 |
| 2 | **Stage TDR Value** | 0–15 | `Stage` | Stage 2 (Determine Needs) → 15 · Stage 3 (Demonstrate Value) → 12 · Stage 1 → 8 · Stage 4 → 4 |
| 3 | **Cloud Partner Alignment** | 0–15 | `Snowflake Team Picklist`, `Partners Involved`, `Partner Influence`, `Primary Partner Role` | Cloud platform detected (Snowflake/Databricks/BigQuery/GCP/AWS/Azure) → 15 · Co-sell + Partner Influence → 8 · Partner Influence only → 4 |
| 4 | **Competitive Pressure** | 0–10 | `Number of Competitors` | ≥2 competitors → 10 · 1 competitor → 5 |
| 5 | **Deal Type Signal** | 0–10 | `Type` | New Logo / New Business → 10 · Acquisition → 8 · Upsell / Expansion → 3 |
| 6 | **Forecast Momentum** | 0–10 | `Domo Forecast Category` | Probable → 10 · Best Case → 8 · Pipeline → 6 · Commit → 4 |
| 7 | **Stage Freshness** | −10 to +5 | `Stage Age` | ≤14 days → +5 · ≤45 days → +3 · ≤90 days → 0 · ≤180 days → −5 · >180 days → −10 |
| 8 | **Deal Complexity** | 0–10 | `Deal Code` | PA prefix → +5 · P prefix → +3 · Multi-component → +3 · E02+ → +2 |
| 9 | **Partner Role Strength** | 0–5 | `Primary Partner Role` | Co-sell → 5 · Reseller → 3 · Referral → 1 |

**Maximum theoretical score: ~100** (requires a $250K+ new-logo deal in Stage 2 with cloud partner, 2+ competitors, probable forecast, fresh stage, partner-architecture deal code, and co-sell partner role).

### Priority Thresholds

| Priority | Score Range | Meaning |
|----------|------------|---------|
| **CRITICAL** | ≥ 75 | Immediate TDR required — multiple high-value signals converging |
| **HIGH** | 50–74 | TDR strongly recommended — good intervention opportunity |
| **MEDIUM** | 25–49 | TDR beneficial — monitor for escalation |
| **LOW** | < 25 | Standard process, no urgent TDR need |

### "WHY TDR?" Tags (Factor Detection)

The `detectCriticalFactors()` function evaluates each deal against the same factor set and returns the matching factors for display as colored pills in the UI. Each pill includes:

- **Icon** — visual indicator of the factor category
- **Label** — short human-readable name
- **Tooltip** — detailed description + recommended strategy
- **Color** — categorized by factor type (blue, cyan, emerald, amber, violet, orange)

The `getTopFactors(deal, limit)` function returns the top N factors sorted by tier (Tier 1 first) then by points (highest first).

---

## 2. Domo AI Recommendation Engine

**File:** `src/lib/domoAi.ts`

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CommandCenter loads deals                                   │
│       ↓                                                      │
│  useDeals() hook                                             │
│       ↓                                                      │
│  After opportunities load:                                   │
│       ↓                                                      │
│  generateTDRRecommendations(opportunities)                   │
│       ↓                                                      │
│  1. Pre-filter: ACV ≥ $100K, exclude closed                 │
│  2. Sort by ACV desc, take top 40                            │
│  3. Shape compact JSON payload                               │
│  4. POST /domo/ai/v1/text/chat                               │
│       ↓                                                      │
│  System Prompt: 17-factor TDR Framework                      │
│  User Prompt: "Analyze these opportunities... return JSON"   │
│       ↓                                                      │
│  Parse JSON response → TDRRecommendation[]                   │
│       ↓                                                      │
│  Top 5 with score ≥ 50 → suggestedDealIds                   │
│       ↓                                                      │
│  Auto-pinned to Agenda on first load                         │
└─────────────────────────────────────────────────────────────┘
```

### The API Call

**Endpoint:** `POST /domo/ai/v1/text/chat`

**Request body:**
```json
{
  "input": "<system_prompt>\n\nUser request: <user_prompt_with_deal_data>",
  "temperature": 0.3
}
```

**Response structure:**
```json
{
  "choices": [
    {
      "output": "[{\"opportunityId\": \"...\", \"score\": 85, ...}]"
    }
  ]
}
```

### System Prompt (17-Factor Framework)

The system prompt instructs the AI to act as a sales operations expert and score deals against 17 factors organized into 4 tiers:

**Tier 1 — High Priority Triggers (25 pts each):**
1. Material ACV (≥$150K, high priority ≥$300K)
2. Partner Platform (Snowflake/Databricks/BigQuery)
3. Strategic Account (Enterprise segment, revenue >$1B)
4. Competitive Displacement
5. Early-Stage + Strong Signal (the "sweet spot")
6. Forecast Momentum

**Tier 2 — Complexity Indicators (15 pts each):**
7. Deal Type (New Business / Upsell)
8. Partner Alignment
9. Vertical Depth
10. Architecture Decision Window
11. Stale Signals

**Tier 3 — Risk Flags (10 pts each):**
12. Champion Gap
13. Multi-Stakeholder
14. Partner Co-Sell
15. Expansion Dynamics
16. Late-Stage Warning

**Tier 4 — Future-State (5 pts each):**
17. AI/Agentic Scope
18. Cloud Compute

### User Prompt (Deal Data)

The user prompt contains a JSON array of the top 40 deals (by ACV) with these fields per deal:

```json
{
  "id": "Opportunity Id",
  "name": "Opportunity Name",
  "account": "Account Name",
  "owner": "Domo Opportunity Owner",
  "acv": 250000,
  "likely": 200000,
  "high": 300000,
  "snowflakeTeam": "...",
  "partnersInvolved": "...",
  "partnerInfluence": "Yes",
  "numCompetitors": 2,
  "type": "New Logo",
  "stage": "2: Determine Needs",
  "stageAge": 15,
  "forecastCategory": "3.Probable",
  "dealCode": "PA-001",
  "daysToClose": 45
}
```

### AI Response Format

The AI returns a JSON array (top 5 candidates):

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
4. The Agenda section shows them with a ✨ "AI Suggested" badge and a tooltip with the AI's reasoning.
5. Users can un-pin any deal manually — the auto-pin only fires once per session.

---

## 3. Deterministic vs. AI Scoring

| Aspect | Deterministic (`calculateTDRScore`) | AI (`generateTDRRecommendations`) |
|--------|--------------------------------------|-----------------------------------|
| **Speed** | Instant (client-side) | ~2–5 seconds (API call) |
| **Consistency** | Identical every render | May vary (temperature 0.3) |
| **Depth** | 9 quantitative factors | 17+ factors with qualitative reasoning |
| **Output** | Numeric score (0–100) | Score + reasons + risk flags + actions |
| **Usage** | All deals (table, charts, pills) | Top 5 pinned candidates |
| **Fallback** | Always available | Gracefully degrades if AI unavailable |

Both systems use the same conceptual framework (TDR Framework.pdf) but serve different purposes. The deterministic score drives the UI's sorting, coloring, and priority filters. The AI adds nuanced, context-aware reasoning for the top candidates.

---

## 4. Data Flow Summary

```
Domo Dataset (opportunitiesmagic)
       ↓
  fetchOpportunities() → raw records
       ↓
  transformOpportunityToDeal() → Deal objects
       ↓
  SE Mapping join (semapping dataset) → adds seManager
       ↓
  calculateTDRScore() → adds tdrScore (0-100)
       ↓
  AppDB join (TDRSessions) → adds tdrSessions[]
       ↓
  Domo AI call → suggestedDealIds (auto-pinned)
       ↓
  CommandCenter renders:
    • Metrics row (eligible/recommended/agenda/at-risk ACV)
    • Charts (Top TDR Candidates, Priority Distribution, Pipeline Timeline)
    • Recommended Deals table (sorted by tdrScore, WHY TDR? tags)
    • Agenda section (pinned + AI-suggested deals)
```

---

## 5. Configuration

Settings are stored in `localStorage` under key `tdrAppSettings` and managed via the Settings page.

| Setting | Default | Effect |
|---------|---------|--------|
| `enableAIRecommendations` | `true` | Enables/disables the Domo AI call |
| `enableAppDB` | `true` | Enables/disables TDR session persistence |
| `minTDRACV` | `100000` | Minimum ACV for AI analysis |
| `allowedManagers` | 5 managers | Filters deals to specific AE managers |
| `defaultManager` | `Andrew Rich` | Pre-selected manager on load |
| `defaultQuarterFilter` | `current` | Default quarter filter |

