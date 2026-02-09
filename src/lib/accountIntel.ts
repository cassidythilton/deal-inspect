/**
 * Account Intelligence — Front-end service for Sumble + Perplexity
 *
 * Calls Code Engine functions to enrich accounts (Sumble) and research
 * them on the web (Perplexity). Results are persisted to Snowflake and
 * cached on the front-end to minimize API calls.
 *
 * @see IMPLEMENTATION_STRATEGY.md Sections 7 & 8
 */

import { isDomoEnvironment } from './domo';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SumbleEnrichment {
  success: boolean;
  pullId?: string;
  industry?: string;
  subIndustry?: string;
  employeeCount?: number;
  revenue?: number;
  headquarters?: string;
  technologies?: string[];
  techCategories?: Record<string, string[]>;
  pulledAt?: string;
  error?: string;
}

export interface PerplexityResearch {
  success: boolean;
  pullId?: string;
  summary?: string;
  recentInitiatives?: string[];
  technologySignals?: string[];
  competitiveLandscape?: string[];
  keyInsights?: string[];
  citations?: string[];
  pulledAt?: string;
  error?: string;
}

export interface AccountIntelligence {
  sumble: SumbleEnrichment | null;
  perplexity: PerplexityResearch | null;
  hasSumble: boolean;
  hasPerplexity: boolean;
}

// ─── Code Engine Calling ─────────────────────────────────────────────────────

interface DomoSDK {
  get: (url: string) => Promise<unknown>;
  post: (url: string, body?: unknown) => Promise<unknown>;
  put: (url: string, body?: unknown) => Promise<unknown>;
  delete: (url: string) => Promise<unknown>;
}

function getDomo(): DomoSDK | null {
  const domo = (window as unknown as { domo?: DomoSDK }).domo
    || (globalThis as unknown as { domo?: DomoSDK }).domo;
  return domo || null;
}

const CE_BASE = '/domo/codeengine/v2/packages';

async function callCodeEngine<T>(fnName: string, args: Record<string, unknown> = {}): Promise<T> {
  const domo = getDomo();
  if (!domo) {
    throw new Error(`[AccountIntel] Code Engine not available — no Domo SDK. Function: ${fnName}`);
  }

  const url = `${CE_BASE}/${fnName}`;
  console.log(`[AccountIntel] Calling Code Engine: ${fnName}`, Object.keys(args));

  try {
    const result = await domo.post(url, args);
    console.log(`[AccountIntel] Code Engine raw response for ${fnName}:`, result);
    return result as T;
  } catch (err) {
    console.error(`[AccountIntel] Code Engine call failed: ${fnName}`, err);
    throw err;
  }
}

/**
 * Extract the actual result from potentially SDK-wrapped responses.
 * The SDK's packageMapping wraps returns as { [outputAlias]: returnValue }
 */
function extractResult(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null) {
    const keys = Object.keys(raw);
    // If it's a wrapper with a single key (e.g., { result: { success: true, ... } })
    if (keys.length === 1) {
      const inner = (raw as Record<string, unknown>)[keys[0]];
      if (typeof inner === 'object' && inner !== null && 'success' in inner) {
        return inner as Record<string, unknown>;
      }
    }
    // If it has 'success' directly, return as-is
    if ('success' in raw) {
      return raw as Record<string, unknown>;
    }
  }
  console.warn('[AccountIntel] Unexpected response shape:', raw);
  return raw as Record<string, unknown>;
}

// ─── Mock data for dev mode ──────────────────────────────────────────────────

const MOCK_SUMBLE: SumbleEnrichment = {
  success: true,
  pullId: 'mock-sumble-001',
  industry: 'Technology',
  subIndustry: 'Enterprise Software',
  employeeCount: 5000,
  revenue: 800000000,
  headquarters: 'San Francisco, CA',
  technologies: ['Snowflake', 'Tableau', 'AWS', 'Kafka', 'dbt', 'Salesforce', 'Databricks'],
  techCategories: {
    BI: ['Tableau'],
    DW: ['Snowflake', 'Databricks'],
    ETL: ['dbt'],
    Cloud: ['AWS'],
    ML: [],
    Other: ['Kafka', 'Salesforce'],
  },
  pulledAt: new Date().toISOString(),
};

const MOCK_PERPLEXITY: PerplexityResearch = {
  success: true,
  pullId: 'mock-pplx-001',
  summary: 'This company is a mid-market enterprise software firm investing heavily in cloud data infrastructure. They recently migrated from on-prem Teradata to Snowflake and are evaluating BI consolidation.',
  recentInitiatives: [
    'Cloud migration from Teradata to Snowflake (completed Q3 2025)',
    'Evaluating consolidated BI platform to replace Tableau + internal tools',
    'Launched AI/ML practice with focus on predictive analytics',
  ],
  technologySignals: [
    'Heavy Snowflake investment (Enterprise tier)',
    'Using dbt for transformation layer',
    'AWS as primary cloud provider',
    'Kafka for real-time event streaming',
  ],
  competitiveLandscape: [
    'Currently using Tableau for executive dashboards',
    'Power BI evaluated but rejected in 2024',
    'ThoughtSpot POC planned for Q1 2026',
  ],
  keyInsights: [
    'CTO publicly stated goal of "single pane of glass" for data visibility',
    'Budget allocated for BI modernization in FY2026',
    'Strong existing Snowflake relationship — joint reference customer',
  ],
  citations: [
    'https://example.com/company-cloud-migration',
    'https://example.com/cto-interview-2025',
  ],
  pulledAt: new Date().toISOString(),
};

// ─── Public API ──────────────────────────────────────────────────────────────

export const accountIntel = {
  /**
   * Enrich an account via Sumble API.
   * Persists results to Snowflake and returns parsed enrichment.
   */
  async enrichSumble(
    opportunityId: string,
    accountName: string,
    domain: string,
    calledBy: string = 'current-user'
  ): Promise<SumbleEnrichment> {
    if (!isDomoEnvironment()) {
      console.log('[AccountIntel] Dev mode: returning mock Sumble data');
      return { ...MOCK_SUMBLE, pulledAt: new Date().toISOString() };
    }

    const raw = await callCodeEngine<unknown>('enrichSumble', {
      opportunityId,
      accountName,
      domain,
      calledBy,
    });

    const result = extractResult(raw) as SumbleEnrichment;
    return result;
  },

  /**
   * Research an account via Perplexity Sonar API.
   * Persists results to Snowflake and returns parsed research.
   */
  async researchPerplexity(
    opportunityId: string,
    accountName: string,
    dealContext: { acv?: number; stage?: string; partnersInvolved?: string },
    calledBy: string = 'current-user'
  ): Promise<PerplexityResearch> {
    if (!isDomoEnvironment()) {
      console.log('[AccountIntel] Dev mode: returning mock Perplexity data');
      return { ...MOCK_PERPLEXITY, pulledAt: new Date().toISOString() };
    }

    const raw = await callCodeEngine<unknown>('researchPerplexity', {
      opportunityId,
      accountName,
      dealContext,
      calledBy,
    });

    const result = extractResult(raw) as PerplexityResearch;
    return result;
  },

  /**
   * Get cached intelligence for an opportunity (no API calls).
   * Returns the latest Sumble + Perplexity data from Snowflake.
   */
  async getLatestIntel(opportunityId: string): Promise<AccountIntelligence> {
    if (!isDomoEnvironment()) {
      console.log('[AccountIntel] Dev mode: returning empty intel (no cache)');
      return { sumble: null, perplexity: null, hasSumble: false, hasPerplexity: false };
    }

    try {
      const raw = await callCodeEngine<unknown>('getLatestIntel', { opportunityId });
      const result = extractResult(raw) as Record<string, unknown>;

      return {
        sumble: (result.sumble as SumbleEnrichment) || null,
        perplexity: (result.perplexity as PerplexityResearch) || null,
        hasSumble: !!result.hasSumble,
        hasPerplexity: !!result.hasPerplexity,
      };
    } catch (err) {
      console.warn('[AccountIntel] Failed to load cached intel:', err);
      return { sumble: null, perplexity: null, hasSumble: false, hasPerplexity: false };
    }
  },

  /**
   * Get all intel pulls for an opportunity (for history view).
   */
  async getIntelHistory(opportunityId: string): Promise<Record<string, unknown>[]> {
    if (!isDomoEnvironment()) {
      return [];
    }

    try {
      const raw = await callCodeEngine<unknown>('getIntelHistory', { opportunityId });
      if (Array.isArray(raw)) return raw as Record<string, unknown>[];
      const result = extractResult(raw);
      if (Array.isArray(result)) return result;
      return [];
    } catch (err) {
      console.warn('[AccountIntel] Failed to load intel history:', err);
      return [];
    }
  },

  /**
   * Heuristic to derive a domain from an account name.
   * e.g., "Acme Corporation" → "acme.com"
   */
  guessDomain(accountName: string): string {
    if (!accountName) return '';
    const cleaned = accountName
      .toLowerCase()
      .replace(/\s*(inc\.?|corp\.?|corporation|llc|ltd\.?|co\.?|group|holdings|technologies|technology|tech|solutions|services|systems|software|enterprises?|partners?)\s*/gi, '')
      .trim()
      .replace(/[^a-z0-9]/g, '');
    return cleaned ? `${cleaned}.com` : '';
  },
};

