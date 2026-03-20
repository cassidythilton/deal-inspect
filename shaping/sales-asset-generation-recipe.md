---

## shaping: true

status: draft
appetite: medium (3–5 days)

# Sales Asset Generation Recipe

## Source

> "in this app we now have full gong transcripts by deal, strategic and insightful inputs from the tdr process, enrichment data from perplexity, submle, etc. I now want to use this data as a means for generating assets that sellers (solutions engineers, solution architects) can use to close the deal more efficiently and to maximize the deal size. these assets could include solution briefs, app prototypes, solution architecture diagrams, pitch decks, etc. etc. (I want you to think deeply about the various, optional items that should be included here). These will all be very specific to the aforementioned context on the deal, and would be honed even further based on the Domo Layers entered in the TDR process (e.g. not every deal needs an app prototype or an integration strategy). Note i am working on specific skills, etc. that can be referenced for this purpose (which we can add to and further evolve as needed) here: [https://github.com/stahura/domo-ai-vibe-rules/tree/main](https://github.com/stahura/domo-ai-vibe-rules/tree/main) . Note these assets will likely be genearted in a separate process/app but we need to provide a detailed plan/recipe that it can pick up and reference. This could be a markdown file, or other asset as you see fit."

---

## Problem

The `deal-inspect` app currently collects an incredibly rich dataset for each deal: Gong transcripts, TDR (Technical Discovery & Review) inputs, Perplexity/Sumble enrichment, and specific Domo Layer requirements. However, this data is currently passive. Sellers (SEs, SAs) have to manually synthesize this wealth of information to create the assets they need to close the deal (pitch decks, architecture diagrams, solution briefs). 

We need a structured way to export or expose this deal context as a "recipe" that a downstream generative AI process (or separate app) can consume to automatically generate highly tailored, deal-specific sales assets. The recipe must dynamically dictate *which* assets to generate based on the specific Domo Layers identified in the TDR process.

---

## Requirements

### R0: Produce a structured, machine-readable "Asset Generation Recipe" for a given deal that a downstream generative process can consume.

- R0.1: The recipe must aggregate all relevant deal context (Gong summaries, TDR inputs, enrichment data).
- R0.2: The recipe must explicitly list the required output assets based on the deal's specific context (e.g., Domo Layers).

### R1: Dynamic Asset Selection

The recipe must not request a one-size-fits-all bundle. It must conditionally include assets like "App Prototype" or "Integration Strategy" only if the corresponding Domo Layers or TDR inputs warrant them.

### R2: Extensible Asset Catalog

The system must define a comprehensive catalog of potential assets (Solution Brief, Pitch Deck, Architecture Diagram, App Prototype, ROI Calculator, Security/Governance One-Pager, etc.) that the downstream process knows how to generate.

### R3: Integration with Agent Skills

The recipe generation or the downstream process should leverage the Domo Agent Skills repository (`stahura/domo-ai-vibe-rules`) to guide the AI on *how* to build these assets (e.g., using `domo-js` for prototypes).

---

## Solution Shape [A: Markdown Recipe Export]

### A1: Asset Catalog & Trigger Logic


| Part     | Mechanism                                                                                                                                                                                                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1.1** | **Define the Asset Catalog.** Create a configuration mapping Domo Layers to potential assets. E.g., Layer: "Data Apps" -> Asset: "App Prototype Spec". Layer: "Data Integration" -> Asset: "Integration Architecture Diagram". All deals get a "Solution Brief" and "Pitch Deck Outline". |
| **A1.2** | **Define Asset Prompts/Skills.** For each asset type, define the required context and the specific Agent Skill (from `stahura/domo-ai-vibe-rules`) the downstream agent should use.                                                                                                       |


### A2: Recipe Generation Utility


| Part     | Mechanism                                                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A2.1** | **Recipe Compiler `[Cursor]*`*. Create a utility in `src/utils/recipeGenerator.ts` that takes a `Deal` ID, fetches the `TDR_SESSIONS`, `TDR_STEP_INPUTS`, and `ACCOUNT_INTEL_CACHE`, and compiles the recipe. |
| **A2.2** | **Context Aggregation `[Cursor]`**. The compiler summarizes or concatenates the Gong transcripts and Perplexity enrichment into a `context` block.                                                            |
| **A2.3** | **Asset Determination `[Cursor]`**. The compiler reads the `TDR_STEP_INPUTS` (specifically the Domo Layers step) and populates an `assets_to_generate` array.                                                 |


### A3: Export Mechanism


| Part     | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A3.1** | **Export Actions `[Cursor]`**. Add an interface icon (e.g., a magic wand or document export icon) on the Deal Detail page that provides two options: 1) Automatically write the `.md` recipe to a bespoke GitHub repository and send a notification with a link to the `#tdr-channel` Slack channel, or 2) Simply download a hard copy `.md` file directly to the user's local machine.                          |
| **A3.2** | **Dynamic Skill Resolution & Formatting `[Cursor]`**. The compiler dynamically fetches the latest available skills from `https://github.com/stahura/domo-ai-vibe-rules/tree/main` to ensure up-to-date references. It then formats the export as a structured mega-prompt: "You are an expert SA. Here is the deal context: [Context]. Generate the following assets: [Asset List]. Use these skills: [Skills]." |


---

## Fit Check: R × A


| Req | Requirement                                                                                                                         | Status    | A              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------- |
| R0  | Produce a structured, machine-readable "Asset Generation Recipe" for a given deal that a downstream generative process can consume. | Core goal | ✅ (A2.1, A3.2) |
| R1  | Dynamic Asset Selection based on Domo Layers and TDR inputs.                                                                        | Must-have | ✅ (A1.1, A2.3) |
| R2  | Extensible Asset Catalog (Solution Brief, Pitch Deck, Architecture Diagram, etc.).                                                  | Must-have | ✅ (A1.1)       |
| R3  | Integration with Agent Skills (`stahura/domo-ai-vibe-rules`).                                                                       | Must-have | ✅ (A1.2, A3.2) |


**Notes:**

- A Markdown export formatted as a prompt (A3.2) is ideal because it can be easily read by a human or an automated CI/CD pipeline. Pushing directly to a bespoke GitHub repository and notifying Slack (A3.1) creates a seamless handoff to the downstream agentic workflow.

---

## Resolved Questions

1. **What format should the recipe be?** → **Markdown prompt template.** This allows a human to read it, but an LLM or separate app to easily parse the exact requirements and context.
2. **Where does the actual generation happen?** → **Outside this app.** This app only compiles the *recipe* (the prompt + context), pushes it to a bespoke GitHub repo, and alerts Slack. The generation happens in a separate agentic workflow triggered by that repo.
3. **What assets should be in the catalog?** → **Solution Brief, Executive Pitch Deck, Technical Architecture Diagram, App Prototype Spec, Integration Strategy, Security & Governance Addendum, ROI/Business Case.**

---

## Rabbit Holes

- **Don't build the asset generator inside `deal-inspect`.** The prompt context window for generating 5 different massive assets will break standard API limits or take too long for a synchronous UI request. Stick to exporting the recipe.
- **Don't just dump all raw data.** Concatenating 10 raw Gong transcripts will overwhelm the downstream agent. We must rely on the *summaries* or structured insights already captured in the TDR process and `ACCOUNT_INTEL_CACHE`.

---

## No-Gos

- No synchronous generation of the final assets within the `deal-inspect` UI.
- No hardcoding assets that don't apply to the deal (e.g., don't ask for an App Prototype if the deal is just a basic BI dashboard).

---

## CURRENT State Reference

Currently, the `deal-inspect` app stores:

- `TDR_SESSIONS` and `TDR_STEP_INPUTS` (containing the Domo Layers like "Data Apps", "Data Integration", "BI & Analytics", "Governance").
- `ACCOUNT_INTEL_CACHE` (Perplexity/Submle enrichment).
- Gong transcript summaries (linked to the deal).

There is no export functionality for this aggregated context.