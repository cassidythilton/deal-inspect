/**
 * Cortex AI — Front-end service for Snowflake Cortex AI functions
 *
 * Calls Code Engine functions that execute Snowflake Cortex SQL
 * (AI_COMPLETE, AI_CLASSIFY, AI_EXTRACT, AI_AGG, AI_SUMMARIZE_AGG, AI_SENTIMENT)
 * against stored TDR and account intelligence data.
 *
 * Sprint 7: generateTDRBrief, classifyFindings, extractEntities
 * Sprint 9: getPortfolioInsights, summarizeIntelHistory, getSentimentTrend
 * Sprint 11: findSimilarDeals, askAnalyst
 * Sprint 17.5: extractStructuredTDR
 *
 * @see IMPLEMENTATION_STRATEGY.md Section 7 (Sprint 7), Sprint 9, Sprint 11 & Sprint 17.5
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

// Sprint 9 types
export interface PortfolioInsightsResult {
  success: boolean;
  insights: string;
  dealCount: number;
  error?: string;
}

export interface IntelEvolutionResult {
  success: boolean;
  evolution: string;
  pullCount: number;
  error?: string;
}

export interface SentimentDataPoint {
  iteration: number;
  sentiment: number;   // -1 to +1
  createdAt: string;
}

export interface SentimentTrendResult {
  success: boolean;
  trend: SentimentDataPoint[];
  noInputs?: boolean;  // true when no TDR inputs exist to analyze
  error?: string;
}

// Sprint 11 types
export interface SimilarDeal {
  opportunityId: string;
  accountName: string;
  similarityScore: number;
  sessionId?: string;
}

export interface SimilarDealsResult {
  success: boolean;
  deals: SimilarDeal[];
  error?: string;
}

export interface AnalystResult {
  success: boolean;
  sql?: string | null;
  columns: string[];
  rows: Record<string, unknown>[];
  answer?: string;
  error?: string;
}

export interface StructuredExtractResult {
  success: boolean;
  extractId?: string;
  structured?: {
    THESIS?: string | null;
    STRATEGIC_VALUE?: string | null;
    CLOUD_PLATFORM?: string | null;
    ENTRY_LAYER?: string | null;
    DECISION_TIMELINE?: string | null;
    PARTNER_NAME?: string | null;
    PARTNER_POSTURE?: string | null;
    AI_MATURITY?: string | null;
    VERDICT?: string | null;
    NAMED_COMPETITORS?: string[];
    NAMED_TECHNOLOGIES?: string[];
    NAMED_STAKEHOLDERS?: Array<{ name: string; role: string }>;
    RISK_CATEGORIES?: string[];
    DOMO_USE_CASES?: string[];
    ARCHITECTURAL_PATTERN?: string | null;
    DEAL_COMPLEXITY?: string | null;
    KEY_DIFFERENTIATORS?: string[];
    CUSTOMER_DECISION_TYPE?: string | null;
    URGENCY_DRIVERS?: string[];
    extractionModel?: string | null;
    extractionVersion?: string;
  };
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

// Sprint 9 mocks
const MOCK_PORTFOLIO: PortfolioInsightsResult = {
  success: true,
  insights: `**Portfolio Analysis — 5 Active TDR Sessions**

**1. Technology Patterns**
Three of five deals involve Snowflake as the primary cloud data platform. Two deals have active Databricks evaluations running in parallel. All five accounts use some form of legacy BI (Tableau: 3, Power BI: 2) indicating strong replacement opportunity for Domo.

**2. Competitive Landscape**
Tableau is the dominant incumbent across the portfolio (60% of deals). ThoughtSpot appeared in 2 competitive evaluations — both in the Discovery/Validation stage, suggesting they're entering earlier in the cycle. Power BI is present in 2 accounts but not actively evaluated as a replacement.

**3. Architecture Patterns**
Common theme: accounts are modernizing from on-prem data warehouses to cloud-native stacks. The "Snowflake + dbt + BI Layer" pattern is most common. Domo's positioning should emphasize the unified platform advantage over the fragmented stack approach.

**4. Strategic Recommendations**
- **Accelerate Snowflake co-sell** — 3 of 5 deals have active Snowflake relationships. Leverage partner alignment.
- **Build ThoughtSpot counter-narrative** — Create competitive positioning deck for the 2 deals facing TS evaluation.
- **Consolidation story** — The "single platform" message resonates with accounts moving away from tool sprawl.`,
  dealCount: 5,
};

const MOCK_EVOLUTION: IntelEvolutionResult = {
  success: true,
  evolution: `Intelligence for this account has evolved across 3 research pulls over the past 30 days:

**Pull 1 (Jan 10):** Initial enrichment identified Snowflake, Tableau, and AWS as core technologies. No competitive signals detected. Account appeared stable with no active transformation initiatives.

**Pull 2 (Jan 24):** Perplexity research revealed a newly posted VP of Data Engineering role and 3 data platform engineer positions — indicating a major data infrastructure investment. CTO published a blog post about "democratizing data access" — strong alignment with Domo's messaging.

**Pull 3 (Feb 5):** Latest pull detected ThoughtSpot evaluation (competitive alert). Also found a Snowflake partnership announcement, confirming deepening cloud data commitment. Hiring velocity increased (5 new data roles posted).

**Key Trend:** Account is accelerating its data modernization. Competitive window is narrowing — ThoughtSpot is now in play. Recommend immediate architectural engagement.`,
  pullCount: 3,
};

const MOCK_SENTIMENT: SentimentTrendResult = {
  success: true,
  trend: [
    { iteration: 1, sentiment: 0.35, createdAt: new Date(Date.now() - 14 * 86400000).toISOString() },
    { iteration: 2, sentiment: 0.55, createdAt: new Date(Date.now() - 7 * 86400000).toISOString() },
    { iteration: 3, sentiment: 0.72, createdAt: new Date().toISOString() },
  ],
};

// Sprint 11 mocks
const MOCK_SIMILAR_DEALS: SimilarDealsResult = {
  success: true,
  deals: [
    { opportunityId: 'mock-opp-001', accountName: 'Globex Corporation', similarityScore: 0.89, sessionId: 'mock-sess-001' },
    { opportunityId: 'mock-opp-002', accountName: 'Initech', similarityScore: 0.82, sessionId: 'mock-sess-002' },
    { opportunityId: 'mock-opp-003', accountName: 'Hooli', similarityScore: 0.76, sessionId: undefined },
    { opportunityId: 'mock-opp-004', accountName: 'Pied Piper', similarityScore: 0.71, sessionId: 'mock-sess-004' },
    { opportunityId: 'mock-opp-005', accountName: 'Massive Dynamic', similarityScore: 0.65, sessionId: undefined },
  ],
};

const MOCK_ANALYST: AnalystResult = {
  success: true,
  sql: 'SELECT ACCOUNT_NAME, ACV, STAGE FROM TDR_APP.TDR_DATA.TDR_SESSIONS WHERE STATUS = \'in-progress\' ORDER BY ACV DESC LIMIT 10',
  columns: ['ACCOUNT_NAME', 'ACV', 'STAGE'],
  rows: [
    { ACCOUNT_NAME: 'Acme Corp', ACV: 125000, STAGE: '4: Negotiate' },
    { ACCOUNT_NAME: 'Globex Corp', ACV: 89000, STAGE: '3: Demonstrate Value' },
    { ACCOUNT_NAME: 'Initech', ACV: 67500, STAGE: '2: Discovery' },
  ],
  answer: 'There are 3 active TDR sessions. The highest ACV deal is Acme Corp at $125,000 in the Negotiate stage. Globex Corp follows at $89,000 in Demonstrate Value, and Initech at $67,500 in Discovery.',
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

  // ─── Sprint 9: Portfolio & Sentiment ─────────────────────────────────

  /**
   * Get AI-generated portfolio insights across all manager's TDR sessions.
   * Uses Snowflake AI_AGG to aggregate and analyze deal patterns.
   */
  async getPortfolioInsights(manager: string): Promise<PortfolioInsightsResult> {
    if (!isDomoEnvironment()) {
      console.log('[CortexAI] Dev mode: returning mock portfolio insights');
      return { ...MOCK_PORTFOLIO };
    }

    try {
      const raw = await callCodeEngine<unknown>('getPortfolioInsights', { manager });
      const result = extractResult(raw) as unknown as PortfolioInsightsResult;
      return result;
    } catch (err: unknown) {
      console.error('[CortexAI] getPortfolioInsights failed:', err);
      return { success: false, insights: '', dealCount: 0, error: String(err) };
    }
  },

  /**
   * Get intelligence evolution summary across multiple research pulls.
   * Uses Snowflake AI_SUMMARIZE_AGG to narrate how intel changed over time.
   */
  async summarizeIntelHistory(opportunityId: string): Promise<IntelEvolutionResult> {
    if (!isDomoEnvironment()) {
      console.log('[CortexAI] Dev mode: returning mock intel evolution');
      return { ...MOCK_EVOLUTION };
    }

    try {
      const raw = await callCodeEngine<unknown>('summarizeIntelHistory', { opportunityId });
      const result = extractResult(raw) as unknown as IntelEvolutionResult;
      return result;
    } catch (err: unknown) {
      console.error('[CortexAI] summarizeIntelHistory failed:', err);
      return { success: false, evolution: '', pullCount: 0, error: String(err) };
    }
  },

  /**
   * Get sentiment trend of TDR notes across session iterations.
   * Uses Snowflake AI_SENTIMENT to score each iteration's notes.
   */
  async getSentimentTrend(opportunityId: string): Promise<SentimentTrendResult> {
    if (!isDomoEnvironment()) {
      console.log('[CortexAI] Dev mode: returning mock sentiment trend');
      return { ...MOCK_SENTIMENT };
    }

    try {
      const raw = await callCodeEngine<unknown>('getSentimentTrend', { opportunityId });
      const result = extractResult(raw) as unknown as SentimentTrendResult;
      return result;
    } catch (err: unknown) {
      console.error('[CortexAI] getSentimentTrend failed:', err);
      return { success: false, trend: [], error: String(err) };
    }
  },

  // ─── Sprint 11: Semantic Search & Analyst ─────────────────────────────

  /**
   * Find deals with similar tech profiles and competitive landscapes.
   * Uses AI_EMBED + AI_SIMILARITY to compare enrichment embeddings.
   * Requires at least one Perplexity research pull for the source deal.
   */
  async findSimilarDeals(opportunityId: string): Promise<SimilarDealsResult> {
    if (!isDomoEnvironment()) {
      console.log('[CortexAI] Dev mode: returning mock similar deals');
      return { ...MOCK_SIMILAR_DEALS };
    }

    try {
      const raw = await callCodeEngine<unknown>('findSimilarDeals', { opportunityId });
      const result = extractResult(raw) as unknown as SimilarDealsResult;
      return result;
    } catch (err: unknown) {
      console.error('[CortexAI] findSimilarDeals failed:', err);
      return { success: false, deals: [], error: String(err) };
    }
  },

  /**
   * Ask a natural language question about TDR portfolio data.
   * Uses AI_COMPLETE to generate SQL, execute it, and provide a natural language answer.
   */
  async askAnalyst(question: string): Promise<AnalystResult> {
    if (!isDomoEnvironment()) {
      console.log('[CortexAI] Dev mode: returning mock analyst result');
      return { ...MOCK_ANALYST };
    }

    try {
      const raw = await callCodeEngine<unknown>('askAnalyst', { question });
      const result = extractResult(raw) as unknown as AnalystResult;
      return result;
    } catch (err: unknown) {
      console.error('[CortexAI] askAnalyst failed:', err);
      return { success: false, columns: [], rows: [], error: String(err) };
    }
  },

  /**
   * Extract structured analytical fields from a TDR session.
   * Tier 1: Reads select/dropdown fields directly.
   * Tier 2: Uses Cortex AI to extract entities from free-text fields.
   * Stores results in TDR_STRUCTURED_EXTRACTS (upsert).
   *
   * @param sessionId - The TDR session to extract from
   * @returns Structured extraction result including competitors, technologies, risks, etc.
   */
  async extractStructuredTDR(sessionId: string): Promise<StructuredExtractResult> {
    if (!isDomoEnvironment()) {
      console.log('[CortexAI] Dev mode: returning mock structured extract');
      return {
        success: true,
        extractId: 'mock-extract-id',
        structured: {
          THESIS: 'Mock thesis',
          STRATEGIC_VALUE: 'High',
          CLOUD_PLATFORM: 'Snowflake',
          ENTRY_LAYER: 'Data Integration',
          VERDICT: 'Proceed',
          NAMED_COMPETITORS: ['Tableau', 'Power BI'],
          NAMED_TECHNOLOGIES: ['Snowflake', 'dbt'],
          RISK_CATEGORIES: ['competitive_displacement'],
          DOMO_USE_CASES: ['Dashboards', 'MagicETL'],
          DEAL_COMPLEXITY: 'Moderate',
          ARCHITECTURAL_PATTERN: 'warehouse-first',
          extractionModel: 'llama3.3-70b',
          extractionVersion: 'v1',
        },
      };
    }

    try {
      console.log('[CortexAI] Extracting structured TDR data for session:', sessionId);
      const raw = await callCodeEngine<unknown>('extractStructuredTDR', { sessionId });
      const result = extractResult(raw) as unknown as StructuredExtractResult;
      return result;
    } catch (err: unknown) {
      console.error('[CortexAI] extractStructuredTDR failed:', err);
      return { success: false, error: String(err) };
    }
  },
};

