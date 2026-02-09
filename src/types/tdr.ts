export type DealStatus = 'ready' | 'at-risk' | 'needs-attention' | 'draft';
export type ReadinessLevel = 'green' | 'yellow' | 'red';

/** Lightweight summary of a single TDR session for the deals list */
export interface TDRSessionSummary {
  id: string;
  status: 'in-progress' | 'completed';
  completedAt?: string;
  createdAt: string;
}

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
  // SE Team fields (sourced from Opportunities dataset)
  salesConsultant?: string;     // From "Sales Consultant" column
  pocSalesConsultant?: string;  // From "PoC Sales Consultant" column
  seManager?: string;           // Looked up via SE mapping
  // Partner fields
  partnersInvolved?: string;
  primaryPartnerRole?: string;
  partnerInfluence?: string;    // "Yes" or "No"
  snowflakeTeam?: string;       // Snowflake Team Picklist
  dealCode?: string;
  websiteDomain?: string;       // From "Webiste Domain" column (account website URL)
  // Forecast fields
  forecastCategory?: string;    // Domo Forecast Category
  dealType?: string;            // Type: "New Logo", "Upsell", etc.
  numCompetitors?: number;      // Number of Competitors
  // TDR scoring
  tdrScore?: number; // 0-100 score
  // TDR session tracking (from AppDB) — a deal can have up to 5 TDRs
  tdrSessions?: TDRSessionSummary[];
  // Account Intelligence indicator
  hasIntel?: boolean;
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
