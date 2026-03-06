/**
 * Application Constants
 */

// Allowed managers for the manager filter dropdown
export const ALLOWED_MANAGERS = [
  'Andrew Rich',
  'John Pasalano',
  'Keith White',
  'Taylor Rust',
  'Casey Morgan',
] as const;

// TDR Score thresholds for deal priority filtering
export const TDR_PRIORITY_THRESHOLDS = {
  critical: 75,
  high: 50,
  medium: 25,
} as const;

// TDR Priority filter options
export const TDR_PRIORITY_OPTIONS = [
  { id: 'all', label: 'All Deals' },
  { id: 'critical', label: 'Critical (75+)', minScore: 75 },
  { id: 'high', label: 'High (50+)', minScore: 50 },
  { id: 'medium', label: 'Medium (25+)', minScore: 25 },
  { id: 'low', label: 'Low (<25)', maxScore: 25 },
] as const;

// Stage age filtering: deals with stage age above this are hidden UNLESS
// their close date is within CLOSE_DATE_PROXIMITY_DAYS of today.
export const MAX_STAGE_AGE_DAYS = 730;
export const CLOSE_DATE_PROXIMITY_DAYS = 90;

// PoC SE Manager - SEs reporting to this person are PoC Architects
export const POC_SE_MANAGER = 'Dan Wentworth';

// TDR Steps for the workspace
export const TDR_STEPS = [
  {
    id: 'deal-context',
    name: 'Deal Context & Stakes',
    description: 'Strategic importance and business impact',
  },
  {
    id: 'business-decision',
    name: 'Business Decision',
    description: 'What is the customer trying to achieve?',
  },
  {
    id: 'current-architecture',
    name: 'Current Architecture',
    description: 'Existing systems and data landscape',
  },
  {
    id: 'target-architecture',
    name: 'Target Architecture',
    description: 'Proposed solution and integration points',
  },
  {
    id: 'domo-role',
    name: 'Domo Role',
    description: 'How Domo fits in the solution',
  },
  {
    id: 'partner-alignment',
    name: 'Partner Alignment',
    description: 'SI/Partner involvement and commitment',
  },
  {
    id: 'ai-strategy',
    name: 'AI Strategy',
    description: 'AI/ML use cases and data science needs',
  },
  {
    id: 'technical-risk',
    name: 'Technical Risk',
    description: 'Implementation risks and mitigations',
  },
  {
    id: 'usage-adoption',
    name: 'Usage & Adoption',
    description: 'User adoption plan and success metrics',
  },
] as const;

export const ML_FACTOR_DISPLAY: Record<string, { name: string; explain: string }> = {
  STAGE_NUMBER:           { name: 'Stage',              explain: 'The deal\'s current sales stage. Later stages have historically higher close rates.' },
  DEAL_AGE_DAYS:          { name: 'Deal Age',           explain: 'How long the opportunity has been open. Very old deals tend to stall.' },
  STAGE_AGE_DAYS:         { name: 'Stage Age',          explain: 'Days spent in the current stage. Extended time may indicate a stalled deal.' },
  ACV:                    { name: 'Deal Size',          explain: 'Annual contract value. Larger deals often have longer but more committed cycles.' },
  NUM_COMPETITORS:        { name: 'Competition',        explain: 'Number of known competitors on the deal. More competition lowers win probability.' },
  HAS_PARTNER:            { name: 'Partner Involved',   explain: 'Whether a channel or technology partner is engaged. Partners can accelerate deals.' },
  DEAL_TYPE:              { name: 'Deal Type',          explain: 'New logo vs. upsell. Upsells historically close at higher rates.' },
  SALES_PROCESS:          { name: 'Sales Process',      explain: 'The defined sales methodology being followed for this opportunity.' },
  FORECAST_CATEGORY:      { name: 'Forecast Category',  explain: 'The rep\'s forecast commitment level (Pipeline, Best Case, Commit, Closed).' },
  ACCOUNT_WIN_RATE:       { name: 'Account History',    explain: 'Historical win rate for this account. Past success predicts future outcomes.' },
  QUARTER_END_PROXIMITY:  { name: 'Quarter Timing',     explain: 'How close the deal is to quarter end. Urgency increases near deadlines.' },
  SALES_SEGMENT:          { name: 'Segment',            explain: 'Enterprise, mid-market, or SMB classification. Segment affects close patterns.' },
  SALES_VERTICAL:         { name: 'Vertical',           explain: 'Industry vertical (Tech, Healthcare, Finance, etc.) with distinct win patterns.' },
};

export function getMLFactorDisplayName(rawName: string): string {
  return ML_FACTOR_DISPLAY[rawName]?.name || rawName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function getMLFactorExplanation(rawName: string): string {
  return ML_FACTOR_DISPLAY[rawName]?.explain || 'A feature used by the ML model to predict win probability.';
}

