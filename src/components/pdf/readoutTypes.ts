/**
 * TDR Readout Payload — types for the assembled readout data.
 * Matches the shape returned by `assembleTDRReadout` Code Engine function.
 */

export interface ReadoutSession {
  sessionId: string;
  opportunityId: string;
  opportunityName: string;
  accountName: string;
  acv: number;
  stage: string;
  status: string;
  outcome?: string;
  owner: string;
  createdBy: string;
  iteration: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReadoutInput {
  stepId: string;
  fieldId: string;
  value: string;
  savedAt: string;
}

export interface ReadoutSumble {
  technologies: Record<string, string[]> | string[] | null;
  pulledAt: string;
}

export interface ReadoutPerplexity {
  summary: string;
  recentInitiatives: string[] | null;
  technologySignals: string[] | null;
  competitiveLandscape: string[] | null;
  citations: string[] | null;
  pulledAt: string;
}

export interface ReadoutBrief {
  content: string;
  modelUsed: string;
  createdAt: string;
}

export interface ReadoutChatMessage {
  role: string;
  content: string;
  provider: string;
  model: string;
  createdAt: string;
}

export interface ReadoutOrgProfile {
  industry: string;
  totalEmployees: number;
  hqCountry: string;
  hqState: string;
  linkedinUrl?: string;
  pulledAt: string;
}

export interface ReadoutHiringSignals {
  jobCount: number;
  jobsSummary: unknown;
  pulledAt: string;
}

export interface ReadoutKeyPeople {
  peopleCount: number;
  peopleSummary: unknown;
  pulledAt: string;
}

export interface ReadoutActionPlan {
  content: string;
  modelUsed: string;
  createdAt: string;
}

export interface ReadoutPayload {
  success: boolean;
  error?: string;
  session: ReadoutSession;
  inputs: ReadoutInput[];
  sumble: ReadoutSumble | null;
  perplexity: ReadoutPerplexity | null;
  brief: ReadoutBrief | null;
  classifiedFindings: { findings?: { finding: string; category: string }[] } | null;
  extractedEntities: { competitors?: string[]; technologies?: string[]; executives?: string[]; budgets?: string[]; timelines?: string[] } | null;
  actionPlan: ReadoutActionPlan | null;
  chatHighlights: ReadoutChatMessage[];
  orgProfile: ReadoutOrgProfile | null;
  hiringSignals: ReadoutHiringSignals | null;
  keyPeople: ReadoutKeyPeople | null;
  generatedAt: string;
}

export interface ReadoutTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headerBg: string;
  confidentialityLabel: string;
}

export const DEFAULT_THEME: ReadoutTheme = {
  primaryColor: '#6929C4',   // Domo purple
  secondaryColor: '#1B1630', // Deep navy
  accentColor: '#22D3EE',    // Cyan accent
  headerBg: '#1B1630',
  confidentialityLabel: 'CONFIDENTIAL — TDR Readout',
};

