---
shaping: true
status: draft
appetite: medium (3–5 days)
---

# Gong Call Transcripts in TDR Chat

## Source

> I'm considering adding some functionality to the app related to domo filesets (already implemented) and gong: I'd like to be able to ask questions about a specific deal/opportunity. One thought on the pipeline is I generate transcripts from gong to filesets (in PDF form, etc.) that are landed in filesets where I can search them. Or, perhaps I just go straight to gong via api at the deal level and fetch all transcripts related to a deal in order to answer questions via chat. The experience will be available in the chat modal on intelligence panel.

---

## Problem

Today, when an SE uses TDR Chat to ask questions about a deal, the AI can draw on two context sources: (1) the deal's structured data from `opportunitiesmagic` (stage, ACV, competitors, etc.) and (2) the Knowledge Base filesets (partner playbooks, competitive battle cards). **Neither source contains what was actually said on calls with the customer.** The richest qualitative signal — what the customer described as their pain, what objections they raised, what technical constraints they mentioned, how they reacted to pricing — lives exclusively in Gong call transcripts, locked behind a separate system.

This creates a significant blind spot. An SE asking "What did the customer say about their timeline?" or "Were there any security concerns raised?" gets answers synthesized from generic deal metadata and playbook excerpts rather than **the actual words spoken on discovery and demo calls.** The Cortex pipeline already extracts structured TDR field values from Gong transcripts (Sprint 32b), but the raw transcript text — the full conversational context — is not available for free-form Q&A.

**The core tension is how to bridge Gong transcript data into the chat experience.** There are multiple viable paths: landing transcripts in Domo filesets and leveraging the existing semantic search infrastructure, calling the Gong API directly at query time, or a hybrid approach. Each path has different trade-offs around latency, freshness, API rate limits, cost, and architectural complexity.

---

## Requirements

### R0: Enable TDR Chat to answer user questions using the actual content of Gong call transcripts for the current deal

- R0.1: The user must be able to ask natural-language questions in TDR Chat and receive answers grounded in what was said on Gong calls associated with the current opportunity
- R0.2: Answers must cite or reference which call(s) the information came from (date, participants, or call title)

### R1: Transcript context must be scoped to the current deal/opportunity

Transcripts from unrelated deals must never leak into the chat context. The system must reliably associate Gong calls with the correct Salesforce opportunity.

### R2: The experience must live in the existing Chat modal on the Intelligence panel

No new pages or modals. The transcript Q&A integrates into the existing `TDRChat` component, alongside the current provider/model selectors and KB toggle.

### R3: Latency must be acceptable for interactive chat

The user should not wait more than ~10 seconds for the first token of a response. If transcript retrieval adds significant latency, it should be pre-fetched or cached rather than blocking each query.

### R4: The system must handle deals with no Gong calls gracefully

If an opportunity has zero associated Gong calls, the chat should work exactly as it does today — no errors, no empty states that confuse the user.

### R5: Gong API credentials must be stored securely

API key and secret must never appear in source code, manifests, or client-side bundles. They must be server-side only (Code Engine environment or Snowflake secrets).

### R6: The solution must respect Gong API rate limits

Gong enforces 3 requests/second and 10,000 requests/day. The architecture must avoid per-chat-message API calls to Gong if possible, or implement caching/batching to stay within limits.

---

## Solution Shape [A: Gong → Domo Fileset Pipeline (Batch ETL)]

Land Gong transcripts as documents in a Domo fileset on a scheduled basis. TDR Chat queries them via the existing `filesetIntel.search()` semantic search — no real-time Gong API calls from the app.

### A1: Transcript ETL Pipeline (Batch)

| Part | Mechanism |
|------|-----------|
| **A1.1** | **Scheduled Gong transcript extraction.** A Python notebook or Snowflake task runs daily (or on-demand). It calls `POST /v2/calls/extensive` with date-range filters to list recent calls, then `POST /v2/calls/transcript` to fetch transcripts for each call. Gong API credentials stored as Snowflake secrets or notebook environment variables. |
| **A1.2** | **Opportunity-call association.** For each call, the pipeline extracts CRM context (account name, participant emails) from the `/v2/calls/extensive` response. It joins against the `opportunitiesmagic` dataset to associate calls with opportunity IDs. Calls that can't be matched are logged but not discarded (they may match future opportunities). |
| **A1.3** | **Transcript document formatting.** Each call's transcript is formatted as a structured document: header (call date, duration, participants, opportunity ID, account name) + body (speaker-attributed utterances). Saved as individual text/PDF files or as a combined document per opportunity. |
| **A1.4** | **Land in Domo fileset.** Formatted transcripts are uploaded to a dedicated Domo fileset (e.g., "Gong Call Transcripts") via the Domo Files API. Each file is named with a convention like `{OpportunityId}_{CallDate}_{CallTitle}.txt` to enable filename-based filtering. |

### A2: Chat Integration (Frontend)

| Part | Mechanism |
|------|-----------|
| **A2.1** | **New "Call Transcripts" toggle in TDRChat.** Add a toggle alongside the existing KB toggle in `src/components/TDRChat.tsx`. When enabled, the chat includes transcript context in the query. The toggle label shows the number of available transcripts (e.g., "Gong Calls (4)"). |
| **A2.2** | **Transcript search via filesetIntel.** When the Gong toggle is on, `filesetIntel.search()` is called against the Gong transcripts fileset with the user's query, filtered by opportunity-related keywords. The existing `buildChatContext()` method formats matches into the chat prompt. This reuses the entire existing fileset pipeline — no new search infrastructure needed. |
| **A2.3** | **Suggestion chips for transcript queries.** Add transcript-specific suggestion chips when Gong data is available: "Summarize all calls", "What were the key objections?", "Timeline discussed on calls", "Technical requirements mentioned". |

### A3: Fileset Configuration

| Part | Mechanism |
|------|-----------|
| **A3.1** | **Dedicated fileset ID in appSettings.** Add a `gongFilesetId` field to `src/lib/appSettings.ts` (separate from the existing KB filesets). This fileset is purpose-built for Gong transcripts and searched independently. |
| **A3.2** | **Opportunity-scoped search.** When searching the Gong fileset, prepend the opportunity ID or account name to the query to scope results. Alternatively, use filename-pattern matching (`{OpportunityId}_*`) if the fileset supports it. |

---

## Solution Shape [B: Direct Gong API at Query Time]

Call the Gong API in real-time when the user asks a question. No intermediate storage — transcripts are fetched, assembled, and injected into the chat prompt on demand.

### B1: Gong API Proxy (Code Engine)

| Part | Mechanism |
|------|-----------|
| **B1.1** | **Code Engine function: `getGongTranscripts`.** A new Code Engine function that accepts an opportunity ID, looks up associated Gong call IDs (via a mapping table or participant-email join), calls `POST /v2/calls/transcript` for each, and returns the combined transcript text. Gong API credentials stored as Code Engine environment variables (never client-side). |
| **B1.2** | **Call-opportunity mapping.** Since the Gong API cannot filter calls by opportunity ID directly, the function either: (a) maintains a cached mapping table (populated by a lightweight daily sync), or (b) calls `/v2/calls/extensive` with date-range filters and matches by participant email against the deal's contacts. Option (a) is strongly preferred for latency. |
| **B1.3** | **Transcript caching in Snowflake.** After fetching transcripts from Gong, cache them in a Snowflake table (`GONG_CALL_TRANSCRIPTS`: `CALL_ID`, `OPPORTUNITY_ID`, `CALL_DATE`, `PARTICIPANTS`, `TRANSCRIPT_TEXT`, `FETCHED_AT`). Subsequent requests for the same call return cached data. Cache TTL: 24 hours or until next daily refresh. |

### B2: Chat Integration (Frontend)

| Part | Mechanism |
|------|-----------|
| **B2.1** | **Gong context toggle in TDRChat.** Similar to A2.1 — a toggle to include Gong call context. When enabled, the chat route includes a call to `getGongTranscripts` before sending the message to the AI provider. |
| **B2.2** | **Context assembly.** The Code Engine `sendChatMessage` function is extended to accept an `includeGongTranscripts` flag. When set, it fetches cached transcripts (or calls Gong API if cache is cold) and prepends them to the system prompt as `### Gong Call Transcripts` context. |
| **B2.3** | **Token budget management.** Gong transcripts can be very long (30-minute call ≈ 8,000 words ≈ 10K tokens). The context assembly must truncate/summarize to fit within the model's context window. Strategy: include the most recent N calls, truncate each to the most relevant sections using a pre-summarization step (Cortex AI), or use the user's query to select the most relevant transcript segments. |

---

## Solution Shape [C: Hybrid — Gong API Sync + Snowflake Cache + Cortex Search]

Combine the reliability of batch sync with the flexibility of direct queries. Gong transcripts are synced to Snowflake on a schedule; Cortex AI (via Cortex Search or `AI_COMPLETE`) is used to search/summarize them at query time.

### C1: Gong → Snowflake Sync

| Part | Mechanism |
|------|-----------|
| **C1.1** | **Daily transcript sync task.** A Snowflake task (or Python notebook) runs daily: calls Gong API to fetch new/updated call transcripts, associates them with opportunities, and inserts into `TDR_APP.TDR_DATA.GONG_CALL_TRANSCRIPTS`. Schema: `CALL_ID VARCHAR`, `OPPORTUNITY_ID VARCHAR`, `ACCOUNT_NAME VARCHAR`, `CALL_DATE TIMESTAMP`, `CALL_TITLE VARCHAR`, `DURATION_SECONDS NUMBER`, `PARTICIPANTS VARIANT`, `TRANSCRIPT_TEXT VARCHAR(16777216)`, `SYNCED_AT TIMESTAMP`. `[Cortex CLI]` |
| **C1.2** | **Opportunity-call association via Snowflake join.** Join Gong call participants against contacts/emails in the `opportunitiesmagic` dataset or a Salesforce contacts table. Runs as part of the sync task. More reliable than real-time email matching. `[Cortex CLI]` |

### C2: Cortex-Powered Transcript Search

| Part | Mechanism |
|------|-----------|
| **C2.1** | **Cortex Search service over transcripts.** Create a Cortex Search service on `GONG_CALL_TRANSCRIPTS` that indexes `TRANSCRIPT_TEXT` with `OPPORTUNITY_ID` as a filter column. This enables semantic search scoped to a specific deal — e.g., "find segments where the customer discussed security requirements for opportunity X." Query via `SNOWFLAKE.CORTEX.SEARCH_PREVIEW()`. Confirmed working: ~200–400ms latency, `snowflake-arctic-embed-m-v1.5` embeddings, auto-refresh with `TARGET_LAG = '5 minutes'`. `[Cortex CLI]` |
| **C2.2** | **Code Engine function: `searchGongTranscripts`.** Accepts `opportunityId` and `query`, calls the Cortex Search service, returns the top-K relevant transcript segments with call metadata (date, participants). Falls back to `LIKE`-based SQL search if Cortex Search is unavailable. `[Cursor]` |
| **C2.3** | **Pre-summarization for long transcripts.** For deals with many calls, use `SNOWFLAKE.CORTEX.AI_COMPLETE` to generate a per-call summary stored alongside the full transcript. The summary is used for initial context; full transcript segments are fetched only when the user's question requires verbatim detail. `[Cortex CLI]` |

### C3: Chat Integration

| Part | Mechanism |
|------|-----------|
| **C3.1** | **Gong context toggle + call count badge.** Same UX as A2.1/B2.1. The toggle shows the number of synced calls for this deal. Badge reuses the existing `callCount` field from Sprint 32b. |
| **C3.2** | **Context injection via Code Engine.** The `sendChatMessage` function is extended to call `searchGongTranscripts` when `includeGongTranscripts` is true. Relevant transcript segments are injected into the system prompt alongside KB context and deal data. |
| **C3.3** | **Citation metadata.** AI responses include structured citations: `[Call: Mar 5 2026, Discovery w/ VP Engineering]` linking back to specific Gong calls. The frontend renders these as clickable links (opening the Gong call URL in a new tab). |

---

## Fit Check: R × A, B, C

| Req | Requirement | Status | A (Fileset) | B (Direct API) | C (Hybrid) |
|-----|-------------|--------|:-----------:|:--------------:|:----------:|
| R0 | Enable TDR Chat to answer questions using Gong call transcripts for the current deal | Core goal | ✅ (A1.4, A2.2) | ✅ (B1.1, B2.2) | ✅ (C2.2, C3.2) |
| R0.1 | Natural-language questions answered from actual call content | Core goal | ✅ (A2.2) | ✅ (B2.2) | ✅ (C2.2) |
| R0.2 | Answers cite which call(s) the information came from | Core goal | ❌ | ✅ (B2.2) | ✅ (C3.3) |
| R1 | Transcript context scoped to the current deal/opportunity | Must-have | ✅ (A3.2) | ✅ (B1.2) | ✅ (C1.2, C2.1) |
| R2 | Experience lives in the existing Chat modal | Must-have | ✅ (A2.1) | ✅ (B2.1) | ✅ (C3.1) |
| R3 | Latency acceptable for interactive chat (<10s) | Must-have | ✅ (A2.2) | ❌ | ✅ (C2.2) |
| R4 | Deals with no Gong calls work identically to today | Must-have | ✅ (A2.1) | ✅ (B2.1) | ✅ (C3.1) |
| R5 | Gong API credentials stored securely (server-side only) | Must-have | ✅ (A1.1) | ✅ (B1.1) | ✅ (C1.1) |
| R6 | Respects Gong API rate limits (3/sec, 10K/day) | Must-have | ✅ (A1.1) | ❌ | ✅ (C1.1) |

**Notes:**
- **A fails R0.2:** Fileset semantic search returns document chunks but loses structured call metadata (date, participants) unless the document format is carefully designed. Partial mitigation possible but not robust.
- **B fails R3:** Real-time Gong API calls add 2–5 seconds per call transcript fetched. For a deal with 10+ calls, total latency could exceed 30 seconds. The Snowflake cache (B1.3) mitigates this after first fetch, but cold-cache latency is unacceptable.
- **B fails R6:** Without caching, every chat message triggers Gong API calls. A busy day with 50 users could exhaust the daily limit. The cache (B1.3) mitigates this, but then B essentially becomes C.
- **C satisfies all requirements.** Batch sync handles rate limits and latency; Cortex Search handles semantic relevance and scoping; the hybrid approach gets the benefits of both A and B without their weaknesses.

---

## Recommendation: Shape C (Hybrid)

Shape C is the recommended approach. It naturally extends the existing architecture:
- The daily Gong sync parallels the existing Cortex pipeline that already reads Gong transcripts for Sprint 32b seeded fields (see `samples/tdrSeed.ipynb`)
- Snowflake caching aligns with the existing `TDR_CHAT_MESSAGES`, `ACCOUNT_INTEL_CACHE` pattern
- Cortex Search / `AI_COMPLETE` are already used throughout the app (Sprint 19.5 KB summarization, Sprint 32b field extraction)
- The Code Engine integration pattern (`callCodeEngine → proxy function → Snowflake`) is established

Shape A (filesets) is a viable fallback if Cortex Search proves unavailable or the Snowflake schema changes are undesirable. It's simpler but loses call-level citation and requires a separate ETL into the Domo file system.

---

## Resolved Questions

1. **Can the Gong API filter calls by Salesforce Opportunity ID directly?** → **No.** The `/v2/calls/extensive` endpoint does not support opportunity ID as a filter parameter. The workaround is to fetch calls by date range and match participant emails against contacts associated with the opportunity. This is why a batch sync (Shape C) is preferred over real-time API queries — the association logic is complex and should run offline.

2. **Does Gong have an "AI" API for asking questions about calls?** → **No.** Gong's API is data-access only (calls, transcripts, users, CRM sync). There is no "ask a question about this call" endpoint. The AI layer must be built on our side using Cortex AI or another LLM provider against the raw transcript text.

3. **How large are Gong transcripts?** → **A typical 30-minute call produces ~8,000 words (~10K tokens).** A deal with 10 discovery/demo calls could have 80,000+ words of transcript. This is too large to inject wholesale into a chat prompt. Semantic search (Cortex Search) or pre-summarization is required to select relevant segments.

4. **Should transcripts go into the existing KB fileset or a separate one?** → **Separate.** Gong transcripts are deal-specific and ephemeral (refreshed daily); KB documents (battle cards, playbooks) are static reference material. Mixing them would pollute KB search results with call transcripts from unrelated deals. In Shape C, transcripts live in Snowflake — not in filesets at all.

5. **Where should Gong API credentials live?** → **Snowflake secrets (for the sync task) and Code Engine environment variables (if real-time fallback is needed).** Never in `manifest.json`, never in frontend code, never committed to git.

---

## Rabbit Holes

- **Don't try to build real-time Gong API integration without caching.** The rate limits (3/sec, 10K/day) and the inability to filter by opportunity ID make real-time calls fragile and slow. A cold-cache query for a deal with 15 calls would take 5+ seconds just for API roundtrips, plus transcript processing time.

- **Don't attempt to land full transcripts in Domo filesets as the primary approach.** Domo fileset semantic search is optimized for static documents (PDFs, playbooks), not for deal-scoped ephemeral data that refreshes daily. You'd need to delete/replace files constantly, and scoping search results to a single opportunity is awkward without native metadata filtering.

- **Don't inject full transcripts into the chat prompt.** A deal with 10 calls could produce 100K+ tokens of transcript text — far exceeding context windows. Always use semantic search or pre-summarization to select the relevant 2,000–4,000 tokens.

- **Don't try to parse call-level provenance from the Cortex-seeded fields.** Sprint 32b's seeded data (`tdrSeed.ipynb`) aggregates across all Gong calls for an opportunity — there's no per-call attribution. This feature (transcript Q&A) is complementary, not a replacement: seeded fields give structured answers; transcript search gives verbatim conversational evidence.

---

## No-Gos

- No Gong API credentials in source code, manifests, or client-side bundles
- No real-time Gong API calls from the frontend (browser) — all Gong access is server-side
- No modification to existing KB fileset search behavior — Gong transcripts are a separate context source
- No automatic injection of transcript context without user opt-in (toggle must be explicitly enabled)

---

## Resolved Spikes

1. **Cortex Search availability:** Does the current Snowflake account support Cortex Search services? → **Yes. Confirmed working.** Snowflake Enterprise Edition on AWS US East 1 (DOMOPARTNER / DOMOINC). A test Cortex Search service was created, queried with filter columns, and dropped successfully. Query latency: **~200–400ms**. Uses `snowflake-arctic-embed-m-v1.5` embedding model (default). Auto-indexes with configurable `TARGET_LAG`. Full details in `shaping/spike-cortex-search-gong.md`.

2. **Can Cortex Search support live Q&A chat?** → **Yes.** The end-to-end flow (Cortex Search query ~300ms + AI completion ~3–5s) fits well within the <10s interactive requirement. Filter columns (`OPPORTUNITY_ID`) correctly scope results to a single deal. The SQL syntax (`SNOWFLAKE.CORTEX.SEARCH_PREVIEW(...)`) is compatible with the Code Engine `executeSql` pattern.

## Open Questions

1. **Gong call-opportunity association accuracy:** How reliably can we match Gong calls to Salesforce opportunities using participant emails? The existing `tdrSeed.ipynb` pipeline already does this — need to verify its accuracy rate and whether it can be reused for transcript sync. → **Check existing pipeline.**

2. **Token budget allocation:** When both KB context and Gong transcript context are enabled, how should the token budget be split? Current KB context uses ~3,000 chars (`buildChatContext` maxChars). Need to decide the allocation for transcripts. → **Design decision during implementation.**

---

## CURRENT State Reference

### Chat Context Sources (current)

| Source | Toggle | Mechanism | Files |
|--------|--------|-----------|-------|
| Deal data | Always on | Structured fields from `opportunitiesmagic` passed as `deal` prop | `src/pages/TDRWorkspace.tsx`, `src/lib/domo.ts` |
| TDR inputs | Always on | Current session inputs assembled by Code Engine | `codeengine/consolidated-sprint4-5.js` |
| Knowledge Base | "KB" toggle | `filesetIntel.search()` → `buildChatContext()` → prepend to message | `src/lib/filesetIntel.ts`, `src/components/TDRChat.tsx` |
| **Gong transcripts** | **Not available** | **—** | **—** |

### Chat Context Sources (proposed — Shape C)

| Source | Toggle | Mechanism | Files |
|--------|--------|-----------|-------|
| Deal data | Always on | *(unchanged)* | *(unchanged)* |
| TDR inputs | Always on | *(unchanged)* | *(unchanged)* |
| Knowledge Base | "KB" toggle | *(unchanged)* | *(unchanged)* |
| **Gong transcripts** | **"Gong Calls" toggle** | **`searchGongTranscripts(opportunityId, query)` → Cortex Search → inject segments into system prompt** | **`codeengine/gongTranscripts.js` (new), `src/components/TDRChat.tsx`** |

### Gong API Endpoints Required

| Endpoint | Method | Purpose | Rate Limit Impact |
|----------|--------|---------|-------------------|
| `/v2/calls/extensive` | POST | List calls with metadata + CRM context (date range filter) | 1 call per sync batch |
| `/v2/calls/transcript` | POST | Fetch transcript text for specific call IDs | 1 call per ~10 transcripts (batched) |

### Existing Gong Integration (Sprint 32b)

- `samples/tdrSeed.ipynb` — Cortex pipeline that reads Gong transcripts → models TDR field values
- `opportunitiesmagic` dataset — 24 seeded columns derived from Gong call analysis
- `call_count` field — number of Gong calls analyzed per opportunity
- **Gap:** The pipeline extracts structured field values but discards the raw transcript text. Shape C fills this gap by persisting full transcripts in Snowflake for free-form Q&A.
