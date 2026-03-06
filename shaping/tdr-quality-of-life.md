---

## shaping: true

status: draft
appetite: medium (3–5 days across 2 sprints)

# TDR Quality-of-Life Improvements

## Source

> TDR Steps improvements:
>
> 1. add ability to drag text boxes for larger view
> 2. The "mark complete" box has to be selected manually and I don't like it. This should be semi-automated. Add functionality that essentially auto-saves in each step based on certain completeness.
> 3. What happens if I want to add a second response, or series of responses to a TDR at a later date? We should add a versioning capability.
> 4. The "in scope layers" should be changed to save as pills/tags to be used later for analytics. etc. Add the ability to enter the text and when hitting enter it turns into a pill/tag (with the ability to delete as well).
> 5. We need to make the AI & ML steps apart of the core TDR. We also need to make this a more rigorous piece that spans teasing out whether there's an opportunity for rules based automation, traditional machine learning models, generative AI, or fully agentic solutions. This does not need to be a deep dive but it should strategically surface the most critical elements of a potential AI & ML opportunity in the deal. See ai-value-continuum.png, what-to-look-for.png, Practitioners Series Problem Framing Worksheet (1).pdf for inspiration.
> 6. There are a few requisite items out to right that need to be performed in order for a fully built out pdf to be generated (via slack, etc.). It's unclear which "buttons to push" to generate all the things (tdr brief, action plan, enrich, research, etc.) and which order the user should do it in. Analyze this part of the app and rework for a much more straightforward experience.
> 7. The technical landscape pills are primarily driven by Sumble but could also include specific tech cited in the perplexity call as well e.g. Papa Johns perplexity pull cited Alteryx. I'd expect to see "Alteryx" as a pill in the technical landscape as a pill with the perplexity logo.
> 8. Oftentimes, there are not adequate information for a field which can mean that a gap has been identified in the deal strategy. Does it make sense to incorporate some kind of "gap identified" indication?
> 9. After generating a tdr brief via "Generate TDR brief" I have to run another process when sending via slack. Is this necessary? Is this different from the other tdr brief, action plan, etc.? Perhaps there's a performance improvement opportunity here? Need to verify.
> 10. The tech stack pills in slack pdf are not colored. They should match the same colors as the app.
> 11. When adding a new manager in settings, it does not show up in the dropdown.
> 12. In addition to the already designed shaping/ai-enhanced-tdr-responses.md, we need to take a look at a vastly improved and more efficient TDR process with a refined set of steps. That said, any changes should align to the already designed schema and table structure in Snowflake as much as possible. A few thoughts..
>   a. change "key stakeholders" to "key technical stakeholders"
>     b. rethink the business decision step. it seems to me this can be reduced
>     c. in the architecture step, it seems the system of record, architectural truth, what changes in target state, pain points are somewhat redundant
>     d. in the composable role step, entry layer should be a multi-select rather than single select. or perhaps entry layer, follow-on layer, etc.
>     e. entry layer vs. in scope layers seems redundant
>     f. is out of scope necessary? maybe? maybe not, perhaps they can be optimized
>     g. rethink the items in the additional context section, perhaps they're necessary, perhaps not, perhaps they can be optimized (aside from the ai & ml step mentioned above).
> 13. I will need to approve the redesigned steps.
> 14. also make sure pdf is reworked per new steps

---

## Problem

The TDR process works — SEs can complete a review and generate artifacts. But the current workflow has friction at multiple levels:

**Step structure is too granular.** 9 steps with 25+ fields across required and optional sections. Several fields overlap (Entry Layer vs. In-Scope Layers, System of Record vs. Architectural Truth vs. What Changes in Target State). The Business Decision step could be tighter. The Additional Context steps (Target Architecture, Partner, AI Strategy, Usage) are optional and loosely structured. The result: SEs either skip optional steps entirely or spend too long on required ones.

**AI & ML is underweighted.** The current "AI Strategy & Data Science" step has just two fields — a select ("AI Reality Check": Production/Piloting/Roadmap/Not applicable) and a textarea ("Autonomous Decision Potential"). For an SE team at a company that sells AI-powered analytics, this is far too thin. There's no structured framework for distinguishing rules-based automation from ML from GenAI from agentic solutions, and no way to surface the most critical elements of an AI opportunity in a deal.

**Step completion is manual and tedious.** The "Mark Complete" button is a manual checkbox that must be clicked per-step. There's no intelligence about whether a step is actually complete — a step with one word in one field can be "completed" while a step with all fields filled but unchecked looks incomplete.

**The Intelligence Panel workflow is opaque.** To generate a fully built-out PDF for Slack distribution, the user must: (1) Enrich via Sumble, (2) Research via Perplexity, (3) Generate Action Plan, (4) Generate TDR Brief — then separately trigger "Share to Slack" which regenerates the brief. The sequence isn't communicated. The relationship between "Generate TDR Brief" and the Slack PDF is unclear. Users don't know what buttons to push or in what order.

**Several smaller irritants compound.** Textareas can't be resized for longer responses. In-scope layers save as free text instead of structured tags. Tech landscape pills miss Perplexity-cited technologies. The Slack PDF renders tech stack pills without colors. Adding a manager in Settings doesn't update the filter dropdown. Versioning (adding follow-up responses to a TDR at a later date) isn't clearly exposed.

---

## Requirements

### R0: TDR step structure must be consolidated and AI-reweighted

The current 9 steps / 25+ fields should be reduced to fewer, broader steps. Redundant fields (Entry Layer / In-Scope Layers, System of Record / Architectural Truth / Target State Change) must be consolidated. The AI & ML assessment must become a core step with a structured framework that spans the AI value continuum (rules-based automation → traditional ML → generative AI → agentic solutions). Changes must align to the existing Snowflake schema and table structure as much as possible (field IDs in `TDR_STEP_INPUTS` are strings — adding/renaming fields is low-risk; removing fields requires migration consideration). **Redesigned steps require explicit user approval before implementation.**

- R0.1: Reduce total step count by consolidating overlapping fields
- R0.2: AI & ML becomes a rigorous core step with structured AI value continuum framework
- R0.3: Specific field changes: "Key Stakeholders" → "Key Technical Stakeholders"; Entry Layer → multi-select; evaluate necessity of Out of Scope, Business Decision reduction, Additional Context optimization
- R0.4: PDF readout must reflect the new step structure
- R0.5: Reference materials reviewed and incorporated: `samples/ai-value-continuum.png`, `samples/what-to-look-for.png`, `samples/Practitioners Series Problem Framing Worksheet (1).pdf`

### R1: Step completion should be semi-automated

Step completion should be driven by field completeness, not a manual checkbox. When required fields in a step are filled with substantive content, the step should auto-complete (or at minimum, strongly suggest completion). The manual "Mark Complete" override remains available for edge cases.

### R2: Textarea fields should be resizable

Textarea fields need a drag handle or expand affordance so SEs can enlarge them for longer responses. This is especially important for fields like "Proposed Solution Detail" and "Data Flow" where responses can be multi-paragraph.

### R3: In-Scope Layers should be structured as pills/tags

The "In-Scope Layers" field (currently a textarea) should accept text input that converts to pills/tags on Enter. Each pill is individually deletable. The structured format enables analytics (which Domo layers appear most in deals?) and cross-deal comparison. The tag set should be open (SEs can type any value) but can suggest common options.

### R4: Intelligence Panel workflow must be guided and streamlined

The sequence of actions to produce a complete readout must be obvious to a first-time user. Options: (a) guided wizard/checklist showing what's been done and what's next, (b) a single "Prepare Readout" action that orchestrates all steps, or (c) clear visual indicators of prerequisite completion. The Slack share process should not require re-generating the TDR brief if it already exists — cache and reuse.

- R4.1: The "Generate TDR Brief" and "Share to Slack" relationship must be clear (or unified)
- R4.2: Redundant processing between brief generation and Slack distribution should be eliminated

### R5: Tech landscape must incorporate all data sources with provenance

Technical landscape pills should include technologies cited by Perplexity (e.g., "Alteryx" from a Papa Johns research pull), not just Sumble. Each pill should indicate its source (Sumble logo, Perplexity logo, or Cortex logo). The Slack PDF must render tech stack pills with the same colors as the app.

### R6: TDR versioning must support follow-up iterations

A user should be able to return to a previously completed TDR and add a second (or Nth) set of responses — a new iteration that preserves the original. The iteration history should be visible and navigable. The current `iteration` column in Snowflake supports this, but the UX doesn't clearly expose it.

### R7: Data gaps should surface as actionable indicators

When a field has insufficient information (empty, or very terse for a textarea), the system should surface a "gap identified" indicator. This isn't punitive — it's diagnostic. It tells the SE Manager that a deal strategy gap exists in this area, which is itself useful intelligence (e.g., "Architecture gap identified — no system of record documented").

### R8: Settings changes must immediately reflect in filters

Adding a manager in the Settings page must immediately update the `ALLOWED_MANAGERS` list and the AE Manager dropdown in the Command Center. Currently, the Settings page writes to `appSettings.allowedManagers` in localStorage, but the dropdown reads from the hardcoded `ALLOWED_MANAGERS` constant in `src/lib/constants.ts`. These are disconnected.

---

## Solution Shape A: Two-Sprint Delivery

The items naturally split into two workstreams based on dependency and risk:

### A1: Quick Fixes & Intelligence Workflow (Sprint 30 additions)

Items that don't require TDR step restructuring and can ship independently.


| Part     | Mechanism                                                                                                                                                                                                                                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1.1** | **Settings → Filter bridge.** Read `appSettings.allowedManagers` from localStorage in `useDomo.ts` and merge with `ALLOWED_MANAGERS` constant. The constant becomes the default; Settings additions are additive. Dropdown immediately reflects changes.                                                                                                         |
| **A1.2** | **Perplexity tech pills.** In `TDRIntelligence.tsx`, extract technology names from `perplexityData.technologySignals` (currently narrative text) using a lightweight regex or the existing Cortex entity extraction. Render as pills with a Perplexity source icon alongside Sumble pills.                                                                       |
| **A1.3** | **Slack PDF tech pill colors.** In `src/components/pdf/TDRReadoutDocument.tsx`, apply `TECH_CATEGORY_STYLES` color mapping to tech stack pills (currently rendering without color). Match app appearance.                                                                                                                                                        |
| **A1.4** | **Intelligence Panel guided workflow.** Add a "Readout Checklist" sidebar or inline indicator to the Intelligence Panel showing: ☐ Enrich (Sumble) → ☐ Research (Perplexity) → ☐ Generate Action Plan → ☐ Generate TDR Brief. Each item shows status (not started / complete / stale). The checklist communicates the recommended sequence without enforcing it. |
| **A1.5** | **Slack share caching.** In `tdrReadout.shareToSlack()`, check if a TDR brief and PDF were recently generated (within the session). If so, reuse instead of regenerating. Skip the redundant `generateReadoutSummary()` call if the summary hasn't changed since last generation.                                                                                |
| **A1.6** | **Gap indicator.** Add a subtle "Gap" badge to: (a) textarea fields that are empty or < ~15 chars when sibling fields are filled, (b) select fields set to "Unknown" or equivalent (e.g., `ai-data` = "Unknown / needs discovery"), (c) contradiction states (e.g., `ai-level` = "No AI Opportunity" but positive signals selected). Non-blocking visual cue. Step header shows count: "2 gaps identified." Aggregates in session summary. |


### A2: TDR Framework Redesign (Sprint 31 — new sprint)

Structural changes to the TDR step framework. Requires user approval before implementation.


| Part     | Mechanism |
| -------- | --------- |
| **A2.1** | **Step consolidation — APPROVED.** 9 steps → 5 steps. See "Approved Step Design" section below for exact field-by-field specification. |
| **A2.2** | **AI & ML core step — APPROVED.** 5 fields grounded in three Domo SKO frameworks. Plain English labels, level-specific dynamic hints, multi-select data readiness. "Unknown / needs discovery" triggers gap indicator per R7. See detailed design below. |
| **A2.3** | **Field-level changes — APPROVED.** "Key Stakeholders" → "Key Technical Stakeholders". Entry Layer + In-Scope Layers → single multi-select "Domo Layers" (pills). System of Record + Architectural Truth + Pain Points → "Current Architecture & Constraints". Target Change + Proposed Solution + Data Flow + Integration Points → "Target Architecture & Data Flow". Why Composition → "Why Domo Wins Here" (concrete prompt). Out of Scope kept as optional. |
| **A2.4** | **Pill/tag inputs.** Domo Layers (multi-select with autocomplete, custom values allowed, stored as JSON array). AI Opportunity Signals (multi-select with preset options). AI Data Readiness (multi-select). All pill components use `react-select` creatable or similar existing library. |
| **A2.5** | **Textarea resize handles.** Add CSS `resize: vertical` (or a drag handle component) to all textarea fields. Minimum height preserved; SEs can drag to expand. State does not need to persist — resize is per-session. |
| **A2.6** | **Semi-automated step completion.** Step auto-completes when all required fields have substantive content (>15 chars for textareas, any non-"Unknown" selection for selects). Select fields set to "Unknown" or equivalent trigger a gap indicator (R7) but do not block auto-completion. Manual override preserved. `completedSteps` array in Snowflake updated on auto-complete. |
| **A2.7** | **TDR versioning UX.** Expose the existing `iteration` support in the UI. When a deal already has a completed TDR session, show "Start New Iteration" button. Previous iterations are visible in a collapsible history view (read-only). Each iteration is a complete TDR pass. Diff view between iterations is a future nice-to-have (not in scope here). |
| **A2.8** | **PDF readout update.** Update `TDRReadoutDocument.tsx` to reflect the new 5-step structure — new step names, new field layout, consolidated sections. The PDF matches the app's step structure 1:1. |


---

## ✅ Approved Step Design (User-approved — locked)

### Step 1: Deal Context (required)
*Merges: Context + Business Decision*

| Field ID | Label | Type | Required? | Notes |
|----------|-------|------|-----------|-------|
| `strategic-value` | Strategic Value | select (High/Med/Low) | Yes | Unchanged |
| `customer-goal` | Customer Decision | textarea | Yes | Forcing function: "X so they can Y" |
| `why-now` | Why This Deal Matters Now | textarea | Yes | Unchanged |
| `key-technical-stakeholders` | Key Technical Stakeholders | text | No | Renamed from `key-stakeholders` |
| `timeline` | Decision Timeline | select (This Quarter/Next Quarter/6+ Months) | No | Moved from Business Decision |

**Dropped:** `success-criteria` — subsumed by Adoption & Success step.

### Step 2: Technical Architecture (required)
*Merges: Architecture + Domo's Composable Role + Target Architecture Detail*

| Field ID | Label | Type | Required? | Notes |
|----------|-------|------|-----------|-------|
| `cloud-platform` | Cloud / Data Platform | select | Yes | Unchanged options |
| `current-state` | Current Architecture & Constraints | textarea | Yes | **Merges** system-of-record + arch-truth + pain-points. Hint: "What is the current system of record, what architectural constraint must we accept, and what hurts?" |
| `target-state` | Target Architecture & Data Flow | textarea | Yes | **Merges** target-change + proposed-solution + data-flow + integration-points. Hint: "What does the target architecture look like? How will data flow through the system?" |
| `domo-layers` | Domo Layers | multi-select (pills) | Yes | **Merges** entry-layer + in-scope. Options: Data Integration, Data Warehouse, Visualization/BI, Embedded Analytics, App Development, Automation/Alerts, AI/ML. Custom values allowed. Stored as JSON array. |
| `out-of-scope` | Out of Scope | textarea | No | "What is explicitly NOT Domo's job?" Kept as explicit boundary declaration. |
| `why-domo` | Why Domo Wins Here | textarea | No | Renamed from `why-composition`. Hint: "Given the architecture constraints, why is Domo the right solution over alternatives? What specific capability or integration gives Domo the edge in this deal?" |

**Dropped:** `compute-alignment` — captured in `target-state` when relevant.

### Step 3: Risk & Verdict (required)
*Merges: Risk + Partner*

| Field ID | Label | Type | Required? | Notes |
|----------|-------|------|-----------|-------|
| `top-risks` | Top 1–2 Technical Risks | textarea | Yes | Unchanged |
| `key-assumption` | Key Assumption | textarea | Yes | Forcing function: single falsifiable belief |
| `verdict` | Verdict | select | Yes | Proceed / Proceed with Corrections / Rework Before Advancing |
| `partner-name` | Key Partner | text | No | Moved from Partner step |
| `partner-posture` | Partner Posture | select | No | Amplifying / Neutral / Conflicting / None. Moved from Partner step — partner posture is a risk/opportunity signal. |

### Step 4: AI & ML Opportunity Assessment (required — NEW core step)
*Replaces: AI Strategy & Data Science (was optional, 2 fields)*

| Field ID | Label | Type | Required? | Notes |
|----------|-------|------|-----------|-------|
| `ai-level` | AI Opportunity Level | select | Yes | **Plain English labels with subtitles:** **Rules & Automation** — Automate a repeatable process (alerts, ETL, scheduled workflows) · **Predictive AI** — Predict an outcome (who will churn, what will sell, where's the risk) · **Generative AI** — Generate or summarize content (reports, insights, recommendations) · **Autonomous AI (Agentic)** — AI that takes action (multi-step tasks, tool use, autonomous decisions) · **No AI Opportunity Identified** |
| `ai-signals` | Opportunity Signals | multi-select (pills) | Yes | Manual review loops · Reactive decisions (fire drills, escalations) · Stalled AI pilots (demo works, nothing ships) · Prediction would change the outcome · Workflow bottlenecks (handoffs, approvals, queue time) · None identified |
| `ai-problem` | Problem Statement | textarea | Yes | **Dynamic hint based on `ai-level`:** Rules & Automation → "What process is manual and repeatable? What rules would govern it? Where are the bottlenecks?" · Predictive AI → "What outcome do you want to predict? What decision does the prediction enable? What happens if you know the answer earlier?" · Generative AI → "What content is being created manually? What would the AI summarize, generate, or explain? Who consumes the output?" · Autonomous AI → "What goal should the agent pursue? What tools or systems does it need access to? Where do humans stay in the loop?" · No AI Opportunity → field hidden |
| `ai-data` | Data Readiness | multi-select (pills) | Yes | **Structured data** (CRM, ERP, databases, spreadsheets) · **Unstructured data** (documents, emails, tickets, images) · **No data today** · **Unknown / needs discovery**. SE can select both Structured + Unstructured. Selecting "No data today" or "Unknown / needs discovery" clears other selections. **"Unknown / needs discovery" triggers a gap indicator per R7.** |
| `ai-value` | Value & Accountability | textarea | Yes | **Dynamic hint based on `ai-level`:** Rules & Automation → "How much time is spent on this process today? What's the error rate? How would you know the automation is working?" · Predictive AI → "What's the cost of a wrong prediction? What's the value of a right one? What metric proves the model works?" · Generative AI → "How much time is spent creating this content manually? What quality bar must the output meet? How do you catch a bad generation?" · Autonomous AI → "What's the risk if the agent makes a wrong decision? What guardrails are needed? What does success look like after 90 days?" · No AI Opportunity → field hidden |

### Step 5: Adoption & Success (optional)
*Streamlines: Usage & Adoption Detail*

| Field ID | Label | Type | Required? | Notes |
|----------|-------|------|-----------|-------|
| `expected-users` | Expected Users | text | No | Unchanged |
| `adoption-success` | Adoption & Success Criteria | textarea | No | **Merges** adoption-plan + success-metrics. Hint: "What does adoption success look like? What are the key metrics?" |

---

### Summary: Before & After

| | Old | New | Change |
|---|---|---|---|
| **Steps** | 9 | 5 | -4 |
| **Total fields** | 29 | 23 | -6 |
| **Required fields** | 17 | 15 | -2 |
| **Optional fields** | 12 | 8 | -4 |
| **Required steps** | 5 | 4 | -1 |
| **Optional steps** | 4 | 1 | -3 |
| **AI & ML fields** | 2 (optional) | 5 (required) | +3, elevated to core |

### Field Disposition

| Action | Count | Fields |
|--------|-------|--------|
| Kept unchanged | 10 | strategic-value, why-now, cloud-platform, top-risks, key-assumption, verdict, expected-users, customer-goal, timeline, partner-posture |
| Renamed | 3 | key-stakeholders → key-technical-stakeholders, partner-name (moved), why-composition → why-domo |
| Merged (many → one) | 4 created from 11 old | current-state (3→1), target-state (4→1), domo-layers (2→1), adoption-success (2→1) |
| New | 5 | ai-level, ai-signals, ai-problem, ai-data, ai-value |
| Dropped | 3 | success-criteria, compute-alignment, integration-points |
| Old AI fields retired | 2 | ai-reality, autonomous-decision (replaced by 5 new fields) |

### Gap Indicator Integration (R7)

The gap indicator system applies across all steps, with special handling for "Unknown" selections:

| Trigger | Behavior |
|---------|----------|
| Textarea empty or < ~15 chars (when sibling fields filled) | Subtle "Gap" badge on field, count in step header |
| `ai-data` = "Unknown / needs discovery" | Gap badge on field: "Data readiness unknown — discovery needed" |
| `ai-level` = "No AI Opportunity Identified" + `ai-signals` includes items other than "None" | Contradiction indicator: "Signals suggest an opportunity but level set to none — verify" |
| Select fields left at default/unset (when sibling fields filled) | Gap badge, same as textarea |

Gap indicators are non-blocking — visual cues only. They surface in the step header as "N gaps identified" and aggregate in the session summary.

---

### A2.2 Detail: AI & ML Step — Source Framework Mapping

Informed by three Domo SKO reference frameworks:

- **AI Value Continuum** (`samples/ai-value-continuum.png`) — Four levels: Process Automation → Traditional AI & ML → Generative AI → Agentic AI. Value increases as systems move closer to execution.
- **What to Look For** (`samples/what-to-look-for.png`) — Five opportunity signals + six qualifying questions. "If it's still manual there may be an opportunity."
- **Problem Framing Worksheet** (`samples/Practitioners Series Problem Framing Worksheet (1).pdf`) — DataRobot's 11-step framework distilled to SE-appropriate fields.

**Design principle:** The SE is not a data scientist. This step strategically surfaces whether an AI/ML opportunity exists — it does not scope a project. The dynamic hints based on `ai-level` are the key UX mechanism: they make the distinction between "I need a churn prediction model" (Predictive AI) and "I need an agent that handles support tickets end-to-end" (Autonomous AI) natural and obvious, because the questions themselves are different.

| Field | AI Value Continuum | What to Look For | Problem Framing Worksheet |
|-------|-------------------|-----------------|--------------------------|
| AI Opportunity Level | Direct mapping to 4 continuum levels (renamed for clarity) | — | Steps 10–11 (formulate/cast problem) |
| Opportunity Signals | — | Direct mapping to 5 "what to look for" items | Step 1 (operational assessment) |
| Problem Statement | — | Questions 1–3 (process, bottlenecks, goal) | Steps 2–4 (describe, ideal outcome/output) |
| Data Readiness | Implied by each level's data requirements | — | Steps 8–9 (modeling/deployment complexity) |
| Value & Accountability | "Value increases as systems move closer to execution" | Questions 5–6 (moment of decision, accountability) | Steps 6–7 (heuristics, accountability) |

**Step metadata:**

| Property | Value |
|----------|-------|
| Step ID | `ai-ml` (new, replaces `ai-strategy`) |
| Title | AI & ML Opportunity Assessment |
| Core question | Is there an AI or ML opportunity in this deal, and at what level of the value continuum? |
| Required? | Yes (elevated from optional) |
| Position | Step 4 (after Risk & Verdict) |


---

## Fit Check: R × A


| Req  | Requirement                                              | Status       | A                                                |
| ---- | -------------------------------------------------------- | ------------ | ------------------------------------------------ |
| R0   | TDR step structure consolidated, AI-reweighted           | Core goal    | ✅                                                |
| R0.1 | Reduce step count                                        | Core goal    | ✅ (A2.1)                                         |
| R0.2 | AI & ML core step with value continuum                   | Core goal    | ✅ (A2.2)                                         |
| R0.3 | Specific field changes (stakeholders, entry layer, etc.) | Must-have    | ✅ (A2.3)                                         |
| R0.4 | PDF reflects new steps                                   | Must-have    | ✅ (A2.8)                                         |
| R0.5 | Reference materials reviewed and incorporated            | Must-have    | ✅ — in `samples/`, incorporated into A2.2 design |
| R1   | Semi-automated step completion                           | Must-have    | ✅ (A2.6)                                         |
| R2   | Textarea fields resizable                                | Must-have    | ✅ (A2.5)                                         |
| R3   | In-scope layers as pills/tags                            | Must-have    | ✅ (A2.4)                                         |
| R4   | Intelligence Panel workflow guided                       | Must-have    | ✅ (A1.4)                                         |
| R4.1 | TDR Brief / Slack relationship clear                     | Must-have    | ✅ (A1.4, A1.5)                                   |
| R4.2 | Redundant processing eliminated                          | Nice-to-have | ✅ (A1.5)                                         |
| R5   | Tech landscape includes all sources with provenance      | Must-have    | ✅ (A1.2, A1.3)                                   |
| R6   | TDR versioning supports follow-up iterations             | Must-have    | ✅ (A2.7)                                         |
| R7   | Data gaps surface as indicators                          | Nice-to-have | ✅ (A1.6)                                         |
| R8   | Settings changes reflect in filters                      | Must-have    | ✅ (A1.1)                                         |


**Notes:**

- All requirements pass. R0.5 reference materials located in `samples/` and incorporated into A2.2 detailed design (AI Value Continuum → `ai-level` field, What to Look For → `ai-signals` field, Problem Framing Worksheet → `ai-problem`, `ai-data`, `ai-value` fields).

---

## Resolved Questions

1. **Where do these items fit in the roadmap?** → Split across two sprints:
   - **Sprint 30** (UX Polish & Iteration, already defined): absorbs A1.1–A1.6 (quick fixes, Intelligence Panel workflow, gap indicators)
   - **Sprint 31** (TDR Framework Redesign, new sprint): A2.1–A2.8 (step consolidation, AI step, versioning, PDF update)
2. **Does step restructuring break the Snowflake schema?** → Low risk. `TDR_STEP_INPUTS` stores field values keyed by `STEP_ID` (string) and `FIELD_ID` (string). Adding new step/field IDs is additive. Renamed fields can coexist with old ones. Removed fields stay in the table but are no longer written. The `TDR_SESSIONS.COMPLETED_STEPS` array updates to reflect new step IDs. Existing sessions with old step IDs remain readable (historical data preserved).
3. **Should the step redesign happen before or after Sprint 29 (AI Enhancement)?** → After. Sprint 29's AI Enhancement feature works at the field level (any textarea). The step restructuring changes which fields exist, but the enhancement mechanism is field-agnostic. Build enhancement on the current steps, then restructure steps — enhancement automatically applies to the new fields.
4. **How many steps should the new TDR have?** → **5 steps (approved).** See "Approved Step Design" section above. 9 → 5 steps, 29 → 23 fields.
5. **Is `why-composition` too abstract?** → **Yes.** Renamed to "Why Domo Wins Here" with concrete hint: "Given the architecture constraints, why is Domo the right solution over alternatives?" Drives competitive positioning, not abstract composition theory.
6. **Can naive users distinguish AI levels?** → **Addressed.** Labels changed from jargon (Process Automation, Traditional AI & ML) to plain English with examples (Rules & Automation — "alerts, ETL, scheduled workflows"; Predictive AI — "who will churn, what will sell"). Dynamic hints on Problem Statement and Value & Accountability change based on selected level, making the distinction between "I need a prediction model" and "I need an agent that acts autonomously" obvious through the questions themselves.
7. **Should `ai-data` be multi-select?** → **Yes.** A deal can have both structured CRM data AND unstructured support tickets. "No data today" and "Unknown / needs discovery" are mutually exclusive with data-present options.
8. **Should "Unknown" selections trigger gap indicators?** → **Yes.** Per R7, `ai-data` = "Unknown / needs discovery" triggers a gap badge: "Data readiness unknown — discovery needed." This extends the gap system beyond empty/terse textareas to include select fields where "Unknown" signals an information deficit. A contradiction check also fires when `ai-level` = "No AI Opportunity" but `ai-signals` contains positive signals.

---

## Rabbit Holes

- **Don't build a custom tag input component from scratch.** Use an existing React tag input library (e.g., `react-tag-input`, `react-select` with creatable mode). The interaction model is well-established.
- **Don't auto-complete steps based on word count alone.** "N/A" in a textarea is 3 characters but may be a valid response. The heuristic should check for substantive content (>15 chars or explicit "N/A" / "None" patterns), not just non-empty.
- **Don't migrate historical TDR data to new step IDs.** Old sessions keep their old step IDs. The app reads both old and new formats. Migration is unnecessary complexity.
- **Don't redesign the Intelligence Panel layout.** Sprint 30 adds a checklist/indicator overlay to the existing panel. A full layout redesign is out of scope.
- **Reference materials are resolved.** All three source files (`ai-value-continuum.png`, `what-to-look-for.png`, `Practitioners Series Problem Framing Worksheet`) are in `samples/` and incorporated into A2.2 design.

---

## No-Gos

- ~~No step redesign implementation without explicit user approval (item 13)~~ — **APPROVED. Step design locked (5 steps, 23 fields).**
- No deletion of historical TDR data — old step/field IDs remain readable in Snowflake
- No changes to the Snowflake table structure (`TDR_STEP_INPUTS`, `TDR_SESSIONS`) — only new field/step ID values
- No forced workflow in the Intelligence Panel — the checklist is advisory, not blocking
- Gap indicators are non-blocking — visual cues only, never prevent step completion or session save

---

## CURRENT State Reference

### Current TDR Steps (9 total)


| #   | Step ID        | Title                      | Required? | Field Count                                                                  |
| --- | -------------- | -------------------------- | --------- | ---------------------------------------------------------------------------- |
| 1   | `context`      | Deal Context & Stakes      | Yes       | 3 (strategic-value, why-now, key-stakeholders)                               |
| 2   | `decision`     | Business Decision          | Yes       | 3 (customer-goal, success-criteria, timeline)                                |
| 3   | `current-arch` | Architecture               | Yes       | 5 (system-of-record, cloud-platform, arch-truth, target-change, pain-points) |
| 4   | `domo-role`    | Domo's Composable Role     | Yes       | 4 (entry-layer, in-scope, out-of-scope, why-composition)                     |
| 5   | `risk`         | Risk & Verdict             | Yes       | 3 (top-risks, key-assumption, verdict)                                       |
| 6   | `target-arch`  | Target Architecture Detail | No        | 3 (proposed-solution, integration-points, data-flow)                         |
| 7   | `partner`      | Partner & AI Implications  | No        | 3 (partner-name, partner-posture, compute-alignment)                         |
| 8   | `ai-strategy`  | AI Strategy & Data Science | No        | 2 (ai-reality, autonomous-decision)                                          |
| 9   | `usage`        | Usage & Adoption Detail    | No        | 3 (user-count, adoption-plan, success-metrics)                               |


**Total:** 9 steps, 29 fields (17 required, 12 optional)

### Identified Redundancies (from user feedback, item 12)


| Fields                                                                              | Overlap                                                                                                                                             |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry Layer (select) + In-Scope Layers (textarea)                                   | Both define which Domo capabilities are in play. Entry Layer is one; In-Scope is many. Could be a single multi-select.                              |
| System of Record + Architectural Truth + What Changes in Target State + Pain Points | Four fields in the Architecture step all describe "what exists and what needs to change." Could be consolidated to 2 (Current State, Target Delta). |
| Business Decision step (3 fields)                                                   | Customer Decision, Success Criteria, Timeline — user suggests this can be reduced.                                                                  |
| Out of Scope (textarea)                                                             | May be redundant if In-Scope is well-defined. Or useful as an explicit "not Domo's job" declaration.                                                |


### Key Files Affected


| File                                        | What Changes                                                  |
| ------------------------------------------- | ------------------------------------------------------------- |
| `src/data/mockData.ts`                      | Step definitions (IDs, titles, core questions)                |
| `src/components/TDRInputs.tsx`              | `stepInputConfigs` — field definitions, types, options, hints |
| `src/components/pdf/TDRReadoutDocument.tsx` | PDF layout — step sections, field rendering                   |
| `src/pages/TDRWorkspace.tsx`                | Step completion logic (`handleToggleStepComplete`)            |
| `src/hooks/useTDRSession.ts`                | `completedSteps` auto-completion logic                        |
| `src/lib/tdrCriticalFactors.ts`             | Scoring weights reference step/field IDs                      |
| `src/components/TDRIntelligence.tsx`        | Intelligence Panel — tech pills, workflow indicators          |
| `src/lib/tdrReadout.ts`                     | Readout assembly references step/field structure              |
| `src/lib/constants.ts`                      | `ALLOWED_MANAGERS` — Settings bridge                          |
| `src/pages/Settings.tsx`                    | Manager settings — bridge to filter                           |


