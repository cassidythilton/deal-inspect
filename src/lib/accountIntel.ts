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

export interface SumbleTechDetail {
  name: string;
  last_job_post: string | null;
  jobs_count: number;
  jobs_data_url: string;
  people_count: number;
  people_data_url: string;
  teams_count: number;
  teams_data_url: string;
}

export interface SumbleEnrichment {
  success: boolean;
  pullId?: string;
  // Organization identity (from Sumble)
  orgName?: string;
  orgDomain?: string;
  orgId?: number;
  // Technology signals
  technologiesFound?: string;
  technologiesCount?: number;
  sourceDataUrl?: string;
  creditsUsed?: number;
  creditsRemaining?: number;
  technologies?: string[];
  techDetails?: SumbleTechDetail[];
  techCategories?: Record<string, string[]>;
  pulledAt?: string;
  error?: string;
  // Legacy firmographic fields (not returned by Sumble enrich endpoint)
  industry?: string;
  subIndustry?: string;
  employeeCount?: number;
  revenue?: number;
  headquarters?: string;
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
 * e.g., { result: { success: true, ... } } or { intel: { sumble: null, ... } }
 */
function extractResult(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null) {
    // If it has 'success' directly, return as-is (already unwrapped)
    if ('success' in raw) {
      return raw as Record<string, unknown>;
    }
    const keys = Object.keys(raw);
    // Single-key wrapper from SDK packageMapping — always unwrap
    if (keys.length === 1) {
      const inner = (raw as Record<string, unknown>)[keys[0]];
      if (typeof inner === 'object' && inner !== null) {
        return inner as Record<string, unknown>;
      }
    }
  }
  console.warn('[AccountIntel] Unexpected response shape:', raw);
  return raw as Record<string, unknown>;
}

// ─── Mock data for dev mode ──────────────────────────────────────────────────

const MOCK_SUMBLE: SumbleEnrichment = {
  success: true,
  pullId: 'mock-sumble-001',
  orgName: 'Acme Corp',
  orgDomain: 'acme.com',
  orgId: 12345,
  technologiesFound: 'AWS, Snowflake, Salesforce, Tableau, dbt, Kafka, Databricks',
  technologiesCount: 7,
  sourceDataUrl: 'https://sumble.com/l/org/mock',
  creditsUsed: 35,
  creditsRemaining: 465,
  technologies: ['AWS', 'Snowflake', 'Salesforce', 'Tableau', 'dbt', 'Kafka', 'Databricks'],
  techDetails: [
    { name: 'AWS', last_job_post: '2026-02-01', jobs_count: 120, people_count: 340, teams_count: 45, jobs_data_url: '#', people_data_url: '#', teams_data_url: '#' },
    { name: 'Snowflake', last_job_post: '2026-01-28', jobs_count: 45, people_count: 80, teams_count: 12, jobs_data_url: '#', people_data_url: '#', teams_data_url: '#' },
    { name: 'Salesforce', last_job_post: '2026-02-05', jobs_count: 60, people_count: 150, teams_count: 20, jobs_data_url: '#', people_data_url: '#', teams_data_url: '#' },
    { name: 'Tableau', last_job_post: '2025-11-15', jobs_count: 15, people_count: 50, teams_count: 8, jobs_data_url: '#', people_data_url: '#', teams_data_url: '#' },
    { name: 'dbt', last_job_post: '2026-01-20', jobs_count: 10, people_count: 20, teams_count: 5, jobs_data_url: '#', people_data_url: '#', teams_data_url: '#' },
    { name: 'Kafka', last_job_post: '2025-12-10', jobs_count: 8, people_count: 15, teams_count: 3, jobs_data_url: '#', people_data_url: '#', teams_data_url: '#' },
    { name: 'Databricks', last_job_post: '2026-01-30', jobs_count: 25, people_count: 40, teams_count: 10, jobs_data_url: '#', people_data_url: '#', teams_data_url: '#' },
  ],
  techCategories: {
    CRM: ['Salesforce'],
    BI: ['Tableau'],
    DW: ['Snowflake', 'Databricks'],
    ETL: ['dbt', 'Kafka'],
    Cloud: ['AWS'],
    ML: [],
    ERP: [],
    DevOps: [],
    Other: [],
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

    const result = extractResult(raw) as unknown as SumbleEnrichment;
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

    const result = extractResult(raw) as unknown as PerplexityResearch;
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

      // SDK wraps as { history: [...] } or { history: null }
      if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        // Direct .history (SDK alias)
        if (Array.isArray(obj.history)) return obj.history as Record<string, unknown>[];
        // Null/empty from Snowflake = no history
        if (obj.history === null || obj.history === undefined) return [];
      }

      const result = extractResult(raw);
      if (Array.isArray(result)) return result;
      return [];
    } catch (err) {
      console.warn('[AccountIntel] Failed to load intel history:', err);
      return [];
    }
  },

  /**
   * Get all opportunity IDs that have cached intel (Sumble or Perplexity).
   * Used for the deals table indicator icon.
   */
  async getDealsWithIntel(): Promise<Set<string>> {
    if (!isDomoEnvironment()) {
      return new Set();
    }

    try {
      const raw = await callCodeEngine<unknown>('getDealsWithIntel');
      const result = extractResult(raw);
      const ids = (result.opportunityIds as string[]) || [];
      return new Set(ids);
    } catch (err) {
      console.warn('[AccountIntel] Failed to load deals with intel:', err);
      return new Set();
    }
  },

  /**
   * Get API usage stats for a given month (YYYY-MM format).
   * Returns call counts, error counts, avg duration per service.
   */
  async getUsageStats(month?: string): Promise<Record<string, unknown>> {
    if (!isDomoEnvironment()) {
      return {
        month: month || new Date().toISOString().substring(0, 7),
        sumble: { calls: 3, errors: 0, avgDurationMs: 1200 },
        perplexity: { calls: 5, errors: 1, avgDurationMs: 3400 },
      };
    }

    try {
      const raw = await callCodeEngine<unknown>('getUsageStats', { month: month || null });
      const result = extractResult(raw);
      return result;
    } catch (err) {
      console.warn('[AccountIntel] Failed to load usage stats:', err);
      return { month: month || 'unknown', error: 'Failed to load' };
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

