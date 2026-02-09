/**
 * Domo AI Service — TDR Candidate Recommendation Engine
 *
 * Uses the Domo AI text/chat endpoint (`/domo/ai/v1/text/chat`) to analyze
 * filtered opportunities and return the top 5 TDR candidates with scores,
 * reasons, risk flags, and suggested actions.
 *
 * The prompt encodes the full 17-factor TDR Framework scoring system and
 * instructs the model to return a strict JSON array.
 *
 * In dev mode (no Domo SDK), returns deterministic mock recommendations
 * derived from the local TDR scoring engine.
 */

import { isDomoEnvironment } from './domo';
import type { DomoOpportunity } from './domo';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TDRRecommendation {
  opportunityId: string;
  opportunityName: string;
  accountName: string;
  acv: number;
  score: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
  riskFlags: string[];
  suggestedActions: string[];
}

interface GenerateOptions {
  minACV?: number;
  maxDaysToClose?: number;
  stages?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDomo(): {
  post: (url: string, body?: unknown) => Promise<unknown>;
} | null {
  const domo = (window as unknown as { domo?: { post: (url: string, body?: unknown) => Promise<unknown> } }).domo
    || (globalThis as unknown as { domo?: { post: (url: string, body?: unknown) => Promise<unknown> } }).domo;
  return domo || null;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a sales operations expert analyzing opportunities to identify which deals need a Technical Deal Review (TDR).

A TDR exists to PROTECT DEAL INTEGRITY, ACCOUNT EXPANSION, and PARTNER ALIGNMENT.

## CRITICAL INSIGHT: EARLY-STAGE INTERVENTION

**PRIORITIZE EARLY-STAGE DEALS** where the SE Subject Matter Expert can still SHAPE the technical strategy:
- Stage "2: Determine Needs" or "3: Demonstrate Value" = HIGHEST TDR VALUE
- The SME can influence architecture decisions, partner alignment, and competitive positioning BEFORE they're locked in

**DEPRIORITIZE LATE-STAGE** (Stage ≥ "4: Confirm Solution"):
- Technical strategy is often already set
- Flag as RISK rather than opportunity (may need rescue intervention, not strategic shaping)

## THE 17 TDR CANDIDATE FACTORS (in priority order):

### TIER 1 - HIGH PRIORITY TRIGGERS (25 pts each):
1. Material ACV: ACV ≥ $150K (high priority if ≥ $300K)
2. Partner Platform: Snowflake/Databricks/BigQuery involvement
3. Strategic Account: Enterprise segment OR revenue > $1B OR employees > 5K
4. Competitive Displacement: Competitors present AND displacing incumbent
5. **Early-Stage + Strong Signal**: Stage = "Determine Needs" or "Demonstrate Value" AND (ACV/Likely ≥ $150K) - THIS IS THE SWEET SPOT
6. Forecast Momentum: Category suggests deal progression (Probable, Commit with reasonable timeline)

### TIER 2 - COMPLEXITY INDICATORS (15 pts each):
7. **Deal Type — New Logo vs Upsell** (critical dimension):
   - **New Logo**: Full architecture review required — no existing footprint. Score HIGHER when combined with Competitive or Early Stage.
     - New Logo + Competitive = need architectural differentiation urgently
     - New Logo + Early Stage = peak greenfield shaping window
     - New Logo + Stale = high-risk, needs immediate intervention
   - **Upsell/Expansion**: Existing customer expanding. Focus on validating new use cases fit current architecture. Score HIGHER when ACV ≥ $100K or Partner platform involved.
     - Upsell + High ACV = material expansion worth full TDR
     - Upsell + Partner = re-validate alignment for expanded scope
8. Partner Alignment: Partner Influence = Yes OR Premium/Select tier
9. Vertical Depth: Financial Services, Healthcare, Manufacturing, Technology
10. Architecture Decision Window: Early stage + partner platform = critical timing
11. Stale Signals: Stage Age > 60 days OR no update in 14+ days (potential blocker)

### TIER 3 - RISK FLAGS (10 pts each):
12. Champion Gap: Missing primary buying/user group
13. Multi-Stakeholder: Multiple deal desk reviews OR complex challenge
14. Partner Co-Sell: Partner sourcing active but architecture not validated
15. Expansion Dynamics: Existing customer expanding architecture
16. **Late-Stage Warning**: Stage ≥ "4: Confirm Solution" = technical strategy may be locked (flag as risk, not opportunity)

### TIER 4 - FUTURE-STATE (5 pts each):
17. AI/Agentic Scope: Business challenge suggests AI/automation
18. Cloud Compute: Cloud platform identified, compute strategy unclear

## SCORING:
- CRITICAL (≥75): Immediate TDR - early stage deal with multiple high-value signals
- HIGH (50-74): TDR strongly recommended - good intervention opportunity
- MEDIUM (25-49): TDR beneficial - monitor for escalation
- LOW (<25): Standard process

## KEY GUIDANCE:
- Favor early-stage deals with strong ACV/Partner signals over late-stage rescues
- For late-stage deals, flag as "Late-stage risk - technical strategy may be set" in riskFlags
- Highlight the SHAPING OPPORTUNITY in reasons: what can the SME influence?
- For New Logo deals: emphasize greenfield opportunity and architecture shaping potential
- For Upsell deals: emphasize expansion validation and partner re-alignment needs
- Include the deal type ("New Logo" or "Upsell") in your reasons when it's a scoring factor

Identify the TOP 5 TDR candidates prioritizing early-stage intervention opportunities.`;

// ─── Core Function ────────────────────────────────────────────────────────────

/**
 * Call the Domo AI text/chat endpoint to generate TDR recommendations.
 */
async function callDomoAI(userPrompt: string, systemPrompt: string, temperature = 0.3): Promise<string> {
  const domo = getDomo();
  if (!domo) {
    console.log('[Domo AI] Dev mode — simulating AI response');
    return JSON.stringify({
      recommendations: [
        { opportunityId: 'dev-1', score: 85, reasons: ['High ACV deal', 'Complex technical requirements'] },
      ],
    });
  }

  const input = `${systemPrompt}\n\nUser request: ${userPrompt}`;

  try {
    const result = await domo.post('/domo/ai/v1/text/chat', {
      input,
      temperature,
    }) as { choices?: Array<{ output?: string }>; output?: string };

    const output = result.choices?.[0]?.output || (result as { output?: string }).output || '';
    console.log('[Domo AI] Response received');
    return output;
  } catch (err) {
    console.error('[Domo AI] Failed to call AI:', err);
    throw err;
  }
}

/**
 * Generate TDR recommendations from raw Domo opportunity records.
 *
 * 1. Pre-filters and shapes opportunity data into a compact payload.
 * 2. Sends to Domo AI with the 17-factor prompt.
 * 3. Parses the JSON response and enriches with opportunity metadata.
 */
export async function generateTDRRecommendations(
  opportunities: DomoOpportunity[],
  options?: GenerateOptions,
): Promise<TDRRecommendation[]> {
  const { minACV = 100000, stages } = options || {};

  // Pre-filter: skip low-value and stage-excluded deals
  const eligible = opportunities.filter((opp) => {
    if ((opp['ACV (USD)'] || 0) < minACV) return false;
    if (stages && stages.length > 0 && !stages.includes(opp.Stage)) return false;
    return true;
  });

  if (eligible.length === 0) return [];

  // Sort by ACV descending and take top 40 for the AI payload
  const top = eligible
    .sort((a, b) => (b['ACV (USD)'] || 0) - (a['ACV (USD)'] || 0))
    .slice(0, 40);

  const now = new Date();

  // Shape a compact payload for the AI (reduce token usage)
  const payload = top.map((opp) => {
    const closeDate = opp['Close Date'] ? new Date(opp['Close Date']) : null;
    const daysToClose = closeDate
      ? Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      id: opp['Opportunity Id'],
      name: opp['Opportunity Name'],
      account: opp['Account Name'],
      owner: opp['Domo Opportunity Owner'],
      acv: opp['ACV (USD)'] || 0,
      likely: (opp as Record<string, unknown>)['Likely'] || 0,
      high: (opp as Record<string, unknown>)['High'] || 0,
      snowflakeTeam: opp['Snowflake Team Picklist'],
      partnersInvolved: opp['Partners Involved'],
      partnerInfluence: opp['Partner Influence'],
      numCompetitors: opp['Number of Competitors'] || 0,
      type: opp['Type'],                      // Raw type field
      dealType: opp['Type'] || 'Unknown',     // Explicit deal type for AI scoring
      stage: opp['Stage'],
      stageAge: opp['Stage Age'] || 0,
      forecastCategory: opp['Domo Forecast Category'],
      dealCode: opp['Deal Code'],
      daysToClose,
    };
  });

  const userPrompt = `Analyze these opportunities against the 17 TDR factors:

${JSON.stringify(payload, null, 2)}

Return a JSON array with this structure:
[
  {
    "opportunityId": "string",
    "score": number (0-100 based on factor scoring),
    "priority": "CRITICAL" | "HIGH" | "MEDIUM",
    "reasons": ["Factor X: specific reason", "Factor Y: specific reason"],
    "riskFlags": ["specific risk to address in TDR"],
    "suggestedActions": ["action1", "action2"]
  }
]

Only return valid JSON array, no markdown or explanation.`;

  try {
    const raw = await callDomoAI(userPrompt, SYSTEM_PROMPT, 0.3);

    // Parse — strip markdown fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    let parsed: Array<{
      opportunityId: string;
      score: number;
      priority?: string;
      reasons?: string[];
      riskFlags?: string[];
      suggestedActions?: string[];
    }>;

    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[Domo AI] Failed to parse AI response:', parseErr);
      return [];
    }

    // Enrich with opportunity metadata
    const recommendations: TDRRecommendation[] = parsed
      .map((rec) => {
        const opp = top.find((o) => o['Opportunity Id'] === rec.opportunityId);
        if (!opp) return null;

        const score = rec.score || 0;
        let priority = rec.priority || 'LOW';
        if (!rec.priority) {
          if (score >= 75) priority = 'CRITICAL';
          else if (score >= 50) priority = 'HIGH';
          else if (score >= 25) priority = 'MEDIUM';
          else priority = 'LOW';
        }

        return {
          opportunityId: rec.opportunityId,
          opportunityName: opp['Opportunity Name'],
          accountName: opp['Account Name'] || 'Unknown Account',
          acv: opp['ACV (USD)'] || 0,
          score,
          priority: priority as TDRRecommendation['priority'],
          reasons: rec.reasons || [],
          riskFlags: rec.riskFlags || [],
          suggestedActions: rec.suggestedActions || [],
        };
      })
      .filter((r): r is TDRRecommendation => r !== null);

    console.log(`[Domo AI] Generated ${recommendations.length} TDR recommendations`);
    return recommendations;
  } catch (err) {
    console.error('[Domo AI] Failed to generate TDR recommendations:', err);
    return [];
  }
}

/**
 * Check whether AI recommendations are enabled in app settings.
 */
export function isAIEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('tdrAppSettings');
    if (!raw) return true; // default = enabled
    const settings = JSON.parse(raw);
    return settings.enableAIRecommendations !== false;
  } catch {
    return true;
  }
}

