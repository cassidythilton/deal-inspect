---
shaping: true
status: captured
type: blog-post
appetite: small (1 session)
---

# Blog Post: Cursor + Cortex CLI — Building AI/ML in Tandem

## Problem

There's no good public example of two AI coding agents — one application-focused (Cursor), one infrastructure-focused (Cortex CLI) — collaborating on a single project. Developers building on Snowflake with Domo (or similar platforms) would benefit from seeing the workflow, the handoffs, the self-healing, and the results.

## Audience

- Data engineers and analytics engineers considering AI-assisted development
- Snowflake practitioners curious about Cortex CLI for ML workflows
- Domo developers building intelligent apps
- Anyone interested in multi-agent development patterns

## Thesis

Two specialized AI agents — Cursor for application code and Cortex CLI for Snowflake infrastructure — can collaborate on a complex AI/ML pipeline faster and more reliably than either could alone. The key is clear domain boundaries: Cursor authors the app, Cortex CLI authors and executes the SQL. When one agent hits a wall (type mismatches, leakage), the other catches it.

## Story Arc

### 1. Context: The App (brief)
- TDR Deal Inspection app — a Domo App Studio application for SE deal reviews
- Built over 39 sprints, ~2 months
- The AI/ML layer (Sprint 28) is the focus of this post

### 2. The ML Problem
- Predict which deals will close (propensity-to-close)
- Use Snowflake's native `SNOWFLAKE.ML.CLASSIFICATION` — no Python, no external compute
- Batch-score 6,500+ open pipeline deals nightly
- Surface scores, quadrant labels, and factor explanations in the app

### 3. The Collaboration Pattern
- **Cursor** authored: the SQL file (`sprint_28c_ml_pipeline.sql`), the shaping docs, the data validation script, the manifest wiring, the TypeScript types and transform logic
- **Cortex CLI** executed: the SQL against Snowflake, self-healed type mismatches (People AI Engagement Level is FLOAT not VARCHAR, Created Date is TIMESTAMP not epoch), created additional views for scoring parity, trained the model, ran batch scoring
- **The handoff**: Cursor writes → User runs via Cortex CLI → Cortex reports results → Cursor reconciles fixes back into the SQL file → repeat

### 4. The Leakage Catch
- v1 model: AUC 0.997 — too good to be true
- Cursor audited the feature set and found 5 leaky features (account win rate includes current deal's outcome, stage age measures time in "Closed Won" stage not pre-close stage, etc.)
- Dropped the leakers, retrained via Cortex CLI
- v2 model: F1 92.3% (Won class) — honest signal from legitimate features
- Top features: days in pipeline, line items, contract type, deal type, sales segment

### 5. The End-to-End Pipeline
```
Cursor authors SQL → Cortex CLI executes in Snowflake →
Model trains → Cortex reports metrics → Cursor validates →
Predictions table → Domo sync → LEFT JOIN → App reads scores
```

### 6. Takeaways
- Domain boundaries matter: don't ask Cortex to write React, don't ask Cursor to run Snowflake DDL
- Self-healing agents reduce iteration cycles (Cortex fixed type issues without human intervention)
- Leakage auditing requires human/Cursor judgment — Cortex CLI executed the training but didn't question the features
- The combination is greater than the sum: Cursor provides rigor (shaping, validation, reconciliation), Cortex provides execution speed

## Key Artifacts to Reference
- `sql/sprint_28c_ml_pipeline.sql` — the complete ML pipeline
- `notebooks/02_pre_training_validation.py` — pre-training data quality gate
- `shaping/ml-predictions-table-approach.md` — architectural decision to use predictions table vs. Code Engine
- `.cursor/rules/cortex-cli.mdc` — the "line" between Cursor and Cortex domains
- The Snowflake Query History screenshots showing all-green execution

## Tone & Format
- Technical but accessible — assume the reader knows what ML is but not necessarily Snowflake/Domo specifics
- First person (Cassidy's voice) — "I asked Cursor to...", "Cortex CLI then..."
- ~1,500–2,000 words
- Include code snippets (SQL excerpts, not full files)
- Include the leakage audit table (before/after metrics)
- Include at least one Snowflake Query History screenshot

## Open Questions
1. Where will this be published? (blog platform, LinkedIn, Medium, Snowflake community?)
2. Should it include the Snowflake Query History screenshots from the session?
3. Should it name the specific Cortex CLI commands used?
4. Does the reader need context on what Domo App Studio is, or can we assume familiarity?

## Draft Location
When ready to write: `blog/cursor-cortex-collaboration.md`
