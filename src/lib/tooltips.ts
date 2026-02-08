/**
 * Tooltip Content Configuration
 * All tooltip text for the TDR Deal Inspection app
 */

// TDR Score explanations by priority level
export const TDR_SCORE_TOOLTIPS = {
  critical: 'TDR Score 75+: Highest priority for SE engagement. Major architecture decisions pending, cloud platform integration opportunities, or competitive differentiation urgently needed.',
  high: 'TDR Score 50-74: Strong TDR candidates. Multiple technical factors present—partner integrations, complex data architectures, or platform expansion potential.',
  medium: 'TDR Score 25-49: Moderate technical complexity. Consider for TDR if bandwidth allows—may have specific integration or architecture needs.',
  low: 'TDR Score <25: Limited technical complexity. Standard sales-led motion likely sufficient unless specific technical questions arise.',
} as const;

// Get TDR score tooltip based on score value
export function getTDRScoreTooltip(score: number): string {
  if (score >= 75) return TDR_SCORE_TOOLTIPS.critical;
  if (score >= 50) return TDR_SCORE_TOOLTIPS.high;
  if (score >= 25) return TDR_SCORE_TOOLTIPS.medium;
  return TDR_SCORE_TOOLTIPS.low;
}

// Get TDR priority label based on score
export function getTDRPriorityLabel(score: number): 'Critical' | 'High' | 'Medium' | 'Low' {
  if (score >= 75) return 'Critical';
  if (score >= 50) return 'High';
  if (score >= 25) return 'Medium';
  return 'Low';
}

// Stage definitions with tooltips
export const STAGE_CONFIG = {
  '01': {
    label: 'Prospect',
    num: '01',
    tooltip: 'Stage 01 - Prospect: Customer needs being explored. Maximum opportunity to shape architecture and solution direction.',
    className: 'stage-early',
  },
  '02': {
    label: 'Discovery', 
    num: '02',
    tooltip: 'Stage 02 - Discovery: Customer needs being explored. Maximum opportunity to shape architecture and solution direction.',
    className: 'stage-early',
  },
  '03': {
    label: 'Validation',
    num: '03', 
    tooltip: 'Stage 03 - Validation: Solution being demonstrated. Good opportunity to influence technical decisions and partner alignment.',
    className: 'stage-mid',
  },
  '04': {
    label: 'Proposal',
    num: '04',
    tooltip: 'Stage 04 - Proposal: Technical strategy likely set. Focus on risk validation and ensuring delivery readiness.',
    className: 'stage-late',
  },
  '05': {
    label: 'Closing',
    num: '05',
    tooltip: 'Stage 05 - Closing: Technical strategy likely set. Focus on risk validation and ensuring delivery readiness.',
    className: 'stage-late',
  },
} as const;

// Get stage config from stage name
export function getStageConfig(stageName: string): typeof STAGE_CONFIG[keyof typeof STAGE_CONFIG] | null {
  const stageLower = stageName.toLowerCase();
  
  if (stageLower.includes('prospect')) return STAGE_CONFIG['01'];
  if (stageLower.includes('discovery') || stageLower.includes('determine')) return STAGE_CONFIG['02'];
  if (stageLower.includes('validation') || stageLower.includes('demonstrate')) return STAGE_CONFIG['03'];
  if (stageLower.includes('proposal') || stageLower.includes('negotiate')) return STAGE_CONFIG['04'];
  if (stageLower.includes('closing') || stageLower.includes('close')) return STAGE_CONFIG['05'];
  
  return null;
}

// WHY TDR tag configurations with strategies
export const WHY_TDR_TAGS = {
  competitive: {
    label: 'Competitive',
    icon: 'Swords',
    color: 'orange',
    description: 'Active competition in deal',
    strategy: 'Assess competitive positioning and differentiation strategy.',
  },
  partnerPlay: {
    label: 'Partner play',
    icon: 'Users',
    color: 'blue', 
    description: 'Partner-influenced deal',
    strategy: 'Validate integration approach and co-sell opportunity.',
  },
  stalled: {
    label: 'Stalled',
    icon: 'Clock',
    color: 'red',
    description: 'Extended time in current stage',
    strategy: 'Identify blockers and accelerate technical decision-making.',
  },
  earlyStage: {
    label: 'Early stage',
    icon: 'Zap',
    color: 'green',
    description: 'Early in sales cycle',
    strategy: 'Shape architecture direction and establish technical credibility.',
  },
  cloudPlatform: {
    label: 'Cloud platform',
    icon: 'Cloud',
    color: 'purple',
    description: 'Cloud platform integration opportunity',
    strategy: 'Position Domo as control layer on their infrastructure.',
  },
} as const;

// Generate WHY TDR tooltip content
export function getWhyTDRTooltip(tag: keyof typeof WHY_TDR_TAGS): string {
  const config = WHY_TDR_TAGS[tag];
  return `${config.description}.\n→ ${config.strategy}`;
}

// Partner tooltip content generator
export interface PartnerInfo {
  cloudPlatform?: string;
  partnersInvolved?: string;
  primaryPartnerRole?: string;
  dealCode?: string;
}

export function getPartnerTooltip(info: PartnerInfo): string | null {
  if (!info.partnersInvolved && !info.cloudPlatform) return null;
  
  const lines: string[] = [];
  
  if (info.cloudPlatform || info.partnersInvolved) {
    lines.push(`Cloud Platform: ${info.cloudPlatform || info.partnersInvolved}`);
  }
  
  if (info.primaryPartnerRole) {
    lines.push(`Role: ${info.primaryPartnerRole}`);
  }
  
  if (info.dealCode) {
    lines.push(`Deal Code: ${info.dealCode}`);
  }
  
  // Add strategy recommendation
  if (info.cloudPlatform?.toLowerCase().includes('snowflake')) {
    lines.push('→ Position Domo as control layer on their infrastructure');
  } else if (info.primaryPartnerRole) {
    lines.push('→ Validate integration approach and co-sell opportunity');
  }
  
  return lines.join('\n');
}

// TDR Priority Factors tooltip
export function getTDRPriorityFactorsTooltip(deal: {
  numCompetitors?: number;
  isPartnerPlay?: boolean;
  stageAge?: number;
  isEarlyStage?: boolean;
}): string {
  const factors: string[] = ['TDR Priority Factors:'];
  
  if (deal.numCompetitors && deal.numCompetitors > 0) {
    factors.push(`• ${deal.numCompetitors} competitor${deal.numCompetitors > 1 ? 's' : ''}`);
  }
  
  if (deal.isPartnerPlay) {
    factors.push('• Partner play');
  }
  
  if (deal.stageAge) {
    factors.push(`• ${deal.stageAge}d in stage`);
  }
  
  if (deal.isEarlyStage) {
    factors.push('• Early stage opportunity');
  }
  
  return factors.length > 1 ? factors.join('\n') : '';
}

// Top TDR Candidates chart tooltip
export function getTopCandidateTooltip(deal: {
  dealName: string;
  account: string;
  tdrScore?: number;
  acv: number;
  stage: string;
}): string {
  const priority = getTDRPriorityLabel(deal.tdrScore ?? 0);
  const acvFormatted = deal.acv >= 1000000 
    ? `$${(deal.acv / 1000000).toFixed(1)}M`
    : `$${Math.round(deal.acv / 1000)}K`;
  
  const stageConfig = getStageConfig(deal.stage);
  const stageLabel = stageConfig?.label || deal.stage;
  
  return `${deal.dealName}\n${deal.account}\nTDR: ${deal.tdrScore ?? 0}  (${priority})\n${acvFormatted} • ${stageLabel}`;
}

// Metrics card tooltips
export const METRICS_TOOLTIPS = {
  eligibleACV: 'Total ACV of deals in the current view that meet eligibility criteria.',
  recommended: 'Deals prioritized for TDR review based on technical complexity and strategic value.',
  agenda: 'Deals you have pinned for upcoming TDR sessions.',
  atRisk: 'Deals with elevated risk indicators requiring attention.',
} as const;

