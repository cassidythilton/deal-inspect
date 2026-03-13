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

export function getMLFactorDisplayName(rawName: string): string {
  return rawName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function getMLFactorExplanation(
  rawName: string,
  value?: string,
  direction?: 'helps' | 'hurts' | 'neutral'
): string {
  const v = String(value ?? '');
  const dir = direction ?? 'neutral';

  switch (rawName) {
    case 'Sales Process': {
      const pct = parseInt(v);
      if (dir === 'hurts') {
        if (!isNaN(pct) && pct < 30) return `Only ${v} of sales milestones completed (discovery, demo, pricing, gate calls). Advance these to strengthen the deal.`;
        return `${v} of milestones completed — below the threshold that correlates with wins. Schedule outstanding discovery, demo, or pricing calls.`;
      }
      if (dir === 'helps') return `${v} of milestones completed — a thorough process strongly correlates with closing.`;
      return `${v} of sales milestones completed.`;
    }

    case 'Deal Size': {
      if (dir === 'helps') return `ACV is ${v.toLowerCase()} for this segment. Larger deals in this segment close at higher rates historically.`;
      if (dir === 'hurts') return `ACV is ${v.toLowerCase()} for this segment. Smaller deals often lack executive sponsorship — consider whether the business case justifies buyer effort.`;
      return `ACV is ${v.toLowerCase()} for this segment.`;
    }

    case 'Competition': {
      if (v === '0 competitors' || v.startsWith('0 ')) {
        return 'No named competitors — non-competitive deals close at significantly higher rates.';
      }
      if (dir === 'hurts') return `${v} in play. Higher competition lowers win rate. Sharpen differentiation and identify the decision criteria the competition can\'t meet.`;
      if (dir === 'helps') return `${v} — manageable competitive field. Clear positioning should maintain advantage.`;
      return `${v} involved.`;
    }

    case 'Engagement Level': {
      if (dir === 'helps') return `${v} engagement — strong buyer interaction is the strongest behavioral predictor of close.`;
      if (dir === 'hurts') {
        if (v === 'None' || v === 'Unknown') return 'No engagement data detected. Increase stakeholder touchpoints — deals with low engagement close at half the rate.';
        return `${v} engagement. Increase executive involvement and meeting cadence — deals at this engagement level close at below-average rates.`;
      }
      return `${v} engagement level.`;
    }

    case 'Deal Complexity': {
      const idx = parseFloat(v);
      if (dir === 'hurts') {
        if (!isNaN(idx) && idx > 3) return `Complexity score ${v} (driven by line items, competitors, and services). High-complexity deals take longer and close less often — simplify scope or phase the rollout.`;
        return `Complexity score ${v} — above average. Consider reducing scope or breaking into phases.`;
      }
      if (dir === 'helps') return `Complexity score ${v} — simpler deals with fewer moving parts close faster and more reliably.`;
      return `Complexity score ${v}.`;
    }

    case 'Deal Age': {
      const days = parseInt(v);
      if (dir === 'hurts') {
        if (!isNaN(days) && days > 365) return `${v} in pipeline — well beyond the typical close window. Create urgency with a time-bound offer or re-qualify the opportunity.`;
        return `${v} in pipeline — exceeds the average for wins. Identify what's stalling the deal and set a concrete next-step deadline.`;
      }
      if (dir === 'helps') return `${v} in pipeline — within the typical window for successful deals. Momentum is a positive signal.`;
      return `${v} in pipeline.`;
    }

    case 'Services Mix': {
      if (dir === 'hurts') return `Professional services are ${v} of the deal. High services ratios indicate implementation complexity that can delay or derail deals.`;
      if (dir === 'helps') return `Services are ${v} of the deal — a healthy platform-to-services ratio that correlates with faster closes.`;
      return `Professional services make up ${v} of the deal.`;
    }

    case 'Revenue Mix': {
      if (dir === 'helps') return `${v} — strong recurring revenue base. Recurring-heavy deals signal long-term buyer commitment and close at higher rates.`;
      if (dir === 'hurts') return `${v} — low recurring component. Deals weighted toward non-recurring revenue may indicate uncertainty about long-term adoption.`;
      return `${v}.`;
    }

    default:
      return `${rawName}: ${v || 'N/A'}. ${dir === 'helps' ? 'Positively' : dir === 'hurts' ? 'Negatively' : 'Minimally'} impacts win probability.`;
  }
}

