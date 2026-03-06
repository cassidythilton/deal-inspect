---
shaping: true
status: approved
appetite: small (1–2 days)
---

# Sprint 30b — Table Column Polish

## Source

> "upgrade the tooltip to match the comprehensiveness of the win % and tdr tooltips (the priority one is embarrassingly basic, including the pills are hard to read--slight color tweak needed). the column header is also unreadable."

> "convert the stage to a number only and do the same with the tooltip--kick it up a few notches. this should allow for enough space to spread the column headers out a bit for better readability."

> "the why tdr icons should all be the same size, look and feel, this may include combining the descriptions into one cohesive message (maybe not) but at a minimum, they should all be the same size and all descriptions should have the same look and feel whether ml-related or not. also the ml-related ones need a lot better information for a naive reader to make sense of them."

---

## Problem

**The Priority tooltip is embarrassingly thin compared to its siblings.** The Win % tooltip shows a title, quadrant badge, ML Factors section with directional arrows, and a scored-at timestamp. The TDR tooltip shows a title, priority badge, prescriptive guidance, competitors, and contributing factors with tier/points. The Priority tooltip shows three lines of arithmetic. It's the most important new signal in the app and has the weakest presentation.

**The Stage column wastes horizontal real estate.** It renders `[04] Confirm Solu` — a 15-character string that forces `minWidth: 150`. Converting to just the stage number (04) with the full context in the tooltip frees ~100px of horizontal space, directly relieving the header crowding problem.

**The Why TDR? icons are inconsistent.** Factor pills and ML pills have different sizes, different padding, different color treatments, and different tooltip structures. Factor tooltips show description + strategy + TDR prep steps. ML tooltips show a one-line name/value pair. A naive user can't tell why some icons are green arrows and others are blue dollar signs, or why hovering one gives a paragraph and the other gives a sentence.

---

## Requirements

### R0: All three score columns (Win %, TDR, Priority) must have comparable tooltip quality — same structural depth, same visual hierarchy.

### R1: The Priority tooltip must show: quadrant label as a pill, score/100, the formula breakdown, prescriptive guidance for the quadrant, and key contributing signals.

### R2: Stage column must show only the stage number in the cell, with the full stage name and TDR-value context in the tooltip.

### R3: All Why TDR? icons must be visually uniform — same dimensions, same border radius, same padding — regardless of whether they're factor-based or ML-based.

### R4: ML factor tooltips must explain in plain English what the factor means for a naive reader, not just show a name and a percentage.

### R5: Column headers must be readable at their rendered widths — no clipping.

---

## Solution Shape [A: Table Column Polish]

### A1: Priority Tooltip Upgrade

| Part | Mechanism |
|------|-----------|
| **A1.1** | **Rich tooltip structure.** Match TDR tooltip layout: title row with score + quadrant pill (higher contrast colors), prescriptive guidance paragraph per quadrant, formula breakdown section, and key signals (top TDR factor + top ML factor if available). |
| **A1.2** | **Pill color fix.** Increase contrast: `PRIORITIZE` → solid purple bg/white text, `FAST_TRACK` → solid emerald, `INVESTIGATE` → solid amber, `DEPRIORITIZE` → muted slate. Current `bg-purple-500/15` is too faint. |

### A2: Stage Column Compression

| Part | Mechanism |
|------|-----------|
| **A2.1** | **Cell renders stage number only.** `StageBadgeCell` shows `04` (or `02`, etc.) in a color-coded badge. Remove the icon and stage name text from the cell. |
| **A2.2** | **Rich stage tooltip.** Keep existing tooltip content (TDR value window, prescriptive guidance). Add the full stage name as the title line. |
| **A2.3** | **Column shrink.** Reduce `minWidth` from 150 to 50, `maxWidth` to 60. Reclaim ~100px. |

### A3: Why TDR? Icon Uniformity

| Part | Mechanism |
|------|-----------|
| **A3.1** | **Uniform icon sizing.** Both factor icons and ML direction arrows render at identical dimensions: `h-3.5 w-3.5`, `p-[3px]`, `rounded` — same container for both types. |
| **A3.2** | **ML tooltip upgrade.** ML factor tooltips get the same structural depth as factor tooltips: bold factor name, plain-English explanation of what the factor measures and why it matters, direction label ("Helps win probability" / "Hurts win probability"), and magnitude context. |
| **A3.3** | **Visual separator.** Keep the thin divider between factor icons and ML icons but ensure both groups use the same border/padding treatment. |

### A4: Header Readability

| Part | Mechanism |
|------|-----------|
| **A4.1** | **Header names.** Ensure all headers fit: "Win %", "TDR", "Pri", "Stage" (already short), "Age", "ACV", "TDRs", "Ptr", "Why TDR?". Full descriptions in `headerTooltip`. |

---

## No-Gos

- No changes to the Priority composite formula or thresholds
- No removal of existing tooltip content from Win % or TDR columns
- No changes to the scatter plot
