/**
 * TDR Critical Factors Framework
 *
 * Based on TDR Framework.pdf — TDR exists to protect deal integrity,
 * account expansion, and partner alignment.
 *
 * SCORING PHILOSOPHY:
 *   - Base score is 0. Every point must be EARNED.
 *   - Most deals should land LOW (0-24) or MEDIUM (25-49).
 *   - Only truly complex, high-value, strategically important deals reach HIGH (50-74).
 *   - CRITICAL (75+) is reserved for deals with multiple Tier 1 signals converging.
 *
 * SCORING COMPONENTS (aligned to TDR Framework sections):
 *   1. ACV Significance (0-20)        — material ARR triggers TDR eligibility
 *   2. Stage TDR Value (0-15)         — sweet spot = Stage 2-3 (shape architecture)
 *   3. Cloud Partner Alignment (0-15) — Snowflake/Databricks/BigQuery platform
 *   4. Competitive Pressure (0-10)    — displacement scenario
 *   5. Deal Type Signal (0-10)        — new logo vs upsell vs renewal
 *   6. Forecast Momentum (0-10)       — pipeline/probable/commit category
 *   7. Stage Freshness (-10 to +5)    — stale deals lose priority
 *   8. Deal Complexity (0-10)         — deal code, partner architecture
 *   9. Partner Role (0-5)             — co-sell, reseller
 *
 *   Maximum theoretical: ~100 points
 *   Expected distribution: ~60% LOW/MEDIUM, ~30% HIGH, ~10% CRITICAL
 */

import { Deal } from '@/types/tdr';

// ---------------------------------------------------------------------------
// Critical Factor definitions (for display as "WHY TDR?" tags)
// ---------------------------------------------------------------------------

export interface CriticalFactor {
  id: string;
  label: string;
  shortLabel: string;
  tier: 1 | 2 | 3;
  points: number;
  description: string;
  strategy: string;
  /** Detailed TDR preparation guidance — aligned with the 17-factor AI prompt */
  tdrPrep: string[];
  icon: string;
  /** Color category matching the backup's WHY TDR? palette */
  color: 'cyan' | 'emerald' | 'amber' | 'violet' | 'blue' | 'orange' | 'red' | 'secondary';
}

export const CRITICAL_FACTORS: Record<string, CriticalFactor> = {
  // TIER 1 — High-priority triggers
  // TIER 1 — High-priority triggers
  materialACV: {
    id: 'materialACV',
    label: 'Material Deal',
    shortLabel: '$100K+ ACV',
    tier: 1,
    points: 20,
    description: 'ACV ≥ $100K — material revenue at stake',
    strategy: 'Prioritize executive engagement, comprehensive solution design, and multi-stakeholder alignment. Ensure architecture supports long-term account expansion.',
    tdrPrep: [
      'Review current architecture fit — does the proposed solution protect future ACV growth?',
      'Identify executive sponsors and validate buying committee alignment',
      'Prepare ROI framework tied to specific business outcomes',
      'Assess whether deal scope matches the long-term data strategy',
    ],
    icon: 'DollarSign',
    color: 'blue',          // backup: "material" → blue
  },
  cloudPartner: {
    id: 'cloudPartner',
    label: 'Cloud Platform',
    shortLabel: 'Cloud platform',
    tier: 1,
    points: 15,
    description: 'Cloud data platform is involved — architecture alignment is critical',
    strategy: 'Position Domo as the composable control layer on their data infrastructure. Validate compute strategy and integration approach before architecture decisions lock in.',
    tdrPrep: [
      'How would a cloud architect describe the solution? Validate the Domo role in the stack',
      'Confirm whether MagicETL runs on cloud compute vs. Domo compute',
      'Identify partner SA (Solutions Architect) and schedule joint architecture review',
      'Prepare integration architecture diagram showing data flow between platforms',
      'Validate that cloud-native capabilities align with the overall cloud strategy',
    ],
    icon: 'Cloud',
    color: 'cyan',           // backup: "cloud-platform" → cyan
  },
  earlyStageSweet: {
    id: 'earlyStageSweet',
    label: 'Architecture Shaping Window',
    shortLabel: 'Shaping window',
    tier: 1,
    points: 15,
    description: 'Stage 2–3 = maximum opportunity to shape technical strategy before architecture decisions lock in',
    strategy: 'This is the TDR sweet spot. The SE Subject Matter Expert can still influence architecture decisions, partner alignment, and competitive positioning.',
    tdrPrep: [
      'Engage now — architecture decisions are actively being made at this stage',
      'Define what the SME can uniquely shape: platform choice, integration approach, data governance',
      'Map current vs. target architecture and identify the optimal Domo insertion point',
      'Prepare solution positioning that differentiates from evaluation alternatives',
      'Align with partner SA before the technical team commits to a direction',
    ],
    icon: 'Zap',
    color: 'emerald',        // backup: "early-stage" / "arch-window" → emerald
  },
  competitiveDisplacement: {
    id: 'competitiveDisplacement',
    label: 'Competitive Displacement',
    shortLabel: 'Competitive',
    tier: 1,
    points: 10,
    description: 'Competitors are present — displacement or head-to-head evaluation',
    strategy: 'Build differentiation strategy around unique Domo capabilities. Identify competitor weaknesses and align demo scenarios to exploit gaps.',
    tdrPrep: [
      'Identify specific competitors and their likely positioning',
      'Prepare competitive battle card with differentiation points and landmines',
      'Design demo scenarios that highlight unique strengths (governance, speed to insight, app layer)',
      'Anticipate competitor objections and prepare counter-narratives',
      'Validate that the technical evaluation criteria favor the Domo architecture',
    ],
    icon: 'Swords',
    color: 'amber',          // backup: "competitive" → amber
  },
  newLogoDeal: {
    id: 'newLogoDeal',
    label: 'Greenfield / New Logo',
    shortLabel: 'New logo',
    tier: 1,
    points: 10,
    description: 'New business — full architecture review required. No existing footprint to build on.',
    strategy: 'Full discovery and architecture alignment. Shape the solution from the ground up — this is the best opportunity to establish Domo as the data experience platform.',
    tdrPrep: [
      'Conduct full business challenge discovery — what problem drives this initiative?',
      'Map the existing tech stack and identify integration requirements',
      'Prepare a phased implementation approach (crawl → walk → run)',
      'Define success metrics that tie to specific business outcomes',
      'Identify potential land-and-expand path for long-term account growth',
    ],
    icon: 'Building2',
    color: 'violet',         // backup: "greenfield" → violet
  },

  upsellExpansion: {
    id: 'upsellExpansion',
    label: 'Upsell Expansion',
    shortLabel: 'Upsell',
    tier: 2,
    points: 6,
    description: 'Existing customer expanding — validate partner alignment and architecture fit for new scope.',
    strategy: 'Leverage the existing relationship and usage data. Focus on validating that the expanded use case fits the current architecture and that partner alignment is maintained.',
    tdrPrep: [
      'Review current usage patterns — where is the expansion opportunity?',
      'Validate that existing architecture supports the new use case without rework',
      'Re-confirm partner alignment for the expanded scope (§6)',
      'Identify expansion champions — are they the same as the original buyer?',
      'Assess whether the upsell creates new integration or governance requirements',
    ],
    icon: 'ArrowUpRight',
    color: 'blue',
  },
  newLogoRisk: {
    id: 'newLogoRisk',
    label: 'New Logo at Risk',
    shortLabel: 'New logo risk',
    tier: 1,
    points: 8,
    description: 'New logo facing competitive pressure or extended timeline — early TDR intervention needed.',
    strategy: 'This new relationship is already facing headwinds. Engage immediately with architectural differentiation and executive alignment before the evaluation locks in.',
    tdrPrep: [
      'Assess: is the competitive pressure architectural (feature gap) or commercial (pricing)?',
      'If stale: identify the technical blocker preventing progression',
      'Prepare differentiated architecture story for greenfield deployment',
      'Engage executive sponsor to re-establish Domo positioning',
      'Consider partner co-sell acceleration if applicable',
    ],
    icon: 'AlertTriangle',
    color: 'amber',
  },

  // TIER 2 — Complexity indicators
  partnerCoSell: {
    id: 'partnerCoSell',
    label: 'Partner Play',
    shortLabel: 'Partner play',
    tier: 2,
    points: 8,
    description: 'Active partner co-sell — architecture has not been validated across both platforms',
    strategy: 'Validate the integration approach between Domo and the partner platform. Ensure the combined architecture delivers on requirements without gaps.',
    tdrPrep: [
      'Schedule joint architecture session with partner Solutions Architect',
      'Validate data flow: where does data originate, transform, and land?',
      'Confirm co-sell motion alignment — are both teams positioning consistently?',
      'Identify potential friction: overlapping capabilities, conflicting roadmaps',
      'Prepare a unified architecture diagram for the technical team',
    ],
    icon: 'Users',
    color: 'cyan',           // backup: "partner-play" / "co-sell" → cyan
  },
  forecastMomentum: {
    id: 'forecastMomentum',
    label: 'Forecast Momentum',
    shortLabel: 'Momentum',
    tier: 2,
    points: 10,
    description: 'Forecast category suggests real deal progression — customer is actively evaluating',
    strategy: 'This deal has momentum. Validate that technical requirements are fully understood and that the timeline expectations are realistic for the proposed solution scope.',
    tdrPrep: [
      'Confirm that the technical evaluation criteria and success metrics are defined',
      'Validate that the implementation timeline matches the expected go-live date',
      'Ensure all technical stakeholders have been identified and are aligned',
      'Prepare for potential POC or technical deep-dive requests',
    ],
    icon: 'TrendingUp',
    color: 'blue',           // backup: similar to "enterprise" → blue
  },
  complexDealCode: {
    id: 'complexDealCode',
    label: 'Enterprise Scale',
    shortLabel: 'Enterprise',
    tier: 2,
    points: 5,
    description: 'Multi-component deal structure or partner architecture deal — complexity demands coordination',
    strategy: 'Ensure all solution components are technically validated. Complex deal structures often have integration points that can become delivery risks if not reviewed.',
    tdrPrep: [
      'Map each deal component to specific technical deliverables',
      'Identify cross-component dependencies and integration requirements',
      'Validate that licensing aligns with the actual architecture',
      'Confirm whether professional services or partner delivery is required',
    ],
    icon: 'Layers',
    color: 'blue',           // backup: "enterprise" → blue
  },

  // TIER 3 — Context signals / Risk flags
  staleSignals: {
    id: 'staleSignals',
    label: 'Stalling in Stage',
    shortLabel: 'Stalling',
    tier: 3,
    points: 5,
    description: 'Extended time in current stage — potential technical or organizational blockers preventing progression',
    strategy: 'Identify technical blockers, re-engage champions, and determine if the deal needs a technical re-set or a champion shift. Stale deals often indicate an unresolved technical objection.',
    tdrPrep: [
      'Investigate: Is the stall technical (architecture concerns, POC issues) or organizational (budget, priority shift)?',
      'Re-engage the technical champion — has the evaluation team changed?',
      'Review last technical touchpoint: what was the outcome? Were there open questions?',
      'Consider a technical reset: new demo, updated architecture proposal, or POC extension',
    ],
    icon: 'Clock',
    color: 'orange',         // backup: "check-progress" → orange
  },
  lateStageRisk: {
    id: 'lateStageRisk',
    label: 'Late Stage',
    shortLabel: 'Late stage',
    tier: 3,
    points: -5,
    description: 'Stage 4+ — technical strategy is likely already set. TDR value shifts from shaping to risk validation.',
    strategy: 'Focus on risk mitigation and delivery readiness. The architecture may already be committed — verify it will actually work at scale before contracts close.',
    tdrPrep: [
      'Validate: Is the committed architecture technically sound? Are there hidden risks?',
      'Review implementation plan for feasibility — does the timeline match the complexity?',
      'Identify any last-minute technical objections that could derail the close',
      'Ensure professional services scope aligns with the proposed solution',
      'Late-stage TDR is about risk prevention, not reshaping — adjust expectations accordingly',
    ],
    icon: 'AlertOctagon',
    color: 'secondary',      // backup: "late-stage" → secondary
  },
  veryStale: {
    id: 'veryStale',
    label: 'Deal Stalled',
    shortLabel: 'Stalled',
    tier: 3,
    points: -10,
    description: 'Stage Age > 180 days — deal is likely dead, deprioritized, or facing fundamental obstacles',
    strategy: 'Re-qualify before investing more SE time. If the deal is still alive, identify what has changed and whether a completely new approach is needed.',
    tdrPrep: [
      'Re-qualify: Is this deal still real? Has the budget been reallocated?',
      'If still active: what fundamental blocker has prevented 6+ months of progression?',
      'Consider whether a new champion, new use case, or new approach is needed',
      'Assess opportunity cost — is SE time better spent on fresher pipeline?',
    ],
    icon: 'AlertTriangle',
    color: 'orange',         // backup: "stalled" → orange
  },
};

// Stage timing from TDR Framework
export const STAGE_TIMING = {
  sweetSpot: [2, 3], // Stage numbers where TDR adds most value
  late: [4, 5],
} as const;

// ---------------------------------------------------------------------------
// Scoring engine
// ---------------------------------------------------------------------------

/**
 * Parse stage number from stage string.
 * Handles: "2: Determine Needs", "Closed Won", etc.
 */
function parseStageNumber(stage: string): number {
  // Try "N: ..." format first
  const numMatch = stage.match(/^(\d+):/);
  if (numMatch) return parseInt(numMatch[1]);

  const lower = stage.toLowerCase();
  if (lower.includes('closed')) return 6;
  if (lower.includes('engage') || lower.includes('qualify')) return 1;
  if (lower.includes('determine') || lower.includes('discovery')) return 2;
  if (lower.includes('demonstrate') || lower.includes('validation')) return 3;
  if (lower.includes('confirm') || lower.includes('proposal') || lower.includes('negotiate')) return 4;
  if (lower.includes('close') || lower.includes('closing')) return 5;
  return 1;
}

/**
 * Calculate TDR score from 0-100 based on deal data.
 *
 * The score is built from independent components, each derived from
 * the TDR Framework's eligibility criteria and sections.
 */
export function calculateTDRScore(deal: Deal): number {
  let score = 0;
  const stageNum = deal.stageNumber ?? parseStageNumber(deal.stage);
  const stageAge = deal.stageAge ?? 0;
  const acv = deal.acv ?? 0;
  const forecastCat = (deal.forecastCategory ?? '').toLowerCase();
  const dealType = (deal.dealType ?? '').toLowerCase();
  const numComp = deal.numCompetitors ?? 0;
  const partnerRole = (deal.primaryPartnerRole ?? '').toLowerCase();
  const partnersInvolved = (deal.partnersInvolved ?? '').toLowerCase();
  const snowflake = (deal.snowflakeTeam ?? '').toLowerCase();
  const partnerInfluence = (deal.partnerInfluence ?? '').toLowerCase();
  const dealCode = (deal.dealCode ?? '').toUpperCase();

  // Skip closed deals entirely
  if (forecastCat.includes('closed')) return 0;
  if (deal.stage.toLowerCase().includes('closed')) return 0;

  // ── 1. ACV Significance (0-20) ──────────────────────────────────────────
  //    TDR Framework: "Material ARR" is an eligibility trigger
  if (acv >= 250000) score += 20;
  else if (acv >= 100000) score += 15;
  else if (acv >= 50000) score += 10;
  else if (acv >= 25000) score += 5;
  else if (acv >= 10000) score += 2;
  // acv < $10K: 0 pts

  // ── 2. Stage TDR Value (0-15) ───────────────────────────────────────────
  //    Sweet spot is Stage 2-3 where SE can shape architecture.
  //    Late stage (4-5) has diminishing TDR value.
  if (stageNum === 2) score += 15;       // Determine Needs — PEAK value
  else if (stageNum === 3) score += 12;  // Demonstrate Value — still good
  else if (stageNum === 1) score += 8;   // Early engage — some value
  else if (stageNum === 4) score += 4;   // Confirm — limited value
  // Stage 5+ / Closed: 0

  // ── 3. Cloud Partner Alignment (0-15) ───────────────────────────────────
  //    TDR Framework §6: How would a Snowflake/Databricks/GCP architect
  //    describe this solution?
  const hasCloudPartner = snowflake ||
    /snowflake|databricks|bigquery|google cloud|gcp|aws|azure/i.test(partnersInvolved);

  if (hasCloudPartner) {
    score += 15;
  } else if (partnerInfluence === 'yes' && partnerRole === 'co-sell') {
    score += 8;
  } else if (partnerInfluence === 'yes') {
    score += 4;
  }

  // ── 4. Competitive Pressure (0-10) ──────────────────────────────────────
  //    TDR Framework §8: Competitive & Technical Risk
  if (numComp >= 2) score += 10;
  else if (numComp === 1) score += 5;

  // ── 5. Deal Type Signal (0-23 max) ─────────────────────────────────────
  //    Aligned to TDR Framework: New logos need full architecture review,
  //    Upsells focus on expansion validation and partner re-alignment.
  if (dealType.includes('new logo') || dealType.includes('new business')) {
    score += 10; // Base: greenfield architecture review
    // Bonus: New Logo + Competitive — need architectural differentiation (§8)
    if (numComp > 0) score += 3;
    // Bonus: New Logo + Early Stage — peak shaping window for greenfield (§3/§4)
    if (stageNum <= 2) score += 2;
    // Bonus: New Logo Risk — facing hurdles early, needs intervention
    if (numComp >= 1 || stageAge > 60) score += 8;
  } else if (dealType.includes('acquisition')) {
    score += 8;
  } else if (dealType.includes('upsell') || dealType.includes('expansion')) {
    // Adjusted: Upsell + High ACV = material expansion worth full TDR
    if (acv >= 100000) score += 6;
    else score += 3; // Base upsell
    // Bonus: Upsell + Partner Alignment — re-validate for expanded scope (§6)
    if (hasCloudPartner) score += 2;
  }
  // Renewal: 0

  // ── 6. Forecast Momentum (0-10) ────────────────────────────────────────
  //    Probable deals are the sweet spot for TDR — real but still shapeable
  if (forecastCat.includes('probable')) score += 10;
  else if (forecastCat.includes('best case')) score += 8;
  else if (forecastCat.includes('pipeline')) score += 6;
  else if (forecastCat.includes('commit')) score += 4;
  else if (forecastCat.includes('omitted')) score += 0;

  // ── 7. Stage Freshness (-10 to +5) ─────────────────────────────────────
  //    Fresh deals are healthy; very stale deals waste SE time
  if (stageAge <= 14) score += 5;
  else if (stageAge <= 45) score += 3;
  else if (stageAge <= 90) score += 0;
  else if (stageAge <= 180) score -= 5;
  else score -= 10; // > 180 days

  // ── 8. Deal Complexity (0-10) ──────────────────────────────────────────
  //    Complex deal codes suggest multi-component or partner architecture deals
  if (dealCode.startsWith('PA')) score += 5; // Partner architecture
  else if (dealCode.startsWith('P')) score += 3; // Partner deal
  if (dealCode.includes('-') && !dealCode.endsWith('-A')) score += 3; // Multi-component (not basic)
  if (/E0[2-9]|E[1-9]\d/.test(dealCode)) score += 2; // E02+ = complex enterprise

  // ── 9. Partner Role Strength (0-5) ─────────────────────────────────────
  if (partnerRole === 'co-sell') score += 5;
  else if (partnerRole === 'reseller') score += 3;
  else if (partnerRole === 'referral') score += 1;

  return Math.max(0, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// Factor detection (for WHY TDR? tags)
// ---------------------------------------------------------------------------

/**
 * Detect which critical factors apply to a deal for display
 */
export function detectCriticalFactors(deal: Deal): CriticalFactor[] {
  const factors: CriticalFactor[] = [];
  const stageNum = deal.stageNumber ?? parseStageNumber(deal.stage);
  const stageAge = deal.stageAge ?? 0;
  const acv = deal.acv ?? 0;
  const numComp = deal.numCompetitors ?? 0;
  const forecastCat = (deal.forecastCategory ?? '').toLowerCase();
  const dealType = (deal.dealType ?? '').toLowerCase();
  const partnersInvolved = (deal.partnersInvolved ?? '').toLowerCase();
  const snowflake = (deal.snowflakeTeam ?? '').toLowerCase();
  const partnerRole = (deal.primaryPartnerRole ?? '').toLowerCase();
  const dealCode = (deal.dealCode ?? '').toUpperCase();

  // TIER 1
  if (acv >= 100000) factors.push(CRITICAL_FACTORS.materialACV);

  if (snowflake || /snowflake|databricks|bigquery|gcp|aws|azure/i.test(partnersInvolved)) {
    factors.push(CRITICAL_FACTORS.cloudPartner);
  }

  if (stageNum >= 2 && stageNum <= 3) {
    factors.push(CRITICAL_FACTORS.earlyStageSweet);
  }

  if (numComp >= 1) factors.push(CRITICAL_FACTORS.competitiveDisplacement);

  if (dealType.includes('new logo') || dealType.includes('new business')) {
    factors.push(CRITICAL_FACTORS.newLogoDeal);
    // New Logo Risk: facing competitive pressure or stalling
    if (numComp >= 1 || stageAge > 60) {
      factors.push(CRITICAL_FACTORS.newLogoRisk);
    }
  }

  if (dealType.includes('upsell') || dealType.includes('expansion')) {
    factors.push(CRITICAL_FACTORS.upsellExpansion);
  }

  // TIER 2
  if (partnerRole === 'co-sell') {
    factors.push(CRITICAL_FACTORS.partnerCoSell);
  }

  if (forecastCat.includes('probable') || forecastCat.includes('best case')) {
    factors.push(CRITICAL_FACTORS.forecastMomentum);
  }

  if (dealCode.startsWith('PA') || dealCode.startsWith('P0') || /E0[2-9]/.test(dealCode)) {
    factors.push(CRITICAL_FACTORS.complexDealCode);
  }

  // TIER 3
  if (stageAge > 60 && stageAge <= 180) {
    factors.push(CRITICAL_FACTORS.staleSignals);
  }

  if (stageAge > 180) {
    factors.push(CRITICAL_FACTORS.veryStale);
  }

  if (stageNum >= 4 && stageNum < 6) {
    factors.push(CRITICAL_FACTORS.lateStageRisk);
  }

  return factors;
}

/**
 * Get priority label from score
 */
export function getPriorityFromScore(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

// ---------------------------------------------------------------------------
// Post-TDR Score v2 (Sprint 18)
// ---------------------------------------------------------------------------

export interface PostTDRScoreContext {
  /** Named competitors from structured extract or deal data */
  namedCompetitors?: string[];
  /** Dangerous competitor list from Settings */
  dangerousCompetitors?: string[];
  /** Has Sumble enrichment data */
  hasSumbleEnrichment?: boolean;
  /** Has Perplexity enrichment data */
  hasPerplexityEnrichment?: boolean;
  /** Risk categories from structured extract */
  riskCategories?: string[];
  /** Deal complexity from structured extract */
  dealComplexity?: string;
  /** Domo use cases identified from structured extract */
  domoUseCases?: string[];
  /** Number of completed REQUIRED TDR steps */
  completedStepCount?: number;
  /** Total REQUIRED TDR steps */
  totalStepCount?: number;
  /** Number of completed OPTIONAL TDR steps */
  optionalCompletedCount?: number;
  /** Total OPTIONAL TDR steps */
  optionalTotalCount?: number;
  /** Sprint 19: Fileset match signal — 'strong' | 'partial' | 'none' */
  filesetMatchSignal?: 'strong' | 'partial' | 'none';
  /** Whether an action plan has been generated */
  hasActionPlan?: boolean;
  /** Whether a TDR brief has been generated */
  hasBrief?: boolean;
}

export interface PostTDRScoreBreakdown {
  preTDRScore: number;
  namedCompetitorThreat: number;
  enrichmentDepth: number;
  tdrInputCompleteness: number;
  riskAwareness: number;
  /** Sprint 19: Fileset match signal score (0, 2, or 5) */
  filesetMatchSignal: number;
  totalPostTDR: number;
}

/**
 * Calculate the Post-TDR Score — adds enrichment-based components on top
 * of the Pre-TDR base score. Only meaningful after SE has started the TDR.
 */
export function calculatePostTDRScore(
  deal: Deal,
  context: PostTDRScoreContext
): PostTDRScoreBreakdown {
  const preTDRScore = calculateTDRScore(deal);
  let namedCompetitorThreat = 0;
  let enrichmentDepth = 0;
  let tdrInputCompleteness = 0;
  let riskAwareness = 0;

  // ── Named Competitor Threat (0-10) ─────────────────────────────────────
  // If the deal names competitors from the "dangerous" list, score higher
  const dangerousList = (context.dangerousCompetitors ?? []).map(c => c.toLowerCase());
  const namedList = (context.namedCompetitors ?? []).map(c => c.toLowerCase());

  if (namedList.length > 0 && dangerousList.length > 0) {
    const dangerousMatches = namedList.filter(nc =>
      dangerousList.some(dc => nc.includes(dc) || dc.includes(nc))
    );
    if (dangerousMatches.length >= 2) namedCompetitorThreat = 10;
    else if (dangerousMatches.length === 1) namedCompetitorThreat = 7;
    else if (namedList.length > 0) namedCompetitorThreat = 3; // Named but not dangerous
  }

  // ── Enrichment Depth (0-5) ─────────────────────────────────────────────
  // More external intelligence = more informed TDR
  if (context.hasSumbleEnrichment) enrichmentDepth += 2;
  if (context.hasPerplexityEnrichment) enrichmentDepth += 2;
  if (context.hasSumbleEnrichment && context.hasPerplexityEnrichment) enrichmentDepth += 1; // bonus for both

  // ── TDR Input Completeness (0-10) ──────────────────────────────────────
  // How much of the TDR has the SE actually filled out?
  const completed = context.completedStepCount ?? 0;
  const total = context.totalStepCount ?? 4;
  if (total > 0) {
    const ratio = completed / total;
    if (ratio >= 0.9) tdrInputCompleteness = 10;      // 90%+ complete
    else if (ratio >= 0.7) tdrInputCompleteness = 7;   // 70%+
    else if (ratio >= 0.5) tdrInputCompleteness = 5;   // 50%+
    else if (ratio >= 0.2) tdrInputCompleteness = 2;   // started
    else tdrInputCompleteness = 0;                      // barely touched
  }

  // ── Risk Awareness (0-5) ───────────────────────────────────────────────
  // SE identified risks = more thoughtful TDR
  const riskCount = context.riskCategories?.length ?? 0;
  if (riskCount >= 3) riskAwareness = 5;
  else if (riskCount >= 2) riskAwareness = 3;
  else if (riskCount >= 1) riskAwareness = 2;

  // ── Fileset Match Signal (0-5) — Sprint 19 ───────────────────────────
  // Battle cards / playbooks for named competitors = higher readiness
  let filesetMatchSignalScore = 0;
  if (context.filesetMatchSignal === 'strong') filesetMatchSignalScore = 5;
  else if (context.filesetMatchSignal === 'partial') filesetMatchSignalScore = 2;

  const totalPostTDR = Math.max(0, Math.min(100,
    preTDRScore + namedCompetitorThreat + enrichmentDepth + tdrInputCompleteness + riskAwareness + filesetMatchSignalScore
  ));

  return {
    preTDRScore,
    namedCompetitorThreat,
    enrichmentDepth,
    tdrInputCompleteness,
    riskAwareness,
    filesetMatchSignal: filesetMatchSignalScore,
    totalPostTDR,
  };
}

// ---------------------------------------------------------------------------
// TDR Confidence Score — measures how well-informed the assessment is
// ---------------------------------------------------------------------------
// The Pre-TDR score measures RISK/COMPLEXITY (intrinsic to the deal).
// The Confidence score measures ASSESSMENT QUALITY (how much work the SE has done).
// Together they give a dual-axis view: "How complex is this deal?" × "How well do we understand it?"

export interface TDRConfidenceBreakdown {
  /** Required steps completed out of required total (0–40 pts) */
  requiredSteps: number;
  /** Optional steps completed — bonus depth (0–10 pts) */
  optionalSteps: number;
  /** External intelligence pulled (0–15 pts) */
  externalIntel: number;
  /** AI outputs generated: action plan, brief (0–15 pts) */
  aiOutputs: number;
  /** Knowledge base matches found (0–10 pts) */
  kbMatch: number;
  /** Risk categories identified through extraction (0–10 pts) */
  riskAwareness: number;
  /** Total confidence score 0–100 */
  total: number;
  /** Human-readable confidence band */
  band: 'Insufficient' | 'Developing' | 'Solid' | 'High' | 'Comprehensive';
}

export function calculateTDRConfidence(
  context: PostTDRScoreContext
): TDRConfidenceBreakdown {
  // Required steps (0-40) — the backbone of the TDR
  const reqCompleted = context.completedStepCount ?? 0;
  const reqTotal = context.totalStepCount ?? 4;
  const requiredSteps = reqTotal > 0
    ? Math.round((reqCompleted / reqTotal) * 40)
    : 0;

  // Optional steps (0-10) — bonus depth
  const optCompleted = context.optionalCompletedCount ?? 0;
  const optTotal = context.optionalTotalCount ?? 4;
  const optionalSteps = optTotal > 0
    ? Math.round((optCompleted / optTotal) * 10)
    : 0;

  // External intelligence (0-15)
  let externalIntel = 0;
  if (context.hasSumbleEnrichment) externalIntel += 6;
  if (context.hasPerplexityEnrichment) externalIntel += 6;
  if (context.hasSumbleEnrichment && context.hasPerplexityEnrichment) externalIntel += 3; // both = comprehensive

  // AI outputs (0-15)
  let aiOutputs = 0;
  if (context.hasActionPlan) aiOutputs += 8;
  if (context.hasBrief) aiOutputs += 7;

  // KB match (0-10)
  let kbMatch = 0;
  if (context.filesetMatchSignal === 'strong') kbMatch = 10;
  else if (context.filesetMatchSignal === 'partial') kbMatch = 5;

  // Risk awareness (0-10)
  const riskCount = context.riskCategories?.length ?? 0;
  let riskAwareness = 0;
  if (riskCount >= 3) riskAwareness = 10;
  else if (riskCount >= 2) riskAwareness = 7;
  else if (riskCount >= 1) riskAwareness = 4;

  const total = Math.min(100, requiredSteps + optionalSteps + externalIntel + aiOutputs + kbMatch + riskAwareness);

  let band: TDRConfidenceBreakdown['band'];
  if (total >= 80) band = 'Comprehensive';
  else if (total >= 60) band = 'High';
  else if (total >= 40) band = 'Solid';
  else if (total >= 20) band = 'Developing';
  else band = 'Insufficient';

  return { requiredSteps, optionalSteps, externalIntel, aiOutputs, kbMatch, riskAwareness, total, band };
}

/**
 * Get the top N most impactful factors for display as WHY TDR? tags
 */
export function getTopFactors(deal: Deal, limit = 2): CriticalFactor[] {
  const factors = detectCriticalFactors(deal);
  return factors
    .filter(f => f.points > 0)
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return b.points - a.points;
    })
    .slice(0, limit);
}

/**
 * Get risk flags for a deal
 */
export function getRiskFlags(deal: Deal): CriticalFactor[] {
  return detectCriticalFactors(deal).filter(f => f.points < 0);
}

/**
 * TDR Priority Thresholds
 */
export const TDR_PRIORITY_THRESHOLDS_NEW = {
  critical: 75,
  high: 50,
  medium: 25,
  low: 0,
} as const;
