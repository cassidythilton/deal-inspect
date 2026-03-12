# TDR Prep Sheet — Know Before You Go

A practical checklist for SEs preparing to inspect a deal in DealInspect. Complete this prep **before** opening the TDR Workspace so your review is focused, efficient, and produces a defensible verdict.

---

## Before You Start

**Confirm the deal is TDR-eligible.** A deal qualifies for Technical Deal Review if *any* of the following are true:

- [ ] Domo is positioned beyond a simple BI use case
- [ ] Displacing an incumbent analytics, data prep, or custom app solution
- [ ] Material ARR is at stake
- [ ] Competition is present in the account (e.g. Fivetran, dbt, Matillion, Sigma)
- [ ] Lighthouse account, executive visibility, or partner visibility
- [ ] Snowflake, Databricks, or Google BigQuery is a mandated or emerging standard
- [ ] Partner-aligned architecture or Cloud Amplifier is in scope
- [ ] The deal could influence or expand the partner relationship
- [ ] AI impacts operational decisions or automated workflows

If none of these are true, question whether a formal TDR is the right use of time.

**Know the people.**

- [ ] Which SE Manager are you meeting with? This manager is typically aligned with an AE manager.
- [ ] Which SE (Sales Consultant) is attached to the deal?
- [ ] Who owns this architecture internally on the customer side, and do they have decision authority?

**Know the deal.**

- [ ] Pull up the opportunity in Salesforce. You should know the current stage, ACV, close date, forecast category, competitors, and partner involvement before the review starts.

---

## The Thesis

The Thesis bar sits above every step and never goes away. It asks one question:

> **"In one sentence: Why does Domo belong in this architecture?"**

Write this first. If the sentence is strong, the deal is probably solid. If it's weak, the rest doesn't matter. Come back and sharpen it as you work through the steps.

---

## Step 1 — Deal Context *(required)*

**Core question:** *Why is this deal worth technical inspection right now?*

What you need to know before filling this out:

| Field | What to Prepare |
|-------|----------------|
| **Strategic Value** | Is this deal High / Medium / Low strategic value? Think beyond ACV — does it open a new vertical, displace a competitor, or establish a reference account? |
| **Customer Decision** | Be able to complete this sentence: *"The customer is trying to decide _____ so they can _____."* If you can't say it in one sentence, you're not ready. |
| **Why This Deal Matters Now** | What makes the timing urgent? A budget cycle closing, a competitive evaluation deadline, a leadership change, a failed POC with another vendor? |
| **Key Technical Stakeholders** *(optional)* | Names and roles of the people who will make or block the technical decision. |
| **Decision Timeline** *(optional)* | This Quarter, Next Quarter, or 6+ Months. Know where the customer thinks they are vs. where they actually are. |

**Preparation tips:**
- Talk to the AE before the review. Understand the sales narrative, not just the technical one.
- If the AE can't articulate why now, the deal may not be ready for TDR.

---

## Step 2 — Technical Architecture *(required)*

**Core question:** *What architectural truth must we accept, and where does Domo fit?*

This is the heaviest step. Come prepared with a mental (or sketched) picture of how data flows today and how it should flow in the future.

| Field | What to Prepare |
|-------|----------------|
| **Cloud / Data Platform** | Which platform anchors the customer's data strategy? Snowflake, Databricks, BigQuery, Azure Synapse, AWS Redshift, on-prem, or multiple? |
| **Current Architecture & Constraints** | What is the system of record? What architectural constraint cannot change? What hurts? Consolidate the current state into something an SE manager can read in 30 seconds. |
| **Target Architecture & Data Flow** | What does the future state look like? How will data move through the system? Where do integrations live? What changes from today? |
| **Domo Layers** | Select all Domo capabilities in scope: Data Integration, Data Warehouse, Visualization/BI, Embedded Analytics, App Development, Automation/Alerts, AI/ML. Be honest — over-scoping kills credibility. |
| **Out of Scope** *(optional)* | What is explicitly *not* Domo's job? Drawing boundaries is as important as defining scope. |
| **Why Domo Wins Here** *(optional)* | Given the architectural constraints, what specific capability or integration gives Domo the edge? |

**Preparation tips:**
- If a cloud partner (Snowflake, Databricks, etc.) is involved, know whether MagicETL runs on their compute or Domo compute. This question will come up.
- Sketch the data flow before you open the workspace. Current state on the left, target state on the right, Domo in the middle. If you can't draw it, you don't understand it yet.
- Use the **Intelligence panel** — hit the Sumble enrichment button to pull firmographic and technographic data (tech stack, org structure, recent hires). Hit Perplexity for real-time web research on the account's strategic initiatives and technology decisions.

---

## Step 3 — Risk & Verdict *(required)*

**Core question:** *What is the one assumption that must be true for this deal to succeed?*

This step forces a professional judgment call. Don't hedge — take a position.

| Field | What to Prepare |
|-------|----------------|
| **Top 1–2 Technical Risks** | What could actually kill this deal technically? Not a laundry list — the one or two risks that matter. |
| **Key Assumption** | The ONE assumption that, if wrong, makes everything else fall apart. Every deal has one. Find it. |
| **Verdict** | Your professional call: **Proceed**, **Proceed with Corrections**, or **Rework Before Advancing**. This is not a committee decision — it's your judgment as an SE. |
| **Key Partner** *(optional)* | Which partner matters most in this deal? |
| **Partner Posture** *(optional)* | Is the partner Amplifying, Neutral, Conflicting, or None? If conflicting, this is a risk that belongs in the field above. |

**Preparation tips:**
- Think about risks from the customer's perspective, not just yours. "Customer's data team is understaffed for the migration timeline" is a better risk than "Complex integration."
- The Key Assumption field is the most important field in the entire TDR. Spend time on it. Examples: *"The customer's Snowflake instance has the capacity and governance to support Domo's query patterns at scale"* or *"The VP of Engineering will champion this over the incumbent BI tool."*

---

## Step 4 — AI & ML Opportunity Assessment *(required)*

**Core question:** *Is there an AI or ML opportunity in this deal, and at what level of the value continuum?*

This step was added as a core requirement. Every deal gets assessed for AI/ML opportunity — even if the answer is "none identified."

| Field | What to Prepare |
|-------|----------------|
| **AI Opportunity Level** | Where does the opportunity sit on the value continuum? Pick one: **Rules & Automation** (automate a repeatable process), **Predictive AI** (predict an outcome), **Generative AI** (generate or summarize content), **Autonomous AI / Agentic** (AI that takes action), or **No AI Opportunity Identified**. |
| **Opportunity Signals** | Select signals you've observed: manual review loops, reactive decisions (fire drills), stalled AI pilots, prediction would change the outcome, workflow bottlenecks. |
| **Problem Statement** | What specific problem could AI solve? The hint adapts to your selected level — follow it. |
| **Data Readiness** | What data is available? Structured (CRM, ERP), unstructured (docs, emails, tickets), nothing yet, or unknown. |
| **Value & Accountability** | What value does solving this with AI unlock? The hint adapts — it asks about time savings for automation, cost of wrong predictions for predictive, quality bars for generative, guardrails for agentic. |

**Preparation tips:**
- Don't force an AI opportunity where there isn't one. "No AI Opportunity Identified" is a valid and honest answer.
- If the customer has *stalled AI pilots* (demo works, nothing ships), that's often the highest-value signal — they have budget, intent, and a failed first attempt. Domo can be the thing that actually ships.
- The Problem Statement and Value fields are hidden if you select "No AI Opportunity Identified" — so make your level selection first.
- Think about the AI opportunity from the customer's workflow, not from Domo's feature set. "What decision could be made faster or better with a prediction?" is more useful than "Where can we use AI_COMPLETE?"

---

## Step 5 — Adoption & Success *(optional)*

**Core question:** *What does adoption success look like?*

This step is optional but recommended for large or complex deals. It forces you to think past the close.

| Field | What to Prepare |
|-------|----------------|
| **Expected Users** | Number and type of users. "50 analysts in the finance org" is better than "50." |
| **Adoption & Success Criteria** | What does success look like post-deployment? Combine your adoption plan with measurable criteria. |

**Preparation tips:**
- If the AE is forecasting this deal but can't describe what adoption looks like, that's a yellow flag worth noting in the Risk step.

---

## Intelligence Panel — What's Available

The right panel of the TDR Workspace provides AI-powered intelligence. You don't need to prepare these — they're generated during the review — but knowing what's available helps you plan your time:

| Capability | What It Does | When to Use It |
|-----------|-------------|----------------|
| **Account Profile** | Firmographic data from Sumble (tech stack, org, recent hires, funding) | First. Enriches your understanding before you write anything. |
| **Perplexity Research** | Real-time web research with citations on the account's strategic initiatives, market position, technology decisions | After account profile. Fills gaps that CRM data can't. |
| **Competitive Position** | Competitor identification and positioning analysis | When competitors are named or suspected. |
| **Action Plan** | Cortex-generated 7-section strategic plan from all TDR data | After you've completed the required steps. |
| **TDR Brief** | AI-generated executive summary from your inputs + intelligence | After action plan. This becomes the core of the readout. |
| **Similar Deals** | Semantically similar past TDRs for pattern matching | When you want to see how a comparable deal was handled. |
| **Knowledge Base** | Battle cards, playbooks, competitive docs from Domo filesets | When a named competitor triggers a match. |
| **Chat** | Multi-provider context-aware chat (Cortex, Claude, Perplexity, Domo AI) | Anytime — ask questions mid-review without leaving the workspace. |

---

## Output & Distribution

When your TDR is complete:

1. **Export PDF** — generates a branded executive readout document covering all steps, scores, and the verdict.
2. **Share to Slack** — distributes the readout summary to the deal team and leadership channels.

Both are available from the workspace header once the session is saved to Snowflake.

---

## Quick-Reference: TDR Priority Bands

| Band | Score Range | What It Means |
|------|-----------|---------------|
| **CRITICAL** | 75–100 | Multiple Tier 1 signals converging. Full TDR required. |
| **HIGH** | 50–74 | Significant complexity or strategic value. TDR strongly recommended. |
| **MEDIUM** | 25–49 | Some complexity signals. TDR at manager discretion. |
| **LOW** | 0–24 | Straightforward deal. TDR likely not needed unless specific concerns arise. |

---

## Quick-Reference: Verdicts

| Verdict | When to Use |
|---------|------------|
| **Proceed** | Architecture is sound, risks are manageable, deal is ready to advance. |
| **Proceed with Corrections** | Fundamentally viable but specific issues need resolution before the deal progresses. |
| **Rework Before Advancing** | Significant technical or strategic gaps. The deal needs a reset before more SE time is invested. |

---

*Last updated: March 2026*
