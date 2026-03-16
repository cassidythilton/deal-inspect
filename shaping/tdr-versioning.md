---
shaping: true
status: draft
appetite: medium (3–5 days)
---

# TDR Versioning — Iteration Lifecycle & Version Switching

## Source

> "when i went into the ips deal just now i can see inputs that i did last week (great). what i don't see is a clear path to do another tdr (new version). what should this look like? i'm imagining a combination of former inputs, coupled with ai generated seeded content and the opportunity to create a net new version (v1,v2,v3, etc.) with the ability to also toggle between versions."

---

## Problem

When an SE returns to a deal they've already worked, the TDR inputs from the prior session are visible — but there's **no clear path to start a new iteration**. The current "New Iteration" button only appears in narrow conditions (session completed or prior sessions exist), and even when it does appear, it's easy to miss. The SE needs to be able to say "the deal has evolved, I want to do a fresh TDR pass" without losing what they did before.

More critically, once a new iteration is created, **there's no way to go back and view prior versions**. The `previousSessions` data is fetched from Snowflake but never exposed in the UI. An SE who completed a TDR in week 1 and starts a new one in week 3 cannot compare their assessments or see how the deal has evolved. This defeats the purpose of versioning — the history exists in the database but is invisible.

The third gap is the **merge between human inputs and AI-seeded content**. When starting a new version, the SE wants to see their prior inputs as defaults (not blank fields), overlaid with any new AI-generated seeded values from Cortex (Sprint 32b). The current `priorInputValues` mechanism exists in memory but is fragile — it only works during the same browser session and is lost on page reload. Seeded values from the `opportunitiesmagic` dataset (`SeedCustomerDecision`, `SeedStrategicValue`, etc.) should fill in gaps where the SE hasn't yet provided input.

---

## Requirements

### R0: Enable SEs to create successive TDR versions for a deal and navigate between them

- R0.1: A clear, always-visible "New TDR" action when viewing a deal with an existing session
- R0.2: Version selector (v1, v2, v3...) to toggle between iterations without data loss

### R1: Prior inputs carry forward as defaults into new versions

When starting v2, all v1 field values pre-populate as editable defaults. The SE can accept, modify, or clear each one. This eliminates redundant re-entry for fields that haven't changed.

### R2: AI-seeded content fills gaps alongside prior inputs

For fields where the SE hasn't provided input in any prior version, AI-seeded values from the `opportunitiesmagic` dataset (Sprint 32b `Seed*` columns) serve as suggestions. The priority chain is: saved input (current version) > prior version input > AI-seeded value > empty.

### R3: Prior versions are read-only and always accessible

Completed TDR versions become read-only snapshots. The SE can view them but not edit. Only the current in-progress version is editable.

### R4: Version metadata is visible in the workspace header

The current iteration number, creation date, and status (in-progress vs completed) are clearly displayed. Prior versions show when they were completed.

### R5: Chat history is scoped to the active version

Each TDR version has its own chat history. Switching versions switches the visible chat. The Gong digest and KB context persist across versions (they're deal-level, not version-level).

### R6: Completing a version marks it as a snapshot

An explicit "Complete TDR" action finalizes the current version, sets `status: completed`, and records a timestamp. This is the trigger that makes the version read-only and enables a new version to be created.

---

## Solution Shape [A: Version Lifecycle with Switcher]

### A1: Version Selector UI `[Cursor]`

| Part | Mechanism |
|------|-----------|
| **A1.1** | **Version switcher dropdown.** In `TDRWorkspace.tsx` header bar (where `TDR #N` pill currently lives), replace the static pill with a `<Select>` dropdown listing all sessions for this opportunity, ordered by iteration. Each option shows `v{iteration}` + status badge (in-progress / completed) + creation date. Selecting switches the active session. |
| **A1.2** | **"New TDR" button.** Always visible when a deal has at least one existing session. Positioned next to the version selector. Calls `startNewIteration()` from `useTDRSession`. Disabled while the current session has zero completed steps (prevent empty versions). |
| **A1.3** | **"Complete TDR" button.** Replace or augment the existing "Mark Complete" checkbox with a clear action button. Calls `completeSession()`, which sets `status: 'completed'` and records `updatedAt`. After completion, the version selector updates to show the completed badge. |

### A2: Session Switching Logic `[Cursor]`

| Part | Mechanism |
|------|-----------|
| **A2.1** | **`switchToSession(sessionId)` in `useTDRSession.ts`.** New function that loads a different session for the same opportunity. Fetches inputs via `snowflakeStore.getLatestInputs(sessionId)`, rebuilds `inputValues` map, loads `completedSteps`, and sets the session as active. If the target session is completed, sets an `isReadOnly` flag. |
| **A2.2** | **Read-only mode propagation.** `useTDRSession` exposes `isReadOnly: boolean`. `TDRInputs.tsx` disables all fields (inputs, selects, textareas) and hides accept/dismiss buttons when `isReadOnly` is true. `TDRSteps.tsx` disables step completion toggles. Visual indicator (lock icon or muted styling) signals the version is frozen. |
| **A2.3** | **`previousSessions` exposed in return type.** Update `UseTDRSessionReturn` interface to include `previousSessions: AppDbSession[]` and `switchToSession: (sessionId: string) => void`. Currently these exist in the hook but aren't in the type definition. |

### A3: Prior Input Carry-Forward `[Cursor]`

| Part | Mechanism |
|------|-----------|
| **A3.1** | **Server-side prior input fetch.** When `startNewIteration()` creates a new session, the hook immediately loads the prior session's inputs from Snowflake (not from in-memory `priorInputValues`). This survives page reloads. Stored as `priorInputValues` in the hook state. |
| **A3.2** | **Priority chain in `getFieldValue`.** Already exists in `TDRInputs.tsx`: saved > prior > seeded > empty. Ensure it works with server-fetched `priorInputValues` (not just in-memory). The `priorInputValues` prop already flows from `TDRWorkspace` → `TDRInputs`; the change is in where the data originates. |

### A4: Version-Scoped Chat `[Cursor]`

| Part | Mechanism |
|------|-----------|
| **A4.1** | **Chat follows session.** `TDRChat` already receives `sessionId` as a prop. When `switchToSession` changes the active session, the `sessionId` prop updates, triggering `useEffect` to reload chat history for the new session. No code change needed — this works automatically because `sessionId` is already reactive. |

### A5: `TDRSessionSummary` Enhancement `[Cursor]`

| Part | Mechanism |
|------|-----------|
| **A5.1** | **Add iteration to `TDRSessionSummary`.** Update `src/types/tdr.ts` to include `iteration: number` and `completedAt?: string` on `TDRSessionSummary`. Update `toAppDbSession` in `snowflakeStore.ts` to map `ITERATION` from the session row. |

---

## Fit Check: R × A

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | Enable SEs to create successive TDR versions and navigate between them | Core goal | ✅ (A1.1, A1.2, A2.1) |
| R0.1 | Clear, always-visible "New TDR" action | Must-have | ✅ (A1.2) |
| R0.2 | Version selector to toggle between iterations | Must-have | ✅ (A1.1, A2.1) |
| R1 | Prior inputs carry forward as defaults into new versions | Must-have | ✅ (A3.1, A3.2) |
| R2 | AI-seeded content fills gaps alongside prior inputs | Must-have | ✅ (A3.2 — priority chain already handles this) |
| R3 | Prior versions are read-only and always accessible | Must-have | ✅ (A2.1, A2.2) |
| R4 | Version metadata visible in workspace header | Must-have | ✅ (A1.1) |
| R5 | Chat history scoped to active version | Must-have | ✅ (A4.1) |
| R6 | Completing a version marks it as a snapshot | Must-have | ✅ (A1.3) |

---

## Resolved Questions

1. **Should the "New TDR" button require the current version to be completed first?** → **No.** The SE should be able to start a new version at any time, but the current version should have at least one completed step to prevent empty versions piling up. An in-progress v1 remains accessible alongside an in-progress v2.

2. **Should prior inputs be fetched from the server or carried in memory?** → **Server.** The current in-memory `priorInputValues` approach breaks on page reload. The new iteration should fetch the prior session's inputs from Snowflake via `getLatestInputs(priorSessionId)` during initialization.

3. **Should chat be version-scoped or deal-scoped?** → **Version-scoped.** Each session already has its own `sessionId` that scopes chat messages. This is the natural boundary. Gong digest and KB context are deal-level and don't need re-scoping.

4. **Can multiple versions be in-progress simultaneously?** → **Yes.** The SE might start a new version without completing the prior one. Both remain editable. The version selector shows status badges to distinguish.

---

## Rabbit Holes

- **Don't build a full diff/comparison view between versions.** Tempting, but the value is in switching — not side-by-side comparison. A comparison view is a follow-on feature if versioning proves useful. Ship switching first.

- **Don't migrate the `TDR_STEP_DEFINITIONS` table into active use.** The table exists in `bootstrap.sql` but has never been populated or queried. Versioning is about session iterations, not step schema evolution. Keep `stepSchemaVersion` at `'v1'` for now.

- **Don't auto-complete versions.** It's tempting to auto-complete v1 when the SE starts v2, but the SE might want both in-progress. Let them manage status explicitly.

---

## No-Gos

- No deletion of prior versions — completed sessions are permanent audit records
- No bulk version creation (e.g., "copy this TDR to 5 other deals")
- No cross-deal version comparison
- No schema version changes (`stepSchemaVersion` stays `'v1'`)

---

## CURRENT State Reference

### TDR_SESSIONS Table (Snowflake)

| Column | Type | Notes |
|--------|------|-------|
| SESSION_ID | VARCHAR | UUID, primary key |
| OPPORTUNITY_ID | VARCHAR | Links to deal |
| ITERATION | INTEGER | `MAX(ITERATION)+1` on create |
| STATUS | VARCHAR | `'in-progress'` or `'completed'` |
| STEP_SCHEMA_VERSION | VARCHAR | Always `'v1'` |
| COMPLETED_STEPS | VARIANT | JSON array of step IDs |
| NOTES | VARCHAR | Free text |
| CREATED_AT | TIMESTAMP | Auto-set |
| UPDATED_AT | TIMESTAMP | Auto-set |

### Existing Version UI (TDRWorkspace.tsx header)

- Static pill: `TDR #{session.iteration || 1}`
- "X prior" count badge (shows `previousSessions.length` but not clickable)
- "New Iteration" button (conditional, only when completed or prior sessions exist)

### Field Value Priority Chain (TDRInputs.tsx `getFieldValue`)

```
1. Local draft (inputValues map — current unsaved edits)
2. Saved input (from Snowflake for current session)
3. Prior version input (priorInputValues — currently in-memory only)
4. AI-seeded value (Seed* columns from opportunitiesmagic dataset)
5. Empty string
```

### Key Files

| File | Role |
|------|------|
| `src/hooks/useTDRSession.ts` | Session lifecycle, `startNewIteration`, input loading |
| `src/pages/TDRWorkspace.tsx` | Header bar, session status pill, "New Iteration" button |
| `src/components/TDRInputs.tsx` | Field rendering, `getFieldValue` priority chain |
| `src/components/TDRSteps.tsx` | Step progress, completion toggles |
| `src/types/tdr.ts` | `TDRSessionSummary`, `Deal` |
| `src/lib/snowflakeStore.ts` | `createSession`, `getSessionsByOpp`, `getLatestInputs` |
| `codeengine/consolidated-sprint4-5.js` | `createSession` (iteration logic), `updateSession` |
