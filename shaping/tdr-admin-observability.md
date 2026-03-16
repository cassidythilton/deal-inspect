---
shaping: true
status: draft
appetite: medium (3–5 days)
---

# TDR Admin Observability — Usage Tracking, History & Analytics Consolidation

## Source

> "i need visibility into tdr history, logging, etc. i will be rolling out the app to other users and need visibility into all things tdr related (e.g. inputs, logs, timing, etc.). we may also want to think about capturing user information so I can see who's using the app the most, who's inputting the most tdr information, etc. i know we have a history tab, but i do not think it's functional. we also have an analytics tab, but i'm not sure how useful it is. can these be modified/consolidated or removed?"

---

## Problem

The app is about to go multi-user. **The admin has zero visibility into who's using it or what they're doing.** Every `CREATED_BY` value in Snowflake is the literal string `'current-user'` — the Domo user identity API (`/domo/users/v1/me`) was spec'd in the architecture doc but never implemented. When 10+ SEs start running TDRs, there's no way to answer basic questions: Who completed a TDR this week? Which deals have stale TDRs? Who's using chat the most? How long does a TDR take to complete?

The **History page is a dead placeholder** — 6 hardcoded mock records, no API calls, no navigation to detail. It looks like a real page but delivers zero value. An SE or admin who navigates there gets fake data. This is worse than not having the page at all, because it erodes trust.

The **Analytics page is partially functional** — it pulls real session data from `getAllSessions` and has an NLQ bar backed by Cortex AI. But it's underutilized: the stat cards show basic counts, the charts are mostly empty (platforms, risks, layers, use cases all empty), and it's getting 403 errors in production. The NLQ feature is powerful but discovery is low — users don't know what to ask.

The fundamental gap: **the app generates rich activity data (sessions, inputs, chat messages, AI briefs, extractions) across 6+ Snowflake tables, but none of it is surfaced in a way that helps the admin understand usage, quality, or adoption.** The two existing pages (History, Analytics) should be consolidated into a single, useful admin view.

---

## Requirements

### R0: Give the admin full visibility into TDR activity, usage, and adoption across all users

- R0.1: See all TDR sessions across all deals, with who created them, when, and current status
- R0.2: See per-user activity metrics (sessions created, inputs saved, chat messages sent)
- R0.3: See timing data (time to complete a TDR, time between iterations)

### R1: Capture real Domo user identity on every action

Every session creation, input save, and chat message must record the actual Domo user (name + ID), not `'current-user'`. This is a prerequisite for all per-user analytics.

### R2: Replace the mock History page with real data

The History page must show actual TDR sessions from Snowflake with search, filtering, and drill-down to session detail (inputs, completed steps, chat count).

### R3: Consolidate History and Analytics into a single admin surface

Two half-functional pages are worse than one good one. Merge into a single tabbed admin view: Activity Log (the history), Usage Metrics (the analytics), and optionally the NLQ analyst.

### R4: Activity feed with actionable detail

Each TDR session row should show: deal name, account, SE name, iteration, status, completed steps count, total inputs count, chat message count, created/updated timestamps. Clicking a row navigates to the TDR workspace for that deal.

### R5: Leaderboard / adoption metrics

Show which users are most active (sessions created, inputs saved, steps completed, chat messages). This helps the admin identify adoption gaps and champion users during rollout.

### R6: Preserve the NLQ analyst capability

The existing `askAnalyst` NLQ feature in Analytics is valuable and should be retained in the consolidated view.

---

## Solution Shape [A: Consolidated Admin View with User Identity]

### A1: User Identity Capture `[Cursor]`

| Part | Mechanism |
|------|-----------|
| **A1.1** | **Domo user context hook.** New `src/hooks/useDomoUser.ts` hook. On app init, calls `domo.get('/domo/users/v1/me')` to fetch `{ id, displayName, emailAddress, avatarKey }`. Stores in React context via `DomoUserProvider`. Falls back to `{ displayName: 'Unknown User' }` in dev mode. |
| **A1.2** | **Thread user identity through all writes.** Update `useTDRSession.ts`, `TDRChat.tsx`, `cortexAi.ts`, and `accountIntel.ts` to pass `user.displayName` (or `user.id`) instead of the literal `'current-user'`. Affects `createdBy` and `savedBy` parameters on `createSession`, `saveInput`, `sendChatMessage`, `generateBrief`, etc. |
| **A1.3** | **Backfill-safe.** Existing records with `'current-user'` remain valid. Admin views display them as "Unknown User" or the admin's own name (since only one user has been using the app). |

### A2: Admin Activity Log (replaces History) `[Cursor]`

| Part | Mechanism |
|------|-----------|
| **A2.1** | **New Code Engine function: `getAdminActivityLog`.** `[Cursor]` Returns all sessions joined with input counts, chat message counts, and step completion data. SQL joins `TDR_SESSIONS` with aggregated counts from `TDR_STEP_INPUTS` and `TDR_CHAT_MESSAGES`. Supports optional filters: `createdBy`, `status`, date range. Returns rows sorted by `UPDATED_AT DESC`. |
| **A2.2** | **Activity Log UI.** Replace `TDRHistory.tsx` internals with a data table (AG Grid or styled table) backed by `getAdminActivityLog`. Columns: Deal Name, Account, SE (CREATED_BY), Iteration, Status badge, Steps (completed/total), Inputs count, Chat messages count, Created, Last Updated. Searchable by deal/account name. Filterable by status, user, date range. |
| **A2.3** | **Row drill-down.** Clicking a row navigates to `/workspace?deal={opportunityId}`, loading that deal's TDR workspace. |

### A3: Usage Metrics Dashboard (replaces Analytics stats) `[Cursor]`

| Part | Mechanism |
|------|-----------|
| **A3.1** | **New Code Engine function: `getUsageMetrics`.** `[Cursor]` Returns aggregated usage stats: sessions by user, inputs by user, chat messages by user, sessions by day/week, average completion time. Single SQL query with CTEs against `TDR_SESSIONS`, `TDR_STEP_INPUTS`, `TDR_CHAT_MESSAGES`. |
| **A3.2** | **Stat cards.** Total TDRs, Active TDRs, Completed TDRs, Total Users, Avg Completion Time, Total Chat Messages, Total Inputs Saved. Pulled from `getUsageMetrics`. |
| **A3.3** | **User leaderboard.** Ranked table: User Name, Sessions Created, Inputs Saved, Steps Completed, Chat Messages. Highlights top contributors. |
| **A3.4** | **Activity timeline.** Bar chart showing TDR sessions created per week (Recharts `BarChart`). Shows adoption trend over time. |

### A4: Consolidated Page Structure `[Cursor]`

| Part | Mechanism |
|------|-----------|
| **A4.1** | **Single `/admin` route.** Replace both `/history` and `/analytics` routes with `/admin`. Update `AppSidebar.tsx` navigation: rename "History" to "Admin" (or "Activity"), remove "Analytics" as a separate item. The admin page uses internal tabs: "Activity Log", "Usage", "Analyst" (NLQ). |
| **A4.2** | **Retain NLQ tab.** Move the existing `askAnalyst` NLQ hero bar and result rendering from `TDRAnalytics.tsx` into the "Analyst" tab of the consolidated admin page. No logic changes — just lift and shift. |
| **A4.3** | **Delete dead code.** Remove `TDRHistory.tsx` mock data. Remove empty chart sections from `TDRAnalytics.tsx` (platforms, risks, layers, use cases — all empty arrays). |

---

## Fit Check: R × A

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | Give the admin full visibility into TDR activity, usage, and adoption across all users | Core goal | ✅ (A2, A3) |
| R0.1 | See all TDR sessions with who created them, when, and current status | Must-have | ✅ (A2.1, A2.2) |
| R0.2 | See per-user activity metrics (sessions, inputs, chat messages) | Must-have | ✅ (A3.1, A3.3) |
| R0.3 | See timing data (time to complete, time between iterations) | Must-have | ✅ (A3.1, A3.2) |
| R1 | Capture real Domo user identity on every action | Must-have | ✅ (A1.1, A1.2) |
| R2 | Replace mock History page with real data | Must-have | ✅ (A2.1, A2.2) |
| R3 | Consolidate History and Analytics into a single admin surface | Must-have | ✅ (A4.1, A4.2) |
| R4 | Activity feed with actionable detail and drill-down | Must-have | ✅ (A2.2, A2.3) |
| R5 | Leaderboard / adoption metrics | Must-have | ✅ (A3.3) |
| R6 | Preserve the NLQ analyst capability | Must-have | ✅ (A4.2) |

---

## Resolved Questions

1. **Should we capture Domo user ID or display name?** → **Both.** Store `user.id` as the stable identifier and `user.displayName` for human-readable display. Use display name in `CREATED_BY` (it's VARCHAR and already used for display). Store ID in a new column if needed later for deduplication, but display name is sufficient for Sprint 35.

2. **Should old `'current-user'` records be migrated?** → **No.** They represent the admin's own activity before multi-user rollout. Display them as-is or as "Admin" in the UI. Migration is unnecessary overhead.

3. **Keep two separate routes or merge?** → **Merge.** Two pages that are each 50% useful is worse than one page that's 100% useful. Use internal tabs for organization.

4. **What about the 403 error on `getAllSessions` in Analytics?** → **Investigate during implementation.** Likely a Domo Code Engine publish issue. The function works — the manifest mapping exists. May need a re-publish of Code Engine.

5. **Should the admin view be access-controlled?** → **Not in Sprint 35.** All users see the same admin view. Access control (e.g., only managers see all users) is a follow-on feature if needed after rollout feedback.

---

## Rabbit Holes

- **Don't build a custom logging/audit framework.** Snowflake already has `CREATED_AT`, `UPDATED_AT`, `CREATED_BY` on every table. The data exists — we just need to query and display it. Don't create a separate `AUDIT_LOG` table.

- **Don't build real-time dashboards with auto-refresh.** The admin checks this periodically, not continuously. Load on mount, provide a refresh button. WebSocket or polling is overkill.

- **Don't rebuild the NLQ analyst from scratch.** The existing `askAnalyst` function works. Lift and shift it into the new tab. Don't rewrite the prompt engineering or result rendering.

---

## No-Gos

- No role-based access control in Sprint 35 — all users see the same admin view
- No data export (CSV/Excel) — follow-on feature
- No real-time notifications (Slack/email) when TDRs are completed
- No editing other users' TDR sessions from the admin view

---

## CURRENT State Reference

### Existing Pages

| Page | Route | Status | Data Source |
|------|-------|--------|-------------|
| TDR History | `/history` | Placeholder — 6 mock records, no API calls | Hardcoded `mockHistory` array |
| TDR Analytics | `/analytics` | Partially functional — session stats + NLQ | `getAllSessions` + `askAnalyst` |

### User Identity Status

| Component | Current `createdBy` value | Target |
|-----------|--------------------------|--------|
| `useTDRSession.ts` → `createSession` | `'current-user'` | `user.displayName` from Domo API |
| `TDRChat.tsx` → `sendChatMessage` | `'current-user'` | `user.displayName` from Domo API |
| `cortexAi.ts` → `generateBrief` | `'current-user'` | `user.displayName` from Domo API |
| `accountIntel.ts` → `runIntelligence` | `'current-user'` | `user.displayName` from Domo API |

### Snowflake Tables Available for Admin Queries

| Table | Key Columns for Admin |
|-------|----------------------|
| `TDR_SESSIONS` | SESSION_ID, OPPORTUNITY_NAME, ACCOUNT_NAME, CREATED_BY, STATUS, ITERATION, COMPLETED_STEPS, CREATED_AT, UPDATED_AT |
| `TDR_STEP_INPUTS` | SESSION_ID, STEP_ID, FIELD_ID, FIELD_VALUE, SAVED_AT, SAVED_BY |
| `TDR_CHAT_MESSAGES` | SESSION_ID, ROLE, PROVIDER, MODEL_USED, TOKENS_IN, TOKENS_OUT, CREATED_BY, CREATED_AT |
| `V_TDR_ANALYTICS` | View joining sessions + extracts + intel — includes `SE_NAME` (from CREATED_BY) |

### Existing Code Engine Functions

| Function | Returns | Used By |
|----------|---------|---------|
| `getAllSessions` | All sessions, no filtering | TDRAnalytics, deals table |
| `getPortfolioInsights(manager)` | Sessions filtered by CREATED_BY | Portfolio view |
| `askAnalyst(question)` | NLQ → SQL → answer | TDRAnalytics NLQ bar |

### Navigation (AppSidebar.tsx)

| Current | Proposed |
|---------|----------|
| Command Center `/` | Command Center `/` |
| TDR Workspace `/workspace` | TDR Workspace `/workspace` |
| History `/history` | **Admin** `/admin` (replaces History + Analytics) |
| Analytics `/analytics` | *(removed — merged into Admin)* |
| Documentation `/docs` | Documentation `/docs` |
| Settings `/settings` | Settings `/settings` |
