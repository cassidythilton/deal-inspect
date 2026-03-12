---
shaping: true
status: approved
type: blog-post-rewrite
appetite: medium (1 session)
supersedes: shaping/blog-cursor-cortex-collaboration.md
---

# Blog Post Rewrite: One-Person Product & Engineering with AI Agents

## Problem

The current blog post tells the wrong story. It leads with the ML leakage catch and frames the work as "we built an ML model with two coding agents." That's a minor anecdote inside a much bigger narrative.

The real story: **one person ran a complete product and engineering endeavor — 17 pillars, 43 sprints, 6,800-line strategy document — using AI agents not just as code generators but as product collaborators.** This isn't vibe coding. This is structured product development: user stories, engineering requirements, roadmap, sprints, UAT, iteration — the same playbook a 5-person team would run, except the team was one human + two AI agents.

The current draft:
- Leads with the ML pipeline (a detail, not the thesis)
- Treats the leakage catch as the climax (it's a footnote)
- Doesn't mention the IMPLEMENTATION_STRATEGY.md or product strategy work
- Doesn't mention the shaping methodology
- Doesn't explain how the human operated — UAT, iteration, sprint planning
- Buries the Cursor + Cortex CLI collaboration pattern under technical details

## Requirements

### R0: The thesis is "structured product development with AI agents"

The central claim: you can run a full product + engineering lifecycle solo if you treat AI agents as team members with clear roles — not as autocomplete tools. This is the opposite of vibe coding. Vibe coding is "generate code, see if it works." This was: shape requirements → plan sprints → implement with agents → UAT → iterate → ship.

### R1: The IMPLEMENTATION_STRATEGY.md is a first-class artifact

The 6,800-line strategy doc is the proof. It has:
- 17 pillars, each independently valuable, described in elevator-pitch format
- 43 sprints with goals, risk assessments, effort estimates, dependencies, and definitions of done
- A flywheel diagram showing how pillars compound
- A "What This Means Practically" table showing every incremental stopping point
- Version history (Draft 1.0 → 6.5)

This doc was co-authored with Cursor. The human provided direction; Cursor wrote the strategy, organized the roadmap, tracked progress. The doc IS the product management artifact — it's how a solo developer ran sprints without Jira.

### R2: The shaping methodology is part of the operating model

12 shaping documents in `/shaping/`. The methodology comes from [@rjs's shaping skill](https://github.com/rjs/shaping-skills/blob/main/shaping/SKILL.md) — a structured approach for defining problems (Requirements) and exploring solutions (Shapes) before writing code. Requirements are numbered (R0, R1...), solution shapes are lettered (A, B, C...), fit checks are binary (pass/fail). Every major feature was shaped before it was built.

This is the planning layer that separates structured development from vibe coding. You don't ask the agent to "add ML." You shape the problem, define requirements, explore solution options, check fit, THEN sprint.

### R3: Cursor + Cortex CLI collaboration is the centerpiece

Two agents, two domains. One rule file defines the boundary:

> If it runs IN Snowflake → Cortex CLI.
> If it runs OUTSIDE Snowflake → Cursor.

Cursor handled: strategy docs, shaping, SQL authoring, TypeScript/React, data validation, PDF generation, documentation. Cortex CLI handled: executing SQL against Snowflake, self-healing type mismatches, training models, batch scoring, runtime debugging.

The handoff loop: Cursor writes → user runs via Cortex CLI → Cortex executes & self-heals → user reconciles fixes back to source → repeat. This is the "progressive agentic coding" the user is describing — structured collaboration, not autonomous generation.

### R4: The human's role is explicit

The human (Cassidy) did:
- Product direction ("what should we build next?")
- UAT testing after every sprint (publishing to Domo, clicking through, reporting issues)
- Iteration feedback ("the labels are overlapping," "the tooltip is embarrassingly basic," "that's not intuitive")
- Quality gating ("AUC 0.997 — are you sure there's no leakage?")
- Architecture decisions (predictions table vs. real-time inference, 3 AI providers vs. 1)
- Shaping approval (reviewing requirements, selecting shapes)

The human didn't write code. The human ran the product.

### R5: The generative AI and agentic components are woven in, not a separate act

Don't treat GenAI as "Act 2." Weave it into the product story naturally:
- Cortex AI functions are part of the intelligence layer (Pillar 4)
- Domo AI enhancement is part of raising input quality (Pillar 15)
- The readout workflow is an agentic pattern that emerged from the pillar architecture
- The composite score bridges ML and human assessment

These are features shipped in sprints, shaped with requirements, tested via UAT — not a technical appendix.

### R6: The leakage catch is a supporting anecdote, not the climax

Mention it briefly as an example of the human's role in quality gating. Don't give it 400 words and a table. It illustrates R4 (human judgment matters), not the main thesis.

### R7: Tone and length

- First-person Cassidy voice
- ~3,000–4,000 words
- Technical but accessible — assume the reader is a developer or technical PM
- No marketing language
- Developer sharing how they worked, not what the app does
- Include the IMPLEMENTATION_STRATEGY.md pillar table (or a condensed version)
- Include shaping doc excerpts
- Include the `.cursor/rules/cortex-cli.mdc` boundary rule

## Solution Shape

### A: Three-act structure — Operating Model → Agent Collaboration → What Emerged

**Act 1: The Operating Model (~1,200 words)**

How I ran product + engineering solo:
- The IMPLEMENTATION_STRATEGY.md as the roadmap (show the pillar table, the flywheel)
- Shaping methodology: shape before you sprint (show a shaping excerpt — R/S/fit check)
- Sprint cadence: shape → implement → UAT → iterate → ship
- The doc was co-authored with Cursor — I provided direction, Cursor wrote strategy
- "This isn't vibe coding. Vibe coding is generate-and-pray. This was plan-build-test-iterate."

**Act 2: The Agent Collaboration (~1,200 words)**

How Cursor and Cortex CLI divided labor:
- The boundary rule (`.cursor/rules/cortex-cli.mdc`)
- Cursor's domain: strategy, shaping, SQL authoring, app code, validation, documentation
- Cortex CLI's domain: Snowflake execution, self-healing, model training, runtime debugging
- The handoff loop in practice (concrete example: ML pipeline)
- Self-healing: Cortex discovers type mismatches, fixes them, user reconciles
- The human in the loop: UAT, iteration, quality gating (leakage catch as brief example)

**Act 3: What Emerged (~800 words)**

The product that came out of this process:
- 17 pillars, each independently valuable (condensed table)
- Three AI layers working together: predictive (ML.CLASSIFICATION), generative (Cortex AI, Domo AI), agentic (readout workflow, enrichment cascade)
- The composite score as the bridge between ML and human assessment
- 43 sprints in ~1 month — one developer, two agents
- The flywheel: better inputs → better AI → better outputs → better inputs

**Updated takeaways (~400 words)**:
1. Structure beats speed — shaping requirements before sprinting prevented rework
2. Domain boundaries matter — the one-line rule saved context switching
3. The human runs the product, the agents run the code — UAT and iteration are human jobs
4. Self-healing agents reduce iteration cycles
5. Composition > capability — cheap focused AI calls, orchestrated well
6. The strategy doc IS the project manager — 6,800 lines of living strategy replaced Jira
7. This is reproducible — any developer with domain expertise can run this operating model

## Fit Check

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | Thesis: structured product dev with AI agents | Core goal | ✅ |
| R1 | IMPLEMENTATION_STRATEGY.md as first-class artifact | Must-have | ✅ |
| R2 | Shaping methodology as operating model component | Must-have | ✅ |
| R3 | Cursor + Cortex CLI collaboration as centerpiece | Must-have | ✅ |
| R4 | Human role explicit | Must-have | ✅ |
| R5 | GenAI/agentic woven in, not separate act | Must-have | ✅ |
| R6 | Leakage catch is supporting anecdote | Must-have | ✅ |
| R7 | Tone, length, developer voice | Must-have | ✅ |

## Rabbit Holes

- Don't explain every pillar in detail — the condensed table is enough
- Don't reproduce the entire shaping skill methodology — show one example
- Don't list every Cortex AI function — mention the count and key ones
- Don't turn this into a DealInspect product pitch — it's about the process

## No-Gos

- No marketing language ("revolutionary," "game-changing")
- No pricing or SKU details
- No proprietary deal data
- Don't frame this as "AI replacing developers" — frame it as "AI amplifying a developer"
- Don't position this as the only way to work — position it as one pattern that worked
