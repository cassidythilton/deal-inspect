---
shaping: true
status: approved
appetite: small (half-day)
---

# Sprint 30b Addendum — Deal Priority in TDR Workspace

## Source

> "on the tdr steps, far right details modal we'll want to incorporate the new deal priority metric in a way that takes into account the proper visual prioritization of the tdr and propensity scores."

---

## Problem

The TDR Workspace's Intelligence Panel (Zone A — Situation Room) currently shows **two separate, unlinked scores**:

1. **TDR Score** — large number + priority badge + progress bar + lifecycle phase
2. **Win Propensity** — smaller number + quadrant badge + progress bar + SHAP factors

An SE looking at this panel can't quickly answer the single most important question: **"Should I invest time in this deal?"** They have to mentally combine two metrics with different scales, different meanings, and different visual weights. The Deal Priority composite score (60% propensity + 40% TDR) was built for exactly this — but it only lives in the Command Center table, not in the workspace where the actual work happens.

---

## Requirements

### R0: The Deal Priority metric must appear in Zone A (Situation Room) with visual weight that reflects its role as the **primary strategic signal** — it synthesizes TDR and propensity into one answer.

### R1: The visual hierarchy must be: Deal Priority (primary) → TDR Score + Win Propensity (supporting). The composite should feel like the headline; the two inputs should feel like the explanation.

### R2: The quadrant label (PRIORITIZE / FAST TRACK / INVESTIGATE / DEPRIORITIZE) must be prominent and use the same high-contrast pill colors established in Sprint 30b (solid purple/emerald/amber/slate).

### R3: The Score Breakdown must show how TDR and propensity contribute to the composite, matching the Priority tooltip's formula display from the table.

### R4: No removal of existing TDR Score or Win Propensity sections — they remain as supporting detail below the composite.

---

## Solution Shape [A: Priority Header in Zone A]

### A1: Deal Priority Hero Section

Insert a new section at the **top** of Zone A, above the existing TDR Score section:

| Element | Treatment |
|---------|-----------|
| **Score** | Large (text-2xl or text-3xl) bold number, e.g. `72` |
| **Label** | "Deal Priority" in small uppercase tracking |
| **Quadrant pill** | High-contrast solid color pill (PRIORITIZE = purple-600/white, etc.) — same as table column |
| **Guidance line** | One-sentence prescriptive guidance per quadrant (same text as table tooltip) |
| **Progress bar** | Full-width bar with gradient matching quadrant color |
| **Breakdown** | Compact two-line formula: `TDR {score} × 40% = {n}` / `Win {pct}% × 60% = {n}` |

### A2: Subordinate Existing Scores

Visually demote TDR Score and Win Propensity to "supporting detail" role:

| Change | Mechanism |
|--------|-----------|
| **Reduce TDR Score prominence** | Shrink from `text-2xl` to `text-lg`. Keep all existing detail (priority badge, lifecycle, progress bar, expandable breakdown). |
| **Section label** | Add subtle "Contributing Scores" or "Score Components" section header above TDR + Propensity |
| **Divider** | Light border between Deal Priority hero and the contributing scores |

### A3: No Structural Changes

- Zone B, C, D unchanged.
- No new data requirements — `deal.dealPriority` and `deal.dealQuadrant` already computed in `useDomo.ts`.
- SHAP factors remain under Win Propensity.

---

## Where It Fits

**Sprint 30b** — this is a natural extension of items 22–25 (Priority tooltip, Stage compression, icon uniformity). It takes the Deal Priority signal that already exists in the table and scatter plot and surfaces it in the workspace where SEs actually do their work. Adding as item 33.

---

## No-Gos

- No changes to the composite formula or thresholds
- No removal of existing TDR Score expandable breakdown
- No changes to Zone B/C/D layout
- No new data fetching
