# TDR Deal Inspection — Sprint Archive

> **Archived from [`IMPLEMENTATION_STRATEGY.md`](IMPLEMENTATION_STRATEGY.md) on March 12, 2026.**
> This file preserves the full sprint records for Sprints 1–27 and OSS-1 (37 sprints, Feb 9 – Mar 3, 2026).
> Each entry includes task checklists, learnings & decisions, files changed, definition of done, and post-sprint notes.
>
> **For current sprint activity (Sprint 28+), see Section 18 of [`IMPLEMENTATION_STRATEGY.md`](IMPLEMENTATION_STRATEGY.md).**

---

## Sprints 1–14 (Feb 9 – Feb 13, 2026)

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
- Used hardcoded keypair auth (PKCS#8 private key + Snowflake account locator + service user) matching the `cortexAnalystCodeEngine.js` pattern — `sdk.getAccount()` was unreliable (500 errors).
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

**Post-Sprint PDF Readout Improvements (Feb 12, 2026):**

| Improvement | Detail |
|-------------|--------|
| **Action Plan as centerpiece** | Promoted to Section 2 (after Executive Summary). SE/AE Quick Actions card auto-parses action plan prose to extract role-specific actions with capitalized first letters. |
| **TDR Framework + KB intel in prompt** | `generateActionPlan` prompt now includes all 10 TDR Framework dimensions and the cached Knowledge Base summary as intelligence sources. |
| **Font stability** | Switched from woff2 `Inter` to built-in `Helvetica` to eliminate `DataView RangeError` font subsetting crashes. Added `sanitize()` to strip non-ASCII characters. |
| **Tech stack rendering** | `assembleTDRReadout` normalizes Sumble `TECHNOLOGIES` objects to clean `string[]`. Added `TECH_CATEGORIES` for categorized display. |
| **Category-colored pills** | Tech stack pills match UI colors per category (CRM=orange, BI=blue, ERP=indigo, etc.) via `PDF_TECH_CATEGORY_COLORS` map. |
| **Markdown parsing** | `MultilineText` handles `## headings`, `**N. Title**` bold-numbered patterns, and `### subheadings`. `MultilineBody` handles numbered sub-items. |
| **Branding** | Domo, Snowflake, and Cortex SVG logos integrated into cover page, footer, AI badges, and appendix. "TECHNICAL DEAL REVIEW" label uses Domo blue. |
| **Cover subtitle** | Changed from duplicative account name to "Prepared by [owner] · [stage] · [date]". |
| **Input dedup** | Frontend `groupInputsByStep()` keeps only latest entry per (stepId, fieldId) by `savedAt`. |
| **Content normalization** | `normalizeContent()` strips wrapping quotes, converts literal `\n` to newlines, handles escaped `\"`. |
| **Logo SVG** | Created `public/dealinspect-logo.svg` — standalone DealInspect brand mark. |

---

### Sprint 14 — TDR Readout: Slack Distribution & Executive Summary ✅ COMPLETE

> **Goal:** Push TDR readouts to Slack channels with AI-generated summaries and PDF attachments.
> **Risk to app:** Low — new outbound integration. Slack API failure doesn't affect core app.
> **Decision:** Slack-only distribution (Teams evaluated and deferred). PDF attachment is a hard requirement.
> **Status:** ✅ Complete as of Feb 12, 2026. Polished Feb 13, 2026. All 3 Code Engine functions deployed (generateReadoutSummary, distributeToSlack, getSlackChannels). Frontend Share dialog with AI summary, channel picker, and PDF attachment integrated into TDR workspace header. Slack section added to Settings page with setup instructions and manifest reference. Feb 13 enhancements: executive-level Block Kit formatting, @mentions via `resolveSlackUsers`, consolidated PDF attachment, structured summary → Slack `mrkdwn` conversion, deal team info passthrough, `forceRegenerate` cache busting, retry with exponential backoff, Slack-style message preview with `FormattedSummary` component, icon-only buttons with hover animations, opportunity name cleanup.

**Architecture: Slack Bot Token**
- Auth: Single Slack Bot Token (`xoxb-...`) stored in Domo Account (Account ID configured in CE)
- Required OAuth scopes: `chat:write`, `chat:write.public`, `files:write`, `files:read`, `channels:read`, `groups:read`, `users:read`
- Two-call pattern: `files.uploadV2` (upload PDF) → `chat.postMessage` (send Block Kit message with file permalink)
- Rate limits: 1 msg/sec per channel (well above our needs)

**Step 0: Create Slack App via Manifest**

Before any Slack integration can work, a Slack App must be created in the target workspace. Use the **Slack App Manifest** approach (https://api.slack.com/apps → "Create New App" → "From an app manifest") with the following manifest:

```json
{
    "display_information": {
        "name": "TDR Deal Inspect",
        "description": "Technical Deal Review readout distribution — pushes AI-generated executive summaries and PDF readouts to Slack channels from the Domo TDR app.",
        "long_description": "TDR Deal Inspect integrates with the Domo-based Technical Deal Review (TDR) application to distribute completed deal review readouts to Slack. When an SE Manager completes a TDR, they can push an AI-generated executive summary and a professionally formatted PDF readout directly to a designated Slack channel. The bot posts a rich Block Kit message containing the deal summary (account name, ACV, stage, decision, reviewer, TDR score), an AI-written 3-5 sentence executive overview, and the attached PDF artifact. This eliminates the manual copy-paste workflow and ensures leadership has immediate visibility into deal review outcomes.",
        "background_color": "#1a1a2e"
    },
    "features": {
        "bot_user": {
            "display_name": "TDR Deal Inspect",
            "always_online": false
        }
    },
    "oauth_config": {
        "scopes": {
            "bot": [
                "chat:write",
                "chat:write.public",
                "files:write",
                "files:read",
                "channels:read",
                "groups:read",
                "users:read"
            ]
        }
    },
    "settings": {
        "org_deploy_enabled": false,
        "socket_mode_enabled": false,
        "is_hosted": false,
        "token_rotation_enabled": false
    }
}
```

**Manifest scope rationale:**

| Scope | Why |
|-------|-----|
| `chat:write` | Post Block Kit messages to channels the bot is a member of |
| `chat:write.public` | Post to public channels without being explicitly invited (convenience for initial setup) |
| `files:write` | Upload PDF readout attachments via `files.uploadV2` |
| `files:read` | Read file permalink after upload to include in the message |
| `channels:read` | Fetch list of public channels for the channel picker in Settings |
| `groups:read` | Fetch list of private channels the bot is a member of (for the channel picker) |
| `users:read` | Resolve deal team member names to Slack user IDs for @mentions in distributed messages |

**Setup steps (manual, one-time):**
1. Go to https://api.slack.com/apps → "Create New App" → "From an app manifest"
2. Select the target Slack workspace
3. Paste the manifest JSON above
4. Click "Create" → "Install to Workspace" → Authorize
5. Copy the **Bot User OAuth Token** (`xoxb-...`) from "OAuth & Permissions"
6. In Domo: create a new Account of type "Abstract Credential Store" with the token value
7. In `consolidated-sprint4-5.js`: configure the Account ID in the Slack integration section

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

**New Code Engine Functions (3 + 1 helper)**

| Function | Inputs | Output | Domo CE Types |
|----------|--------|--------|---------------|
| `generateReadoutSummary` | `sessionId` (string), `dealTeamJson` (string, nullable), `forceRegenerate` (boolean, nullable) | `{ success, summary, modelUsed, cached, error }` (object) | Input: string + 2 nullable, Output: object |
| `distributeToSlack` | `sessionId` (string), `channel` (string), `summary` (string), `pdfBase64` (string), `dealTeamJson` (string, nullable) | `{ success, messageTs, fileId, error }` (object) | Input: 4× string + 1 nullable, Output: object |
| `getSlackChannels` | `placeholder` (string, nullable) | `{ success, channels: [{id, name}], error }` (object) | Input: 1 nullable string, Output: object |
| `resolveSlackUsers` (internal helper) | `userNames` (array), `token` (string) | `{ name: "<@SLACK_ID>" }` map | Not mapped — called internally by `distributeToSlack` |

**Definition of Done:** SE Manager can generate an executive-ready PDF and push it to Slack in under 10 seconds. The Slack message includes an AI-written summary that a VP can read without opening the PDF. The PDF is attached as a downloadable file. Every distribution is logged for audit.

**Sprint 14 — Post-Completion Enhancements (Feb 13, 2026):**

The following enhancements were applied to the Slack distribution experience after initial deployment:

| Deliverable | Status |
|-------------|--------|
| **Executive-level Block Kit formatting** — Slack messages now use structured Block Kit: header, deal vitals (ACV, stage, verdict, opportunity), divider, multi-section executive summary, deal team block, PDF link, timestamp footer | ✅ |
| **@mentions via `resolveSlackUsers`** — New CE helper resolves deal team names (AE, SE, SE Manager, PoC Architect) to Slack user IDs using `users.list` API with cursor-based pagination. Falls back to bold name if not found. Requires `users:read` OAuth scope. | ✅ |
| **Consolidated PDF attachment** — PDF uploaded via `files.uploadV2` + `files.completeUploadExternal`, permalink embedded in Block Kit message. No separate attachment message. | ✅ |
| **Structured summary → Slack `mrkdwn` conversion** — AI generates `**Header**` + `- bullet` markdown. `distributeToSlack` parses this into separate Block Kit sections with `*bold*` headers and `  •  bullet` formatting. | ✅ |
| **`forceRegenerate` parameter** — `generateReadoutSummary` accepts `forceRegenerate: true` to bypass Snowflake cache, delete old cached summaries, and generate fresh. Used by "Regenerate" button in share dialog. | ✅ |
| **Deal team info passthrough** — `DealTeamInfo` interface added to frontend (`tdrReadout.ts`). `TDRShareDialog` passes AE/SE/SE Mgr/PoC to `shareToSlack` → serialized as `dealTeamJson` for CE. | ✅ |
| **AI prompt rewrite** — `generateReadoutSummary` prompt now: leads with SE/AE names (never "Owner" or managers), incorporates Perplexity + Sumble + KB summary context, structures output as 4 sections (`**Deal Overview**`, `**Technical Positioning**`, `**Competitive Landscape**`, `**Risk & Recommendation**`), each with bullets. | ✅ |
| **Retry with exponential backoff** — `TDRShareDialog` retries `getSlackChannels` and `generateReadoutSummary` CE calls (up to 3 attempts, 1s → 2s → 4s delays) to handle Code Engine cold starts. Retry button on channel error. | ✅ |
| **Slack-style message preview** — Share dialog redesigned with Slack-branded message preview: bot header, `FormattedSummary` component renders structured markdown as styled HTML (headers, bullets, bold), edit/preview toggle, PDF attachment footer, Cortex AI label. | ✅ |
| **Icon-only export/share buttons** — Export PDF (FileDown) and Share to Slack (custom SVG) buttons are 24×24 icon-only with tooltips. Slack icon turns pink (`#E01E5A`) on hover with `scale-110` animation. | ✅ |
| **Cursor-based channel pagination** — `getSlackChannels` fetches up to 4,000 channels via Slack cursor pagination (200/page, max 20 pages). Supports private channels via `groups:read`. | ✅ |
| **Default channel** — `appSettings.ts` defaults to `tdr-channel`. Channel picker falls back to this if no `localStorage` last-used channel found. | ✅ |
| **Opportunity name cleanup** — Trailing hyphens/whitespace trimmed from opportunity names in Slack messages (e.g. "Lotus & Windoware-" → "Lotus & Windoware"). | ✅ |
| **Status label cleanup** — Hyphenated status values like "in-progress" display as "In Progress" in Slack verdict field. | ✅ |
| **No emojis** — Removed all emojis from Block Kit messages for professional tone. | ✅ |
| Manifest version: 1.49.0 | ✅ |

---

---

## Post-Sprint Enhancement & Bug Fix Notes

**Post-Sprint Enhancements (Feb 14, 2026):**
- Sprint 25 — Documentation Hub: 7-section in-app reference at `/docs` with sticky Table of Contents sidebar and accordion navigation. Sections: (1) Architecture Diagram — interactive 5-layer SVG (System Overview, Data Model, Cortex AI Model Map, Enrichment Pipeline, User Workflow) with pill-toggle layer switcher, (2) Scoring Reference — Pre-TDR, Post-TDR, and Confidence Score methodology with detailed factor/weight tables, (3) Capabilities Guide — 9 accordion sections covering every app feature, (4) Integrations Reference — Snowflake Cortex, Sumble, Perplexity, Domo Platform, Slack with endpoints and capabilities, (5) Data Model Reference — all 10 Snowflake tables/views with key columns, (6) AI Models Reference — every model across 3 providers with cost tier and use cases, (7) Glossary & FAQ — 20+ terms and common questions.
- Sprint 25 — New files: `src/pages/Documentation.tsx`, `src/components/docs/ArchitectureDiagram.tsx`, `src/components/docs/ScoringReference.tsx`, `src/components/docs/CapabilitiesGuide.tsx`, `src/components/docs/IntegrationsReference.tsx`, `src/components/docs/DataModelReference.tsx`, `src/components/docs/AIModelsReference.tsx`, `src/components/docs/GlossaryReference.tsx`.
- Sprint 25 — Navigation: `/docs` route, "Documentation" sidebar nav item (Network icon), MainLayout page title.
- Sprint 27 — TDR Score lifecycle maturity: 6-phase lifecycle (NOT_STARTED → EARLY → IN_PROGRESS → NEAR_COMPLETE → COMPLETE → ENRICHED) × 4 priority bands = 24 distinct contextual messages. Messaging evolves from "Requires TDR" to "TDR complete — execute action plan" to "Fully informed — manage through close."
- Sprint 27 — TDR Confidence Score (dual-axis): new 0–100 score measuring assessment thoroughness (Required Steps 0–40, Optional Depth 0–10, External Intel 0–15, AI Analysis 0–15, Knowledge Base 0–10, Risk Identified 0–10). Bands: Insufficient → Developing → Solid → High → Comprehensive.
- Sprint 27 — Required vs Optional steps: lifecycle phase uses required steps only (5/5). Optional steps noted separately as "+N optional" badge.
- Sprint 27 — Trigger pill colors now match DealsTable portfolio page palette (factor.color: cyan, blue, amber, etc.).
- Sprint 27 — Auto-load Research & Similar section: similar deals and research history fetched on mount without manual clicks.
- Sprint 27 — Suppress Domo auto-refresh: `domo.onDataUpdate` no-op handler in `main.tsx` prevents dataset updates from reloading the app.
- Sprint 27 — Deal team (AE, SE, SE Mgr) relocated to deal header alongside account name, ACV, stage.
- Sprint 27 — TDR Score context: detailed breakdown with component definitions and priority band legend.

**Post-Sprint Enhancements (Feb 13, 2026):**
- Sprint 14 — Major Slack distribution polish: executive-level Block Kit formatting, structured summary → `mrkdwn` conversion, @mention support via `resolveSlackUsers`, consolidated PDF attachment, deal team passthrough, `forceRegenerate` cache busting, retry with exponential backoff, Slack-style message preview with `FormattedSummary` component, icon-only buttons with hover animations.
- Sprint 14 — AI prompt rewrite: leads with SE/AE names, incorporates Perplexity + Sumble + KB summary, structures output as 4 markdown sections with headers and bullets.
- Sprint 14 — Added `users:read` OAuth scope to Slack app manifest for @mention user resolution.
- Sprint 14 — Opportunity name trailing hyphen cleanup, status label cleanup ("in-progress" → "In Progress").

**Post-Sprint Bug Fixes (Feb 11, 2026):**
- Sprint 19 — Fixed `discoverFilesets()` API response parsing: Domo API returned filesets under `fileSets` (camelCase) key but code expected `filesets` (lowercase). Added robust multi-key fallback.
- Sprint 19 — Fixed fileset persistence: `updateSetting()` only updated React state, not `localStorage`. Added `persistFileset` helper that calls `saveAppSettings()` immediately.
- Sprint 19 — Added fileset name search, display by name, and `filesetNameMap` in `appSettings.ts`.
- Sprint 19.5 — Added `summarizeKBResults` Code Engine function using Cortex `AI_COMPLETE` with TDR-Framework-aware prompt.
- Sprint 19.5 — Added collapsible document rows in KB listing and "View in Domo" deep links.
- Sprint 19.5 — Added KB tooltip in TDR Chat showing configured fileset names.

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

---

## Sprints 15–27 + OSS-1 (Feb 10 – Mar 3, 2026)

### Sprint 15 — AG Grid Table, Deal Search & Filter Rethink ✅ COMPLETE

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

### Sprint 19.5 — Cortex KB Summarization & Fileset UX ✅ COMPLETE *(completed 2026-02-12)*

> **Goal:** Route the Knowledge Base AI summary through the configured Snowflake Cortex integration (via Code Engine) instead of the generic Domo AI text generation endpoint. Make the summary TDR-Framework-aware by incorporating session context, competitor landscape, and the 10-step TDR evaluation model. Add "View in Domo" deep links from fileset document listings.
> **Risk to app:** Low — enhances existing KB feature. Domo AI fallback preserved.
> **Effort:** ~1 day
> **Dependencies:** Sprint 19 (Fileset Intelligence Layer)

**Problem Statement:**
Sprint 19 implemented KB summarization via `/domo/ai/v1/text/generation` — a generic, stateless endpoint with no access to deal context stored in Snowflake. The resulting summaries are generic and disconnected from the TDR Framework's 10-step evaluation model. They don't reference the deal's specific competitors, partner platform, or architecture story because that data lives in Snowflake, not in the fileset documents.

**Solution: Cortex Code Engine Function**

A new Code Engine function `summarizeKBResults` receives fileset document excerpts and a TDR session ID, then:

1. **Pulls session context** from `TDR_SESSIONS` (account name, ACV, stage, status)
2. **Pulls competitive landscape** from `ACCOUNT_INTEL_PERPLEXITY` (if available)
3. **Constructs a TDR-Framework-aware prompt** that maps insights to the 10 TDR evaluation steps:
   - Opportunity Overview, Technical Environment, Competition, Architecture, Use Cases, Partner Alignment, Risks & Blockers, Decision Process, Next Steps, Thesis
4. **Calls `AI_COMPLETE`** with the full context via `CORTEX_MODELS.brief` (llama3.3-70b)
5. **Stores the result** in `CORTEX_ANALYSIS_RESULTS` with `ANALYSIS_TYPE = 'kb_summary'`
6. **Logs usage** to `API_USAGE_LOG` with `SERVICE = 'cortex'`, `ACTION = 'kb_summary'`

**Frontend Integration:**

The frontend `summarizeResults()` function in `filesetIntel.ts` now:
1. Tries the Cortex Code Engine function first (when `sessionId` is available)
2. Falls back to `/domo/ai/v1/text/generation` if Code Engine fails or no session ID
3. Passes `sessionId` from `TDRIntelligence.tsx` through `getIntelligenceSummary()`

**Fileset Document Deep Links:**

Each document in the expanded fileset listing now includes a "View in Domo" link that opens the source document in the Domo datacenter:
- URL pattern: `{domoInstance}/datacenter/filesets/{filesetId}/preview/{encodedFileName}`
- The Domo instance origin is derived from `document.referrer` (the parent iframe)
- `filesetId` is now carried through the `FilesetSummary.relevantDocuments` data model

**Cortex Prompt Structure:**
```
You are a senior Solutions Engineering strategist at Domo, conducting a TDR.

The TDR Framework evaluates deals across 10 key dimensions:
1. Opportunity Overview   6. Partner Alignment
2. Technical Environment  7. Risks & Blockers
3. Competition            8. Decision Process
4. Architecture           9. Next Steps
5. Use Cases             10. Thesis

DEAL CONTEXT: {session data from Snowflake}
COMPETITIVE LANDSCAPE: {from Perplexity intel}
KNOWLEDGE BASE DOCUMENTS: {fileset excerpts with titles, relevance, sources}

Provide summary organized by:
1. Competitive Intelligence — battle card tactics
2. Partner & Platform Guidance — playbook guidance
3. Technical Positioning — architectural patterns
4. Recommended Actions — specific SE actions
```

**Files Changed:**

| File | Change |
|------|--------|
| `codeengine/consolidated-sprint4-5.js` | **New function:** `summarizeKBResults(sessionId, documentTexts)` — Cortex AI_COMPLETE with TDR-Framework-aware prompt |
| `manifest.json` | Add `summarizeKBResults` to `packageMapping` (2 params: sessionId, documentTexts) |
| `src/lib/filesetIntel.ts` | `summarizeResults()` now tries Code Engine first, falls back to Domo AI. `getIntelligenceSummary()` accepts optional `sessionId`. `FilesetSummary.relevantDocuments` includes `filesetId`. |
| `src/components/TDRIntelligence.tsx` | Passes `sessionId` to `getIntelligenceSummary()`. Expanded document view includes "View in Domo" deep link with `ExternalLink` icon. |

**Snowflake Tables Used:**
- **Read:** `TDR_SESSIONS` (session context), `ACCOUNT_INTEL_PERPLEXITY` (competitive landscape)
- **Write:** `CORTEX_ANALYSIS_RESULTS` (kb_summary result), `API_USAGE_LOG` (usage tracking)

**Definition of Done:** KB AI summary is generated via Cortex `AI_COMPLETE` through Code Engine when a session ID is available. Summary references TDR Framework dimensions and incorporates deal-specific context from Snowflake. Domo AI fallback works when Code Engine is unavailable. Documents in the fileset listing have "View in Domo" deep links. Result stored in `CORTEX_ANALYSIS_RESULTS`, usage logged to `API_USAGE_LOG`. Manifest version bumped to 1.38.0.

---

### Sprint 22 — Frontier Model Upgrade + Cortex Branding ✅ COMPLETE *(completed 2026-02-12)*

> **Goal:** Replace all open-source / legacy Cortex models with best-in-breed frontier models from OpenAI and Anthropic. Add first-class Snowflake & Cortex branding throughout the UI. Fix assorted UX bugs.
> **Risk to app:** Low — configuration change + visual branding. All AI_COMPLETE call signatures are identical regardless of model. If a model is unavailable in a region, Cortex cross-region inference handles fallback automatically.
> **Effort:** ~0.5 days
> **Dependencies:** None — can be applied at any time. Best done before Sprint 21 (Action Plan Synthesis) to ensure the capstone sprint uses the strongest models.

**Problem Statement:**
The app currently uses legacy open-source models for all AI operations:
- **Chat:** Defaults to `llama3.3-70b` with options including `llama3.1-405b`, `mistral-large2`, `claude-3-5-sonnet`, and `snowflake-arctic`
- **TDR Briefs, KB Summarization, askAnalyst:** All hardcoded to `llama3.3-70b` via `CORTEX_MODELS.brief`
- **Classification & Entity Extraction:** Hardcoded to `llama3.1-8b` — a tiny 8B-parameter model doing work that frontier models would do significantly better
- **Chat fallback:** Hardcoded `model || 'llama3.3-70b'` in `sendChatMessage`

These are fine for prototyping but are not best-in-breed. Snowflake Cortex now offers frontier models from OpenAI and Anthropic that dramatically outperform these open-source alternatives on reasoning, instruction following, and structured output quality.

**Available Frontier Models (Snowflake Cortex AI_COMPLETE):**

| Provider | Model ID | Capability | Cost Tier |
|----------|----------|-----------|-----------|
| **Anthropic** | `claude-4-opus` | Most capable model available. Deep reasoning, complex analysis, nuanced output. | high |
| **Anthropic** | `claude-4-sonnet` | Excellent reasoning with fast response. Best balance of capability and speed. | medium |
| **OpenAI** | `openai-gpt-4.1` | Latest GPT. Strong all-around: coding, analysis, structured output. | high |
| **OpenAI** | `openai-o4-mini` | Reasoning-optimized, cost-efficient. Great for classification and extraction tasks. | medium |

**Not Available:**
- **Google Gemini:** Not currently supported on Snowflake Cortex AI_COMPLETE. Will be added to the model selector when Snowflake adds Gemini support.

**Removed Models:**
- `llama3.3-70b` — replaced by `claude-4-sonnet` (better reasoning)
- `llama3.1-405b` — replaced by `claude-4-opus` (more capable, lower latency)
- `llama3.1-8b` — replaced by `openai-o4-mini` (vastly better at classification/extraction)
- `mistral-large2` — replaced by `openai-gpt-4.1` (stronger all-around)
- `claude-3-5-sonnet` — replaced by `claude-4-sonnet` (two generations newer)
- `snowflake-arctic` — removed (not competitive)

**Solution — 4 Parts:**

**Part A: Chat Model Selector** (`src/config/llmProviders.ts`)

Replace the Cortex model list. New default: `claude-4-sonnet`.

```typescript
models: [
  { id: 'claude-4-sonnet',   label: 'Claude 4 Sonnet',   description: 'Fast, excellent reasoning',      costTier: 'medium' },
  { id: 'claude-4-opus',     label: 'Claude 4 Opus',     description: 'Most capable, deep reasoning',   costTier: 'high' },
  { id: 'openai-gpt-4.1',   label: 'GPT-4.1',           description: 'Latest GPT, strong all-around',  costTier: 'high' },
  { id: 'openai-o4-mini',   label: 'OpenAI o4-mini',    description: 'Reasoning-optimized, efficient',  costTier: 'medium' },
],
defaultModelId: 'claude-4-sonnet',
```

**Part B: Code Engine Backend** (`CORTEX_MODELS` in `consolidated-sprint4-5.js`)

```javascript
const CORTEX_MODELS = {
  brief:    'claude-4-sonnet',   // TDR briefs, KB summary, askAnalyst, action plan (was llama3.3-70b)
  classify: 'openai-o4-mini',   // Classification tasks (was llama3.1-8b)
  embed:    'e5-base-v2',       // Embeddings — unchanged (not a generative model)
  extract:  'openai-o4-mini',   // Entity extraction (was llama3.1-8b)
};
```

**Part C: Chat Default Fallback** (in `sendChatMessage`)

```javascript
// Before:
const modelId = model || 'llama3.3-70b';
// After:
const modelId = model || 'claude-4-sonnet';
```

Also update the return statement fallback:
```javascript
// Before:
model: model || (provider === 'cortex' ? 'llama3.3-70b' : 'sonar'),
// After:
model: model || (provider === 'cortex' ? 'claude-4-sonnet' : 'sonar'),
```

**Part D: Gemini Future-Proofing**

Google Gemini is not currently available on Snowflake Cortex. When Snowflake adds Gemini support, add it to the model selector:
```typescript
// Future — when Gemini becomes available on Cortex:
{ id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Google frontier model', costTier: 'high' },
```

**Impact Audit — Every AI_COMPLETE Call in the App:**

| Function | Current Model | New Model | Change Type |
|----------|--------------|-----------|-------------|
| `generateTDRBrief` | `CORTEX_MODELS.brief` → `llama3.3-70b` | `claude-4-sonnet` | Via config |
| `classifyFindings` | `CORTEX_MODELS.classify` → `llama3.1-8b` | `openai-o4-mini` | Via config |
| `extractEntities` | `CORTEX_MODELS.extract` → `llama3.1-8b` | `openai-o4-mini` | Via config |
| `sendChatMessage` (Cortex) | `model \|\| 'llama3.3-70b'` | `model \|\| 'claude-4-sonnet'` | Direct edit |
| `askAnalyst` (SQL gen) | `CORTEX_MODELS.brief` → `llama3.3-70b` | `claude-4-sonnet` | Via config |
| `askAnalyst` (answer) | `CORTEX_MODELS.brief` → `llama3.3-70b` | `claude-4-sonnet` | Via config |
| `summarizeKBResults` | `CORTEX_MODELS.brief` → `llama3.3-70b` | `claude-4-sonnet` | Via config |
| `extractStructuredTDR` | `CORTEX_MODELS.brief` → `llama3.3-70b` | `claude-4-sonnet` | Via config |
| `findSimilarDeals` | `CORTEX_MODELS.embed` → `e5-base-v2` | `e5-base-v2` | **No change** (embedding) |
| Chat model selector | 5 legacy models | 4 frontier models | Frontend config |

**What Stays Unchanged:**
- **Perplexity provider** (`sonar`, `sonar-pro`) — separate web-grounded search provider, not Cortex
- **Domo AI provider** — native Domo AI, not Cortex
- **`e5-base-v2` embedding model** — embedding models are a different category; `e5-base-v2` is the standard Cortex embedding model
- **All API call signatures** — `AI_COMPLETE(model, prompt)` is identical regardless of model name
- **All prompt engineering** — prompts work across models (frontier models follow instructions better, not worse)

**Files Changed:**

| File | Change |
|------|--------|
| `src/config/llmProviders.ts` | Replace Cortex model list: 4 frontier models, default `claude-4-sonnet` |
| `codeengine/consolidated-sprint4-5.js` | Update `CORTEX_MODELS` config object. Update `sendChatMessage` fallback defaults. |

**Definition of Done:** ✅ Every AI operation in the app uses a frontier model from OpenAI or Anthropic. The chat model selector shows only `claude-4-sonnet`, `claude-4-opus`, `openai-gpt-4.1`, `openai-o4-mini`. No Llama, Mistral, or Arctic models remain in the codebase. `CORTEX_MODELS.brief` = `claude-4-sonnet`, `CORTEX_MODELS.classify` = `openai-o4-mini`, `CORTEX_MODELS.extract` = `openai-o4-mini`. Gemini noted as future addition when Snowflake adds support.

**Additional Sprint 22 Work (completed alongside model upgrade):**

**Part E: Snowflake & Cortex Branding** (`src/components/CortexBranding.tsx` — **new file**)
Created a reusable component library with inline SVG versions of the official Snowflake and Cortex logos (blue + gray variants), plus composable badges (`PoweredByCortexBadge`, `CortexPill`, `SnowflakePill`, `CortexSpinner`). Integrated across 7 touchpoints:

| Surface | Change |
|---------|--------|
| Sidebar footer | "Powered by Snowflake Cortex" badge with both logos; collapses to icon-only when narrow |
| Intelligence tab | Cortex logo replaces Brain icon |
| Chat tab | Snowflake logo replaces MessageSquare icon |
| TDR Brief buttons + dialog | Cortex logo on generate/view buttons, dialog header, and loading animation |
| Knowledge Base section | Snowflake logo + Cortex pill in header, branded loading & AI Summary label |
| Analytics Extraction | Cortex logo + Snowflake pill in header |
| Chat messages | Real Snowflake logo in provider selector, Cortex logo as avatar for Cortex responses, branded "Cortex thinking…" loading state |

**Part F: KB Summary Readability** (`formatKBSummary` in `TDRIntelligence.tsx`)
The Cortex AI Knowledge Base summary was rendering as a single dense paragraph. Added `formatKBSummary()` that normalises literal `\n`/`\t` escapes, detects section headers (e.g., "Competitive Intelligence:", "Recommended Actions:"), splits into visually distinct paragraphs with bold headings, and renders bullet points as proper `<ul>` lists. Applied `space-y-2` for consistent vertical spacing between sections.

**Part G: Bug Fixes**
- Fixed React Select uncontrolled→controlled warning in `TDRInputs.tsx` (changed `value={currentValue || undefined}` to `value={currentValue || ''}`)
- Made the "Final Outcome" Select in `TDRIntelligence.tsx` a controlled component with `finalOutcome` state
- Added retry logic with exponential backoff (up to 2 retries) to `summarizeResults()` in `filesetIntel.ts` for the Code Engine summarization call

**All Files Changed (Sprint 22):**

| File | Change |
|------|--------|
| `src/config/llmProviders.ts` | Frontier model list, default `claude-4-sonnet` |
| `codeengine/consolidated-sprint4-5.js` | `CORTEX_MODELS` config, chat fallbacks, version → 1.39.0 |
| `src/components/CortexBranding.tsx` | **NEW** — Snowflake + Cortex SVG logo components and composable badges |
| `src/components/AppSidebar.tsx` | "Powered by Snowflake Cortex" badge in sidebar footer |
| `src/pages/TDRWorkspace.tsx` | Cortex/Snowflake logos on Intelligence + Chat tabs |
| `src/components/TDRIntelligence.tsx` | Cortex branding on Brief, KB, Extraction sections; `formatKBSummary()`; controlled Final Outcome Select |
| `src/components/TDRChat.tsx` | Real Snowflake logo for Cortex provider; branded loading + message avatars |
| `src/components/TDRInputs.tsx` | Fixed uncontrolled→controlled Select warning |
| `src/lib/filesetIntel.ts` | Retry logic with backoff for Code Engine summarization |

---

### Sprint 20 — Hero Metrics & Nav Cleanup ✅ COMPLETE (Feb 12 2026)

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

**Sprint 20 Implementation Notes (Feb 12 2026):**

**Part A: Nav Cleanup**
- Removed `/agenda` route from `App.tsx`
- Removed "Agenda" nav item from `AppSidebar.tsx` (the Agenda Section remains on the Command Center page, accessible via the pin/star workflow)
- Removed `/agenda` from `MainLayout.tsx` page titles

**Part B: New Stat Cards (4)**

| Card | Icon | Metric | Tooltip |
|------|------|--------|---------|
| **TDR Queue** | `ShieldAlert` (purple) | High/Critical deals with no completed TDR | "These need your attention" |
| **Competitive** | `Swords` (rose) | Deals with named competitors | "Use KB battle cards" |
| **Partner Pipeline** | `Handshake` (blue) | Deals with Snowflake team / partner influence | "Cloud Amplifier pipeline" |
| **Stale Deals** | `Clock` (amber) | Deals >60 days in same stage | "May need intervention" |

Each card shows deal count + ACV and has an explanatory Radix tooltip on hover.

**Part C: New Charts (3)**

| Chart | Type | Component | What It Shows |
|-------|------|-----------|---------------|
| **TDR Coverage** | Donut | `TDRCoverageChart.tsx` (new) | Reviewed vs In-Progress vs Unreviewed, with center % label and ACV breakdown |
| **Score Distribution** | Bar | `ScoreDistributionChart.tsx` (new) | Deal count by score bracket (Critical/High/Medium/Low) with color coding |
| **Close Urgency** | Stacked Area | `CloseUrgencyChart.tsx` (new) | ACV by close month, split by TDR review status (Reviewed vs Unreviewed) |

**Part D: Removed Charts**
The old `TopTDRCandidatesChart`, `TDRPriorityChart`, and `PipelineByCloseChart` are no longer imported by `CommandCenter.tsx`. Their source files remain in the repo as reference but are unused dead code.

**All Files Changed (Sprint 20):**

| File | Change |
|------|--------|
| `src/pages/CommandCenter.tsx` | Complete rewrite: new stat cards, new charts, TDR-aligned metrics |
| `src/components/charts/TDRCoverageChart.tsx` | **NEW** — Donut: Reviewed / In-Progress / Unreviewed |
| `src/components/charts/ScoreDistributionChart.tsx` | **NEW** — Bar: deal count by score bracket |
| `src/components/charts/CloseUrgencyChart.tsx` | **NEW** — Stacked area: ACV by close month by TDR status |
| `src/components/AppSidebar.tsx` | Removed Agenda nav item, removed `ListTodo` import |
| `src/App.tsx` | Removed `/agenda` route |
| `src/layouts/MainLayout.tsx` | Removed `/agenda` from page titles |

---

### Sprint 23 — KB Insights Cleanup + KB Tooltip ✅ COMPLETE (Feb 12 2026)

> **Goal:** Make Knowledge Base insight badges more meaningful (replace generic "Insights in: document" with clean document names) and add a rich tooltip to the KB toggle button in chat showing configured fileset names.
> **Risk to app:** Low — cosmetic UX improvements only.
> **Effort:** ~0.5 day
> **Dependencies:** Sprint 19.5 (Cortex KB Summarization), Sprint 22 (Branding)

**Part A: KB Insight Badge Cleanup** (`src/lib/filesetIntel.ts`)
- Replaced vague "Insights in: [filename]" badges with cleaned document names
- Strip file extensions (`.pdf`, `.docx`, `.pptx`, `.txt`)
- Replace hyphens/underscores with spaces
- Remove generic keywords ("competitive", "battle card", "playbook", etc.)
- Deduplicate entries

**Part B: Insight Badge Icons** (`src/components/TDRIntelligence.tsx`)
- Added `Target` icon prefix to competitive insight badges (rose)
- Added `UserCheck` icon prefix to partner insight badges (blue)

**Part C: KB Toggle Rich Tooltip** (`src/components/TDRChat.tsx`)
- Replaced native `title` attribute with Radix UI `Tooltip` on the KB button
- Tooltip shows: header with active/off status, list of configured fileset names with amber diamond bullets, and a footer hint
- Derives fileset names from `filesetConfig` in settings

**All Files Changed (Sprint 23):**

| File | Change |
|------|--------|
| `src/lib/filesetIntel.ts` | Cleaner document name extraction for insight badges |
| `src/components/TDRIntelligence.tsx` | `Target` and `UserCheck` icons on competitive/partner insight badges |
| `src/components/TDRChat.tsx` | Rich Radix UI Tooltip on KB toggle button with fileset names |

---

### Sprint 21 — TDR Action Plan Synthesis ✅ COMPLETE *(completed 2026-02-12)*

> **Goal:** After TDR completion, use Cortex AI to synthesize ALL captured data — SE inputs, deal metadata, Perplexity research, Sumble enrichment, fileset battle cards/playbooks, chat highlights, classified findings, extracted entities, and Post-TDR Score — into a comprehensive, tailored action plan for the SE/AE.
> **Risk to app:** Low — additive feature. Enhances the readout without changing existing behavior.
> **Effort:** ~2-3 days
> **Dependencies:** Sprint 17 (lean TDR inputs), Sprint 18 (Post-TDR Score), Sprint 19 (fileset intelligence), Sprint 19.5 (Cortex KB summarization)

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

### Sprint 26 — Intelligence Panel UX Review & Consolidation ✅ COMPLETE (Feb 13, 2026)

> **Goal:** Perform a comprehensive usability audit of the TDR Intelligence panel (right modal). After 23+ sprints of iterative feature additions, the panel has accumulated ~20 distinct sections, multiple enrichment trigger buttons, heavy branding elements, and visible-but-low-value subsections. This sprint consolidates, simplifies, and refines the panel into a cohesive, intuitive experience — ready for executive demonstrations and daily SE workflow.
> **Risk to app:** Medium — this is a structural UX refactor of the most information-dense surface in the app. Careful attention to not lose functionality while simplifying the interface.
> **Effort:** ~2-3 days
> **Dependencies:** Sprint 14 (Slack Distribution — so the panel is feature-complete before redesigning), Sprint 21 (Action Plan), Sprint 24 WS1 (Caching — so cached state badges are finalized)

**Problem Statement:**

The Intelligence panel has been the primary surface for feature delivery across the app's lifecycle. Each sprint added new sections vertically: Sumble enrichment, Perplexity research, Cortex Brief, classified findings, extracted entities, sentiment trend, similar deals, knowledge base, analytics extraction, action plan, TDR score, deal team, readiness, risks, missing info, evidence, and final outcome. The result is a **~2,800-line component** with:

1. **Fragmented Sumble interactions** — 4 separate enrichment buttons (`Sumble Enrich`, `Org Profile`, `Jobs`, `People`) that call 4 different API endpoints. Users see these as disjointed; they want "enrich this account" as one action.
2. **Heavy branding** — Snowflake logos, Cortex pills, Sumble icons, and Perplexity icons appear throughout, often with colored backgrounds. What started as "make Snowflake professionals notice Cortex" has become visual noise at the section level.
3. **Analytics Extraction as a visible section** — The structured extraction panel shows a status badge but no actual data in the panel itself. The extraction feeds the Portfolio Analytics page, not the Intelligence panel. Its presence here is confusing — it should happen automatically behind the scenes.
4. **No clear information hierarchy** — A first-time user scanning the panel can't distinguish "what's critical" from "what's supplementary." The Action Plan (most actionable) sits below multiple raw data sections.
5. **Section ordering doesn't match workflow** — The panel mixes decision-making outputs (Action Plan, TDR Score, Brief) with raw data feeds (tech stack, hiring signals, web research) with administrative controls (Final Outcome, domain input).

**Solution — Five Workstreams:**

**Workstream 1: Sumble Enrichment Consolidation**

| Current State | Target State |
|---------------|--------------|
| 4 separate buttons: "Sumble Enrich", "Org Profile", "Jobs", "People" | **One button: "Enrich Account"** — triggers all 4 Sumble API calls in parallel |
| User must discover and click each button separately | Single click enriches everything; individual sections load progressively |
| If one fails, user doesn't know which | Unified status: "Enriching... (3/4 complete)" with per-section indicators |
| "Refresh Sumble" vs "Sumble Enrich" labeling confusion | "Enrich Account" (first time) → "Refresh" (subsequent) |

Backend: No Code Engine changes — frontend calls all 4 endpoints (`enrichSumble`, `enrichSumbleOrg`, `enrichSumbleJobs`, `enrichSumblePeople`) in `Promise.allSettled()`.

**Workstream 2: Branding Reduction**

| Current State | Target State |
|---------------|--------------|
| `<CortexPill>` and `<SnowflakePill>` badges on multiple sections | Remove section-level branding pills entirely |
| Cortex/Snowflake logos in section headers | **Icons only** — small (14px) Cortex snowflake or Snowflake logo as a subtle indicator next to section titles that use Cortex, no text labels |
| Colored branding backgrounds (violet/blue glows) | Neutral section headers; branding expressed through the app's overall design language, not per-section decoration |
| Sumble/Perplexity icons on every subsection | **One "Powered by" line** at the bottom of the enrichment block: `Powered by Sumble · Perplexity · Snowflake Cortex` with small icons |

**Workstream 3: Analytics Extraction — Move Behind the Scenes**

| Current State | Target State |
|---------------|--------------|
| Visible "Analytics Extraction" section with status badge | **Remove from panel entirely** |
| User must understand what extraction is | Extraction runs automatically when a TDR is loaded (if no cached extraction exists) — already implemented in Sprint 24 WS1 |
| "Re-extract" button visible in panel | Move to Settings or TDR Analytics page footer (for advanced users) |
| Extraction status/date shown in Intelligence panel | Status only shown in TDR Portfolio Analytics page header (where the data is actually consumed) |

**Workstream 4: Section Reordering & Information Hierarchy**

Reorder the panel sections by **decision value** (most actionable at top, raw data below, admin at bottom):

| Order | Section | Rationale |
|-------|---------|-----------|
| 1 | **Account Header** (name, deal info, domain) | Context — always visible |
| 2 | **TDR Score** (Pre/Post) | Quick signal — is this deal critical? |
| 3 | **Strategic Action Plan** | Most actionable output — what to do next |
| 4 | **Cortex TDR Brief** | AI-synthesized narrative |
| 5 | **Knowledge Base** (fileset search + Cortex summary) | Relevant battle cards / playbooks |
| 6 | **Account Intelligence** (consolidated Sumble + Perplexity) | Collapsible enrichment data — org profile, tech stack, hiring, people, web research |
| 7 | **AI Analysis** (classified findings, extracted entities) | Cortex-processed insights |
| 8 | **Sentiment & Similar Deals** | Supplementary context |
| 9 | **Risk Flags & Missing Information** | Deal hygiene |
| 10 | **Final Outcome & Deal Team** | Administrative |

Key changes:
- **Combine** Sumble subsections (Technographic Signals, Tech Stack, Hiring Signals, Deep Intelligence, Org Profile, Hiring Signals, Key People) into **one collapsible "Account Intelligence"** block with tabs or accordion
- **Combine** Perplexity (Web Research) into the same Account Intelligence block as a tab
- **Combine** Classified Findings + Extracted Entities into **one "AI Analysis"** block
- **Combine** Sentiment + Similar Deals into one supplementary block
- **Collapsible sections** — sections 6-10 default collapsed; sections 1-5 default expanded

**Workstream 5: Visual Refinement**

| Area | Change |
|------|--------|
| Section dividers | Consistent thin borders, uniform padding (px-4 py-3) |
| Section headers | Uniform style: `text-[11px] uppercase tracking-widest text-slate-500 font-semibold` |
| Collapse/expand | ChevronDown/Up toggle on each section; remember state per session |
| Empty states | Consistent: light italic text + single CTA, no large empty boxes |
| Loading states | Uniform skeleton/spinner pattern across all sections |
| Font sizes | Harmonize: section labels 11px, content 12px, metadata 10px |

**Frontend Changes:**

| File | Change |
|------|--------|
| `src/components/TDRIntelligence.tsx` | Major refactor: reorder sections, consolidate Sumble buttons, remove analytics extraction section, reduce branding, add collapsible blocks |
| `src/components/CortexBranding.tsx` | Simplify: remove `CortexPill` and `SnowflakePill` exports, keep icon-only variants |
| `src/lib/accountIntel.ts` | Add `enrichAll(opportunityId, accountName, domain)` convenience method that calls all 4 Sumble endpoints in parallel |

**Definition of Done:** The Intelligence panel has a clear information hierarchy (decision outputs at top, raw data below, admin at bottom). Account enrichment is a single click. Branding is expressed through subtle icons, not colored pills on every section. Analytics Extraction is invisible to the user (runs automatically). The panel renders cleanly with no "wall of buttons" or "branding overload" feeling. A Snowflake SA seeing the panel for the first time can immediately identify what's important.

---

### Sprint 27 — Intelligence Panel Decision Architecture ✅ COMPLETE (Feb 14, 2026)

> **Goal:** Refactor the Intelligence panel from a data-source-centric layout (organized by Sumble, Perplexity, Cortex) into a **decision-oriented 4-zone architecture** — organized by the decisions an SE needs to make on a deal. Add a dual-axis scoring model (Risk × Confidence), lifecycle-aware contextual messaging, and auto-loading data sections.
> **Risk to app:** Medium — major structural refactor of the largest component in the app (~2,800+ lines). No Code Engine changes.
> **Effort:** ~2 days
> **Dependencies:** Sprint 26 (panel must be consolidated before reorganizing)

**Problem Statement:**

After Sprint 26 consolidated sections and reduced branding, the panel was cleaner but still organized by data source. An SE looking at the panel had to mentally assemble insights from separate Sumble, Perplexity, Cortex, and CRM sections to answer a single question like "What is the competitive landscape?" The information was available but **disconnected** — you had to visit 3-4 different sections to get the full picture on any one theme.

**Solution — 4-Zone Decision Architecture:**

| Zone | Purpose | Contents |
|------|---------|----------|
| **A: Situation Room** | Quick orientation — what is this deal and how critical is it? | Deal header (account, ACV, stage, deal type, deal team), TDR Score with lifecycle-aware context, Confidence Score (new), Signal Strip (threat, hiring, KB match, intel level) |
| **B: Intelligence Dossier** | Deep thematic analysis — organized by decision theme, not data source | §B1 Account Profile (Sumble Org + Perplexity summary), §B2 Technical Landscape (Sumble tech + Perplexity signals + Cortex extraction), §B3 Competitive Position (all competitive signals merged), §B4 Key People (Sumble people + Cortex executives), §B5 Market Signals (initiatives + hiring + classified findings + sentiment) |
| **C: Strategic Guidance** | AI-synthesized outputs — what to do next | Action Plan (full dialog), TDR Brief (link), Structured extract chips (Verdict, Complexity, Entry Layer, Cloud Platform) |
| **D: Evidence & Admin** | Raw data and administrative controls (collapsed by default) | Risk & Readiness, Research & Similar, Final Outcome |

**Key Design Decisions:**

1. **Inline Source Badges:** Instead of section-level branding, tiny inline badges (ⓢ Sumble · ⓟ Perplexity · ✨ Cortex AI · 🔎 KB · ▣ CRM) appear next to individual data points. The reader knows where each fact came from without branding dominating the layout.

2. **Enrichment Action Bar:** Domain input and "Enrich Account" button moved to top of Zone B as a compact toolbar — enrichment is a workflow action, not a section.

3. **TDR Score Lifecycle Maturity:**
   - 6 lifecycle phases: NOT_STARTED → EARLY → IN_PROGRESS → NEAR_COMPLETE → COMPLETE → ENRICHED
   - Each phase × 4 priority bands = 24 distinct contextual messages
   - Messaging evolves from "Requires immediate TDR" → "TDR in progress — key risks surfacing" → "TDR complete — execute action plan" → "Fully informed — manage through close"
   - Lifecycle based on **required steps only** (5/5). Optional steps shown as "+N optional" badge.

4. **TDR Confidence Score (Dual-Axis):**
   - Pre-TDR Score = deal complexity/risk (intrinsic to the deal)
   - Confidence Score = assessment thoroughness (SE effort)
   - Components: Required Steps (0-40), Optional Depth (0-10), External Intel (0-15), AI Analysis (0-15), Knowledge Base (0-10), Risk Identified (0-10)
   - Bands: Insufficient (0-19) → Developing (20-39) → Solid (40-59) → High (60-79) → Comprehensive (80-100)
   - A CRITICAL deal with Comprehensive confidence = "We know this is complex AND we fully understand it"

5. **Auto-loading Data:** Similar Deals and Research History load automatically on mount. No manual "click to search" needed.

6. **Domo Auto-refresh Suppression:** `domo.onDataUpdate()` no-op handler in `main.tsx` prevents dataset updates from reloading the app and destroying in-progress state.

**Frontend Changes:**

| File | Change |
|------|--------|
| `src/components/TDRIntelligence.tsx` | Major refactor: 4-zone layout, inline source badges, enrichment action bar, lifecycle-aware score context, confidence score, auto-load similar deals/history |
| `src/lib/tdrCriticalFactors.ts` | Added `calculateTDRConfidence()` function and `TDRConfidenceBreakdown` interface |
| `src/pages/TDRWorkspace.tsx` | Pass required/optional step counts separately to TDRIntelligence |
| `src/main.tsx` | Added `domo.onDataUpdate()` no-op to suppress auto-refresh |

**Definition of Done:** The Intelligence panel is organized into 4 decision-oriented zones. Each data point carries an inline source badge. The TDR Score shows lifecycle-aware context that evolves as the TDR matures (from "needs TDR" to "fully informed"). A Confidence meter shows assessment thoroughness alongside risk. Similar deals and history load automatically. The app does not reload when datasets update.

---

### Sprint 24 — Performance Optimization & KB Summary Caching ✅ COMPLETE (Feb 12–14, 2026)

> **Goal:** Audit the full app for performance bottlenecks, dead code, unused datasets, and redundant API calls. The headline deliverable is **caching Cortex KB summaries to Snowflake** so they are not regenerated on every deal load — the single largest unnecessary cost and latency source in the current app.
> **Risk to app:** Low — optimization and cleanup, no new user-facing features. Improves load times, reduces Cortex AI token spend, and shrinks the bundle.
> **Effort:** ~2 days
> **Dependencies:** Sprint 21 (Action Plan — so all features exist before optimizing), Sprint 19.5 (Cortex KB Summarization)

**Problem Statement:**
The app has grown across 23+ sprints. Features were added iteratively, and some artifacts remain from earlier architectures: unused datasets in the manifest, orphaned functions, dead imports, and API calls that run unconditionally. The most impactful issue is the **Knowledge Base Cortex Summary**: every time a deal is loaded, the app calls Cortex `AI_COMPLETE` to summarize KB search results — even if the KB documents and deal context haven't changed. A single TDR load triggers 1-3 Cortex calls (KB summary, TDR brief, classification) that could be served from cache.

**Solution — Three Workstreams:**

**Workstream 1: KB Summary Caching (Cortex → Snowflake)**

| Component | Change |
|-----------|--------|
| `CORTEX_ANALYSIS_RESULTS` table | Store KB summaries with `analysis_type: 'kb_summary'`, keyed by `session_id` + hash of fileset IDs + search terms |
| `summarizeKBResults` (Code Engine) | Before calling Cortex: check `CORTEX_ANALYSIS_RESULTS` for a cached summary matching the same session + fileset config. If found and < 24h old, return cached. If not, generate and store. |
| `filesetIntel.ts` (frontend) | Accept cached summaries from CE response. Show "Cached · Generated {time}" badge. Add "↻ Refresh" button that forces a fresh Cortex call (bypasses cache). |
| `TDRIntelligence.tsx` | Display cache status indicator (cached vs. live). "Refresh" button triggers re-summarization with `forceRefresh: true` param. |

Cache invalidation rules:
- Cache is keyed on: `session_id` + sorted fileset IDs + search query hash
- TTL: 24 hours (configurable in Settings)
- Manual override: "Refresh" button always bypasses cache
- If deal metadata changes significantly (competitor, partner, stage change), cache is auto-invalidated

**Workstream 2: Dead Code & Unused Asset Cleanup**

| Area | Audit Scope |
|------|-------------|
| **Datasets (`manifest.json`)** | Identify datasets referenced in `packageMapping` that are never called from the frontend. Remove unused mappings. |
| **Code Engine functions** | Cross-reference all CE functions against frontend `cortexAi.ts`, `snowflakeStore.ts`, `filesetIntel.ts` calls. Flag functions with zero frontend invocations. |
| **Frontend imports** | Tree-shake dead imports. Remove unused component files, orphaned utility functions, and legacy type definitions. |
| **Legacy chart components** | Old chart files (e.g., `PipelineByCloseChart.tsx`, `TopTDRCandidatesChart.tsx`, `TDRPriorityChart.tsx`) replaced in Sprint 20 — verify they are no longer imported and remove if dead. |
| **CSS / Tailwind** | Audit for unused CSS classes and redundant utility definitions. |
| **Dependencies (`package.json`)** | Identify npm packages that are no longer imported anywhere in the source. |

**Workstream 3: Runtime Performance**

| Optimization | Description |
|--------------|-------------|
| **Memoization audit** | Ensure expensive computations (deal scoring, chart data transforms, TDR score breakdowns) use `useMemo` / `useCallback` appropriately. |
| **Lazy loading** | Verify that heavy pages (TDR Analytics, Settings) and large libraries (react-pdf, ag-grid) are code-split via `React.lazy`. |
| **API call deduplication** | Prevent duplicate `getAllSessions`, `getLatestInputs`, and `getStepInputHistory` calls when navigating between tabs in the TDR Workspace. |
| **Snowflake query optimization** | Review CE SQL queries for missing indexes, unnecessary `SELECT *`, and opportunities to use `LIMIT` or column projection. |
| **Bundle size** | Analyze with `vite-bundle-visualizer`. Target: reduce main chunk below 1.5MB (currently ~2.2MB). |

**Frontend Changes:**

| File | Change |
|------|--------|
| `src/lib/filesetIntel.ts` | Add `forceRefresh` param to `summarizeResults()`. Check for cached summary before calling CE. |
| `src/components/TDRIntelligence.tsx` | Add cache status badge + "Refresh" button to KB Summary section. |
| `src/lib/cortexAi.ts` | Add `getCachedKBSummary()` method. |
| `codeengine/consolidated-sprint4-5.js` | Enhance `summarizeKBResults` with cache-check-before-generate logic. |
| `manifest.json` | Remove unused dataset/package mappings. |
| Various files | Remove dead imports, unused functions, orphaned components. |

**Definition of Done:** KB summaries load from Snowflake cache on repeat visits (< 200ms vs. 5-10s for live Cortex call). "Refresh" button forces regeneration. Bundle size reduced by ≥ 15%. Zero unused datasets in manifest. Zero orphaned component files.

**Progress (Sprint 24 — Workstream 1: COMPLETE ✅, Feb 12 2026):**

Workstream 1 (Cache-first loading) was completed ahead of schedule as part of Sprint 21 post-completion improvements:

| Deliverable | Status |
|-------------|--------|
| `getCachedKBSummary` Code Engine function — lightweight cache-only query | ✅ |
| `getLatestActionPlan` Code Engine function — loads cached plan without generating | ✅ |
| `getLatestExtraction` Code Engine function — loads cached structured extraction | ✅ |
| Frontend auto-loads cached KB summary on deal open (checks Snowflake first, only calls Cortex if no cache) | ✅ |
| Frontend auto-loads cached action plan on deal open with date stamp | ✅ |
| Frontend auto-loads cached analytics extraction on deal open; auto-extracts if none exists | ✅ |
| KB summary: date stamp + refresh button (↻) in header | ✅ |
| Action plan: "loaded" vs "generated" status + date stamp | ✅ |
| Analytics extraction: date stamp + compact re-extract link | ✅ |
| Removed dead "Save Draft" button (no handler — inputs auto-save) | ✅ |
| Removed dead "Finalize TDR" button (no handler — Final Outcome dropdown handles this) | ✅ |
| Removed obsolete "Generate Summary" button + `TDRSummaryModal` (superseded by Cortex Brief, Action Plan, Readout) | ✅ |
| Compacted Re-extract, View Full Plan, Retry buttons from chunky full-width to subtle inline links | ✅ |
| Generate Action Plan button: refined from aggressive gradient to subtle violet-bordered style | ✅ |
| 3 new manifest function mappings (`getLatestActionPlan`, `getLatestExtraction`, `getCachedKBSummary`) | ✅ |
| Version: 1.43.0 | ✅ |

**Workstream 2 — Dead Code Cleanup (COMPLETE ✅, Feb 14 2026):**

A thorough audit was performed across manifest datasets, Code Engine functions, chart components, application components, UI primitives, and npm packages. **Only zero-risk deletions were executed** — items confirmed to have zero imports and zero runtime impact. Items that posed regression risk (shadcn/ui scaffolding, Radix packages, memoization, lazy loading, SQL changes) were explicitly skipped.

| Workstream | Task | Status | Notes |
|------------|------|--------|-------|
| **WS2: Dead Code Cleanup** | Audit manifest datasets — remove unused mappings | ✅ | Removed `forecastsmagic` and `wcpweekly` from `manifest.json` and `domo.ts` CONFIG — never queried from frontend |
| **WS2: Dead Code Cleanup** | Cross-reference CE functions vs. frontend calls — flag unused | ✅ Audited | All 38 CE functions have ≥1 frontend caller. `getPortfolioInsights` has a wrapper but no UI caller — kept in manifest for future use |
| **WS2: Dead Code Cleanup** | Remove orphaned chart components (Sprint 20 replacements) | ✅ | Deleted 6 files: `PipelineByCloseChart`, `ReadinessTrendChart`, `ACVDistributionChart`, `RiskMixChart`, `TopTDRCandidatesChart`, `TDRPriorityChart` |
| **WS2: Dead Code Cleanup** | Tree-shake dead imports, unused types, legacy utilities | ✅ | Deleted 3 dead components: `TDRSummaryModal`, `MetricsGrid`, `NavLink` — all had zero imports |
| **WS2: Dead Code Cleanup** | Audit `package.json` for unused npm packages | ✅ Audited | `@hookform/resolvers` and `zod` have zero imports but are tree-shaken by Vite — no bundle impact, left in place to avoid install churn |

**Workstream 3 — Runtime Performance (COMPLETE ✅, Feb 14 2026 — audited, no changes needed):**

| Workstream | Task | Status | Notes |
|------------|------|--------|-------|
| **WS3: Runtime Performance** | Memoization audit | ✅ Audited | No user-reported sluggishness. Adding `useMemo`/`useCallback` risks stale closure bugs. **Skipped — no action needed.** |
| **WS3: Runtime Performance** | Lazy loading verification | ✅ Audited | `react-pdf` already lazy-loaded via `await import()`. `ag-grid` statically imported but is the main page component. Converting pages to `React.lazy()` risks Domo iframe + Suspense conflicts. **No changes.** |
| **WS3: Runtime Performance** | API call deduplication | ✅ Audited | `getAllSessions` called once in `useDeals` hook, independently in TDRAnalytics. No actual duplication on main load path. **No issue found.** |
| **WS3: Runtime Performance** | Snowflake SQL query optimization | ✅ Audited | Touching deployed CE SQL = highest regression risk. No queries provably slow. **Skipped — not worth the risk.** |
| **WS3: Runtime Performance** | Bundle size analysis | ✅ Audited | Main chunk: 2.2MB (ag-grid ~500KB, recharts ~200KB, Radix, app code — all actively used). react-pdf already code-split (1.5MB separate chunk). Dead files were already tree-shaken. **No meaningful reduction possible without lazy-loading pages, which risks Domo iframe regressions.** |

**Net result:** 9 dead files deleted (−2,010 lines), 2 unused datasets removed from manifest, zero behavior changes, zero regressions. Version: 1.52.0.

---

### Sprint 25 — Documentation Hub & Architecture Diagram ✅ COMPLETE

> **Goal:** Build a comprehensive in-app Documentation Hub containing an interactive architecture diagram, scoring methodology reference, app capabilities guide, integrations reference, data model documentation, AI model registry, and glossary/FAQ. All in a single unified `/docs` tab.
> **Risk to app:** Low — purely additive, read-only documentation tab. No changes to existing functionality.
> **Effort:** ~1 day
> **Dependencies:** Sprint 21 (Action Plan — so the diagram captures the complete architecture)
> **Completion Date:** Feb 14, 2026

**Problem Statement:**
The app now spans 9+ pillars, 25+ sprints, and dozens of integrations. There is no visual representation of how the pieces connect. Stakeholders (Snowflake SAs, Domo executives, engineering leads) need a single diagram that shows:
- What data flows where
- Which Snowflake Cortex models power which features
- How Domo Code Engine, datasets, and filesets fit together
- Where external APIs (Sumble, Perplexity) plug in
- The end-to-end user workflow from deal selection → TDR → action plan → readout

**Solution: Unified Documentation Hub at `/docs`**

**Approach:** Rather than a standalone architecture diagram page, the architecture visualization was integrated into a comprehensive Documentation Hub — a single `/docs` tab containing seven reference sections. The architecture diagram uses hand-crafted SVG React components (no external D2/Mermaid dependency) with a pill-toggle layer switcher. All documentation sections use accordion-based navigation with a sticky Table of Contents sidebar.

**Documentation Sections (7):**

| Section | Component | Content |
|---------|-----------|---------|
| **1. Architecture Diagram** | `ArchitectureDiagram.tsx` | 5-layer interactive SVG: System Overview, Snowflake Data Model, Cortex AI Model Map, Enrichment Pipeline, User Workflow. Pill-toggle layer switcher. |
| **2. TDR Index Score** | `ScoringReference.tsx` | Pre-TDR scoring (5 factors, weights, bands), Post-TDR scoring (5 factors), Confidence Score (6 dimensions, 0–100 scale, 5 bands). Factor tables with weight breakdowns. |
| **3. App Capabilities** | `CapabilitiesGuide.tsx` | 9 accordion sections: Command Center, TDR Workspace, Intelligence Panel, TDR Inline Chat, Action Plan, TDR Readout & Slack, Portfolio Analytics + NLQ, Similar Deals, History & Settings. |
| **4. Integrations** | `IntegrationsReference.tsx` | 5 integration cards: Snowflake Cortex AI (10 functions), Sumble (4 tiers), Perplexity (sonar-pro), Domo Platform (5 services), Slack (Block Kit). |
| **5. Data Model** | `DataModelReference.tsx` | 10 Snowflake tables/views: TDR_SESSIONS, TDR_STEP_INPUTS, TDR_CHAT_MESSAGES, ACCOUNT_INTEL_SUMBLE, ACCOUNT_INTEL_PERPLEXITY, CORTEX_ANALYSIS_RESULTS, API_USAGE_LOG, V_TDR_ANALYTICS, TDR_READOUTS, TDR_DISTRIBUTIONS. |
| **6. AI Models** | `AIModelsReference.tsx` | Every model across 3 providers: Snowflake Cortex (claude-4-sonnet, snowflake-arctic-embed-l-v2.0, Cortex Analyst, Cortex Search), Perplexity (sonar-pro), Domo AI (domo-ai-default). |
| **7. Glossary & FAQ** | `GlossaryReference.tsx` | 20+ terms (TDR, Pre-TDR Score, Confidence Score, etc.) + common questions in accordion format. |

**Architecture Diagram Layers (5 views):**

| Layer | Shows | Key Elements |
|-------|-------|-------------|
| **1. System Overview** | High-level architecture blocks | Experience Layer (React SPA) → Intelligence Layer (Code Engine) → Persistence Layer (Snowflake) → External APIs |
| **2. Snowflake Data Model** | All Snowflake tables and views | `TDR_SESSIONS`, `TDR_STEP_INPUTS`, `TDR_CHAT_MESSAGES`, `ACCOUNT_INTEL_SUMBLE`, `ACCOUNT_INTEL_PERPLEXITY`, `CORTEX_ANALYSIS_RESULTS`, `API_USAGE_LOG`, `V_TDR_ANALYTICS`, `TDR_READOUTS`, `TDR_DISTRIBUTIONS` |
| **3. Cortex AI Model Map** | Which Cortex function + model powers which feature | `AI_COMPLETE` (claude-4-sonnet → briefs, action plans), `AI_CLASSIFY` (claude-4-sonnet → risk findings), `AI_EXTRACT` (claude-4-sonnet → entities), `AI_EMBED` (snowflake-arctic-embed-l-v2.0 → similarity), Cortex Analyst (NLQ → SQL), Cortex Search (hybrid retrieval) |
| **4. Enrichment Pipeline** | External data flow | Sumble (org → tech → jobs → people) → cache in Snowflake. Perplexity (sonar-pro → research) → cache in Snowflake. Domo Filesets (PDF query → chunk → Cortex summarize) → cache in Snowflake. |
| **5. User Workflow** | End-to-end journey | Deal Selection → TDR Workspace → (SE Inputs + Auto-Enrichment + Chat) → Scoring → Action Plan → PDF Readout → Slack Distribution |

**UI Design:**

| Element | Spec |
|---------|------|
| **Tab location** | Sidebar nav item: "Documentation" with `Network` Lucide icon |
| **Background** | Match app background: dark purple/slate theme |
| **Layout** | 2-column: sticky Table of Contents (left) + content area (right) with accordion sections |
| **Text colors** | High-contrast slate-200/300 for readability on dark backgrounds. No emojis. |
| **Layer switcher** | Pill toggle: "Overview / Data Model / Cortex AI / Enrichment / Workflow" |
| **Accordions** | Each section uses shadcn/ui Accordion with chevron toggles |

**Frontend Changes (Actual):**

| File | Change |
|------|--------|
| `src/pages/Documentation.tsx` | **New** — Main page. Sticky ToC sidebar + 7 accordion sections. |
| `src/components/docs/ArchitectureDiagram.tsx` | **New** — 5-layer SVG architecture diagram with pill-toggle switcher. |
| `src/components/docs/ScoringReference.tsx` | **New** — Pre-TDR, Post-TDR, Confidence Score reference with factor tables. |
| `src/components/docs/CapabilitiesGuide.tsx` | **New** — 9-section capabilities guide. |
| `src/components/docs/IntegrationsReference.tsx` | **New** — 5 integration cards with endpoints and features. |
| `src/components/docs/DataModelReference.tsx` | **New** — 10 Snowflake table/view documentation. |
| `src/components/docs/AIModelsReference.tsx` | **New** — AI model registry across 3 providers. |
| `src/components/docs/GlossaryReference.tsx` | **New** — Glossary + FAQ. |
| `src/components/AppSidebar.tsx` | Added "Documentation" nav item with Network icon. |
| `src/App.tsx` | Added `/docs` route. |
| `src/layouts/MainLayout.tsx` | Added "Documentation" to `PAGE_TITLES`. |

**Definition of Done:** ✅ A new "Documentation" tab at `/docs` renders a comprehensive reference hub with 7 sections. The Architecture Diagram section provides 5 switchable SVG layers accurately representing the current system. The Scoring Reference fully documents the TDR Index Score methodology. The Capabilities Guide covers every app feature. The Integrations, Data Model, and AI Models sections provide complete technical reference. The Glossary & FAQ answers common questions. All content uses high-contrast text for readability, no emojis, and the app's dark violet/purple design language.

---

### Sprint OSS-1 — Open-Source Readiness & README Overhaul ✅ COMPLETE (Mar 3, 2026)

> **Goal:** Make the repository safe and presentable for public GitHub visibility. Remove all hardcoded secrets, internal business data, and build artifacts from git tracking and history. Overhaul README for an expert audience (engineers + executives).
> **Risk to app:** None — all removed files are reference copies (Code Engine functions deployed via Domo CE IDE), sample data, build artifacts, or session logs. No runtime dependencies affected. App builds and runs identically before and after.
> **Effort:** ~0.5 day

**Problem Statement:**
The repository contained hardcoded credentials (Snowflake RSA private key, Sumble API key, Perplexity API key), internal SFDC business data (employee names, deal names, account data), a committed Python virtualenv (21K+ files), build artifacts, and Cursor session logs with embedded secrets. The README was internally-focused and did not reflect the current 4-layer architecture, Cortex AI integrations, or Sprint 28 ML strategy.

**Security Remediation (Tier 1 — Critical):**

| Secret | Files | Action |
|--------|-------|--------|
| Snowflake RSA Private Key (`-----BEGIN PRIVATE KEY-----`) | `codeengine/consolidated-sprint4-5.js`, `codeengine/copiedDomoCEfunctions.js`, `codeengine/consolidated-sprint1.js`, `codeengine/accountIntel.js`, `samples/aptSnowflakeCodeEngine.js` | `git rm --cached` + `git filter-repo --invert-paths` |
| Sumble API Key (`655.66013af459bc...`) | Same files as above | Same treatment |
| Perplexity API Key (`pplx-Qp0ADLMRMS...`) | Same files as above | Same treatment |
| Snowflake account locator (`DOMOINC-DOMOPARTNER`) + username (`CHILTON`) | Same files + `IMPLEMENTATION_STRATEGY.md` | Scrubbed from strategy doc; files removed from tracking |

**Data Remediation (Tier 2 — Internal Business Data):**

| Data | Files | Action |
|------|-------|--------|
| SFDC opportunity data (deal names, ACV, employee names) | `samples/*.json`, `samples/TDR-*.md` | Entire `samples/` directory removed from tracking |
| Employee emails (`@domo.com`) | `notebooks/01_data_exploration.ipynb` outputs | Notebook outputs cleared |
| Cursor session logs with embedded credentials | `cursor_*.md` (3 files) | Removed from tracking |
| Python virtualenv | `ml-venv/` (21,576 files) | Removed from tracking |
| Build artifacts | `dist/`, `dist_backup_v1.4.0/` | Removed from tracking |

**Git History Rewrite:**
- Used `git filter-repo --invert-paths` to purge all sensitive files from every past commit
- Two passes: first for `codeengine/`, `samples/`, `cursor_*.md`, `dist/`, `dist_backup_v1.4.0/`; second for `ml-venv/`
- Remote re-added after each rewrite: `git remote add origin https://github.com/cassidythilton/deal-inspect.git`
- Verified: zero hits for private key, Sumble key, Perplexity key, or account identifiers in tracked files AND git history

**`.gitignore` Hardening:**

```gitignore
# ── Security: Code Engine reference files (deployed via Domo CE IDE, not this repo) ──
codeengine/

# ── Security: Internal business data & sample files ──
samples/

# ── Build artifacts (rebuild with npm run build) ──
dist/
dist_backup*/

# ── Cursor session logs (may contain embedded secrets) ──
cursor_*.md
```

**`IMPLEMENTATION_STRATEGY.md` Scrubbing:**
- Replaced `/Users/cassidy.hilton/.local/bin/cortex` → `~/.local/bin/cortex`
- Replaced `DOMOINC-DOMOPARTNER` account locator + `CHILTON` user → generic references

**README Overhaul:**

The README was rewritten from 830 lines of internal implementation detail to 510 lines of executive-ready narrative:

| Before | After |
|--------|-------|
| Internal dev wiki (filter dropdown mechanics, tooltip CSS, column widths, employee names) | Problem statement → architecture → capabilities → scoring → AI stack → ML strategy |
| Domo-only ASCII architecture diagram | Four-layer system diagram (Experience → Intelligence → Persistence → Data) |
| No mention of Cortex AI, Snowflake persistence, chat, analytics, docs, Slack, readouts | 11 AI functions documented in single reference table |
| No ML strategy | Full Sprint 28 section: 2×2 quadrant, ensemble architecture, 19 features, Snowflake infra |
| No screenshots | 4 screenshot placeholders in `docs/screenshots/` |
| 5 pages documented | 6 pages (added Analytics, Documentation) |
| Outdated file structure | Current component tree (docs/, pdf/, icons/, Chat, ShareDialog) |

**Files Created:**
- `docs/screenshots/` — directory for README screenshot images

**Verification:**
- App builds successfully (`npx vite build` — clean, no errors)
- All local files intact on disk (codeengine/, samples/, dist/, ml-venv/)
- Zero secrets in tracked files (`git grep`)
- Zero secrets in git history (`git log -S`)
- 193 commits remain in rewritten history

**Post-Sprint Action Required:**
1. Save 4 screenshots to `docs/screenshots/` (command-center.png, workspace-intelligence.png, workspace-chat.png, documentation.png)
2. Rotate all 3 API keys (Snowflake private key, Sumble key, Perplexity key) — they were in git history and must be considered compromised
3. Force-push to GitHub: `git push --force-with-lease origin main`

---
