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
    strategy: 'Prioritize executive engagement and comprehensive solution design.',
    icon: 'DollarSign',
    color: 'blue',          // backup: "material" → blue
  },
  cloudPartner: {
    id: 'cloudPartner',
    label: 'Cloud Platform',
    shortLabel: 'Cloud platform',
    tier: 1,
    points: 15,
    description: 'Snowflake, Databricks, or BigQuery is involved',
    strategy: 'Position Domo as composable control layer on their infrastructure.',
    icon: 'Cloud',
    color: 'cyan',           // backup: "cloud-platform" → cyan
  },
  earlyStageSweet: {
    id: 'earlyStageSweet',
    label: 'Architecture Shaping Window',
    shortLabel: 'Shaping window',
    tier: 1,
    points: 15,
    description: 'Stage 2-3 — maximum opportunity to shape architecture before decisions lock in',
    strategy: 'Engage now. Architecture decisions are being made.',
    icon: 'Zap',
    color: 'emerald',        // backup: "early-stage" / "arch-window" → emerald
  },
  competitiveDisplacement: {
    id: 'competitiveDisplacement',
    label: 'Competitive Displacement',
    shortLabel: 'Competitive',
    tier: 1,
    points: 10,
    description: 'Competitors present — displacement scenario',
    strategy: 'Develop clear differentiation. Focus on unique Domo capabilities.',
    icon: 'Swords',
    color: 'amber',          // backup: "competitive" → amber
  },
  newLogoDeal: {
    id: 'newLogoDeal',
    label: 'Greenfield / New Logo',
    shortLabel: 'New logo',
    tier: 1,
    points: 10,
    description: 'New business — full architecture review needed',
    strategy: 'Full discovery and architecture alignment. Shape from the ground up.',
    icon: 'Building2',
    color: 'violet',         // backup: "greenfield" → violet
  },

  // TIER 2 — Complexity indicators
  partnerCoSell: {
    id: 'partnerCoSell',
    label: 'Partner Play',
    shortLabel: 'Partner play',
    tier: 2,
    points: 8,
    description: 'Active partner co-sell — architecture validation needed',
    strategy: 'Validate integration approach and ensure technical alignment with partner.',
    icon: 'Users',
    color: 'cyan',           // backup: "partner-play" / "co-sell" → cyan
  },
  forecastMomentum: {
    id: 'forecastMomentum',
    label: 'Forecast Momentum',
    shortLabel: 'Momentum',
    tier: 2,
    points: 10,
    description: 'Probable/Best Case — deal has real momentum',
    strategy: 'Validate technical requirements align with timeline expectations.',
    icon: 'TrendingUp',
    color: 'blue',           // backup: similar to "enterprise" → blue
  },
  complexDealCode: {
    id: 'complexDealCode',
    label: 'Enterprise Scale',
    shortLabel: 'Enterprise',
    tier: 2,
    points: 5,
    description: 'Multi-component deal code or partner architecture deal',
    strategy: 'Ensure all components are technically validated.',
    icon: 'Layers',
    color: 'blue',           // backup: "enterprise" → blue
  },

  // TIER 3 — Context signals
  staleSignals: {
    id: 'staleSignals',
    label: 'Stalling in Stage',
    shortLabel: 'Stalling',
    tier: 3,
    points: 5,
    description: 'Extended time in current stage — potential blockers',
    strategy: 'Identify technical blockers and re-engage champions.',
    icon: 'Clock',
    color: 'orange',         // backup: "check-progress" → orange
  },
  lateStageRisk: {
    id: 'lateStageRisk',
    label: 'Late Stage',
    shortLabel: 'Late stage',
    tier: 3,
    points: -5,
    description: 'Stage 4+ — technical strategy may be locked',
    strategy: 'Focus on risk mitigation and delivery readiness, not reshaping.',
    icon: 'AlertOctagon',
    color: 'secondary',      // backup: "late-stage" → secondary
  },
  veryStale: {
    id: 'veryStale',
    label: 'Deal Stalled',
    shortLabel: 'Stalled',
    tier: 3,
    points: -10,
    description: 'Stage Age > 180 days — likely dead or deprioritized',
    strategy: 'Re-qualify before investing more SE time.',
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

  // ── 5. Deal Type Signal (0-10) ──────────────────────────────────────────
  //    New logos need full architecture review; upsells less so
  if (dealType.includes('new logo') || dealType.includes('new business')) {
    score += 10;
  } else if (dealType.includes('acquisition')) {
    score += 8;
  } else if (dealType.includes('upsell') || dealType.includes('expansion')) {
    score += 3;
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
