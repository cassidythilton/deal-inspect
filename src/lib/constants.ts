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
  medium: 35,
} as const;

// TDR Priority filter options
export const TDR_PRIORITY_OPTIONS = [
  { id: 'all', label: 'All Deals' },
  { id: 'critical', label: 'Critical (75+)', minScore: 75 },
  { id: 'high', label: 'High (50+)', minScore: 50 },
  { id: 'medium', label: 'Medium (35+)', minScore: 35 },
  { id: 'low', label: 'Low (<35)', maxScore: 35 },
] as const;

// Maximum stage age in days for data filtering (performance optimization)
export const MAX_STAGE_AGE_DAYS = 365;

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

