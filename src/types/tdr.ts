export type DealStatus = 'ready' | 'at-risk' | 'needs-attention' | 'draft';
export type ReadinessLevel = 'green' | 'yellow' | 'red';

export interface Deal {
  id: string;
  account: string;
  dealName: string;
  stage: string;
  stageNumber?: number; // Stage number for display like [02], [03]
  stageAge?: number; // Days in current stage
  acv: number;
  closeDate: string;
  closeDateFQ?: string; // Fiscal quarter
  partnerSignal: 'strong' | 'moderate' | 'weak' | 'none';
  riskLevel: ReadinessLevel;
  reasons: string[]; // WHY TDR? tags
  owner: string;
  isPinned?: boolean;
  agendaStatus?: 'draft' | 'ready' | 'reviewed';
  // SE Team fields
  salesConsultant?: string;
  seManager?: string;
  // TDR scoring
  tdrScore?: number; // 0-50 score
  // Categorization tags
  isCompetitive?: boolean;
  isPartnerPlay?: boolean;
  isStalled?: boolean;
  isEarlyStage?: boolean;
}

export interface TDRStep {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
}

export interface MetricCard {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  status?: ReadinessLevel;
}

export interface HygieneIssue {
  id: string;
  type: 'stale-date' | 'missing-update' | 'high-risk';
  dealName: string;
  message: string;
}
