---
shaping: true
status: draft
appetite: medium (3–5 days)
---

# Manual Transcript Ingestion

## Source

> "If I have a manual transcript from an in-person conversation with a customer/prospect (I used Apple Voice Memo) how's best to go about incorporating a manual transcript into the seeded inputs and storage of the information (with broader Gong transcript storage)?"

> [Example transcript: `sony03262026.txt` — 4,500+ word raw transcription from Apple Voice Memo of an in-person meeting with Sony's DPT team. Covers Snowflake COE initiative, Cortex analyst prototype interest, push-down processing/cost optimization, domo-snowflake governance, and partnership next steps for April 8/16 sessions. Multiple speakers (Cassidy, Alexi, Nate, Thomas, Ian). Raw ASR output with typical speech-to-text artifacts.]

---

## Problem

The Gong transcript pipeline is today's richest qualitative signal for every deal. Call recordings flow from Gong → `GONG_CALL_TRANSCRIPTS` in Snowflake → Cortex Search index → Code Engine digest/search functions → TDR Chat context, recipe generation, and seeded TDR inputs. It's a well-paved path: 1,973 rows indexed, ~200–400ms search latency, auto-refreshing Cortex Search service, and 24 seeded TDR field columns modeled daily from transcript content.

**But not every conversation happens on Gong.** In-person meetings, dinners, hallway conversations, conference encounters, and whiteboard sessions are some of the highest-signal interactions in a deal — and they produce zero Gong data. Today, an SE who has a 45-minute in-person conversation with a customer's Snowflake team (like the Sony DPT meeting) has no mechanism to get that intelligence into the system. The insights from that meeting — that the internal Snowflake team calls Domo "a black box," that they need a COE, that cost attribution is their primary concern, that there's an April 16 session to prepare for — exist only in the SE's memory or on a voice memo sitting in their Downloads folder.

**The manual transcript is stranded outside every downstream process.** It won't appear in Cortex Search results when someone asks "What did Sony's Snowflake team say about costs?" It won't inform the Gong digest. It won't feed the Cortex pipeline that generates seeded TDR inputs. It won't be included in the Asset Generation Recipe. It's a dead-end artifact that the SE has to manually re-articulate across TDR fields, chat conversations, and readout PDFs — exactly the problem the entire Gong pipeline was built to solve for recorded calls.

**The fix is conceptually simple: let manual transcripts enter the same pipeline as Gong transcripts.** If a raw text file lands in `GONG_CALL_TRANSCRIPTS` with the correct `OPPORTUNITY_ID`, the Cortex Search service will auto-index it (target lag: 5 minutes), the digest function will include it, the seeded pipeline will process it on next refresh, and every downstream consumer gets the signal. The challenge is building the ingestion surface — a UI that lets an SE upload a text file, associate it with a deal, and optionally clean up speaker attribution — without disrupting the existing Gong-native pipeline.

---

## Requirements

### R0: Allow SEs to upload manual transcripts (text files from voice memos, notes, etc.) that flow into the same storage and processing pipeline as Gong call transcripts

- R0.1: Uploaded transcripts must land in `GONG_CALL_TRANSCRIPTS` (or a unified transcript table) so they are indexed by the existing Cortex Search service and included in digest/search results.
- R0.2: Manual transcripts must be associable with a specific deal/opportunity at upload time.
- R0.3: Manual transcripts must be distinguishable from Gong-sourced transcripts via a `source` field (e.g., `gong`, `voice_memo`, `manual_notes`, `meeting_notes`).

### R1: Manual transcripts must trigger a complete re-derivation of seeded TDR inputs from all sources

The seeded TDR inputs (customer decision, current architecture, top risks, AI opportunity, etc.) are modeled from transcript text by a Cortex AI pipeline (`tdrSeed.ipynb`). Today this runs as a daily batch. When an SE uploads a manual transcript, they must not wait 24 hours. The system must re-generate seeded inputs on-demand — reading **all** transcripts (Gong + manual) for the opportunity and producing **one unified, synthesized value per field** that reflects the totality of what is known. This is a net-new refresh each time, not an additive merge — the AI considers all sources holistically and produces a coherent assessment, not a conglomeration of source-by-source fragments. If a later conversation updates or contradicts an earlier one, the most recent information takes precedence.

### R2: The upload experience must be low-friction for field SEs

SEs are in the field. They have a voice memo on their phone that Apple transcribed to text. The path from "I have a text file" to "it's in the system" must be minimal: upload file → select deal → done. No mandatory metadata beyond deal association. Optional fields (meeting date, participants, notes) are nice-to-have but must not block the upload.

### R3: Manual transcripts must appear in TDR Chat alongside Gong transcripts

When an SE asks a question in TDR Chat with the Gong toggle enabled, Cortex Search results must include manual transcript content alongside Gong call excerpts. The user should be able to distinguish the source (e.g., "from in-person meeting on Mar 26" vs. "from Gong call on Mar 20") but should not need separate toggles or filters.

### R4: The digest function must incorporate manual transcripts

`getGongTranscriptDigest` must return a digest that includes manual transcript content. The call count should reflect total sources (e.g., "6 Gong calls + 1 in-person meeting" or simply "7 transcripts from 2 sources"). The digest should note when in-person/manual sources are present.

### R5: Deals without manual transcripts must work identically to today

The upload feature is additive. Deals with only Gong data, deals with only manual transcripts, and deals with both must all work correctly. No regressions to existing Gong pipeline behavior.

### R6: Raw ASR artifacts should be tolerable without mandatory cleanup

Apple Voice Memo transcription produces noisy text (misheard words, missing punctuation, run-on sentences, garbled names). The system must not require the SE to clean up the transcript before upload. However, an optional AI-assisted cleanup step (Cortex `AI_COMPLETE` to fix obvious transcription errors, add speaker labels, improve formatting) would significantly improve downstream quality.

---

## Solution Shape [A: Unified Transcript Store + Upload UI]

### A1: Schema Extension `[Cortex CLI]`

| Part | Mechanism |
|------|-----------|
| **A1.1** | **Add `SOURCE` column to `GONG_CALL_TRANSCRIPTS`.** `ALTER TABLE TDR_APP.PUBLIC.GONG_CALL_TRANSCRIPTS ADD COLUMN SOURCE VARCHAR(50) DEFAULT 'gong';`. Existing rows default to `'gong'`. Manual uploads use values like `'voice_memo'`, `'manual_notes'`, `'meeting_notes'`. The Cortex Search service view (`GONG_TRANSCRIPTS_FOR_SEARCH`) must be updated to include the new column as a filter/attribute column. |
| **A1.2** | **Add metadata columns.** `ALTER TABLE ... ADD COLUMN MEETING_DATE DATE, ADD COLUMN PARTICIPANTS VARCHAR(2000), ADD COLUMN UPLOADED_BY VARCHAR(255), ADD COLUMN UPLOAD_NOTES VARCHAR(4000);`. These are nullable — Gong rows won't populate them. Manual uploads populate `MEETING_DATE` (optional), `PARTICIPANTS` (optional comma-separated names), `UPLOADED_BY` (the SE who uploaded), and `UPLOAD_NOTES` (optional context, e.g., "In-person meeting at Sony HQ, DPT team"). |
| **A1.3** | **Update Cortex Search view.** Recreate `GONG_TRANSCRIPTS_FOR_SEARCH` to include `SOURCE` and `MEETING_DATE` as attribute columns. The Cortex Search service will auto-refresh and index the new columns, making them available for filtered search and result metadata. |
| **A1.4** | **Rename consideration (future).** The table is named `GONG_CALL_TRANSCRIPTS` but now holds non-Gong data. A rename to `DEAL_TRANSCRIPTS` or `CALL_TRANSCRIPTS` would be more accurate but carries migration risk. For now, keep the name and use the `SOURCE` column to distinguish origin. Rename in a future cleanup sprint if the mixed naming causes confusion. |

### A2: Code Engine Ingestion Function `[Cursor]`

| Part | Mechanism |
|------|-----------|
| **A2.1** | **New Code Engine function: `uploadManualTranscript`.** Accepts: `opportunityId` (required), `accountName` (required), `opportunityName` (required), `transcriptText` (required — the raw text content), `source` (optional, default `'voice_memo'`), `meetingDate` (optional ISO date string), `participants` (optional string), `uploadedBy` (optional string), `uploadNotes` (optional string). The function: (1) generates a deterministic `CALL_ID` (e.g., `manual-{opportunityId}-{timestamp}`), (2) computes `CALL_COUNT` by counting existing rows for this opportunity + 1, (3) writes a single row to `GONG_CALL_TRANSCRIPTS` via Snowflake SQL INSERT with all provided fields + `SOURCE = source`, (4) returns `{ success: true, callId, rowCount }`. |
| **A2.2** | **Optional: AI transcript cleanup function.** A separate Code Engine function `cleanupTranscript` that accepts raw ASR text and returns a cleaned version via Cortex `AI_COMPLETE`. Prompt: "Clean up this voice memo transcription. Fix obvious speech-to-text errors, add paragraph breaks, attribute speakers where possible based on context (e.g., 'Customer:' vs 'SE:'), and improve readability. Do not add, remove, or change the substance of what was said." The SE can preview the cleaned version before confirming upload. This is optional — the SE can skip cleanup and upload raw text. |
| **A2.3** | **Add to manifest.json.** Add `uploadManualTranscript` (and optionally `cleanupTranscript`) to `public/manifest.json` `packageMapping` with the parameter definitions from A2.1. |

### A3: Frontend Upload UI `[Cursor]`

| Part | Mechanism |
|------|-----------|
| **A3.1** | **Upload trigger in TDR Workspace.** Add a new action to the existing action bar in `src/pages/TDRWorkspace.tsx` — an `Upload` icon (Lucide `FileUp` or `Mic`) next to the existing Wand2 (recipe) and FileText (PDF) icons. Clicking opens a slide-over panel (`Sheet` component). The button is disabled when no real session exists (same guard as other actions). Tooltip: "Upload Meeting Transcript". |
| **A3.2** | **Upload panel.** The slide-over contains: (1) **File drop zone** — drag-and-drop or click to select a `.txt` file. On file selection, reads the text content and displays a preview (first 500 chars, scrollable). (2) **Deal association** — pre-populated from the current deal context (deal name, account, opportunity ID) since the upload is triggered from within a deal's workspace. Read-only display, not a picker. (3) **Optional metadata fields** — Meeting Date (date picker, defaults to today), Participants (text input, comma-separated), Notes (textarea for context). (4) **AI Cleanup toggle** — "Clean up transcription with AI" checkbox. When checked, calls `cleanupTranscript` and shows a before/after diff preview before upload. The SE can accept the cleaned version or revert to raw. (5) **Upload button** — calls `uploadManualTranscript` via Code Engine. Shows loading spinner. On success: toast "Transcript uploaded — it will appear in search results within 5 minutes" (Cortex Search target lag). On error: toast with error message + retry option. |
| **A3.3** | **Transcript count badge update.** After a successful upload, the `callCount` displayed in the TDR Workspace (used by the Gong toggle in TDR Chat, the recipe generator, and the Intelligence Panel) must reflect the new transcript. Since `callCount` currently comes from the `opportunitiesmagic` dataset (refreshed daily), the uploaded transcript won't increment it until next refresh. **Workaround:** After upload, increment the local `callCount` in the React state so the UI immediately reflects the new source. The dataset will catch up on next refresh. Alternatively, the upload CE function can return the updated count from Snowflake directly. |
| **A3.4** | **Upload from Intelligence Panel.** Add a secondary upload entry point on the Intelligence Panel's Gong section. When `callCount === 0` (no Gong data), show a prompt: "No call transcripts available. Have meeting notes or a voice memo?" with an "Upload Transcript" button that opens the same upload panel (A3.2). When `callCount > 0`, show a smaller "Add transcript" link below the existing Gong digest summary. |

### A4: Downstream Pipeline Compatibility `[Cortex CLI]`

| Part | Mechanism |
|------|-----------|
| **A4.1** | **Cortex Search auto-indexing.** No action required. The Cortex Search service `GONG_TRANSCRIPT_SEARCH` is built on the view `GONG_TRANSCRIPTS_FOR_SEARCH` with `REFRESH_MODE = INCREMENTAL` and `TARGET_LAG = '5 minutes'`. When a new row is inserted into `GONG_CALL_TRANSCRIPTS`, the view exposes it, and Cortex Search indexes it automatically. The `searchGongTranscripts` Code Engine function will return manual transcript excerpts alongside Gong excerpts with no code changes. |
| **A4.2** | **Digest function update.** Modify `getGongTranscriptDigest` Code Engine function to: (1) query `SOURCE` column to determine transcript sources present, (2) include source attribution in the digest header (e.g., "Based on 6 Gong calls and 1 in-person meeting"), (3) when generating the digest via Cortex `AI_COMPLETE`, instruct the model to note which insights come from in-person vs. recorded calls if distinguishable. This is a minor update to the existing function — the transcript text is still in `COMBINED_TRANSCRIPT` regardless of source. |
| **A4.3** | **Daily batch pipeline compatibility.** The `tdrSeed.ipynb` Cortex pipeline reads from `GONG_CALL_TRANSCRIPTS` grouped by `OPPORTUNITY_ID`. Manual transcript rows in the same table will be included in the aggregation automatically — **no pipeline changes required**. The daily batch remains the backstop that covers all deals on refresh. On-demand regeneration (A5) handles the immediate case after a manual upload. |
| **A4.4** | **Recipe generator compatibility.** `src/lib/recipeGenerator.ts` calls `gongTranscripts.getDigest(opportunityId)` to fetch the digest for recipe inclusion. Since the digest function (A4.2) now includes manual transcript content, recipes will automatically incorporate in-person meeting intelligence. The recipe's "Gong Call Intelligence" section should be updated to "Call Intelligence" or note when non-Gong sources are present. Minor label change in `recipeGenerator.ts`. |

### A5: On-Demand Seeded Input Regeneration `[Cursor]` + `[Cortex CLI]`

This is the critical missing piece. When an SE uploads a transcript, they should not wait 24 hours for `tdrSeed.ipynb` to run. The system must re-generate all 23 seeded TDR field values immediately using the updated transcript corpus.

**The regeneration is a complete re-derivation, not an additive merge.** The AI reads the full transcript corpus for the deal and produces the single best answer for each TDR field from scratch — as if it's seeing the deal for the first time with all available information. It does not carry forward prior seed values, does not append new information to old seeds, and does not produce a "conglomeration" of source-by-source fragments. Each field gets one coherent, synthesized value that reflects the totality of what is known across all sources.

| Part | Mechanism |
|------|-----------|
| **A5.1** | **New Code Engine function: `regenerateSeededInputs`.** Accepts: `opportunityId` (required). The function: (1) reads ALL rows from `GONG_CALL_TRANSCRIPTS` WHERE `OPPORTUNITY_ID = :opportunityId` via Snowflake SQL, (2) assembles the complete transcript corpus with source labels for provenance (e.g., `"[Gong Call — Dec 4, 2025]\n{text}\n\n[In-Person Meeting — Mar 26, 2026]\n{text}"`), (3) calls Cortex `AI_COMPLETE` (or Domo AI endpoint — see A5.2) with a structured prompt that instructs the model to **synthesize all sources into a single unified assessment for each field** (see A5.3), (4) parses the JSON response into a `Record<string, string>` where keys are `stepId::fieldId` pairs (e.g., `deal-context::customer-goal`, `tech-architecture::cloud-platform`, `risk-verdict::top-risks`, `ai-ml::ai-level`), (5) returns `{ success: true, seededInputs: Record<string, string>, transcriptCount: number, sourceBreakdown: { gong: number, manual: number } }`. **Every call is a full refresh** — the function has no memory of prior outputs and ignores any previously seeded values. |
| **A5.2** | **AI provider selection.** Two viable options: **(a) Snowflake Cortex `AI_COMPLETE`** — runs the prompt via `SELECT SNOWFLAKE.CORTEX.COMPLETE(...)` in the same Code Engine SQL context that reads the transcripts. Keeps everything in Snowflake. Models: `mistral-large2`, `llama3.1-70b`, or `snowflake-arctic-instruct`. **(b) Domo AI endpoint** — uses the same Anthropic-backed AI endpoint that the "Enhance" button uses (`/domo/ai/v1/text/generation`). Advantage: same model quality as Enhance (Claude), consistent behavior. Either option works; Cortex is simpler (single round-trip in Snowflake) and avoids external API costs. Domo AI is higher quality but adds a network hop. **Recommendation: start with Cortex `AI_COMPLETE` for simplicity; switch to Domo AI if quality is insufficient.** |
| **A5.3** | **Prompt template — synthesis, not concatenation.** The prompt is the key to quality. It must instruct the model to **read all transcripts holistically, reconcile any contradictions, and produce one definitive answer per field** — not a source-by-source summary. Core prompt structure: *"You are analyzing sales call transcripts and meeting notes for a single deal. Multiple conversations are included below, spanning different dates and sources (recorded calls, in-person meetings). Read ALL of them as a unified body of evidence about this deal. For each TDR field below, produce a single synthesized answer that reflects the most current and complete understanding of the deal based on everything discussed across all sources. If later conversations contradict or update earlier ones, prioritize the most recent information. Do not list what each source said separately — produce one cohesive answer."* For each field: (a) field ID, human-readable label, expected format, (b) for select/multi-select fields, the exact valid option values, (c) for textareas, instruction to produce a 2–4 sentence synthesis grounded in transcript evidence. The model returns a single JSON object with all 23 fields. |
| **A5.4** | **Post-upload trigger.** After `uploadManualTranscript` completes successfully (A2.1), the frontend automatically calls `regenerateSeededInputs(opportunityId)`. This is a chained call: upload finishes → seed regeneration starts. The UI shows a second loading phase: "Analyzing all transcripts and updating TDR insights..." (~5–10 seconds for the AI call). The upload panel remains open showing progress. |
| **A5.5** | **Frontend seed replacement.** When `regenerateSeededInputs` returns, the frontend **replaces** `deal.seededInputs` entirely with the new map (not a merge — a full replacement, since the function already considered all sources). Any TDR field that the SE has **not** already manually saved will show the updated proposed value with the existing propose/accept/dismiss UX from Sprint 32b. Fields the SE has already saved are **not** overwritten — saved values always take precedence over seeds, because saved values represent the SE's deliberate input. Toast notification: "TDR insights refreshed — X fields have updated proposed values based on Y transcripts." The Gong badge in the Intelligence Panel and TDR Chat also reflects the updated transcript count. |
| **A5.6** | **Standalone re-seed button.** Add a "Refresh Insights" action (Lucide `RefreshCw` icon) in the TDR Workspace action bar. Clicking calls `regenerateSeededInputs` independently of a transcript upload — useful when: (a) the SE knows new Gong calls were synced and wants fresh seeds without waiting for page reload, (b) the SE uploaded multiple transcripts and wants one consolidated re-seed, (c) the daily batch ran but the dataset hasn't refreshed yet. |
| **A5.7** | **Add to manifest.json.** Add `regenerateSeededInputs` to `public/manifest.json` `packageMapping` with `opportunityId` (string) as the parameter and `result` (object) as the output. |

---

## Fit Check: R × A

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | Allow SEs to upload manual transcripts that flow into the same storage and processing pipeline as Gong call transcripts. | Core goal | ✅ (A1.1, A2.1, A3.2) |
| R0.1 | Uploaded transcripts must land in `GONG_CALL_TRANSCRIPTS` and be indexed by Cortex Search. | Core goal | ✅ (A2.1, A4.1) |
| R0.2 | Manual transcripts must be associable with a specific deal/opportunity at upload time. | Core goal | ✅ (A3.2 — pre-populated from current deal context) |
| R0.3 | Manual transcripts must be distinguishable from Gong-sourced transcripts via a `source` field. | Core goal | ✅ (A1.1) |
| R1 | Manual transcripts must trigger on-demand re-generation of seeded TDR inputs — not wait for the daily batch. | Must-have | ✅ (A5.1–A5.5, A4.3 as daily backstop) |
| R2 | Upload experience must be low-friction: upload file → select deal → done. | Must-have | ✅ (A3.2 — deal pre-populated, only file is required) |
| R3 | Manual transcripts must appear in TDR Chat alongside Gong transcripts via Cortex Search. | Must-have | ✅ (A4.1) |
| R4 | Digest function must incorporate manual transcripts with source attribution. | Must-have | ✅ (A4.2) |
| R5 | Deals without manual transcripts must work identically to today. | Must-have | ✅ (A1.1 — default `'gong'`, nullable metadata columns) |
| R6 | Raw ASR artifacts must be tolerable; optional AI cleanup available but not required. | Must-have | ✅ (A2.2, A3.2 — cleanup toggle is optional) |

**Notes:**
- `GONG_CALL_TRANSCRIPTS` + Cortex Search is already a general-purpose transcript pipeline — adding a `SOURCE` column makes it universal. Search, digest, and recipe generation pick up manual transcripts passively (A4.1, A4.2, A4.4).
- Seeded inputs are the exception. The daily batch (`tdrSeed.ipynb` → dataset columns) is too slow for the "just uploaded a transcript" case. A5 solves this with an on-demand Code Engine function that runs the same AI modeling in real time and returns updated seeds directly to the frontend — bypassing the dataset entirely for immediacy. The daily batch continues as the pipeline-wide backstop.

---

## Resolved Questions

1. **Should manual transcripts go into a separate table?** → **No — same table (`GONG_CALL_TRANSCRIPTS`).** The entire downstream pipeline (Cortex Search view, digest function, seeded pipeline, recipe generator) reads from this table. A separate table would require updating every consumer. A `SOURCE` column provides clean separation within a unified store.

2. **Should the table be renamed to `DEAL_TRANSCRIPTS`?** → **Not now.** Renaming carries migration risk (Cortex Search service, views, Code Engine queries, and the Domo writeback job all reference the current name). Add a rename to a future cleanup sprint. The `SOURCE` column makes the mixed content self-documenting.

3. **Should audio files be accepted for in-app transcription?** → **Not in v1.** Audio transcription (Whisper, Cortex, etc.) adds significant complexity: large file handling, async processing, transcription quality review. Apple and Google already provide device-level transcription. The SE's workflow is: record on phone → device transcribes to text → upload text file to deal-inspect. If in-app transcription is needed later, it's a separate sprint.

4. **What about speaker attribution in raw ASR text?** → **Best-effort via the optional AI cleanup.** The cleanup function (A2.2) uses Cortex `AI_COMPLETE` to infer speaker labels from context clues (e.g., "our team" vs. "your team," role references, name mentions). It's imperfect but materially improves downstream quality. The SE can also manually edit the text in the preview before uploading.

5. **How does `callCount` stay accurate?** → **Two mechanisms.** (1) Immediately after upload, the React state increments local `callCount` so the UI reflects the new source instantly. (2) The `opportunitiesmagic` dataset refreshes daily and will reflect the updated count from Snowflake. For `callCount` to be accurate in Snowflake, the upload function (A2.1) can either update the existing row's `CALL_COUNT` or the seeding pipeline can recompute it. The simplest path: let the seeding pipeline handle it — it already counts rows per opportunity.

6. **Where does the upload button live?** → **Two locations.** (1) TDR Workspace action bar — next to the existing Wand2 (recipe) and FileText (PDF) icons. (2) Intelligence Panel Gong section — especially useful when `callCount === 0` to surface the "you can upload meeting notes" option at the point of absence.

7. **What file formats are supported?** → **`.txt` only for v1.** Plain text is the universal output of device-level transcription. Adding `.docx`, `.pdf`, `.m4a` is future work. The upload panel reads the file as UTF-8 text and passes the content string to Code Engine.

8. **Does the Cortex Search service need to be recreated?** → **Only the underlying view needs updating.** `GONG_TRANSCRIPTS_FOR_SEARCH` must be recreated to include the `SOURCE` column. The Cortex Search service will detect the view change and reindex on its next refresh cycle — no service recreation needed if only adding columns. If the service does need recreation, it takes <1 minute and auto-indexes existing rows.

9. **Why not just wait for the daily batch to regenerate seeds?** → **Because the SE just did an intentional act (uploading a transcript) and expects to see the impact now.** Uploading a Sony meeting transcript and then seeing stale (or empty) seeded values for 24 hours defeats the purpose. The on-demand function (A5.1) returns updated seeds in ~5–10 seconds. The daily batch still runs for all deals as a backstop, but the on-demand path is what makes the feature feel responsive.

10. **Should `regenerateSeededInputs` write back to the `opportunitiesmagic` dataset?** → **No — return seeds directly to the frontend.** Writing to the Domo dataset from Code Engine is a writeback operation with its own latency and complexity. The frontend already handles seeded inputs as an in-memory `Record<string, string>` on the `Deal` object (Sprint 32b). The on-demand function returns the same shape — the frontend merges it into state. The dataset catches up on the next daily refresh via `tdrSeed.ipynb`.

11. **Cortex `AI_COMPLETE` vs. Domo AI endpoint for seed regeneration?** → **Start with Cortex.** The function already has a Snowflake connection (to read transcripts). Running `AI_COMPLETE` in the same SQL context avoids a separate API call and keeps everything in Snowflake. If the model quality isn't sufficient (Cortex models are strong but not Claude-level), switch to the Domo AI endpoint (same one the Enhance button uses). The function's internal implementation is swappable without changing the external contract.

12. **Can `regenerateSeededInputs` be called independently of a transcript upload?** → **Yes — it's a standalone function.** The "Refresh Insights" button (A5.6) calls it without any upload. This covers cases where new Gong calls have been synced, the daily batch has run, or the SE simply wants a fresh AI pass over the transcript corpus. It's not coupled to the upload flow.

---

## Rabbit Holes

- **Don't build in-app audio transcription.** The temptation to "just add Whisper" leads to audio file handling (large uploads, storage, async processing queues) that's a project unto itself. Apple, Google, and Otter.ai already transcribe on-device. Accept text, not audio.

- **Don't try to auto-detect the deal from transcript content.** Matching a transcript to a deal by entity extraction (company names, participant names) is brittle and error-prone. The SE uploads from within a deal's workspace — the association is explicit and reliable.

- **Don't build a transcript editor.** The upload panel shows a preview and optional AI cleanup, but it's not a full document editor. If the SE wants to heavily edit the transcript, they should do that in a text editor before uploading. The system accepts what's given.

- **Don't rename `GONG_CALL_TRANSCRIPTS` in this sprint.** The rename is cosmetically appealing but touches every Cortex Search view, Code Engine function, and the Domo writeback configuration. It's a separate, careful migration.

- **Don't add manual transcript processing to the front-end.** Cortex AI cleanup (A2.2) and seed regeneration (A5.1) run server-side in Code Engine, not client-side. The transcript text could be large (5,000+ words) and the AI calls take 3–10 seconds — keep them off the main thread.

- **Don't try to write regenerated seeds back to the Domo dataset.** The temptation to update `opportunitiesmagic` columns in real time leads to dataset writeback complexity, schema permissions, and race conditions with the daily batch. Return seeds directly to the frontend and let the daily batch pipeline own the dataset.

- **Don't produce source-by-source summaries for each field.** The worst outcome is a `customer-goal` seed that reads "Gong call 1 said X. Gong call 2 said Y. In-person meeting said Z." That's a concatenation, not an insight. The prompt must instruct the model to synthesize — produce one coherent answer that reflects the latest, most complete understanding of the deal. Each field should read as if written by someone who attended every conversation and is giving their unified assessment.

---

## No-Gos

- No audio file uploads in v1 (text only)
- No client-side AI processing of transcript content
- No renaming of `GONG_CALL_TRANSCRIPTS` in this sprint
- No separate storage table for manual transcripts (unified store only)
- No mandatory metadata fields — deal association is the only required input
- No disruption to existing Gong writeback pipeline (additive only)
- No assumptions about transcript quality — raw ASR artifacts must be accepted

---

## CURRENT State Reference

### Snowflake Transcript Infrastructure

| Object | Type | Purpose |
|--------|------|---------|
| `TDR_APP.PUBLIC.GONG_CALL_TRANSCRIPTS` | Table | Row-level call transcripts. 1,973 rows. Domo writeback. Change tracking enabled. |
| `TDR_APP.PUBLIC.GONG_TRANSCRIPTS_FOR_SEARCH` | View | Uppercase column names for Cortex Search compatibility. |
| `TDR_APP.PUBLIC.GONG_TRANSCRIPT_SEARCH` | Cortex Search Service | Searches `COMBINED_TRANSCRIPT`, filters on `OPPORTUNITY_ID`. Embedding: `snowflake-arctic-embed-m-v1.5`. Target lag: 5 minutes. |

### Known Columns on `GONG_CALL_TRANSCRIPTS` (inferred from docs)

| Column | Type | Notes |
|--------|------|-------|
| `CALL_ID` | VARCHAR | Primary key — Gong call ID |
| `OPPORTUNITY_ID` | VARCHAR | FK to SFDC opportunity |
| `ACCOUNT_NAME` | VARCHAR | Account name |
| `OPPORTUNITY_NAME` | VARCHAR | Opportunity/deal name |
| `CALL_COUNT` | NUMBER | Number of calls for this opportunity |
| `COMBINED_TRANSCRIPT` | VARCHAR(16777216) | Full transcript text (widened from 6188 in Sprint 33a) |
| `SOURCE` | VARCHAR(50) | **NEW — to be added.** Default `'gong'`. |
| `MEETING_DATE` | DATE | **NEW — to be added.** Optional. |
| `PARTICIPANTS` | VARCHAR(2000) | **NEW — to be added.** Optional. |
| `UPLOADED_BY` | VARCHAR(255) | **NEW — to be added.** Optional. |
| `UPLOAD_NOTES` | VARCHAR(4000) | **NEW — to be added.** Optional. |

### Code Engine Functions (existing)

| Function | Params | Returns | Location |
|----------|--------|---------|----------|
| `searchGongTranscripts` | `opportunityId`, `query` | `{ success, results[], resultCount }` | manifest.json packageMapping |
| `getGongTranscriptDigest` | `opportunityId` | `{ success, digest, callCount, ... }` | manifest.json packageMapping |

### Code Engine Functions (new)

| Function | Params | Returns |
|----------|--------|---------|
| `uploadManualTranscript` | `opportunityId`, `accountName`, `opportunityName`, `transcriptText`, `source?`, `meetingDate?`, `participants?`, `uploadedBy?`, `uploadNotes?` | `{ success, callId, rowCount }` |
| `cleanupTranscript` | `rawText` | `{ success, cleanedText, changesSummary }` |
| `regenerateSeededInputs` | `opportunityId` | `{ success, seededInputs: Record<string, string>, transcriptCount, sourceBreakdown: { gong, manual } }` |

### Frontend Files to Modify

| File | Change |
|------|--------|
| `src/pages/TDRWorkspace.tsx` | Add upload icon to action bar, import Sheet panel |
| `src/components/TranscriptUpload.tsx` | **New file.** Upload panel component (file drop, metadata fields, AI cleanup toggle, preview, submit). |
| `src/lib/gongTranscripts.ts` | Add `uploadTranscript()` and `cleanupTranscript()` functions calling new Code Engine endpoints. Rename module-level references from "Gong" to "Transcripts" in comments/logging where appropriate. |
| `src/lib/recipeGenerator.ts` | Update "Gong Call Intelligence" section label to "Call Intelligence" or add source attribution when non-Gong transcripts present. |
| `src/components/TDRIntelligence.tsx` | Add "Upload Transcript" entry point in the Gong section, especially for `callCount === 0` state. |
| `public/manifest.json` | Add `uploadManualTranscript` and `cleanupTranscript` to packageMapping. |

### Data Flow After Implementation

```
                    ┌─────────────────┐
                    │   Gong API      │
                    │   (daily sync)  │
                    └────────┬────────┘
                             │ source = 'gong'
                             ▼
┌──────────────┐    ┌────────────────────────────────┐
│  SE uploads  │    │  GONG_CALL_TRANSCRIPTS          │
│  text file   │───►│  (unified transcript store)     │
│  via UI      │    │  SOURCE = 'voice_memo' | 'gong' │
└──────────────┘    └────────┬───────────────────────┘
  source = 'voice_memo'     │
                             │
              ┌──────────────┼──────────────────────┐
              │              │                      │
              ▼              ▼                      ▼
  ┌────────────────┐  ┌──────────────┐  ┌────────────────────────┐
  │ Cortex Search  │  │ Digest       │  │ SEEDED INPUTS          │
  │ (auto-indexed, │  │ (AI_COMPLETE │  │                        │
  │  5-min lag)    │  │  summary)    │  │  ┌──────────────────┐  │
  └───────┬────────┘  └──────┬───────┘  │  │ ON-DEMAND (A5)   │  │
          │                  │          │  │ regenerateSeeded  │  │
          ▼                  ▼          │  │ Inputs — instant  │  │
  ┌──────────────┐  ┌──────────────┐   │  │ (~5-10s, returns  │  │
  │ TDR Chat Q&A │  │ Recipe       │   │  │ seeds to frontend │  │
  │ context      │  │ context      │   │  │ directly)         │  │
  └──────────────┘  └──────────────┘   │  └────────┬─────────┘  │
                                       │           │             │
                                       │  ┌────────▼─────────┐  │
                                       │  │ DAILY BATCH      │  │
                                       │  │ tdrSeed.ipynb →   │  │
                                       │  │ opportunitiesmagic│  │
                                       │  │ dataset (backstop │  │
                                       │  │ for all deals)    │  │
                                       │  └──────────────────┘  │
                                       └────────────────────────┘
                                                    │
                                                    ▼
                                          ┌──────────────────┐
                                          │ Proposed values   │
                                          │ in TDR fields     │
                                          │ (propose/accept/  │
                                          │  dismiss UX)      │
                                          └──────────────────┘
```
