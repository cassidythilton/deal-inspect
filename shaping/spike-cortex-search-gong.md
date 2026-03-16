## Cortex Search Spike: Gong Transcript Q&A Viability

### Context
The Gong Transcripts in TDR Chat shaping doc (`shaping/gong-transcripts-in-chat.md`) proposed Shape C (Hybrid) which depends on Cortex Search services for semantic search over cached Gong transcripts in Snowflake. This spike validates whether Cortex Search is available, performant enough for live chat, and what the integration path looks like.

### Goal
Determine whether Cortex Search can serve as the semantic search layer for deal-scoped Gong transcript Q&A at interactive chat latencies (<10 seconds).

### Questions & Answers

| # | Question | Answer |
|---|----------|--------|
| **Q1** | Is Cortex Search available in this Snowflake account? | **Yes.** Snowflake Enterprise Edition on AWS US East 1 (DOMOPARTNER / DOMOINC). Cortex Search is GA and fully supported. A test service was created, queried, and dropped successfully. |
| **Q2** | What is the query latency? | **~200–400ms per query.** Tested with 3 sample transcript rows (~500 words each). Well within the <10s interactive requirement — leaves ample headroom for the AI completion step. |
| **Q3** | Can results be filtered by Opportunity ID? | **Yes.** Filter columns work with `{"@eq": {"OPPORTUNITY_ID": "opp-001"}}` syntax. The test correctly excluded transcripts from other opportunities. Supports `@and`, `@or` for compound filters. |
| **Q4** | What embedding model is used? | **snowflake-arctic-embed-m-v1.5** (default). Optimized for retrieval tasks. No need to specify a custom model. |
| **Q5** | Does the index auto-update when new transcripts are inserted? | **Yes.** `REFRESH_MODE = INCREMENTAL` (default) detects new rows and refreshes automatically. `TARGET_LAG` is configurable — `'5 minutes'` is practical for this use case. |
| **Q6** | What is the SQL syntax for Code Engine integration? | `SNOWFLAKE.CORTEX.SEARCH_PREVIEW('service_name', '{"query":"...", "columns":[...], "filter":{...}, "limit":N}')` — returns JSON. Parse with `PARSE_JSON()`. Compatible with Code Engine `executeSql` pattern. |
| **Q7** | What schema/permissions are needed? | The test used `TDR_APP.ML_MODELS` (SYSADMIN access). `TDR_APP.TDR_DATA` requires ACCOUNTADMIN for DDL. Either schema works; ML_MODELS is the path of least resistance. |

### Acceptance
**Spike complete.** We can confidently describe how Cortex Search will power the Gong transcript Q&A feature:

- **Architecture confirmed:** Gong transcripts → Snowflake table (daily sync) → Cortex Search service (auto-indexed) → Code Engine query function → TDR Chat context injection
- **Latency confirmed:** 200–400ms search + ~2–5s AI completion = well under 10s total
- **Scoping confirmed:** OPPORTUNITY_ID filter column ensures deal-level isolation
- **No blockers identified**

### Account Details
| Property | Value |
|----------|-------|
| Edition | Enterprise |
| Region | AWS_US_EAST_1 |
| Account | DOMOPARTNER |
| Organization | DOMOINC |
| Snowflake Version | 10.8.0 |

### Test Artifacts
All test objects (`GONG_TRANSCRIPT_SPIKE` table and `GONG_TRANSCRIPT_SPIKE_SEARCH` service) were created in `TDR_APP.ML_MODELS` and dropped after testing. No residual objects remain.
