/**
 * Cortex AI — Front-end service for Snowflake Cortex AI functions
 *
 * Calls Code Engine functions that execute Snowflake Cortex SQL
 * (AI_COMPLETE, AI_CLASSIFY, AI_EXTRACT) against stored TDR and
 * account intelligence data.
 *
 * Sprint 7: generateTDRBrief, classifyFindings, extractEntities
 *
 * @see IMPLEMENTATION_STRATEGY.md Section 7 (Sprint 7)
 */

import { isDomoEnvironment } from './domo';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TDRBrief {
  success: boolean;
  brief?: string;
  modelUsed?: string;
  resultId?: string;
  error?: string;
}

export interface ClassifiedFinding {
  finding: string;
  category: string;
}

export interface ClassifiedFindingsResult {
  success: boolean;
  findings: ClassifiedFinding[];
  error?: string;
}

export interface ExtractedEntities {
  success: boolean;
  competitors: string[];
  technologies: string[];
  executives: string[];
  budgets: string[];
  timelines: string[];
  error?: string;
}

// Category display config for classified findings
export const FINDING_CATEGORY_STYLES: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  competitive_threat: {
    label: 'Competitive Threat',
    bg: 'bg-red-500/15',
    text: 'text-red-300',
    border: 'border-red-500/20',
  },
  technology_adoption: {
    label: 'Tech Adoption',
    bg: 'bg-blue-500/15',
    text: 'text-blue-300',
    border: 'border-blue-500/20',
  },
  strategic_initiative: {
    label: 'Strategic Initiative',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    border: 'border-emerald-500/20',
  },
  organizational_change: {
    label: 'Org Change',
    bg: 'bg-purple-500/15',
    text: 'text-purple-300',
    border: 'border-purple-500/20',
  },
  risk_indicator: {
    label: 'Risk Indicator',
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-500/20',
  },
  expansion_opportunity: {
    label: 'Expansion Opp.',
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-300',
    border: 'border-cyan-500/20',
  },
};

// ─── Code Engine Calling ─────────────────────────────────────────────────────

interface DomoSDK {
  get: (url: string) => Promise<unknown>;
  post: (url: string, body?: unknown) => Promise<unknown>;
  put: (url: string, body?: unknown) => Promise<unknown>;
  delete: (url: string) => Promise<unknown>;
}

function getDomo(): DomoSDK | null {
  const domo =
    (window as unknown as { domo?: DomoSDK }).domo ||
    (globalThis as unknown as { domo?: DomoSDK }).domo;
  return domo || null;
}

const CE_BASE = '/domo/codeengine/v2/packages';

async function callCodeEngine<T>(
  fnName: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const domo = getDomo();
  if (!domo) {
    throw new Error(
      `[CortexAI] Code Engine not available — no Domo SDK. Function: ${fnName}`
    );
  }

  const url = `${CE_BASE}/${fnName}`;
  console.log(`[CortexAI] Calling Code Engine: ${fnName}`, Object.keys(args));

  try {
    const result = await domo.post(url, args);
    console.log(`[CortexAI] Code Engine raw response for ${fnName}:`, result);
    return result as T;
  } catch (err) {
    console.error(`[CortexAI] Code Engine call failed: ${fnName}`, err);
    throw err;
  }
}

/**
 * Extract the actual result from potentially SDK-wrapped responses.
 */
function extractResult(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null) {
    if ('success' in raw) return raw as Record<string, unknown>;
    const keys = Object.keys(raw);
    if (keys.length === 1) {
      const inner = (raw as Record<string, unknown>)[keys[0]];
      if (typeof inner === 'object' && inner !== null) {
        return inner as Record<string, unknown>;
      }
    }
  }
  console.warn('[CortexAI] Unexpected response shape:', raw);
  return raw as Record<string, unknown>;
}

// ─── Mock data for dev mode ──────────────────────────────────────────────────

const MOCK_BRIEF: TDRBrief = {
  success: true,
  brief: `**1. Executive Summary**

This is a mid-market deal with Acme Corp involving a cloud data modernization initiative. The account is migrating from legacy Teradata to Snowflake and evaluating BI consolidation. Domo can position as the unified analytics layer across their new cloud data stack.

**2. Technical Architecture Assessment**

The current architecture includes Snowflake (Enterprise tier), AWS cloud infrastructure, Salesforce CRM, Tableau for executive dashboards, dbt for transformations, and Kafka for event streaming. The target architecture calls for a consolidated BI platform replacing Tableau and internal tools, with Domo positioned as the enterprise analytics and data experience layer.

**3. Risk Factors**

- Competitive: Tableau is entrenched for executive dashboards; ThoughtSpot POC planned
- Timeline: BI consolidation budget allocated for FY2026 — window is now
- Technical: Complex Kafka integration may require custom connector work
- Champion: CTO has stated public goal but no identified internal champion yet

**4. Recommended Actions**

- Schedule architecture workshop focused on Snowflake + Domo integration story
- Prepare competitive positioning deck: Domo vs Tableau vs ThoughtSpot for unified analytics
- Identify and engage CTO or VP Data as potential champion
- Build reference story around similar Teradata → Snowflake → Domo migrations

**5. TDR Outcome Recommendation: needs-work**

Deal shows strong technical alignment but needs deeper competitive positioning and champion identification before proceeding.`,
  modelUsed: 'llama3.1-70b (mock)',
  resultId: 'mock-result-001',
};

const MOCK_CLASSIFIED: ClassifiedFindingsResult = {
  success: true,
  findings: [
    {
      finding: 'CTO publicly stated goal of "single pane of glass" for data visibility',
      category: 'strategic_initiative',
    },
    {
      finding: 'Budget allocated for BI modernization in FY2026',
      category: 'expansion_opportunity',
    },
    {
      finding: 'Strong existing Snowflake relationship — joint reference customer',
      category: 'technology_adoption',
    },
  ],
};

const MOCK_ENTITIES: ExtractedEntities = {
  success: true,
  competitors: ['Tableau', 'ThoughtSpot', 'Power BI'],
  technologies: ['Snowflake', 'AWS', 'Salesforce', 'Tableau', 'dbt', 'Kafka', 'Databricks'],
  executives: ['CTO (unnamed)'],
  budgets: ['BI modernization budget FY2026'],
  timelines: ['ThoughtSpot POC Q1 2026', 'BI consolidation FY2026'],
};

// ─── Brief Section Parser ────────────────────────────────────────────────────

export interface BriefSection {
  heading: string;
  content: string;
}

/**
 * Normalise a Cortex AI brief string before parsing.
 * Handles: outer quotes, literal "\\n" escapes, curly-quote artefacts.
 */
function normalizeBrief(raw: string): string {
  let s = raw;
  // Strip outer double-quotes if present (Snowflake sometimes wraps in quotes)
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
  }
  // Replace literal escaped newlines with real ones
  s = s.replace(/\\n/g, '\n');
  // Collapse 3+ newlines to 2
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/**
 * Parse a generated TDR brief into sections by numbered headers.
 * Expected format: "**1. Executive Summary**\n\n<content>\n\n**2. ..."
 */
export function parseBriefSections(raw: string): BriefSection[] {
  if (!raw) return [];

  const brief = normalizeBrief(raw);

  // Split on numbered section headers like "**1. ..." or "1. ..."
  const sectionRegex = /(?:^|\n)\s*\*{0,2}\s*(\d+)\.\s+(.+?)\s*\*{0,2}\s*\n/g;
  const sections: BriefSection[] = [];
  const matches: { index: number; fullLen: number; heading: string }[] = [];

  let match;
  while ((match = sectionRegex.exec(brief)) !== null) {
    matches.push({
      index: match.index,
      fullLen: match[0].length,
      heading: match[2].replace(/\*+/g, '').trim(),
    });
  }

  if (matches.length === 0) {
    // Couldn't parse sections — return as single block
    return [{ heading: 'TDR Brief', content: brief }];
  }

  for (let i = 0; i < matches.length; i++) {
    const contentStart = matches[i].index + matches[i].fullLen;
    const contentEnd = i + 1 < matches.length ? matches[i + 1].index : brief.length;
    const content = brief.substring(contentStart, contentEnd).trim();
    sections.push({ heading: matches[i].heading, content });
  }

  return sections;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const cortexAi = {
  /**
   * Load the most recently cached TDR brief for a session (no token cost).
   */
  async getLatestBrief(sessionId: string): Promise<TDRBrief & { hasBrief?: boolean; createdAt?: string }> {
    if (!isDomoEnvironment()) {
      console.log('[CortexAI] Dev mode: returning cached mock TDR brief');
      return { ...MOCK_BRIEF, hasBrief: true, createdAt: new Date().toISOString() };
    }

    try {
      const raw = await callCodeEngine<unknown>('getLatestBrief', { sessionId });
      const result = extractResult(raw) as Record<string, unknown>;
      if (result.hasBrief === false) {
        return { success: true, hasBrief: false };
      }
      return {
        success: true,
        hasBrief: true,
        brief: (result.brief as string) || '',
        modelUsed: (result.modelUsed as string) || '',
        resultId: (result.resultId as string) || '',
        createdAt: (result.createdAt as string) || '',
      };
    } catch (err: unknown) {
      console.warn('[CortexAI] getLatestBrief failed:', err);
      return { success: false, hasBrief: false };
    }
  },

  /**
   * Generate a structured TDR brief using Snowflake Cortex AI_COMPLETE.
   * Joins session inputs + Sumble tech stack + Perplexity research.
   */
  async generateTDRBrief(sessionId: string): Promise<TDRBrief> {
    if (!isDomoEnvironment()) {
      console.log('[CortexAI] Dev mode: returning mock TDR brief');
      return { ...MOCK_BRIEF };
    }

    const raw = await callCodeEngine<unknown>('generateTDRBrief', { sessionId });
    const result = extractResult(raw) as unknown as TDRBrief;
    return result;
  },

  /**
   * Classify Perplexity findings into TDR-relevant categories.
   * Uses Snowflake Cortex AI_CLASSIFY.
   */
  async classifyFindings(pullId: string): Promise<ClassifiedFindingsResult> {
    if (!isDomoEnvironment()) {
      console.log('[CortexAI] Dev mode: returning mock classified findings');
      return { ...MOCK_CLASSIFIED };
    }

    const raw = await callCodeEngine<unknown>('classifyFindings', { pullId });
    const result = extractResult(raw) as unknown as ClassifiedFindingsResult;
    return result;
  },

  /**
   * Extract entities (competitors, technologies, executives, etc.) from Perplexity research.
   * Uses Snowflake Cortex AI_EXTRACT.
   */
  async extractEntities(pullId: string): Promise<ExtractedEntities> {
    if (!isDomoEnvironment()) {
      console.log('[CortexAI] Dev mode: returning mock extracted entities');
      return { ...MOCK_ENTITIES };
    }

    const raw = await callCodeEngine<unknown>('extractEntities', { pullId });
    const result = extractResult(raw) as unknown as ExtractedEntities;
    return result;
  },
};

