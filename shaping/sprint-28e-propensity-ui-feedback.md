---
shaping: true
status: approved
appetite: small (current sprint amendment)
amends: Sprint 28e (Frontend ML Integration)
---

# Sprint 28e Amendment: Propensity UI Integration Feedback

## Context

Sprint 28e delivered the initial propensity UI: Win % column in the deals table, Propensity Distribution chart, ML factor pills in Why TDR?, and graceful degradation. Data confirmed flowing — **4,363/4,384 deals (99.5%) have propensity scores** via the `DEAL_PREDICTIONS` LEFT JOIN.

Three issues surfaced on first UAT:

---

## Problem 1: Score Misalignment

**Observation:** Deals with high TDR scores (82, 65, 54) show extremely low propensity scores (7%, 0%, 1%). The user perceives this as a contradiction.

**Root cause:** The two scores measure fundamentally different things:
- **TDR Score (0–100):** "How technically complex is this deal?" — driven by ACV, competitors, partner involvement, stage, stale signals. A deal can be very complex (high TDR) but unlikely to close.
- **Propensity Score (0–100%):** "How likely is this deal to close?" — driven by ML features (pipeline age, sales process completeness, engagement, deal type, contract type). A deal can be very closeable but not technically complex.

The original shaping (`dataset-swap-and-propensity-model.md`) explicitly designed the two-axis quadrant for this:

| | High Propensity | Low Propensity |
|---|---|---|
| **High TDR** | CRITICAL TDR — winnable + complex | MONITOR — complex but uncertain |
| **Low TDR** | Standard Process — will close, not complex | Skip |

**What the user wants:** The scores should "coincide completely" — meaning the UI should make it obvious how the two relate, not present them as independent numbers. The quadrant is the bridge.

### Requirements (P1)

- **R1a:** Show the propensity quadrant label (HIGH / MONITOR / AT_RISK) alongside the propensity score in the table, Intelligence Panel, and TDR Workspace. The quadrant contextualizes the relationship between the two scores.
- **R1b:** Add a two-axis visual (quadrant indicator or scatter plot) to the Intelligence Panel that places the current deal on the TDR × Propensity grid. This immediately answers "should I TDR this deal?"
- **R1c:** The TDR Score tooltip should reference the propensity score ("TDR Score: 82 — but only 7% close probability. Quadrant: MONITOR. Consider whether TDR effort is justified."). The propensity tooltip should reference the TDR score similarly.
- **R1d:** The Win % column in the deals table should show the quadrant label on hover, not just the raw percentage.

### What NOT to do (P1)

- Do NOT blend the two scores into a single number. They measure different things and combining them loses information.
- Do NOT hide one score in favor of the other.
- Do NOT add a configurable quadrant threshold slider — hardcoded thresholds are fine for now.

---

## Problem 2: Color Scheme Mismatch

**Observation:** The Propensity Distribution chart uses green/amber/red (`hsl(142, 60%, 45%)`, `hsl(38, 80%, 50%)`, `hsl(0, 70%, 55%)`) which clashes with the app's purple/violet core palette.

**App palette:**
- Primary: `hsl(263, 84%, 55%)` (violet)
- Purple: `hsl(263, 78%, 50%)`
- Deep: `hsl(263, 70%, 35%)`
- Accent: `hsl(280, 70%, 55%)` (magenta-violet)
- Score bar gradient: `hsl(263, 84%, 55%)` → `hsl(280, 70%, 55%)`

### Requirements (P2)

- **R2a:** Propensity Distribution chart bars must use the purple/violet palette:
  - HIGH: `hsl(263, 84%, 55%)` (primary violet)
  - MONITOR: `hsl(280, 60%, 65%)` (soft magenta)
  - AT_RISK: `hsl(300, 45%, 55%)` (muted rose-violet)
- **R2b:** The PropensityScoreCell badge colors should harmonize with the app palette rather than using raw traffic-light green/amber/red. Consider using violet intensity (saturated = high, desaturated = low) instead.
- **R2c:** Factor pills in the table already use indigo — this is fine, keep it.

---

## Problem 3: TDR Workspace Has No Propensity

**Observation:** The TDR Workspace Intelligence Panel (right sidebar) shows TDR score, deal context, factor pills, signal strip, and intelligence dossier — but zero propensity data. The user opened a deal expecting to see the ML prediction.

**Current Intelligence Panel layout (ZONE A — Situation Room):**
1. Deal header (account, deal name, ACV, stage, team)
2. TDR Score block (score, priority pill, lifecycle pill)
3. Score progress bar
4. Confidence meter (if TDR started)
5. Context headline/description
6. Top TDR factor pills
7. Expandable score breakdown
8. Signal strip (Threat, Hiring, KB, Intel)

### Requirements (P3)

- **R3a:** Add a **Propensity Card** to ZONE A, immediately after the TDR Score block. It should show:
  - Win Propensity: `{pct}%` with quadrant badge (HIGH / MONITOR / AT_RISK)
  - Compact two-axis indicator: a small 2×2 grid or dual-bar showing where this deal falls on the TDR × Propensity matrix
  - Top 3–5 SHAP factor bars with:
    - Factor name (plain English)
    - Direction arrow (↑ helps / ↓ hurts / → neutral)
    - Magnitude bar (horizontal, width proportional to importance)
    - Color: emerald for ↑, red for ↓, grey for →
  - Freshness indicator: "Scored 6h ago" from `propensityScoredAt`
- **R3b:** Graceful degradation: If `propensityScore` is null, show "Win Propensity: —" with a note "No ML score available. Scores update nightly."
- **R3c:** The propensity card should use the same visual language as the TDR Score block — progress bar, badge, pills — so it feels native, not bolted on.

---

## Amended Sprint 28e Scope

### Already Done (keep)
- [x] Win % column in AG Grid with tooltip + graceful degradation
- [x] Propensity Distribution chart (replacing Score Distribution)
- [x] ML factor pills in Why TDR? (indigo)
- [x] Diagnostic console logging (`[ML Propensity]`)
- [x] Data pipeline verified (4,363/4,384 deals scored)

### Amendments (add to current sprint)
- [ ] **P2:** Fix chart and badge colors to use purple/violet palette
- [ ] **P3a:** Add Propensity Card to TDR Workspace Intelligence Panel (ZONE A, after TDR Score)
- [ ] **P3a:** Include SHAP factor bars in Propensity Card
- [ ] **P1c:** Update TDR Score tooltip to reference propensity, and vice versa
- [ ] **P1d:** Show quadrant label in Win % column tooltip (already done — verify)
- [ ] **P3b:** Graceful degradation in Intelligence Panel

### Deferred (Sprint 30 or later)
- [ ] Full quadrant scatter plot as Command Center tab
- [ ] Portfolio-level propensity metrics in stat cards
- [ ] Two-axis quadrant indicator in Intelligence Panel (small grid visual)

---

## No-Gos
- No blending TDR + propensity into a single combined score
- No hiding either score in favor of the other
- No quadrant threshold configuration UI
- No new pages — propensity integrates into existing surfaces
