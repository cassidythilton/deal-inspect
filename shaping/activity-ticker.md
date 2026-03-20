---
shaping: true
status: draft
appetite: medium (3–5 days)
---

# Activity Ticker — Live Team Notifications

## Source

> "Now that we're going to be rolling this out to a broader user base i'd like to add some kind of a 'ticker' or notifier with live analytics (but simple) e.g. 'Chris Hunter just started TDR on XYZ account' or 'Tyler Clark completed TDR ABC since you last logged in'. you should take great care on the location of this new widget."

---

## Problem

As the TDR app moves from a single-user tool to a team-wide platform, **there is no awareness of what other users are doing**. An SE opening the app has no idea that a colleague just started a review on a strategic account, completed an iteration, or added inputs to a deal they both touch. This absence of social signal creates two compounding issues.

First, **duplicate effort is invisible**. Two SEs could independently begin TDRs on the same account without knowing the other is already deep into analysis. With seeded responses from Gong now pre-populating fields, the risk of parallel work increases — both SEs see the same proposed data and may each assume they're the first to act.

Second, **team momentum is invisible**. Managers and leads have no ambient awareness of how actively the tool is being adopted. The Admin page provides aggregated metrics, but you have to navigate there deliberately. A lightweight, always-visible signal of live activity creates social proof that drives adoption — "other people are using this, I should too."

The widget must be **non-intrusive** — it cannot steal focus from the primary workflow (deal table, TDR inputs, intelligence panel). It should feel like ambient awareness, not a notification center.

---

## Requirements

### R0: Ambient awareness of team TDR activity across all pages

- R0.1: Show recent activity from other users (not the current user's own actions)
- R0.2: Activity visible without navigating to a dedicated page

### R1: Human-readable activity messages

Messages should name the user and the account/deal, using natural language. Examples:
- "Chris Hunter started a TDR on Acme Corp"
- "Tyler Clark completed TDR on Snowflake Inc"
- "Laura Qualey saved 5 inputs on BigCo since you last visited"

### R2: Recency-aware — highlight what happened since last visit

Some events should be marked as "since you last logged in" to give returning users a catch-up digest. This requires tracking the user's last-seen timestamp.

### R3: Non-intrusive placement

The ticker must not compete with primary content (deals table, TDR inputs, intelligence panel). It should be peripheral — visible but ignorable. The user explicitly called out taking "great care on the location."

### R4: Live-ish updates without polling storms

Activity should feel current (within minutes, not hours) but must not hammer Snowflake or Code Engine with aggressive polling. A reasonable refresh cadence (60–120s) is acceptable.

### R5: Graceful when empty

When there's no recent team activity (e.g., single-user instance, weekend), the ticker should collapse or show a minimal empty state — never a loud "no activity" placeholder.

---

## Solution Shape [A: Header Ticker Strip]

### A1: Data Layer — Recent Activity Feed

| Part | Mechanism |
|------|-----------|
| **A1.1** | **New Code Engine function `getRecentActivity`.** [Cursor] Queries `TDR_SESSIONS` and `TDR_STEP_INPUTS` for the last 24 hours of activity, returning structured events: `{ type: 'started' | 'completed' | 'inputs', userName, accountName, opportunityName, count?, timestamp }`. SQL uses `CREATED_AT` / `UPDATED_AT` from `TDR_SESSIONS` for start/complete events and `SAVED_AT` from `TDR_STEP_INPUTS` (grouped by session) for input-save events. Excludes the requesting user's own activity via a `userName` parameter. Limits to 20 most recent events. |
| **A1.2** | **Manifest registration.** [Cursor] Add `getRecentActivity` to `manifest.json` (root, public, dist) `packageMapping` with `userName` input parameter. |
| **A1.3** | **snowflakeStore integration.** [Cursor] Add `getRecentActivity(userName: string)` method to `src/lib/snowflakeStore.ts`. Returns typed `ActivityEvent[]` interface. |

### A2: Last-Seen Tracking

| Part | Mechanism |
|------|-----------|
| **A2.1** | **localStorage last-seen timestamp.** [Cursor] On app mount (`MainLayout` or `App`), read `dealinspect:lastSeen` from localStorage. On window `beforeunload` or periodic heartbeat, write `Date.now()`. The ticker uses this to badge events that occurred after the stored timestamp as "new since last visit." No Snowflake write — purely client-side. |

### A3: Ticker UI Component

| Part | Mechanism |
|------|-----------|
| **A3.1** | **`ActivityTicker` component.** [Cursor] New `src/components/ActivityTicker.tsx`. Renders a slim horizontal strip that auto-scrolls through activity messages. Each message is a single line: icon + "**User** action on **Account**" + relative timestamp ("2m ago", "1h ago"). Messages older than `lastSeen` get no special treatment; messages newer than `lastSeen` get a subtle dot indicator. |
| **A3.2** | **Placement in `MainLayout` header.** [Cursor] Mount `ActivityTicker` inside the existing `<header>` bar in `src/layouts/MainLayout.tsx`, between the page title (left) and the "DealInspect | TDR" branding (right). The header is already `sticky top-0 z-30` and persists across all pages. The ticker occupies the natural center/right area and collapses to nothing when empty. This avoids adding new UI chrome — it lives inside existing real estate. |
| **A3.3** | **Auto-scroll / carousel behavior.** [Cursor] If there are multiple events, the ticker cycles through them with a CSS transition (fade or slide-up), showing one message at a time. Interval: 5 seconds per message. On hover, pause the rotation and show a small dropdown of the last ~5 events. This keeps the footprint to a single line of text in the header. |
| **A3.4** | **Polling cadence.** [Cursor] `ActivityTicker` calls `getRecentActivity` on mount and then every 90 seconds via `setInterval`. Uses a React ref to avoid re-render storms. Stale data is acceptable — this is ambient awareness, not real-time chat. |
| **A3.5** | **Empty state.** [Cursor] When no events exist, the ticker renders nothing (returns `null`) — the header looks exactly as it does today. No placeholder text, no "no activity" message. |
| **A3.6** | **Event icons.** [Cursor] Use existing lucide-react icons: `Play` for started, `CheckCircle2` for completed, `PenLine` for inputs saved. Tiny (h-3 w-3), muted color, inline with text. |

### A4: Activity Message Formatting

| Part | Mechanism |
|------|-----------|
| **A4.1** | **Message templates.** [Cursor] Three event types with templates: (1) Started: `"{user} started TDR on {account}"` (2) Completed: `"{user} completed TDR on {account}"` (3) Inputs: `"{user} saved {count} inputs on {account}"`. User names use the same `humanizeName` pattern from `TDRAdmin.tsx` (convert `'current-user'` → display name). Account names truncated to ~30 chars with ellipsis if needed. |
| **A4.2** | **Relative timestamps.** [Cursor] "just now", "2m ago", "1h ago", "3h ago", "yesterday". Simple helper function, no library dependency. |
| **A4.3** | **"New" indicator.** [Cursor] Events with `timestamp > lastSeen` show a small pulsing dot (same pattern as the "typing…" indicator in TDRInputs). Dot disappears after the user has been on the page for 30 seconds (they've "seen" it). |

---

## Fit Check: R × A

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | Ambient awareness of team TDR activity across all pages | Core goal | ✅ (A3.2 — header placement persists across all routes) |
| R0.1 | Show recent activity from other users (not current user) | Core goal | ✅ (A1.1 — SQL excludes requesting user) |
| R0.2 | Activity visible without navigating to a dedicated page | Core goal | ✅ (A3.2 — lives in global header) |
| R1 | Human-readable activity messages | Must-have | ✅ (A4.1 — natural language templates) |
| R2 | Recency-aware — highlight what happened since last visit | Must-have | ✅ (A2.1 + A4.3 — localStorage lastSeen + pulsing dot) |
| R3 | Non-intrusive placement | Must-have | ✅ (A3.2 — inside existing header, A3.5 — collapses when empty) |
| R4 | Live-ish updates without polling storms | Must-have | ✅ (A3.4 — 90-second polling interval) |
| R5 | Graceful when empty | Must-have | ✅ (A3.5 — renders null when no events) |

---

## Resolved Questions

1. **Where does the ticker live?** → **Inside the existing `MainLayout` header bar.** The header is already sticky, persistent across all pages, and has available space between the page title and the branding cluster. This avoids adding new UI chrome (no new bar, no sidebar section, no floating widget). The ticker is just text that appears in the header when there's activity.

2. **Should the ticker show the current user's own activity?** → **No.** You already know what you did. The value is seeing what *others* are doing. The SQL query filters by `userName != ?`.

3. **Should this poll Snowflake directly or use a Snowflake Stream/Task?** → **Direct query with 90s polling.** The query is lightweight (last 24h, limit 20, two tables). A Stream/Task architecture would be over-engineered for the event volume (~50–200 events/day across the team). If the user base grows to hundreds, revisit with a materialized recent-activity view.

4. **Should activity persist in a dedicated table?** → **No — query existing tables.** `TDR_SESSIONS` already has `CREATED_AT`, `UPDATED_AT`, `STATUS`, and `CREATED_BY`. `TDR_STEP_INPUTS` has `SAVED_AT` and `SAVED_BY`. These are sufficient to derive started/completed/inputs events without a new table.

5. **Auto-scroll vs. static list?** → **Auto-scroll (one message at a time) with hover-to-expand.** A static list of 5+ events would dominate the header. A single rotating message is ambient; hover reveals more for the curious.

6. **What about the "since you last logged in" summary?** → **Client-side via localStorage.** A `lastSeen` timestamp stored locally is sufficient. Events newer than `lastSeen` get a dot indicator. No server-side session tracking needed.

---

## Rabbit Holes

- **Don't build a WebSocket/SSE real-time feed.** The Domo Code Engine doesn't support persistent connections. Polling every 90s is good enough for "ambient awareness" and avoids architecture complexity that buys almost nothing for a team of 10–50 users.

- **Don't add a notification bell with unread counts.** That's a notification center, not a ticker. It creates anxiety ("I have 12 unread notifications") and obligation to clear them. The ticker is intentionally ephemeral — it shows what's happening now, not a queue to process.

- **Don't try to deduplicate across the `current-user` / display name mismatch in the SQL.** Handle normalization on the frontend (already solved in TDRAdmin leaderboard). The SQL just returns raw `CREATED_BY` / `SAVED_BY`.

- **Don't add click-through navigation from ticker events to specific sessions.** Tempting, but it changes the ticker from "ambient awareness" to "navigation widget" and increases scope. If users want to find a session, they use the deals table or search. Revisit in a follow-up sprint if demand surfaces.

---

## No-Gos

- No new Snowflake tables — derive all activity from existing `TDR_SESSIONS` + `TDR_STEP_INPUTS`
- No WebSocket or server-sent events — poll only
- No notification badge/count — ephemeral ticker only
- No click-to-navigate from ticker messages (defer to follow-up)
- No changes to the sidebar — ticker lives in the header

---

## CURRENT State Reference

### Existing header (`MainLayout`)

```
┌──────────────────────────────────────────────────────────────────┐
│  COMMAND CENTER                              DealInspect │ TDR  │
└──────────────────────────────────────────────────────────────────┘
```

The header is 40px tall (`h-10`), sticky, semi-transparent with backdrop blur. Left side has the page title. Right side has "DealInspect | TDR" branding. **The entire center is empty** — natural home for the ticker.

### Proposed header with ticker

```
┌──────────────────────────────────────────────────────────────────┐
│  COMMAND CENTER    ● Chris Hunter started TDR on Acme · 2m ago  │
│                                                 DealInspect│TDR │
└──────────────────────────────────────────────────────────────────┘
```

Single rotating message, right-aligned before the branding cluster. Pulsing dot for "new since last visit" events.

### Data sources for activity events

| Source Table | Event Type | Key Columns |
|---|---|---|
| `TDR_SESSIONS` | started | `CREATED_BY`, `ACCOUNT_NAME`, `OPPORTUNITY_NAME`, `CREATED_AT` |
| `TDR_SESSIONS` | completed | `CREATED_BY`, `ACCOUNT_NAME`, `OPPORTUNITY_NAME`, `UPDATED_AT`, `STATUS='completed'` |
| `TDR_STEP_INPUTS` | inputs saved | `SAVED_BY`, `SESSION_ID` (join to sessions for account), `SAVED_AT`, `COUNT(*)` |

### Sprint Integration

This feature would become **Sprint 38 — Activity Ticker** (after Sprint 37 Prescriptive TDR Actions completes, before MLOps Sprints 32c–e).

Estimated effort: **3–5 days**
- 38a: Code Engine function + manifest (0.5 day) [Cursor]
- 38b: `ActivityTicker` component + header integration (1–2 days) [Cursor]
- 38c: Last-seen tracking + "new" indicators (0.5 day) [Cursor]
- 38d: Polish — animation, empty states, edge cases (0.5–1 day) [Cursor]
