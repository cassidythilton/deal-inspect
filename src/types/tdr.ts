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
  // Deal team fields (sourced from Opportunities dataset)
  accountExecutive?: string;    // From "Domo Opportunity Owner" column — the AE who owns the deal
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
  competitors?: string;          // Competitor names (comma-separated or semicolon-separated)
  // TDR scoring
  tdrScore?: number; // 0-100 Pre-TDR score
  postTDRScore?: number; // 0-100 Post-TDR score (with enrichment/input quality signals)
  // TDR session tracking (from AppDB) — a deal can have up to 5 TDRs
  tdrSessions?: TDRSessionSummary[];
  // Account Intelligence indicator
  hasIntel?: boolean;
  // Categorization tags
  isCompetitive?: boolean;
  isPartnerPlay?: boolean;
  isStalled?: boolean;
  isEarlyStage?: boolean;
  // Expanded dataset fields (Sprint 28)
  accountRevenue?: number;
  accountEmployees?: number;
  strategicAccount?: boolean;
  region?: string;
  salesSegment?: string;
  salesVertical?: string;
  servicesRatio?: number;
  dealComplexityIndex?: number;
  salesProcessCompleteness?: number;
  // ML propensity fields (Sprint 28c/28d)
  propensityScore?: number;
  mlPrediction?: string;
  propensityQuadrant?: 'HIGH' | 'MONITOR' | 'AT_RISK';
  propensityFactors?: Array<{
    name: string;
    value: string;
    direction: 'helps' | 'hurts' | 'neutral';
    magnitude: number;
  }>;
  propensityScoredAt?: string;
  propensityModelVersion?: string;
  // Composite priority (Sprint 30b)
  dealPriority?: number;
  dealQuadrant?: 'PRIORITIZE' | 'FAST_TRACK' | 'INVESTIGATE' | 'DEPRIORITIZE';
}

export interface TDRStep {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
  /** Whether this step is required for TDR completion */
  required?: boolean;
  /** Core forcing question for this step */
  coreQuestion?: string;
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
