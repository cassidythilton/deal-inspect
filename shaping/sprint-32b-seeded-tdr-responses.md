---
shaping: true
status: draft
appetite: medium (3–5 days)
---

# Seeded TDR Responses from Cortex-Modeled Gong Transcripts

## Source

> I have added columns call_count, strategic_value, customer_decision, why_now, key_technical_stakeholders, timeline, cloud_platform, current_state, target_state, domo_layers, out_of_scope, why_domo, top_risks, key_assumption, verdict, partner_name, partner_posture, ai_level, ai_signals, ai_problem, ai_data, ai_value, expected_users, adoption_success to 'opportunitiesmagic'. This data will be rendered as "pre-seeded" tdr responses in the appropriate areas/fields.
>
> The desired experience will be for a user to reference/edit the seeded responses before submitted actual/final responses. further, subsequent "versions" of tdr responses will need to include the ability to reference updated (the data refreshes daily), proposed responses from the source data as well as previously manually inputted responses. Further, if the user wants to make additional changes/additions to individual responses/inputs, they should be able to do so in subsequent TDR versions.
>
> The "Enhance" button is very useful/helpful and could be a candidate resource to tie pre-seeded info/data and manual inputs together.

---

## Problem

Today, when an SE opens a TDR for a deal, every field starts empty. The SE must manually type every response from scratch — strategic value, customer decision, architecture, risks, verdict, AI opportunity — even though **Cortex AI has already analyzed Gong call transcripts and inferred likely responses for each TDR field**. These modeled inferences are now available as columns on the `opportunitiesmagic` dataset (refreshed daily), but the TDR workflow has no way to surface them.

The seeded data is not raw transcript text. A Cortex AI pipeline (see `samples/tdrSeed.ipynb`) **reads aggregated Gong call transcripts for each opportunity, then models each TDR input field individually** — inferring the strategic value, customer decision, current architecture, risks, verdict, AI opportunity level, etc. based on what was discussed across calls. The result is structured, field-level inferences that map directly to TDR step inputs.

This creates two compounding problems. First, **SEs spend unnecessary effort re-articulating what Cortex has already inferred** from discovery calls. A field like "Customer Decision" might take 5 minutes to write from memory, when a Cortex-modeled draft already exists that synthesizes information from multiple Gong calls. Second, **when an SE starts a new TDR iteration (version), they lose access to both the latest AI-modeled data AND their own prior responses**. They start from a blank slate again, with no ability to reference either source.

The Enhance button already proves the value of AI-assisted drafting: it takes a terse input, adds deal context, and returns a richer version the SE can accept/edit/dismiss. **Seeded data represents the same pattern but at a different point in the workflow** — instead of enhancing what the SE typed, it provides a Cortex-inferred starting point before the SE types anything. The two mechanisms should compose naturally: seeded data populates the field, the SE edits it, and Enhance further refines it.

---

## Requirements

### R0: Surface Gong-extracted TDR field values as pre-seeded proposed responses in the TDR input UI

- R0.1: All 24 seeded columns (23 field values + `call_count`) must flow from the `opportunitiesmagic` dataset through the manifest, into the Deal object, and render in TDRInputs
- R0.2: Seeded values must map 1:1 to existing TDR input field IDs — no new fields or steps
- R0.3: `call_count` must be surfaced as metadata (e.g., badge or tooltip) to indicate how many Gong calls inform the seeded data

### R1: Seeded data must be visually distinct from manually-entered data

The user must be able to tell at a glance whether a field contains AI-proposed content (from Gong) or their own saved response. Seeded content should feel like a "draft to review" — not a committed answer.

### R2: Users must be able to edit, accept, or dismiss seeded values before saving

A seeded value renders in a standard editable field — the SE can click into it and freely modify the text (add context, rewrite sections, delete parts) before saving. Three commit paths exist:
- **Edit inline → auto-save on blur** — the SE modifies the seeded text directly, and the modified version saves on blur just like any manual input today. This is the primary expected flow.
- **Accept as-is** — one-click shortcut to save the seeded value verbatim to Snowflake without editing.
- **Dismiss** — clear the seeded value entirely and start from a blank field.

A seeded value that has not been explicitly saved (via edit+blur or Accept) must not persist. Once saved, it becomes a normal input record in Snowflake — indistinguishable from a fully manual response.

### R3: The Enhance button must compose with seeded data

If a field has a seeded value (and the user hasn't typed anything yet), Enhance should use the seeded text as its input — improving it with deal context, account intel, and knowledge base signals, then presenting the standard Accept/Edit/Dismiss diff.

### R4: New TDR iterations must provide access to both fresh seeded data and prior manual inputs

When starting a new TDR version via "Start New Iteration," the user must be able to reference: (a) the latest daily-refreshed seeded values from the dataset, and (b) their previously saved manual responses from the prior iteration. The system must clearly distinguish between these two sources.

### R5: Deals without seeded data must work identically to today

If a deal has no Gong call data (all seeded columns are empty/null), the TDR experience must be unchanged — empty fields, no seed indicators, no errors.

### R6: Multi-select and select fields must handle seeded data correctly

Seeded values for select fields (e.g., `strategic_value` → "High") and multi-select fields (e.g., `domo_layers` → JSON array) must map to the existing option values without error. Mismatches should be handled gracefully.

---

## Solution Shape [A: Dataset-to-Deal Seed Pipeline + Propose-Accept UI]

### A1: Manifest + Dataset Mapping (24 new columns)

| Part | Mechanism |
|------|-----------|
| **A1.1** | **Add 24 field aliases to `manifest.json` `opportunitiesmagic` dataset.** Add aliases matching dataset column names: `CallCount`, `SeedStrategicValue`, `SeedCustomerDecision`, `SeedWhyNow`, `SeedKeyTechnicalStakeholders`, `SeedTimeline`, `SeedCloudPlatform`, `SeedCurrentState`, `SeedTargetState`, `SeedDomoLayers`, `SeedOutOfScope`, `SeedWhyDomo`, `SeedTopRisks`, `SeedKeyAssumption`, `SeedVerdict`, `SeedPartnerName`, `SeedPartnerPosture`, `SeedAiLevel`, `SeedAiSignals`, `SeedAiProblem`, `SeedAiData`, `SeedAiValue`, `SeedExpectedUsers`, `SeedAdoptionSuccess`. Update all 3 manifests (`manifest.json`, `public/manifest.json`, `dist/manifest.json`). |
| **A1.2** | **Map columns in `src/hooks/useDomo.ts:transformOpportunityToDeal`.** Add a `seededInputs` property to the Deal object — a `Record<string, string>` mapping TDR field keys (`stepId::fieldId`) to the seeded value. Parse the 24 dataset columns and construct this map inside `transformOpportunityToDeal`. Multi-select values (domo_layers, ai_signals, ai_data) arrive as JSON-stringified arrays — pass through as-is since TDRInputs already handles JSON strings for multi-select fields. |

### A2: Deal Type Extension

| Part | Mechanism |
|------|-----------|
| **A2.1** | **Extend `Deal` interface in `src/types/tdr.ts`.** Add `seededInputs?: Record<string, string>` and `callCount?: number`. The keys in `seededInputs` follow the pattern `stepId::fieldId` (e.g., `deal-context::strategic-value`, `tech-architecture::current-state`). |

### A3: TDRInputs — Seed-Aware Field Rendering

| Part | Mechanism |
|------|-----------|
| **A3.1** | **Pass `seededInputs` and `callCount` from TDRWorkspace to TDRInputs.** Thread the deal's `seededInputs` map and `callCount` through the existing props. |
| **A3.2** | **Seed indicator badge.** When a step has any seeded values, show a small "Cortex · N calls" badge on the step header indicating the number of Gong calls that informed the Cortex model. Per-field: if a field has a seeded value and no saved manual input, show a subtle "AI Proposed" label with a distinct border style (e.g., dashed violet border, light violet background — consistent with the existing Enhance result styling). |
| **A3.3** | **Populate field with seeded value as draft.** In `getFieldValue()` (line 636 of `TDRInputs.tsx`), add a third fallback: after checking local drafts and saved inputs, check `seededInputs[stepId::fieldId]`. Return the seeded value but mark it as unsaved (it won't appear in `savedFields`). For select/multi-select fields, set the value directly — the Select component will display the matching option. |
| **A3.4** | **Seeded fields are editable by default.** Seeded values populate standard `<textarea>`, `<input>`, and `<Select>` components — the SE can click into the field and edit freely (add context, rewrite, delete). Editing a seeded field marks it as a local draft; on blur, it auto-saves to Snowflake via the existing `handleBlur` → `saveInput()` path. This is the primary expected interaction: **see the Cortex draft → refine it with your knowledge → it saves automatically**. |
| **A3.5** | **Accept / Dismiss shortcut controls.** Below a field displaying an unsaved seeded value, show Accept and Dismiss buttons. Accept triggers `saveInput()` to persist the seeded value verbatim. Dismiss clears the seeded value for this field (tracked in local state, e.g., `dismissedSeeds: Set<string>`). These are convenience shortcuts — most users will simply edit inline and let auto-save handle persistence. |
| **A3.6** | **Enhance composes with seeded data.** No change to `handleEnhance` needed — it already reads from `getFieldValue()`, which will now return seeded values as fallback. When the user clicks Enhance on a seeded field (whether unedited or after inline edits), the text flows through the existing enhancement pipeline. The diff shows current text → enhanced version. This is how seeded data + manual additions get synthesized together into a polished response. |

### A4: Iteration-Aware Seed + Prior Reference

| Part | Mechanism |
|------|-----------|
| **A4.1** | **Prior iteration inputs available in new iterations.** The existing `previousSessions` array in `useTDRSession` already loads completed sessions. Extend `startNewIteration` to also load the inputs from the most recent prior session and expose them as `priorInputValues: Map<string, string>`. Pass this to TDRInputs. |
| **A4.2** | **Tri-source field value resolution.** In `TDRInputs`, field value resolution becomes: (1) local draft → (2) saved input (current session) → (3) **prior iteration input** → (4) **seeded value from dataset**. The UI indicates which source is active: "Saved" (green), "From Prior TDR" (blue), "AI Proposed" (violet), or empty. |
| **A4.3** | **Source toggle / reference panel.** When a field has values from multiple sources (e.g., seeded data AND prior iteration), show a small expandable panel below the field: "View alternatives" → displays the other source values with "Use this" buttons. This lets the SE compare the latest Gong-derived answer against their prior manual input and pick the better starting point. |

### A5: Seed Coverage Indicator

| Part | Mechanism |
|------|-----------|
| **A5.1** | **Step-level seed coverage.** On the TDR step sidebar, show a small indicator (e.g., "4/5 seeded") for steps where seeded data covers most fields. This helps the SE prioritize — a fully-seeded step may only need review, while an empty step needs original input. |
| **A5.2** | **Deal-level seed badge in DealsTable.** In the deals table, add a small "Cortex" or call icon badge on deals that have seeded TDR data (`callCount > 0`). This helps managers identify which deals have Cortex-modeled TDR data ready for review. |

---

## Seeded Column → TDR Field Mapping

| Dataset Column | Manifest Alias | TDR Step | Field ID | Field Type |
|---|---|---|---|---|
| `call_count` | `CallCount` | *(metadata)* | *(n/a)* | number |
| `strategic_value` | `SeedStrategicValue` | `deal-context` | `strategic-value` | select |
| `customer_decision` | `SeedCustomerDecision` | `deal-context` | `customer-goal` | textarea |
| `why_now` | `SeedWhyNow` | `deal-context` | `why-now` | textarea |
| `key_technical_stakeholders` | `SeedKeyTechnicalStakeholders` | `deal-context` | `key-technical-stakeholders` | text |
| `timeline` | `SeedTimeline` | `deal-context` | `timeline` | select |
| `cloud_platform` | `SeedCloudPlatform` | `tech-architecture` | `cloud-platform` | select |
| `current_state` | `SeedCurrentState` | `tech-architecture` | `current-state` | textarea |
| `target_state` | `SeedTargetState` | `tech-architecture` | `target-state` | textarea |
| `domo_layers` | `SeedDomoLayers` | `tech-architecture` | `domo-layers` | multi-select |
| `out_of_scope` | `SeedOutOfScope` | `tech-architecture` | `out-of-scope` | textarea |
| `why_domo` | `SeedWhyDomo` | `tech-architecture` | `why-domo` | textarea |
| `top_risks` | `SeedTopRisks` | `risk-verdict` | `top-risks` | textarea |
| `key_assumption` | `SeedKeyAssumption` | `risk-verdict` | `key-assumption` | textarea |
| `verdict` | `SeedVerdict` | `risk-verdict` | `verdict` | select |
| `partner_name` | `SeedPartnerName` | `risk-verdict` | `partner-name` | text |
| `partner_posture` | `SeedPartnerPosture` | `risk-verdict` | `partner-posture` | select |
| `ai_level` | `SeedAiLevel` | `ai-ml` | `ai-level` | select |
| `ai_signals` | `SeedAiSignals` | `ai-ml` | `ai-signals` | multi-select |
| `ai_problem` | `SeedAiProblem` | `ai-ml` | `ai-problem` | textarea |
| `ai_data` | `SeedAiData` | `ai-ml` | `ai-data` | multi-select |
| `ai_value` | `SeedAiValue` | `ai-ml` | `ai-value` | textarea |
| `expected_users` | `SeedExpectedUsers` | `adoption` | `expected-users` | text |
| `adoption_success` | `SeedAdoptionSuccess` | `adoption` | `adoption-success` | textarea |

---

## Fit Check: R × A

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | Surface Gong-extracted TDR field values as pre-seeded proposed responses in the TDR input UI | Core goal | ✅ (A1.1, A1.2, A2.1, A3.3) |
| R0.1 | All 24 seeded columns flow from dataset through manifest into Deal object and render in TDRInputs | Core goal | ✅ (A1.1, A1.2, A2.1, A3.1) |
| R0.2 | Seeded values map 1:1 to existing TDR input field IDs — no new fields or steps | Core goal | ✅ (A1.2 — mapping table above) |
| R0.3 | `call_count` surfaced as metadata badge/tooltip | Core goal | ✅ (A3.2, A5.2) |
| R1 | Seeded data visually distinct from manually-entered data | Must-have | ✅ (A3.2) |
| R2 | Users can edit, accept, or dismiss seeded values before saving | Must-have | ✅ (A3.4, A3.5) |
| R3 | Enhance button composes with seeded data | Must-have | ✅ (A3.6) |
| R4 | New iterations provide access to both fresh seeded data and prior manual inputs | Must-have | ✅ (A4.1, A4.2, A4.3) |
| R5 | Deals without seeded data work identically to today | Must-have | ✅ (A3.3 — fallback only returns seeded value when present) |
| R6 | Multi-select and select fields handle seeded data correctly | Must-have | ✅ (A1.2 — JSON passthrough for multi-select; direct value match for select) |

---

## Resolved Questions

1. **Should seeded values auto-save when the user opens a TDR?** → **No.** Seeded data is proposed, not committed. It must be explicitly accepted (or edited and saved) by the SE. This prevents stale Gong data from overwriting intentionally empty fields and keeps the SE in control.

2. **What happens when seeded data conflicts with a saved manual input?** → **Manual input always wins.** The resolution order is: local draft → saved input → prior iteration → seeded value. Once the SE saves a value, the seeded data is only accessible via the "View alternatives" panel (A4.3).

3. **Should seeded values count toward step completion?** → **No.** Only explicitly saved inputs count. A step with 5 seeded fields but 0 saved inputs shows "0/5 complete." This ensures the SE reviews every field before the step is considered done.

4. **How are select field values matched?** → **Exact string match against the option list.** The Gong extraction pipeline uses the exact option labels ("High", "Medium", "Low", "This Quarter", "Proceed with Corrections", etc.). If a seeded value doesn't match any option, it renders as unselected with the seeded text shown as a hint below the select.

5. **Where does the seeded data come from?** → **Cortex AI modeling of Gong transcripts, refreshed daily.** A Cortex AI pipeline (see `samples/tdrSeed.ipynb`) reads aggregated Gong call transcripts per opportunity, then models each TDR input field individually — inferring likely values based on what was discussed across calls. The structured inferences are joined to the `opportunitiesmagic` dataset and refresh daily. The frontend reads them via the standard `/data/v2/` API — no Code Engine calls needed.

6. **Does this change the Snowflake schema?** → **No.** Seeded data lives in the Domo dataset, not Snowflake. Once accepted, it's saved as a normal `TDR_STEP_INPUTS` record via the existing `saveStepInput` Code Engine function. No DDL changes.

7. **Do we already support multiple TDR versions?** → **Yes.** `useTDRSession.ts:startNewIteration` (line 317) completes the current session, creates a new one with an incremented iteration number, and the old session is preserved in `previousSessions`. The existing UI shows "{N} prior" and a "Start New Iteration" button.

---

## Rabbit Holes

- **Don't build a custom "merge" UI that tries to inline-diff seeded vs. manual.** The Enhance button already provides a world-class diff experience. Seeded data should populate the field as a starting point; Enhance handles the refinement. Two separate merge UIs would confuse users.

- **Don't try to detect which Gong calls informed each field.** The `call_count` column is aggregate — it reflects how many Gong calls Cortex analyzed to produce the inferences. There's no per-field call attribution. Showing "from Gong call on Mar 3" per field requires call-level provenance that doesn't exist in the dataset. Just show the total call count.

- **Don't auto-complete steps with seeded data.** It's tempting to auto-mark steps as "complete" when all fields have seeded values. But seeded data is AI-proposed and may be wrong — the SE must review and explicitly save. Treat seeded-but-unsaved the same as empty for completion purposes.

- **Don't modify the Enhance pipeline to "know about" seeded data.** The Enhance button already reads `getFieldValue()` which will return the seeded value. No special seeded-data logic needed in `handleEnhance` or the Code Engine `enhanceTDRResponse` function.

---

## No-Gos

- No changes to Snowflake schema or Code Engine functions for seeded data storage
- No auto-saving of seeded values — explicit user action required
- No new TDR steps or fields — seeded data maps to existing field IDs only
- No blocking the TDR render on seeded data availability — treat as optional enrichment

---

## CURRENT State Reference

### TDR Input Steps & Fields (v1 schema, Sprint 31)

| Step ID | Step Title | Fields | Required |
|---------|-----------|--------|----------|
| `deal-context` | Deal Context & Stakes | `strategic-value` (select), `customer-goal` (textarea), `why-now` (textarea), `key-technical-stakeholders` (text), `timeline` (select) | Yes |
| `tech-architecture` | Technical Architecture | `cloud-platform` (select), `current-state` (textarea), `target-state` (textarea), `domo-layers` (multi-select), `out-of-scope` (textarea), `why-domo` (textarea) | Yes |
| `risk-verdict` | Risk & Verdict | `top-risks` (textarea), `key-assumption` (textarea), `verdict` (select), `partner-name` (text), `partner-posture` (select) | Yes |
| `ai-ml` | AI & ML Opportunity | `ai-level` (select), `ai-signals` (multi-select), `ai-problem` (textarea), `ai-data` (multi-select), `ai-value` (textarea) | Yes |
| `adoption` | Adoption & Success | `expected-users` (text), `adoption-success` (textarea) | No |

### Field Value Resolution (current — `TDRInputs.tsx:636`)

```
getFieldValue(fieldId):
  1. localValues[stepId::fieldId]  →  local draft (typing in progress)
  2. inputValues.get(stepId::fieldId)  →  saved in Snowflake
  3. return ''  →  empty
```

### Field Value Resolution (proposed)

```
getFieldValue(fieldId):
  1. localValues[stepId::fieldId]  →  local draft (typing in progress)
  2. inputValues.get(stepId::fieldId)  →  saved in Snowflake (current session)
  3. priorInputValues?.get(stepId::fieldId)  →  prior iteration input
  4. seededInputs?.[stepId::fieldId]  →  dataset seeded value (Gong AI)
  5. return ''  →  empty
```

### Iteration Support (current — `useTDRSession.ts`)

- `startNewIteration()` — completes current session, creates new one with incremented iteration
- `previousSessions` — array of completed sessions for the same deal
- Current gap: prior session inputs are not loaded into the new iteration's context

### Manifest Fields (current `opportunitiesmagic`)

The dataset currently has 55 field aliases (OpportunityId through PropensityModelVersion). This sprint adds 24 new aliases (CallCount + 23 seed fields) bringing the total to 79.
