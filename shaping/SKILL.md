---
name: shaping
description: Write structured shaping documents for upcoming sprints and features using the project's established methodology. Use when the user asks to shape a feature, write a shaping doc, define a sprint, or spec out upcoming work. Also use when iterating on existing shaping docs in the shaping/ directory.
---

# Shaping — Deal Inspect Project Methodology

Shaping produces structured specification documents that define **what** to build and **why**, grounded in real user feedback and the existing architecture. Each shaping doc lives in `shaping/` and feeds into the sprint plan in `IMPLEMENTATION_STRATEGY.md`.

## When to Use

- User says "shape", "spec", "write a shaping doc", or "define Sprint N"
- User provides raw feedback/requests and wants them distilled into a buildable plan
- User wants to iterate on an existing `shaping/*.md` document

## Document Template

Every shaping doc follows this structure. Sections are ordered; include all that apply.

```markdown
---
shaping: true
status: draft
appetite: small (1–2 days) | medium (3–5 days) | large (1–2 weeks)
---

# [Feature Name]

## Source

> [Verbatim user quotes, requests, emails — blockquoted exactly as received.
> Multiple sources added as they arrive. This is the ground truth.]

---

## Problem

[2–4 paragraphs distilling the pain from Source. Bold the key tensions.
State what's broken, what's missing, what compounds. Not a solution — just the pain.]

---

## Requirements

### R0: [Core goal — one sentence]

- R0.1: [Sub-requirement]
- R0.2: [Sub-requirement]

### R1: [Must-have requirement]

[1–2 sentences explaining the constraint or need.]

### R2: ...

---

## Solution Shape [A: Title]

### A1: [Workstream or component name]

| Part | Mechanism |
|------|-----------|
| **A1.1** | **Bold title.** Concrete description of what changes, where, and how. Reference specific files/functions/tables. |
| **A1.2** | **Bold title.** ... |

### A2: [Second workstream]

| Part | Mechanism |
|------|-----------|
| **A2.1** | **Bold title.** ... |

---

## Fit Check: R × A

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | [Full text] | Core goal | ✅ (A1.1) |
| R1 | [Full text] | Must-have | ✅ (A2.3) |

**Notes:**
- [Explain any ❌ or ⚠️]

---

## Resolved Questions

1. **[Question]?** → **[Answer].** [Brief rationale.]

---

## Rabbit Holes

- **Don't [thing].** [Why it's a trap.]

---

## No-Gos

- No [hard constraint]
- No [hard constraint]

---

## CURRENT State Reference

[When relevant: tables showing what exists before changes.
Include step definitions, field lists, file mappings — whatever the reader
needs to understand the baseline.]
```

## Requirements (R) Notation

Requirements define the problem space — what's needed, not how to build it.

**Rules:**
- **R0** is always the core goal. Other Rs are Must-have, Nice-to-have, or Undecided.
- Sub-requirements use dot notation: R0.1, R0.2. Top-level Rs max out at 9; chunk if exceeding.
- R states the need. Satisfaction is shown in the fit check, not the requirement itself.
- Requirements extracted from user feedback should be standalone — not dependent on any specific shape.
- Always show full requirement text in tables — never abbreviate.

**Status values:** Core goal, Must-have, Nice-to-have, Undecided, Out

## Solution Shape — Parts Tables

Parts describe **what we build or change** — mechanisms, not intentions.

**Rules:**
- Each part gets a bold ID (A1.1, A1.2) and a **bold title** followed by the mechanism.
- Parts must be vertical slices: co-locate the data model change with the feature it supports.
- Reference specific files, functions, tables, and field IDs — ground in the actual codebase.
- Extract shared logic: if the same mechanism appears in multiple parts, make it a standalone part and have others reference it.
- Start flat (A1, A2, A3). Add hierarchy (A1.1, A1.2) only when grouping aids comprehension.

**Flagged unknowns:**

| Part | Mechanism | Flag |
|------|-----------|:----:|
| **A1** | Concrete mechanism we know how to build | |
| **A2** | Described WHAT but don't know HOW yet | ⚠️ |

A ⚠️ flag means the fit check must show ❌ for any requirement that depends on this part. A selected shape should have no flags, or explicit spikes to resolve them.

**Avoid tautologies between R and S:**
- R states the capability needed. S describes how to deliver it.
- If the part just restates the requirement, it's not adding information.

## Fit Check

The fit check is a decision matrix: requirements as rows, shape(s) as columns.

**When to include:**
- Always include for the primary shape, even if single-shape (validates completeness).
- Use multi-shape format (A, B, C columns) only when genuinely comparing alternatives.

**Format rules:**
- Binary: ✅ pass, ❌ fail. No other symbols in shape columns.
- ⚠️ belongs only in parts table Flag column, never in fit checks.
- Full requirement text in every row — never abbreviate.
- Explanations go in Notes below the table, not inline.
- Cite which part(s) satisfy each requirement: `✅ (A1.3)`.

## Resolved Questions

Numbered list. Each entry: **bold question** → **bold answer** with brief rationale. These capture decisions made during shaping so builders don't re-litigate them.

## Rabbit Holes

Things that look tempting but are traps. Each entry: **bold "Don't X"** followed by why. Saves the builder from expensive detours.

## No-Gos

Hard constraints. Non-negotiable boundaries. Short, declarative.

## CURRENT State Reference

When shaping changes to an existing system, document the baseline: current step definitions, field lists, file-to-change mappings, Snowflake table schemas. This grounds the solution shape in reality and makes the diff between current and proposed obvious.

## Spikes

When uncertainty blocks a shape part, extract a spike — a standalone investigation.

Create spikes in their own file (`shaping/spike-[topic].md`). Structure:

```markdown
## [Component] Spike: [Title]

### Context
Why we need this investigation.

### Goal
What we're trying to learn.

### Questions
| # | Question |
|---|----------|
| **Q1** | How does [X] work? |
| **Q2** | What changes to achieve [Y]? |

### Acceptance
Spike is complete when we can describe [specific understanding].
```

Spike questions ask about mechanics ("Where is X?", "What changes?", "How does Y work?"). Avoid effort estimates and yes/no questions.

## Multi-Shape Comparison (When Needed)

Most shaping docs in this project use a single shape. When genuinely exploring alternatives:

- Shapes use letter notation: A, B, C (mutually exclusive — pick one)
- Components within a shape: A1, A2, A3 (combine)
- Alternative approaches to a component: A3-a, A3-b (pick one)
- Give each shape a descriptive title: `## B: Event-sourced with replay`
- Run a fit check with all shapes as columns
- After selection, use "Detail B" (not a new letter) for deeper breakdown

## Project Architecture Context

When writing shaping docs, ground all mechanisms in the actual system:

### Key References
- **`IMPLEMENTATION_STRATEGY.md`** — architectural source of truth, sprint history, all pillars
- **`manifest.json`** (root + `public/`) — dataset mappings, Code Engine proxy, package mappings
- **`sql/bootstrap.sql`** — Snowflake DDL (10 tables in `TDR_APP.TDR_DATA`)
- **`src/data/mockData.ts`** — TDR step definitions (IDs, titles, core questions)
- **`src/components/TDRInputs.tsx`** — field definitions, types, options, hints
- **`src/lib/domo.ts`** — `OPPORTUNITY_FIELD_MAP`, `DomoOpportunity` interface
- **`src/types/tdr.ts`** — `Deal` interface, `TDRStep`, `TDRSessionSummary`
- **`src/hooks/useTDRSession.ts`** — session lifecycle, auto-save, step completion

### Tool Boundary (Cortex CLI)
If a mechanism runs **in Snowflake** (DDL, views, stored procedures, ML functions, AI functions, grants) → label it `[Cortex CLI]` in the shaping doc and sprint checklist.

If it runs **outside Snowflake** (Code Engine JS, frontend TS/React, notebooks, manifest) → label it `[Cursor]`.

This boundary is documented in `shaping/cortex-cli-usage-guidelines.md` and enforced via `.cursor/rules/cortex-cli.mdc`.

### Snowflake Schema Alignment
Shaping docs that add or modify data should reference existing Snowflake tables (`TDR_SESSIONS`, `TDR_STEP_INPUTS`, `TDR_CHAT_MESSAGES`, `ACCOUNT_INTEL_CACHE`, etc.) and explain whether changes are additive (new field IDs, new columns) or require migration. The `TDR_STEP_INPUTS` table stores field values as strings keyed by `STEP_ID` and `FIELD_ID` — adding/renaming is low-risk; removing requires migration consideration.

### Sprint Integration
After a shaping doc is accepted, its sprints are integrated into `IMPLEMENTATION_STRATEGY.md` Section 18 (Sprint Plan). The shaping doc is referenced from the sprint header:

```markdown
> **Shaping document:** `shaping/[name].md`
```

## Quality Checklist

Before finalizing a shaping doc:

- [ ] Source section captures verbatim user input (if user-driven)
- [ ] Problem section distills pain without proposing solutions
- [ ] Requirements are standalone (not dependent on specific shapes)
- [ ] No more than 9 top-level Rs (chunk with sub-Rs if needed)
- [ ] Parts reference specific files, functions, tables, or field IDs
- [ ] No tautologies between R text and part mechanism text
- [ ] Fit check uses full requirement text, binary ✅/❌ only
- [ ] Rabbit Holes call out at least 2–3 traps
- [ ] No-Gos state hard constraints
- [ ] CURRENT state documented when modifying existing features
- [ ] Snowflake-touching items labeled `[Cortex CLI]` or `[Cursor]`
- [ ] `shaping: true` in frontmatter
