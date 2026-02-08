/**
 * TDR Critical Factors Framework
 * Based on TDR Framework.pdf and backup logic
 * 
 * The key insight: Early-stage deals (Stage 2-3) are the SWEET SPOT because
 * the SME can influence architecture decisions BEFORE they're locked in.
 * Late-stage deals need "rescue intervention" not "strategic shaping".
 */

import { Deal } from '@/types/tdr';

// Stage timing context
export const STAGE_TIMING = {
  sweetSpot: ['2: Determine Needs', '3: Demonstrate Value', 'Determine Needs', 'Demonstrate Value', 'Discovery', 'Validation'],
  lateStage: ['4: Confirm Solution', '5: Negotiate', 'Confirm Solution', 'Negotiate', 'Proposal', 'Closing'],
} as const;

// Critical Factor Types with scoring
export interface CriticalFactor {
  id: string;
  label: string;
  shortLabel: string;
  tier: 1 | 2 | 3;
  points: number;
  description: string;
  strategy: string;
  icon: string;
  color: 'orange' | 'blue' | 'green' | 'purple' | 'red' | 'amber';
}

export const CRITICAL_FACTORS: Record<string, CriticalFactor> = {
  // TIER 1 - HIGH PRIORITY TRIGGERS (25 pts each)
  materialACV: {
    id: 'materialACV',
    label: 'Material ACV',
    shortLabel: 'High ACV',
    tier: 1,
    points: 25,
    description: 'ACV ≥ $150K (high priority if ≥ $300K)',
    strategy: 'Prioritize for executive engagement and comprehensive solution design.',
    icon: 'DollarSign',
    color: 'green',
  },
  partnerPlatform: {
    id: 'partnerPlatform',
    label: 'Partner Platform',
    shortLabel: 'Partner platform',
    tier: 1,
    points: 25,
    description: 'Snowflake/Databricks/BigQuery involvement',
    strategy: 'Position Domo as composable control layer. Start with ETL, expand to analytics.',
    icon: 'Cloud',
    color: 'purple',
  },
  strategicAccount: {
    id: 'strategicAccount',
    label: 'Strategic Account',
    shortLabel: 'Strategic',
    tier: 1,
    points: 25,
    description: 'Enterprise segment OR revenue > $1B OR employees > 5K',
    strategy: 'Engage executive sponsors and align with long-term strategic roadmap.',
    icon: 'Building2',
    color: 'blue',
  },
  competitiveDisplacement: {
    id: 'competitiveDisplacement',
    label: 'Competitive Displacement',
    shortLabel: 'Competitive',
    tier: 1,
    points: 25,
    description: 'Competitors present AND displacing incumbent',
    strategy: 'Develop clear differentiation strategy. Focus on unique Domo capabilities.',
    icon: 'Swords',
    color: 'orange',
  },
  earlyStageStrong: {
    id: 'earlyStageStrong',
    label: 'Early-Stage + Strong Signal',
    shortLabel: 'Shaping window',
    tier: 1,
    points: 25,
    description: 'Stage 2-3 AND ACV ≥ $150K - THIS IS THE SWEET SPOT',
    strategy: 'Maximum opportunity to shape architecture before decisions lock in.',
    icon: 'Zap',
    color: 'green',
  },
  forecastMomentum: {
    id: 'forecastMomentum',
    label: 'Forecast Momentum',
    shortLabel: 'Momentum',
    tier: 1,
    points: 25,
    description: 'Category suggests deal progression (Probable, Commit)',
    strategy: 'Validate technical requirements align with timeline expectations.',
    icon: 'TrendingUp',
    color: 'green',
  },

  // TIER 2 - COMPLEXITY INDICATORS (15 pts each)
  multiCloud: {
    id: 'multiCloud',
    label: 'Multi-Cloud/Hybrid',
    shortLabel: 'Multi-cloud',
    tier: 2,
    points: 15,
    description: 'Multiple cloud platforms or hybrid deployment',
    strategy: 'Position Domo as unified layer across environments.',
    icon: 'Layers',
    color: 'purple',
  },
  dataIntegration: {
    id: 'dataIntegration',
    label: 'Complex Data Integration',
    shortLabel: 'Integration',
    tier: 2,
    points: 15,
    description: 'Multiple data sources requiring orchestration',
    strategy: 'Demonstrate ETL/data pipeline capabilities and time-to-value.',
    icon: 'GitMerge',
    color: 'blue',
  },
  partnerCoSell: {
    id: 'partnerCoSell',
    label: 'Partner Co-Sell',
    shortLabel: 'Partner co-sell',
    tier: 2,
    points: 15,
    description: 'Partner sourcing active but architecture not validated',
    strategy: 'Validate integration approach and ensure technical alignment.',
    icon: 'Users',
    color: 'blue',
  },
  aiScope: {
    id: 'aiScope',
    label: 'AI/Agentic Scope',
    shortLabel: 'AI scope',
    tier: 2,
    points: 15,
    description: 'Business challenge suggests AI/automation opportunity',
    strategy: 'Position Domo AI capabilities and data science workflows.',
    icon: 'Sparkles',
    color: 'purple',
  },
  cloudCompute: {
    id: 'cloudCompute',
    label: 'Cloud Compute',
    shortLabel: 'Cloud compute',
    tier: 2,
    points: 15,
    description: 'Cloud platform identified, compute strategy unclear',
    strategy: 'Demonstrate Domo can run natively on their infrastructure.',
    icon: 'Server',
    color: 'purple',
  },

  // TIER 3 - CONTEXT SIGNALS (10 pts each)
  verticalDepth: {
    id: 'verticalDepth',
    label: 'Vertical Depth',
    shortLabel: 'Vertical',
    tier: 3,
    points: 10,
    description: 'Financial Services, Healthcare, Manufacturing, Technology',
    strategy: 'Leverage industry-specific use cases and compliance expertise.',
    icon: 'Briefcase',
    color: 'blue',
  },
  architectureWindow: {
    id: 'architectureWindow',
    label: 'Architecture Decision Window',
    shortLabel: 'Arch. window',
    tier: 3,
    points: 10,
    description: 'Early stage + partner platform = critical timing',
    strategy: 'Act now - architecture decisions are being made.',
    icon: 'Clock',
    color: 'amber',
  },
  staleSignals: {
    id: 'staleSignals',
    label: 'Stale Signals',
    shortLabel: 'Stalled',
    tier: 3,
    points: 10,
    description: 'Stage Age > 60 days OR no update in 14+ days',
    strategy: 'Identify blockers and re-engage technical champions.',
    icon: 'Clock',
    color: 'amber',
  },
  expansionDynamics: {
    id: 'expansionDynamics',
    label: 'Expansion Dynamics',
    shortLabel: 'Expansion',
    tier: 3,
    points: 10,
    description: 'Existing customer expanding architecture',
    strategy: 'Leverage existing relationship to expand footprint.',
    icon: 'ArrowUpRight',
    color: 'green',
  },
  lateStageRisk: {
    id: 'lateStageRisk',
    label: 'Late-Stage Risk',
    shortLabel: 'Late-stage',
    tier: 3,
    points: -5, // Negative - reduces priority
    description: 'Stage ≥ 4 - technical strategy may be locked',
    strategy: 'Rescue intervention needed, not strategic shaping. Focus on risk mitigation.',
    icon: 'AlertOctagon',
    color: 'red',
  },
};

/**
 * Detect which critical factors apply to a deal
 */
export function detectCriticalFactors(deal: Deal): CriticalFactor[] {
  const factors: CriticalFactor[] = [];
  const stageLower = (deal.stage || '').toLowerCase();
  const isEarlyStage = STAGE_TIMING.sweetSpot.some(s => stageLower.includes(s.toLowerCase()));
  const isLateStage = STAGE_TIMING.lateStage.some(s => stageLower.includes(s.toLowerCase()));

  // TIER 1 checks
  if (deal.acv >= 150000) {
    factors.push(CRITICAL_FACTORS.materialACV);
  }

  // Partner platform detection (would need partner data)
  if (deal.partnersInvolved && /snowflake|databricks|bigquery|aws|azure|gcp/i.test(deal.partnersInvolved)) {
    factors.push(CRITICAL_FACTORS.partnerPlatform);
  }

  // Competitive displacement
  if (deal.isCompetitive || deal.reasons.some(r => r.toLowerCase().includes('compet'))) {
    factors.push(CRITICAL_FACTORS.competitiveDisplacement);
  }

  // Early-stage + strong signal (THE SWEET SPOT)
  if (isEarlyStage && deal.acv >= 150000) {
    factors.push(CRITICAL_FACTORS.earlyStageStrong);
  }

  // TIER 2 checks
  if (deal.isPartnerPlay || deal.partnerSignal === 'strong' || deal.partnerSignal === 'moderate') {
    factors.push(CRITICAL_FACTORS.partnerCoSell);
  }

  // TIER 3 checks
  if (deal.stageAge && deal.stageAge > 60) {
    factors.push(CRITICAL_FACTORS.staleSignals);
  }

  // Late-stage warning (negative factor)
  if (isLateStage) {
    factors.push(CRITICAL_FACTORS.lateStageRisk);
  }

  return factors;
}

/**
 * Calculate TDR score based on critical factors
 */
export function calculateTDRScore(deal: Deal): number {
  const factors = detectCriticalFactors(deal);
  let score = 0;

  for (const factor of factors) {
    score += factor.points;
  }

  // Ensure score is within 0-100 range
  return Math.max(0, Math.min(100, score));
}

/**
 * Get priority level from score
 */
export function getPriorityFromScore(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

/**
 * Get the top 2 most impactful factors for display as WHY TDR tags
 */
export function getTopFactors(deal: Deal, limit = 2): CriticalFactor[] {
  const factors = detectCriticalFactors(deal);
  
  // Sort by tier (lower = higher priority) then by points (higher = more important)
  return factors
    .filter(f => f.points > 0) // Exclude negative factors from display
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return b.points - a.points;
    })
    .slice(0, limit);
}

/**
 * Get risk flags for a deal (negative factors)
 */
export function getRiskFlags(deal: Deal): CriticalFactor[] {
  const factors = detectCriticalFactors(deal);
  return factors.filter(f => f.points < 0 || f.id === 'staleSignals' || f.id === 'lateStageRisk');
}

