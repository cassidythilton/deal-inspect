export type DealStatus = 'ready' | 'at-risk' | 'needs-attention' | 'draft';
export type ReadinessLevel = 'green' | 'yellow' | 'red';

export interface Deal {
  id: string;
  account: string;
  dealName: string;
  stage: string;
  acv: number;
  closeDate: string;
  partnerSignal: 'strong' | 'moderate' | 'weak' | 'none';
  riskLevel: ReadinessLevel;
  reasons: string[];
  owner: string;
  isPinned?: boolean;
  agendaStatus?: 'draft' | 'ready' | 'reviewed';
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
