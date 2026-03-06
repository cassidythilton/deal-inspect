---

## shaping: true
status: draft
appetite: medium (2–3 sprints)

# AI-Enhanced TDR Responses

## Problem

SEs filling out TDR fields write terse, incomplete responses under time pressure. A typical human input for "Why This Deal Matters Now" looks like:

> "New CFO wants better reporting. Current process is manual."

But a useful TDR response — one that drives structured extraction, feeds the AI brief, and holds up in a readout — looks like:

> "Telescope Partners just closed Fund IV and their LP base grew from 40 to 110 investors, making the manual Excel-based quarterly reporting process unsustainable. The incoming CFO (starting April) has made investor-grade data infrastructure a condition of joining. Timing is now or they risk losing their CFO hire."

The gap between what humans type and what the system needs is where deal context gets lost. Every downstream AI artifact (structured extract, TDR brief, action plan) degrades when the inputs are thin. The TDR framework was designed to elicit sharp thinking — but the text fields don't help the SE get there.

**This is not a "make it longer" problem.** It's a "help the SE say what they already know but didn't write down" problem.

---

## Requirements

### R1: Enhance, don't replace

The SE's original intent must be preserved. AI enhancement adds specificity, structure, and completeness — it does not invent facts the SE didn't provide. The SE must see the enhanced version and accept, edit, or reject it before it becomes the saved value.

### R2: Context-aware enhancement

Enhancement must use available context — not just the single field value. The AI should draw from:

- Other fields the SE has already filled in (within and across steps)
- Deal metadata (account name, ACV, stage, deal type, close date)
- Account intel if available (Sumble enrichment, Perplexity research)
- The specific field's purpose (its label, placeholder, hint, and the step's core question)

A field that says "Snowflake" in the Cloud Platform context should produce different enhancement than "Snowflake" in a partner context.

### R3: Respect the TDR framework's forcing functions

Each TDR field has a specific intent (captured in hints and core questions). Enhancement should push the SE *toward* the forcing function, not around it. Examples:

- "Customer Decision" demands a one-sentence "X so they can Y" structure — enhancement should tighten, not expand
- "Architectural Truth" demands a constraint statement — enhancement should sharpen the constraint, not soften it
- "Key Assumption" demands a single falsifiable belief — enhancement should isolate, not hedge

### R4: Works within the existing auto-save flow

Enhancement cannot break the current input lifecycle: type → debounce → auto-save to Snowflake → field history. The enhanced version must go through the same save path so that edit history captures both the original and the enhanced value.

### R5: Non-blocking

Enhancement should never block the SE from moving to the next field or step. It can be asynchronous — the SE types, moves on, and enhanced suggestions appear when ready.

### R6: Selective — not every field needs it

Select fields (dropdowns) don't need enhancement. Short text fields like "Key Partner" or "Expected Users" don't need it. Enhancement targets **textarea fields** where the gap between terse input and useful input is largest.

---

## Solution Shape: "Enhance This" Button + Inline Diff

### Interaction Model

1. SE types into a textarea field and blurs (or pauses typing)
2. A subtle **"Enhance"** affordance appears below the field (small button or link, not intrusive)
3. SE clicks "Enhance" → spinner → AI returns an enhanced version
4. Enhanced text appears in an **inline diff view** below the field: SE's original on the left (or struck through), enhanced version on the right (or highlighted)
5. SE can **Accept** (replaces field value), **Edit** (opens enhanced text in the field for manual tweaks), or **Dismiss** (keeps original)
6. On Accept: the enhanced value becomes the field value and saves via the existing auto-save flow. The original value is preserved in edit history.

### Why not auto-enhance on blur?

- Cost: AI calls on every blur across 20+ textarea fields burns tokens fast
- Surprise: changing what the SE wrote without them asking violates R1
- The SE should *choose* when they want help — some fields they'll nail, some they'll want a boost

### Key Components

#### A. Prompt Construction (the hard part)

The enhancement prompt must be assembled per-field with layered context:


| Context Layer          | Source                                              | Purpose                                                                                                     |
| ---------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Field identity**     | `stepInputConfigs` — field label, placeholder, hint | Tells the AI what this field is supposed to answer                                                          |
| **Step identity**      | `tdrSteps` — step title, core question              | Grounds the enhancement in the TDR framework's forcing function                                             |
| **SE's raw input**     | Current field value                                 | The seed to enhance — must be preserved in spirit                                                           |
| **Sibling fields**     | Other filled fields in the same step                | Cross-field coherence (e.g., if System of Record says "Snowflake", Architectural Truth should reference it) |
| **Cross-step context** | Filled fields from other steps                      | Broader deal narrative (e.g., thesis, customer decision, entry layer)                                       |
| **Deal metadata**      | Session data — account, ACV, stage, deal type       | Grounds enhancement in deal reality                                                                         |
| **Account intel**      | Sumble + Perplexity data (if enriched)              | Adds specificity the SE may have skipped (e.g., actual tech stack, competitor names, org structure)         |
| **Knowledge Base**     | Domo filesets — battle cards, playbooks, competitive guides | Always-available context. Surfaces relevant positioning language, competitive talking points, and use case patterns the SE may not have recalled |


The prompt should instruct the model to:

- Preserve the SE's core assertions — do not invent new claims
- Add specificity where the SE was vague (names, numbers, timelines)
- Structure the response to match the field's intent (one-sentence for "Customer Decision", constraint-statement for "Architectural Truth", etc.)
- Draw from account intel *only if it aligns with what the SE stated* — do not contradict
- Keep the voice professional but human (not corporate boilerplate)

#### B. UI Affordance

- **"Enhance" button**: appears for textarea fields only, positioned at the bottom-right of the field (similar to a character count). Uses a subtle icon (sparkle/wand) + "Enhance" text. Disabled while field is empty. Shows spinner during API call.
- **Diff view**: inline below the field, collapsible. Shows original vs. enhanced with highlights on additions/changes. Three action buttons: Accept | Edit | Dismiss.
- **Enhanced indicator**: after accepting, a small badge on the field (e.g., "AI-enhanced") so the SE and reviewers know which fields were enhanced vs. raw.

#### C. API Execution

- Runs client-side → **Domo AI endpoint** (`/domo/ai/v1/text/chat`) — same pattern as `domoAi.ts`
- Model: Anthropic (via Domo's AI proxy — same model quality as Cortex, no Snowflake round-trip)
- Input: assembled prompt (field context + deal context + SE input + KB context)
- Output: enhanced text string
- Cost control: one call per explicit user action (no auto-trigger), token budget per call (~500 output tokens max for a single field)
- Caching: no caching needed — each enhancement is contextual to the current input state
- **Why Domo AI, not Cortex:** Enhancement is a high-frequency, low-latency operation (user clicks and waits). The Domo AI endpoint avoids the Code Engine → Snowflake SQL → Cortex round-trip, reducing latency. It also avoids Cortex per-token costs. The model is Anthropic either way.

#### D. Save & History Integration

- On **Accept**: call `onSaveInput` with the enhanced value (same path as manual save). The auto-save debounce is bypassed — Accept is an explicit save action.
- Edit history captures: the original typed value (already saved on blur) and the accepted enhanced value (saved on Accept). History view shows both entries with timestamps, so the SE can always revert.
- On **Edit**: enhanced text replaces the field value in the textarea. The SE modifies it. Normal auto-save/blur logic takes over from there.
- On **Dismiss**: nothing changes. The original value remains. No save event.

---

## Fit Check


| Requirement                    | Covered?     | Notes                                                                                                                                                                                          |
| ------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1: Enhance, don't replace** | ✅ Yes        | Explicit Accept/Edit/Dismiss flow. SE is always in control. Original preserved in history.                                                                                                     |
| **R2: Context-aware**          | ✅ Yes        | Prompt construction draws from 8 context layers including Knowledge Base (filesets). Account intel used when available; filesets always available as baseline.                                   |
| **R3: Forcing functions**      | ⚠️ Partially | Prompt includes field hints and core questions, but enforcement depends on prompt quality. Need to test with real SE inputs to validate the prompt actually tightens responses per-field-type. |
| **R4: Auto-save flow**         | ✅ Yes        | Accept triggers `onSaveInput`. Edit enters normal flow. No new save path needed.                                                                                                               |
| **R5: Non-blocking**           | ✅ Yes        | Enhancement is on-demand, async. SE can move on without waiting.                                                                                                                               |
| **R6: Selective**              | ✅ Yes        | Button only appears on textarea fields. Selects and short text inputs excluded.                                                                                                                |


---

## Resolved Questions

1. **Bulk enhance?** → **No, per-field only.** Start with individual field enhancement. Evaluate bulk after observing usage patterns. Risk of rubber-stamping is too high at launch.
2. **Re-enhance?** → **Yes.** The Enhance button is always available when the field has content, regardless of whether it was previously enhanced. SE edits after accepting → Enhance reappears.
3. **Enhancement quality signal?** → **Yes.** Show which context sources were used: "Enhanced using: Perplexity research, Sumble tech stack, Domo filesets, deal metadata." Include filesets (Knowledge Base battle cards, playbooks) alongside Sumble and Perplexity. This builds trust and helps the SE evaluate whether the enhancement is grounded.
4. **Offline / no-intel mode?** → **Yes, signal it.** Enhancement always works using SE inputs + deal metadata + Domo filesets (filesets are always available as a baseline context source). If Sumble or Perplexity data is missing, show a nudge: "Enrich account data for better enhancements." Filesets ensure there's always *some* external context beyond what the SE typed.
5. **Token economics at scale?** → **Use the Domo AI endpoint** (`/domo/ai/v1/text/chat`) instead of Snowflake Cortex for enhancement calls. It's an Anthropic model at its core, same quality, but avoids Cortex per-token costs and keeps enhancement compute on the Domo side. This also simplifies the call path — no Code Engine → Snowflake round-trip needed. The existing `domoAi.ts` service already handles this endpoint pattern.

---

## Rabbit Holes

- **Don't build a custom diff renderer.** Use an existing React diff library or a simple "before/after" toggle. Visual diff is nice-to-have, not core.
- **Don't try to auto-detect "needs enhancement."** Heuristics like "response is too short" will annoy SEs who write concise-but-complete answers. Keep it opt-in.
- **Don't enhance select fields.** The dropdown options are fixed and intentional. AI has nothing to add.
- **Don't persist enhancement metadata in a new table.** The edit history in `TDR_STEP_INPUTS` already captures before/after. An "AI-enhanced" badge can be derived from history (if two saves happened within seconds and the content changed significantly, the second was likely an enhancement accept).

---

## No-Gos

- No auto-enhancement without user action
- No enhancement that introduces facts not supported by SE input or account intel
- No changes to the TDR step structure or field definitions
- No new Snowflake tables (reuse existing save/history infrastructure)

